import dotenv from "dotenv";

dotenv.config();

function requireJwtSecret(raw: string | undefined): string {
  const secret = raw ?? "";
  if (secret.length < 32) {
    throw new Error(
      "JWT_SECRET must be set and at least 32 characters long. " +
        "Refusing to start with an empty or weak secret, which would allow " +
        "anyone to forge authentication tokens. Generate one with, e.g.: " +
        "openssl rand -base64 48"
    );
  }
  return secret;
}

function requireKycEncryptionKey(raw: string | undefined): string {
  const key = raw ?? "";
  // AES-256-GCM needs a 32-byte key; it is supplied base64-encoded in env.
  try {
    const decoded = Buffer.from(key, "base64");
    if (decoded.length !== 32) {
      throw new Error("decoded length mismatch");
    }
    return key;
  } catch {
    throw new Error(
      "KYC_ENCRYPTION_KEY must be set to a base64-encoded 32-byte key. " +
        "Generate one with, e.g.: openssl rand -base64 32"
    );
  }
}

function requireNonEmpty(raw: string | undefined, name: string): string {
  const value = (raw ?? "").trim();
  if (!value) {
    throw new Error(
      `${name} must be set. Refusing to start without it. ` +
        "Set it in the environment (Render dashboard / .env) before booting."
    );
  }
  return value;
}

function requireFrontendUrl(raw: string | undefined): string {
  const value = requireNonEmpty(raw, "FRONTEND_URL");
  // In production a localhost origin would make CORS reject the real frontend
  // and produce broken email links — never let it slip through by default.
  if (
    process.env.NODE_ENV === "production" &&
    /localhost|127\.0\.0\.1/.test(value)
  ) {
    throw new Error(
      "FRONTEND_URL must not be a localhost/127.0.0.1 value in production. " +
        "Set it to the actual deployed frontend origin (e.g. " +
        "https://nookly.vercel.app)."
    );
  }
  return value;
}

function requireDatabaseUrl(raw: string | undefined): string {
  return requireNonEmpty(raw, "DATABASE_URL");
}

/* Allowed browser origins. FRONTEND_URL may be a single origin or a
   comma-separated list. Because "localhost" and "127.0.0.1" are commonly
   used interchangeably during local development, each configured origin
   also implies its loopback alias. */
export function parseFrontendOrigins(raw: string | undefined): string[] {
  const origins = (raw ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const aliases: string[] = [];
  for (const origin of origins) {
    if (origin.includes("localhost")) {
      aliases.push(origin.replace("localhost", "127.0.0.1"));
    } else if (origin.includes("127.0.0.1")) {
      aliases.push(origin.replace("127.0.0.1", "localhost"));
    }
  }
  return [...new Set([...origins, ...aliases])];
}

// Validate FRONTEND_URL once and reuse for both CORS origins and email links.
const frontendUrl = requireFrontendUrl(process.env.FRONTEND_URL);

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: requireJwtSecret(process.env.JWT_SECRET),
  kycEncryptionKey: requireKycEncryptionKey(process.env.KYC_ENCRYPTION_KEY),
  databaseUrl: requireDatabaseUrl(process.env.DATABASE_URL),
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? "admin@nookly.local",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "Nookly <noreply@nookly.local>",
  // Cloudflare R2 (S3-compatible object storage).
  r2AccountId: requireNonEmpty(process.env.R2_ACCOUNT_ID, "R2_ACCOUNT_ID"),
  r2AccessKeyId: requireNonEmpty(process.env.R2_ACCESS_KEY_ID, "R2_ACCESS_KEY_ID"),
  r2SecretAccessKey: requireNonEmpty(
    process.env.R2_SECRET_ACCESS_KEY,
    "R2_SECRET_ACCESS_KEY"
  ),
  r2BucketPublic: requireNonEmpty(process.env.R2_BUCKET_PUBLIC, "R2_BUCKET_PUBLIC"),
  r2BucketPrivate: requireNonEmpty(
    process.env.R2_BUCKET_PRIVATE,
    "R2_BUCKET_PRIVATE"
  ),
  r2PublicUrl: requireNonEmpty(process.env.R2_PUBLIC_URL, "R2_PUBLIC_URL"),
  frontendOrigins: parseFrontendOrigins(frontendUrl),
  frontendUrl: frontendUrl.split(",")[0].trim(),
  supportEmail: process.env.SUPPORT_EMAIL ?? "support@nookly.local",
};
