/**
 * Central typed configuration loaded from environment variables.
 * Consumed via `ConfigService` throughout the app.
 */
export interface AppConfig {
  env: string;
  port: number;
  corsOrigins: string[];
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
    synchronize: boolean;
    logging: boolean;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    resetTokenTtl: number;
  };
  seedOnBoot: boolean;
  spaces: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    cdnUrl: string;
  };
  import: {
    timeoutMs: number;
    userAgent: string;
  };
  email: {
    resendApiKey: string;
    from: string;
    appName: string;
  };
  throttle: {
    ttl: number;
    limit: number;
  };
}

const toBool = (v: string | undefined, fallback = false): boolean =>
  v === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());

const toInt = (v: string | undefined, fallback: number): number => {
  const n = parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: toInt(process.env.PORT, 4000),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: toInt(process.env.DATABASE_PORT, 5434),
    user: process.env.DATABASE_USER ?? 'foundry',
    password: process.env.DATABASE_PASSWORD ?? 'foundry_secret',
    name: process.env.DATABASE_NAME ?? 'foundry_hub',
    synchronize: toBool(process.env.DB_SYNC, true),
    logging: toBool(process.env.DB_LOGGING, false),
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: toInt(process.env.REDIS_PORT, 6380),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    resetTokenTtl: toInt(process.env.RESET_TOKEN_TTL, 3600),
  },
  seedOnBoot: toBool(process.env.SEED_ON_BOOT, true),
  spaces: {
    endpoint: process.env.DO_SPACES_ENDPOINT ?? '',
    region: process.env.DO_SPACES_REGION ?? 'us-east-1',
    bucket: process.env.DO_SPACES_BUCKET ?? '',
    accessKey: process.env.DO_SPACES_ACCESS_KEY_ID ?? '',
    secretKey: process.env.DO_SPACES_SECRET_ACCESS_KEY ?? '',
    cdnUrl: process.env.DO_SPACES_CDN_URL ?? '',
  },
  import: {
    timeoutMs: toInt(process.env.IMPORT_TIMEOUT_MS, 10000),
    userAgent:
      process.env.IMPORT_USER_AGENT ??
      'FoundryHubBot/1.0 (+https://foundry-hub.dev)',
  },
  email: {
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    from: process.env.EMAIL_FROM ?? 'Foundry Hub <no-reply@foundry-hub.dev>',
    appName: process.env.APP_NAME ?? 'Foundry Hub',
  },
  throttle: {
    ttl: toInt(process.env.THROTTLE_TTL, 60),
    limit: toInt(process.env.THROTTLE_LIMIT, 120),
  },
});
