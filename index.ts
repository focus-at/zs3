import type {
  ZS3Client,
  ZS3Config,
  ZS3GetOptions,
  ZS3Options,
  ZS3PutOptions,
  ZS3RequestOptions,
} from "./types.ts";

const { subtle } = crypto;
const { assign, keys } = Object;
const DEFAULT_PROTOCOL = (globalThis.location?.protocol || 'https');
const ALG_NAME = ('HMAC' + '');
const ALG_HASH = ('SHA-256' + '');
const AWS4 = ('AWS4' + '');
const AWS_REQUEST = ('aws4_request' + '');
const X = ('X-Amz-' + '');
const NEW_LINE = ('\n' + '');
const UNSIGNED = ('UNSIGNED-PAYLOAD' + '');
const CREDENTIAL = ('Credential' + '');
const SIGNATURE = ('Signature' + '');
const S_HEADERS = ('SignedHeaders' + '');
const SIGN_P = [AWS4, ALG_NAME, 'SHA256'].join('-');
const RE_ISO_DATE = /[:-]|\.\d{3}/g;
const RE_XML_TAGS = /<(\w[-\w]*)(?:\/|[^>]*>((?:(?!<\1)[\s\S])*)<\/\1)>/gm;
const RE_DASH_CASE = /\B[A-Z]/g;
const RE_ENCODE_URI = /[!'()*]/g;

const encoder = new TextEncoder();

const toArrayBuffer = (d: any): ArrayBuffer =>
  d instanceof ArrayBuffer ? d : (d?.buffer?.constructor === ArrayBuffer ? d : encoder.encode(d ?? '')).buffer;

export const toHex = (buf: ArrayBuffer | Uint8Array): string =>
  new Uint8Array(buf).reduce((acc, b) => acc + b.toString(16).padStart(2, '0'), '')

export const chainHmac = (key: any, ...steps: string[]) =>
  steps.reduce(async (k, step) => {
    const cryptoKey = await subtle.importKey('raw', toArrayBuffer(await k), { name: ALG_NAME, hash: ALG_HASH }, false, ['sign']);
    return subtle.sign(ALG_NAME, cryptoKey, encoder.encode(step));
  }, key).then(toHex);

export const hash = async (data: any) => toHex(await subtle.digest(ALG_HASH, toArrayBuffer(data)));

const toKebabCase = (str: string): string =>
  str.replace(RE_DASH_CASE, "-$&").toLowerCase();

const toDashKV = (source: any, prefix = '', res: Record<string, string> = {}) => {
  for (const k in source) source[k] && (res[toKebabCase(prefix + k)] = String(source[k]));
  return res;
};

const awsEncodeURI = (str: string): string =>
  encodeURIComponent(str).replace(RE_ENCODE_URI, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

// Converts a XML string into an object.
const parseXml = (str: string): any => {
  const types: Record<string, any> = { "": "", "true": true, "false": false };
  const m = [...str.matchAll(RE_XML_TAGS)];

  if (!m.length) {
    return types[str] ?? (isNaN(+str) || str === "" ? str : +str);
  }

  const currentLevelTags = m.reduce((acc: any, [, key = '', content = '']) => {
    let value = parseXml(content);

    if (key === "ETag") {
      value = value.replace(/"/g, '');
    }

    if (acc[key] != null) {
      acc[key] = Array.isArray(acc[key]) ? [...acc[key], value] : [acc[key], value];
    } else {
      acc[key] = value;
    }

    return acc;
  }, {});

  const root = keys(currentLevelTags);
  const data = root.length === 1 ? currentLevelTags[root[0] as string] : currentLevelTags;

  if (!Array.isArray(data?.Contents ?? [])) {
    data.Contents = [data.Contents];
  }

  return data;
};

export function zs3({ region = 'us-east-1', parser = parseXml, ...config }: ZS3Config): ZS3Client {
  const { endpoint, accessKeyId, secretAccessKey, sessionToken } = config;
  const [,protocol = DEFAULT_PROTOCOL, host = ''] = endpoint?.match(/^(?:([^/:]+)?:\/\/)?([^/:]+)/) || [];

  const prepare = async (req: ZS3RequestOptions, options: ZS3Options & { expiresIn?: number } = {}, isPresigned = false) => {
    const { method, body, maxKeys = 1000, prefix = '', bucket = config.bucket || '', key = '' } = req as ZS3RequestOptions & (ZS3PutOptions & ZS3GetOptions);
    const pathname = `/${bucket}${bucket && key ? '/' : ''}${key}` || '/';
    const requestUrl = new URL(pathname, `${protocol}://${host}`);
    const isoDate = new Date().toISOString().replace(RE_ISO_DATE, '');
    const sDate = isoDate.slice(0, 8);
    const scope = `${sDate}/${region}/s3/${AWS_REQUEST}`;
    const credential = `${accessKeyId}/${scope}`;
    const isStream = body?.getReader;
    const payloadHash = isPresigned || isStream ? UNSIGNED : await hash(body || '');
    const query = {
      ...(options.query || {}),
      ...((method === 'GET' && !req.key) && { 'list-type': 2, maxKeys, prefix }), // TODO maxKeys or max-keys
      ...(isPresigned && { [X + 'Expires']: options.expiresIn ?? 900 })
    };

    const headers: Record<string, string> = toDashKV(options.headers, '', {
      host,
      [X + 'content-sha256']: payloadHash,
      ...(body && !isStream ? { 'content-length': String(toArrayBuffer(body).byteLength) } : {}),
    });

    toDashKV(options.meta, X + 'meta-', headers);

    assign(isPresigned ? query : headers, {
      [X + 'Date']: isoDate,
      [X + 'Algorithm']: SIGN_P,
      [X + CREDENTIAL]: credential,
      ...(sessionToken && { [X + 'Security-Token']: sessionToken }),
      ...(isPresigned && { [X + S_HEADERS]: 'host' })
    });

    const sortedQuery = keys(query).sort().map(k =>
      `${awsEncodeURI(isPresigned ? k : toKebabCase(k))}=${awsEncodeURI(query[k] ?? '')}`
    ).join('&');

    const sortedHeaders = keys(headers).sort();
    const signature = await chainHmac(
      `${AWS4}${secretAccessKey}`,
      sDate,
      region,
      's3',
      AWS_REQUEST,
      [
        SIGN_P,
        isoDate,
        scope,
        await hash([
          method,
          pathname,
          sortedQuery,
          ...(isPresigned
            ? [`host:${host}`, '', 'host', UNSIGNED]
            : [
              sortedHeaders.map(k => `${k}:${headers[k]?.trim()}`).join(NEW_LINE),
              '',
              sortedHeaders.join(';'),
              payloadHash
            ])
        ].join(NEW_LINE))
      ].join(NEW_LINE)
    );

    requestUrl.search = sortedQuery;

    if (isPresigned) {
      requestUrl.searchParams.append(X + SIGNATURE, signature);
    } else {
      headers['Authorization'] = `${SIGN_P} ${CREDENTIAL}=${credential}, ${S_HEADERS}=${sortedHeaders.join(';')}, ${SIGNATURE}=${signature}`;
    }

    return { requestUrl, headers, body, method };
  };

  return {
    sign: (req, options) => prepare(req, options, true).then(r => r.requestUrl),
    exec: (req, options) => prepare(req, options, false).then(({ requestUrl, ...init }) =>
      fetch(requestUrl, init)
        .then(res => assign(res, { json: () => res.text().then(parser) }))
        .catch((err: any) => {
          throw {
            Code: err.name,
            Message: err.message
          };
        })
    ),
    clone: (newConfig = {}) => zs3({ region, parser, ...config, ...newConfig })
  };
}
