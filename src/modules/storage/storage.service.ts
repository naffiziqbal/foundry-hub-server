import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';
import { AppConfig } from '../../config/configuration';

/**
 * DigitalOcean Spaces (S3-compatible) storage.
 * Uploads go straight to Spaces; only the returned CDN URL is persisted.
 * If Spaces is not configured, methods throw 503 so the rest of the app runs.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null;
  private readonly cfg: AppConfig['spaces'];

  constructor(config: ConfigService<AppConfig, true>) {
    this.cfg = config.get('spaces', { infer: true });
    if (this.isConfigured()) {
      this.client = new S3Client({
        endpoint: this.cfg.endpoint,
        region: this.cfg.region,
        credentials: {
          accessKeyId: this.cfg.accessKey,
          secretAccessKey: this.cfg.secretKey,
        },
        forcePathStyle: false,
      });
      this.logger.log(`Spaces storage ready (bucket: ${this.cfg.bucket})`);
    } else {
      this.client = null;
      this.logger.warn(
        'Spaces not configured — file uploads disabled (set DO_SPACES_* env vars).',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(
      this.cfg.endpoint &&
        this.cfg.bucket &&
        this.cfg.accessKey &&
        this.cfg.secretKey,
    );
  }

  private ensureClient(): S3Client {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'File storage is not configured. Set DO_SPACES_* environment variables.',
      );
    }
    return this.client;
  }

  /** Build the public URL for a stored key (prefers the CDN base). */
  publicUrl(key: string): string {
    if (this.cfg.cdnUrl) {
      return `${this.cfg.cdnUrl.replace(/\/$/, '')}/${key}`;
    }
    // Fall back to the origin endpoint
    const base = this.cfg.endpoint.replace(/^https?:\/\//, '');
    return `https://${this.cfg.bucket}.${base}/${key}`;
  }

  /**
   * Upload a buffer and return its public CDN URL.
   * @param folder logical prefix, e.g. "products" | "exports" | "attachments"
   */
  async upload(
    buffer: Buffer,
    opts: {
      folder: string;
      filename: string;
      contentType: string;
      acl?: 'public-read' | 'private';
    },
  ): Promise<{ key: string; url: string }> {
    const client = this.ensureClient();
    const safeName = opts.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${opts.folder}/${uuid()}-${safeName}`;

    await client.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: key,
        Body: buffer,
        ContentType: opts.contentType,
        ACL: opts.acl ?? 'public-read',
      }),
    );

    return { key, url: this.publicUrl(key) };
  }

  async delete(key: string): Promise<void> {
    const client = this.ensureClient();
    await client.send(
      new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }),
    );
  }
}
