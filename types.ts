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

export interface ZS3Response<T> extends Response {
  json(): Promise<T>;
}

export interface Bucket {
  Name: string;
  CreationDate: string;
}

export interface Buckets {
  Buckets: {
    Bucket: Bucket | Bucket[];
  };
  Owner: {
    DisplayName: string;
    ID: string;
  };
}

export interface S3Client {
  /** Generate a presigned URL for secure, temporary access to an S3 object */
  sign(req: S3RequestOptions, options?: S3Options & { expiresIn?: number }): Promise<string>;

  /** Execute an S3 request directly (supports GET, PUT, DELETE, HEAD) */
  execute<T = unknown>(req: S3RequestOptions, options?: S3Options): Promise<ZS3Response<T>>;

  /** Create a new client instance by shallow-merging the current config with overrides */
  clone(newConfig?: Partial<S3Config>): S3Client;
}

export interface S3StatResponse extends Record<string, any> {
  size: number;
  mtime: Date;
}
