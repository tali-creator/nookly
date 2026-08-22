// Storage adapter for file uploads — backed by Cloudflare R2 (S3-compatible).
// Public files (business/service photos, avatars, category icons, intro video)
// go to R2_BUCKET_PUBLIC and are served by their public R2 URL. Private files
// (KYC documents: selfie, certificate, proof of address) go to
// R2_BUCKET_PRIVATE and are NEVER exposed via a public URL — they are streamed
// only through the authenticated /kyc/documents/:field and
// /admin/kyc/:userId/documents/:field routes after permission checks.
//
// The exported interface is intentionally stable: routes call the same
// multer middleware (imageUpload/avatarUpload/kycDocumentUpload),
// validateUploadedImage(), toPublicUrl/toPrivateUrl/privateFilePath and the
// delete helpers. Swapping local disk for R2 changed only this file's
// internals. To move to another S3-compatible store, just change the client
// endpoint/credentials.
import path from "path";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import multer from "multer";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./http-error";
import { env } from "../config/env";

// S3-compatible client pointed at Cloudflare R2.
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.r2AccessKeyId,
    secretAccessKey: env.r2SecretAccessKey,
  },
  forcePathStyle: true,
});

const NO_STORE = "private, no-store";

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_PHOTOS_PER_BUSINESS = 6;
export const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

// Magic-byte signatures for the image types we accept, checked against the
// ACTUAL file bytes rather than the client-supplied Content-Type. (multer 2.x
// does not expose the upload stream during fileFilter, so validation runs on
// the in-memory buffer after upload instead.) A mismatch is rejected even if
// the declared Content-Type / extension claims to be an image.
const MAGIC_BYTE_JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const MAGIC_BYTE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// WebP: "RIFF" + 4 bytes size + "WEBP"
const MAGIC_BYTE_RIFF = Buffer.from("RIFF");
const MAGIC_BYTE_WEBP = Buffer.from("WEBP");

const MAGIC_BYTE_MIME: Array<{ mime: string; bytes: Buffer; offset: number }> = [
  { mime: "image/jpeg", bytes: MAGIC_BYTE_JPEG, offset: 0 },
  { mime: "image/png", bytes: MAGIC_BYTE_PNG, offset: 0 },
  { mime: "image/webp", bytes: MAGIC_BYTE_RIFF, offset: 0 },
  { mime: "image/webp", bytes: MAGIC_BYTE_WEBP, offset: 8 },
];

// Reads enough of the buffer to decide whether its contents match a real image.
function detectImageMimeFromBuffer(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  const probe = buf.subarray(0, 12);
  for (const sig of MAGIC_BYTE_MIME) {
    if (
      probe.subarray(sig.offset, sig.offset + sig.bytes.length).equals(sig.bytes)
    ) {
      return sig.mime;
    }
  }
  return null;
}

// Express middleware to run AFTER a multer upload middleware. Inspects each
// uploaded file's magic bytes and rejects (deleting the already-uploaded R2
// objects) if the actual contents are not a real JPEG/PNG/WebP — regardless of
// declared Content-Type or extension. Must be mounted before the controller on
// every upload route. Handles both upload.single() (req.file) and
// upload.fields() (req.files).
export function validateUploadedImage(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const files: Express.Multer.File[] = [];
  if (req.file) files.push(req.file);
  const fields = req.files as
    | Record<string, Express.Multer.File[]>
    | Express.Multer.File[]
    | undefined;
  if (fields) {
    if (Array.isArray(fields)) {
      files.push(...fields);
    } else {
      for (const list of Object.values(fields)) {
        files.push(...list);
      }
    }
  }

  for (const file of files) {
    const detected = detectImageMimeFromBuffer(file.buffer);
    if (!detected) {
      // Clean up EVERY object this request uploaded so a rejection never
      // leaves orphaned objects in the bucket.
      for (const f of files) {
        deleteR2Object((f as StoredFile).bucket ?? "public", (f as StoredFile).key);
      }
      res
        .status(400)
        .json({ error: "File contents are not a valid JPEG, PNG, or WebP image" });
      return;
    }
  }
  next();
}

type Bucket = "public" | "private";

interface StoredFile extends Express.Multer.File {
  key?: string;
  bucket?: Bucket;
}

function bucketName(bucket: Bucket): string {
  return bucket === "public" ? env.r2BucketPublic : env.r2BucketPrivate;
}

function deleteR2Object(bucket: Bucket, key?: string): void {
  if (!key) return;
  s3
    .send(new DeleteObjectCommand({ Bucket: bucketName(bucket), Key: key }))
    .catch(() => {});
}

// A multer storage engine that uploads each file directly to R2 and records the
// assigned key on the file object, so downstream code (toPublicUrl, deletes,
// private streaming) can locate the object without ever touching local disk.
class R2Storage implements multer.StorageEngine {
  constructor(private bucket: Bucket) {}

  _handleFile(
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, info?: Partial<Express.Multer.File>) => void
  ): void {
    const ext = EXTENSION_BY_MIME[file.mimetype] ?? ".jpg";
    const key = `${randomUUID()}${ext}`;
    const chunks: Buffer[] = [];
    file.stream.on("data", (c) => chunks.push(c as Buffer));
    file.stream.on("error", (err) => cb(err as Error));
    file.stream.on("end", () => {
      const body = Buffer.concat(chunks);
      s3
        .send(
          new PutObjectCommand({
            Bucket: bucketName(this.bucket),
            Key: key,
            Body: body,
            ContentType: file.mimetype,
          })
        )
        .then(() => {
          const stored = file as StoredFile;
          stored.key = key;
          stored.bucket = this.bucket;
          stored.filename = key;
          stored.buffer = body; // keep for validateUploadedImage
          cb(null, file);
        })
        .catch((err) => cb(err as Error));
    });
  }

  _removeFile(
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null) => void
  ): void {
    deleteR2Object((file as StoredFile).bucket ?? "public", (file as StoredFile).key);
    cb(null);
  }
}

function makeImageUpload(bucket: Bucket, maxBytes: number) {
  return multer({
    storage: new R2Storage(bucket),
    limits: { fileSize: maxBytes },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
        return;
      }
      cb(new HttpError(400, "Only JPEG, PNG, or WebP images are allowed"));
    },
  });
}

export const imageUpload = makeImageUpload("public", MAX_FILE_SIZE);
export const avatarUpload = makeImageUpload("public", MAX_AVATAR_SIZE);
export const kycDocumentUpload = makeImageUpload("private", MAX_FILE_SIZE);

export function toPublicUrl(filename: string): string {
  return `${env.r2PublicUrl.replace(/\/$/, "")}/${filename}`;
}

// KYC document URL stored in the DB. It is a private pseudo-URL: clients never
// receive it, and it is never served publicly. It exists so the file can be
// located (via privateFilePath) and streamed by the authenticated document
// routes. The key is the basename.
export function toPrivateUrl(filename: string): string {
  return `/uploads-private/${filename}`;
}

// Resolves a private pseudo-URL to its R2 object key.
export function privateFilePath(privateUrl: string): string {
  return path.basename(privateUrl);
}

export function deleteFileByUrl(publicUrl: string): void {
  deleteR2Object("public", path.basename(publicUrl));
}

export function deletePrivateFile(privateUrl: string): void {
  deleteR2Object("private", privateFilePath(privateUrl));
}

// Deletes a file that was just uploaded via one of the multer middleware
// instances (used to roll back orphaned objects when a request fails
// validation after multer has already written them to R2).
export function deleteUploadedFile(file: Express.Multer.File): void {
  const f = file as StoredFile;
  deleteR2Object(f.bucket ?? "public", f.key);
}

// Streams a private KYC object from R2 through the authenticated response.
// Throws HttpError(404) when the object does not exist, so the calling route's
// existing try/catch surfaces a clean "Document not found".
export async function streamPrivateObject(
  key: string,
  res: Response
): Promise<void> {
  try {
    const obj = await s3.send(
      new GetObjectCommand({ Bucket: env.r2BucketPrivate, Key: key })
    );
    const contentType = obj.ContentType ?? contentTypeFromKey(key);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", NO_STORE);
    const body = obj.Body as Readable;
    body.on("error", () => res.destroy());
    body.pipe(res);
  } catch (err) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) {
      throw new HttpError(404, "Document not found");
    }
    throw err;
  }
}

function contentTypeFromKey(key: string): string {
  const ext = key.slice(key.lastIndexOf(".")).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}
