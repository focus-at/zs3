export interface ZS3Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  bucket?: string;
  region?: string;
  [key: string]: any;
}

export interface ZS3Options {
  headers?: Record<string, string>;
  meta?: Record<string, string>;
  query?: Record<string, string | number | boolean>;
}

export interface ZS3GetOptions {
  key?: string;
  bucket?: string;
  prefix?: string;
  maxKeys?: number;
}

export interface ZS3ObjectOptions extends Pick<ZS3GetOptions, 'bucket'> {
  key: string;
}

export interface ZS3MultipartOptions {
  uploadId?: string;
  partNumber?: number;
  parts?: { partNumber: number; etag: string }[];
}

export interface ZS3PutOptions extends ZS3ObjectOptions, ZS3MultipartOptions {
  body?: any;
}

export type ZS3RequestOptions =
  | ({ method: 'GET' } & ZS3GetOptions)
  | ({ method: 'PUT' } & ZS3PutOptions)
  | ({ method: 'DELETE' } & ZS3ObjectOptions)
  | ({ method: 'HEAD' } & ZS3ObjectOptions)
  | ({ method: 'POST' } & ZS3PutOptions);

export interface ZS3Response<T> extends Response {
  json(): Promise<T>;
}

export interface ZS3Owner {
  ID: string;
  DisplayName?: string;
}

export interface ZS3Bucket {
  Name: string;
  CreationDate: string;
}

export interface ZS3Buckets {
  Buckets: {
    Bucket: ZS3Bucket | ZS3Bucket[];
  };
  Owner: ZS3Owner;
}

export interface ZS3Object {
  Key: string;
  Size: number;
  LastModified?: string;
  ETag?: string;
  StorageClass?: string;
  Owner?: ZS3Owner;
}

export interface ZS3Objects {
  Name?: string;
  Prefix?: string;
  MaxKeys?: number;
  IsTruncated: boolean;
  Contents: ZS3Object[];
  ContinuationToken?: string;
  NextContinuationToken?: string;
  StartAfter?: string;
  KeyCount?: number;
}

export interface ZS3Client {
  /** Generate a presigned URL for secure, temporary access to an S3 object */
  sign(req: ZS3RequestOptions, options?: ZS3Options & { expiresIn?: number }): Promise<string>;

  /** Execute an S3 request directly (supports GET, PUT, DELETE, HEAD) */
  execute<T = unknown>(req: ZS3RequestOptions, options?: ZS3Options): Promise<ZS3Response<T>>;

  /** Create a new client instance by shallow-merging the current config with overrides */
  clone(newConfig?: Partial<ZS3Config>): ZS3Client;
}
