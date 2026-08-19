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

/* Allowed browser origins. FRONTEND_URL may be a single origin or a
   comma-separated list. Because "localhost" and "127.0.0.1" are commonly
   used interchangeably during local development, each configured origin
   also implies its loopback alias. */
export function parseFrontendOrigins(raw: string | undefined): string[] {
  const origins = (raw ?? "http://localhost:3000")
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

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: requireJwtSecret(process.env.JWT_SECRET),
  kycEncryptionKey: requireKycEncryptionKey(process.env.KYC_ENCRYPTION_KEY),
  databaseUrl: process.env.DATABASE_URL ?? "",
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? "admin@nookly.local",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "Nookly <noreply@nookly.local>",
  frontendOrigins: parseFrontendOrigins(process.env.FRONTEND_URL),
  frontendUrl: (process.env.FRONTEND_URL ?? "http://localhost:3000").split(",")[0].trim(),
  supportEmail: process.env.SUPPORT_EMAIL ?? "support@nookly.local",
};
