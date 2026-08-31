import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import path from "path";
import type { StorageAdapter } from "@/lib/storage/types";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Promise.resolve(Buffer.alloc(0));
  if (Buffer.isBuffer(body)) return Promise.resolve(body);
  if (body instanceof Uint8Array) return Promise.resolve(Buffer.from(body));

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = body as NodeJS.ReadableStream;
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

export class R2StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const accountId = requiredEnv("R2_ACCOUNT_ID");
    const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
    const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
    const bucket =
      process.env.R2_BUCKET_NAME?.trim() || process.env.R2_BUCKET?.trim();
    if (!bucket) throw new Error("Missing required environment variable: R2_BUCKET_NAME");
    this.bucket = bucket;
    const endpoint =
      process.env.R2_ENDPOINT?.trim() ||
      `https://${accountId}.r2.cloudflarestorage.com`;

    this.client = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async upload(file: Buffer, fileName: string, mimeType?: string): Promise<string> {
    const ext = path.extname(fileName);
    const key = `${randomUUID()}${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: mimeType ?? "application/octet-stream",
      })
    );

    return key;
  }

  async getUrl(storageKey: string): Promise<string> {
    // Keep auth proxy route — do not expose raw R2 URLs to clients.
    return `/api/files/${encodeURIComponent(storageKey)}`;
  }

  async delete(storageKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      })
    );
  }

  async read(storageKey: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      })
    );

    return streamToBuffer(response.Body);
  }
}

