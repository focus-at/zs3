import type {
  ZS3Client,
  ZS3Config,
  ZS3GetOptions,
  ZS3Options,
  ZS3PutOptions,
  ZS3RequestOptions,
} from "./types.ts";

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
const RE_DASH_CASE = /\B[A-Z]/g;
const RE_ENCODE_URI = /[!'()*]/g;
const LT = 60; // <
const GT = 62; // >
const SLASH = 47; // /
const QUEST = 63; // ?
const EXCL = 33; // !
const TYPES = { "true": true, "false": false, "": "" };
const { subtle } = crypto;
const { assign, keys } = Object;
const decoder = new TextDecoder();
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
  for (const k in source) source[k] && (res[toKebabCase(prefix + k)] = `${source[k]}`);
  return res;
};

const awsEncodeURI = (str: string): string =>
  encodeURIComponent(str).replace(RE_ENCODE_URI, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export const handler = (res: Response) => {
  if (!res?.body) return res;

  return assign(res, {
    json: async () => {
      const reader = res.body?.getReader();
      const stack = [{ data: {}, key: "" }];
      const str = (s: number, e: number) => decoder.decode(buf.subarray(s, e)).trim();

      let buf = new Uint8Array(64 * 1024);
      let bufLen = 0, cursor = 0, textStart = -1;
      let chunk;

      while (!(chunk = await reader?.read())?.done) {
        const value = chunk?.value;
        const required = bufLen + value.length;

        if (required > buf.length) {
          const next = new Uint8Array(Math.max(required, buf.length * 2));
          next.set(buf.subarray(0, bufLen));
          buf = next;
        }

        buf.set(value, bufLen);
        bufLen = required;

        while (cursor < bufLen) {
          if (buf[cursor] === LT) { // '<'
            let end = cursor + 1;
            while (end < bufLen && buf[end] !== GT) end++; // '>'
            if (end === bufLen) break;

            let start = cursor + 1;
            const isClose = buf[start] === SLASH;
            if (isClose) start++;

            if (buf[start] === QUEST || buf[start] === EXCL) {
              cursor = end + 1;
              continue;
            }

            const tag = str(start, end);

            if (!stack[0].key && !isClose) {
              stack[0].key = tag;
              cursor = end + 1;
              continue;
            }

            if (isClose) {
              if (textStart !== -1 && cursor > textStart) {
                const text = str(textStart, cursor);
                const value = TYPES[text] ?? (isNaN(+text) ? text : +text);
                const frame = stack[stack.length - 1];
                const parent = stack[stack.length - 2];

                if (parent) {
                  const siblings = parent.data[frame.key];
                  if (Array.isArray(siblings)) siblings[siblings.length - 1] = value;
                  else parent.data[frame.key] = value;
                }
              }
              if (stack.length > 1) stack.pop();
              textStart = -1;
            } else {
              const current = stack[stack.length - 1].data;
              const node = {};
              const previous = current[tag];

              if (previous === undefined) current[tag] = node;
              else if (Array.isArray(previous)) previous.push(node);
              else current[tag] = [previous, node];

              stack.push({ data: node, key: tag });
              textStart = end + 1;
            }
            cursor = end + 1;
          } else {
            cursor++;
          }
        }

        // Keep the current text bytes until its closing tag so UTF-8 characters
        // split across stream chunks are decoded together.
        const keep = textStart === -1 ? cursor : textStart;
        if (keep > 0) {
          buf.copyWithin(0, keep, bufLen);
          bufLen -= keep;
          cursor -= keep;
          if (textStart !== -1) textStart -= keep;
        }
      }

      return stack[0];
    }
  });
}

export function zs3({ region = 'us-east-1', ...config }: ZS3Config): ZS3Client {
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
      ...(body && !isStream ? { 'content-length': `${toArrayBuffer(body).byteLength}` } : {}),
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
        .then(config.handler || handler)
        .catch((err: any) => {
          throw {
            Code: err.name,
            Message: err.message
          };
        })
    ),
    clone: (newConfig = {}) => zs3({ region, ...config, ...newConfig })
  };
}
