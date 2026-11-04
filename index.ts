import type {
  ZS3Client,
  ZS3Config,
  ZS3GetOptions,
  ZS3Options,
  ZS3PutOptions,
  ZS3RequestOptions,
  ZS3Response,
} from "./types.ts";

const { subtle } = crypto;
const ALG_NAME = ('HMAC' + '');
const ALG_HASH = ('SHA-256' + '');
const AWS4 = ('AWS4' + '');
const X = ('X-Amz-' + '');
const UNSIGNED = ('UNSIGNED-PAYLOAD' + '');
const CREDENTIAL = ('Credential' + '');
const SIGNATURE = ('Signature' + '');
const S_HEADERS = ('SignedHeaders' + '');
const SIGN_P = [AWS4, ALG_NAME, 'SHA256'].join('-');
const RE_ISO_DATE = /[:-]|\.\d{3}/g;
const RE_XML_TAGS = /<(\w[-\w]*)(?:\/|[^>]*>((?:(?!<\1)[\s\S])*)<\/\1)>/gm;
const RE_DASH_CASE = /\B[A-Z]/g;
const RE_ENCODE_URI = /[!'()*]/g;
const RE_LEADING_SLASHES = /^\/*/;

const encoder = new TextEncoder();

const toArrayBuffer = (d: any): ArrayBuffer =>
  d instanceof ArrayBuffer ? d : d?.buffer?.constructor === ArrayBuffer ? d.buffer : encoder.encode(d == null ? '' : `${d}`).buffer;

export const toHex = (buf: ArrayBuffer | Uint8Array):string =>
  Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

export const hmac = async (key: string | Uint8Array | ArrayBuffer, data: string): Promise<Uint8Array> => {
  const cryptoKey = await subtle.importKey('raw', toArrayBuffer(key), { name: ALG_NAME, hash: ALG_HASH}, false, ['sign']);
  return new Uint8Array(await subtle.sign(ALG_NAME, cryptoKey, encoder.encode(data)));
};

export const hash = async (data: any) => toHex(await subtle.digest(ALG_HASH, toArrayBuffer(data)));

const toKebabCase = (str: string): string =>
  str.replace(RE_DASH_CASE, "-$&").toLowerCase();

const assignDashCase = (target: Record<string, string>, source: Record<string, any> | undefined, prefix: string): Record<string, string> => {
  if (source) Object.keys(source).forEach(key => {
    const name = toKebabCase(prefix + key);
    if (source[key] && typeof source[key] !== 'object') target[name] = `${source[key]}`;
  });
  return target;
};

const awsEncodeURI = (str: string): string =>
  encodeURIComponent(str).replace(RE_ENCODE_URI, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

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

  const keys = Object.keys(currentLevelTags);
  const data = keys.length === 1 ? currentLevelTags[keys[0]] : currentLevelTags;

  if (!Array.isArray(data?.Contents ?? [])) {
    data.Contents = [data.Contents];
  }

  return data;
};

export function zs3(opts: ZS3Config): ZS3Client {
  const config = { region: 'us-east-1', bucket: '', ...opts };
  const { endpoint, region, accessKeyId, secretAccessKey, sessionToken } = config;
  const [,protocol = (globalThis.location?.protocol || 'https'), host = ''] = endpoint?.match(/^(?:([^/:]+)?:\/\/)?([^/:]+)/) || [];

  const prepare = async (req: ZS3RequestOptions, options: ZS3Options & { expiresIn?: number } = {}, isPresigned = false) => {
    const { method, body, maxKeys = 1000, prefix = '', bucket = config.bucket } = req as ZS3RequestOptions & (ZS3PutOptions & ZS3GetOptions);
    const cleanKey = req.key?.replace(RE_LEADING_SLASHES, '') ?? '';
    const uri = bucket ? `/${bucket}/${cleanKey}` : `/${cleanKey}`;
    const isoDate = new Date().toISOString().replace(RE_ISO_DATE, '');
    const sDate = isoDate.slice(0, 8);
    const scope = `${sDate}/${region}/s3/aws4_request`;
    const credential = `${accessKeyId}/${scope}`;
    const isStream = body?.getReader;
    const payloadHash = isPresigned || isStream ? UNSIGNED : await hash(body || '');

    const queryObj: Record<string, any> = {
      ...options.query,
      ...((method === 'GET' || !req.key) && { 'list-type': 2, maxKeys, prefix })
    };

    if (isPresigned) {
       queryObj[X + 'Expires'] = options.expiresIn ?? 900;
    }

    const rawHeaders: Record<string, string> = assignDashCase(assignDashCase({
      host,
      [X + 'content-sha256']: payloadHash,
      ...(body && !isStream ? { 'content-length': `${toArrayBuffer(body).byteLength}` } : {})
    }, options.headers, ""), options.meta, X + 'meta-');

    const target = isPresigned ? queryObj : rawHeaders;

    target[X + 'Date'] = isoDate;
    target[X + 'Algorithm'] = SIGN_P;
    target[X + CREDENTIAL] = credential;

    if (sessionToken) target[X + 'Security-Token'] = sessionToken;
    if (isPresigned) target[X + S_HEADERS] = 'host';

    const sortedQuery = Object.entries(queryObj)
      .sort()
      .map(([k, v]) => `${isPresigned ? awsEncodeURI(k) : toKebabCase(k)}=${awsEncodeURI(String(v ?? ''))}`)
      .join('&');

    const headers = Object.fromEntries(Object.entries(rawHeaders).map(([k, v]) => [k.toLowerCase(), v]));
    const sortedHeaders = Object.keys(headers).sort();

    const start = `${method}\n${uri}\n${sortedQuery}\n`;
    const canonical = start + (isPresigned
      ? `host:${host}\n\nhost\n${UNSIGNED}`
      : `${sortedHeaders.map(k => `${k}:${headers[k]?.trim()}`).join('\n')}\n\n${sortedHeaders.join(';')}\n${payloadHash}`
    );
    const kSign = await hmac(await hmac(await hmac(await hmac(`${AWS4}${secretAccessKey}`, sDate), region), 's3'), 'aws4_request');
    const signature = toHex(await hmac(kSign, [SIGN_P, isoDate, scope, await hash(canonical)].join('\n')));

    const requestUrl = new URL(uri, `${protocol}://${host}`);
    if (sortedQuery) requestUrl.search = sortedQuery;

    if (isPresigned) {
       requestUrl.searchParams.append(X + SIGNATURE, signature);
    } else {
      headers['Authorization'] = `${SIGN_P} ${CREDENTIAL}=${credential}, ${S_HEADERS}=${sortedHeaders.join(';')}, ${SIGNATURE}=${signature}`;
    }

    return { requestUrl, headers, body, method };
  };

  const sign = async (req: ZS3RequestOptions, options: ZS3Options & { expiresIn?: number } = {}): Promise<string> => {
    const { requestUrl } = await prepare(req, options, true);
    return requestUrl.toString();
  };

  const execute = async <T = unknown>(req: ZS3RequestOptions, options: ZS3Options = {}): Promise<ZS3Response<T>> => {
    const { requestUrl, ...init } = await prepare(req, options, false);

    try {
      const res = await fetch(requestUrl, init);
      if (!res.ok || (req.method === 'GET' && !req.key) || req.method === 'POST') {
        return Response.json(parseXml((await res.text()).trim()), { status: res.status }) as ZS3Response<T>;
      }

      return res as ZS3Response<T>;
    } catch ({ name, message }: any) {
      throw {
        Code: name,
        Message: message
      };
    }
  };

  return {
    sign,
    execute,
    clone: (newConfig = {}) => zs3({ ...config, ...newConfig })
  };
}
