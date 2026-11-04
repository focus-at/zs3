
export interface S3Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  bucket?: string;
  region?: string;
  [key: string]: any;
}

export interface S3Options {
  headers?: Record<string, string>;
  meta?: Record<string, string>;
  query?: Record<string, string | number | boolean>;
}

export interface S3GetOptions {
  key?: string;
  bucket?: string;
  prefix?: string;
  maxKeys?: number;
}

export interface S3ObjectOptions extends Pick<S3GetOptions, 'bucket'> {
  key: string;
}

export interface S3MultipartOptions {
  uploadId?: string;
  partNumber?: number;
  parts?: { partNumber: number; etag: string }[];
}

export interface S3PutOptions extends S3ObjectOptions, S3MultipartOptions {
  body?: any;
}

export type S3RequestOptions =
  | ({ method: 'GET' } & S3GetOptions)
  | ({ method: 'PUT' } & S3PutOptions)
  | ({ method: 'DELETE' } & S3ObjectOptions)
  | ({ method: 'HEAD' } & S3ObjectOptions)
  | ({ method: 'POST' } & S3PutOptions);

export interface S3Client {
  /** Generate a presigned URL for secure, temporary access to an S3 object */
  sign(req: S3RequestOptions, options?: S3Options & { expiresIn?: number }): Promise<string>;

  /** Execute an S3 request directly (supports GET, PUT, DELETE, HEAD) */
  execute(req: S3RequestOptions, options?: S3Options): Promise<Response>;

  /** Create a new client instance by shallow-merging the current config with overrides */
  clone(newConfig?: Partial<S3Config>): S3Client;
}

export interface S3StatResponse extends Record<string, any> {
  size: number;
  mtime: Date;
}
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
  return m.length ? m.reduce((acc: any, [, key = '', content = '']) => {
    const value = types[content] ?? (isNaN(+content) ? parseXml(content) : +content);
    acc[key] = Array.isArray(acc[key]) ? [...acc[key], value] : acc[key] != null ? [acc[key], value] : key === "Contents" ? [value] : value;
    return acc;
  }, {}) : str;
};

export function zs3(opts: S3Config): S3Client {
  const config = { region: 'us-east-1', bucket: '', ...opts };
  const { endpoint, region, accessKeyId, secretAccessKey, sessionToken } = config;
  const [,protocol = (globalThis.location?.protocol || 'https'), host = ''] = endpoint?.match(/^(?:([^/:]+)?:\/\/)?([^/:]+)/) || [];

  const prepare = async (req: S3RequestOptions, options: S3Options & { expiresIn?: number } = {}, isPresigned = false) => {
    const { method, body, maxKeys = 1000, prefix = '', bucket = config.bucket } = req as S3RequestOptions & (S3PutOptions & S3GetOptions);
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

    return { requestUrl, headers, body };
  };

  const sign = async (req: S3RequestOptions, options: S3Options & { expiresIn?: number } = {}): Promise<string> => {
    const { requestUrl } = await prepare(req, options, true);
    return requestUrl.toString();
  };

  const execute = async (req: S3RequestOptions, options: S3Options = {}): Promise<Response> => {
    const { requestUrl, headers, body } = await prepare(req, options, false);

    try {
      const res = await fetch(requestUrl, { method: req.method, headers, body });

      if (!res.ok || (req.method === 'GET' && !req.key) || req.method === 'POST') {
        let data = parseXml(await res.text());

        if (data && typeof data === 'object') {
          const keys = Object.keys(data);
          if (keys.length === 1) data = data[keys[0] as string];
          if (data.Buckets && data.Buckets.Bucket) {
            data.Buckets = Array.isArray(data.Buckets.Bucket) ? data.Buckets.Bucket : [data.Buckets.Bucket];
          }
        }

        // FIXME если добавлять заголовки то error on line 1 at column 1: Start tag expected, '<' not found
        // FIXME нужны ли нам заголовки для GET, POST ?
        return Response.json(data, { status: res.status });
      }

      return res;
    } catch (err: any) {
      return Response.json(err, { status: err.status });
    }
  };

  return {
    sign,
    execute,
    clone: (newConfig: Partial<S3Config> = {}) => zs3({ ...config, ...newConfig })
  };
}
