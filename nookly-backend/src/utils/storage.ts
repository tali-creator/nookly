// Storage adapter for photo uploads.
// Currently saves files to local disk under /uploads at the project root.
// To switch to Cloudinary/S3 later, reimplement saveFile/deleteFile (and the
// multer config) here — route and controller logic should not change.
//
// Two kinds of storage:
//   - uploadsDir: PUBLIC business/avatar files, served via express.static.
//   - uploadsPrivateDir: KYC documents (selfie, certificate, proof of
//     address). NEVER served statically — files are streamed only through the
//     authenticated /kyc/documents/:field and /admin/kyc/:userId/documents/:field
//     routes after permission checks.
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./http-error";

export const uploadsDir = path.resolve(process.cwd(), "uploads");
export const uploadsUrlPrefix = "/uploads";

export const uploadsPrivateDir = path.resolve(process.cwd(), "uploads-private");

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
// ACTUAL file contents rather than the client-supplied Content-Type. This is
// the equivalent of the `file-type` package for the three formats allowed here
// (that package is ESM-only and this backend is CommonJS, and multer 2.x does
// not expose the upload stream during fileFilter, so validation happens on the
// written file instead). A mismatch is rejected even if the declared
// Content-Type / extension claims to be an image.
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

// Reads enough of the file to decide whether its contents match a real image.
function detectImageMime(filePath: string): string | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, "r");
    const probe = Buffer.alloc(12);
    fs.readSync(fd, probe, 0, probe.length, 0);
    for (const sig of MAGIC_BYTE_MIME) {
      if (probe.subarray(sig.offset, sig.offset + sig.bytes.length).equals(sig.bytes)) {
        return sig.mime;
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
}

// Express middleware to run AFTER a multer upload middleware. Reads each saved
// file's magic bytes and rejects (deleting the file) if the actual contents
// are not a real JPEG/PNG/WebP — regardless of declared Content-Type or
// extension. Must be mounted before the controller on every upload route.
// Handles both upload.single() (req.file) and upload.fields() (req.files).
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
    const detected = detectImageMime(file.path);
    if (!detected) {
      // Clean up EVERY file this request wrote to disk so a rejection never
      // leaves orphaned uploads behind.
      for (const f of files) fs.unlink(f.path, () => {});
      res
        .status(400)
        .json({ error: "File contents are not a valid JPEG, PNG, or WebP image" });
      return;
    }
  }
  next();
}

export function ensureUploadsDir(): void {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(uploadsPrivateDir, { recursive: true });
}

function makeStorage(dir: string) {
  return multer.diskStorage({
    destination: dir,
    filename: (_req, file, cb) => {
      // Extension is derived from the DECLARED MIME type only. The original
      // client filename is never used in the stored path (path traversal
      // would be possible otherwise), and the magic-byte check that follows
      // upload makes the declared type trustworthy enough for an extension.
      const ext = EXTENSION_BY_MIME[file.mimetype] ?? ".jpg";
      cb(null, `${randomUUID()}${ext}`);
    },
  });
}

function makeImageUpload(dir: string, maxBytes: number) {
  return multer({
    storage: makeStorage(dir),
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

export const imageUpload = makeImageUpload(uploadsDir, MAX_FILE_SIZE);
export const avatarUpload = makeImageUpload(uploadsDir, MAX_AVATAR_SIZE);
export const kycDocumentUpload = makeImageUpload(uploadsPrivateDir, MAX_FILE_SIZE);

export function toPublicUrl(filename: string): string {
  return `${uploadsUrlPrefix}/${filename}`;
}

// KYC document URL stored in the DB. It is a private pseudo-URL: clients never
// receive it, and it is never served by express.static. It exists so the file
// can be located on disk and streamed by the authenticated document routes.
export function toPrivateUrl(filename: string): string {
  return `${uploadsUrlPrefix}-private/${filename}`;
}

// Resolves a private pseudo-URL to its absolute path on disk.
export function privateFilePath(privateUrl: string): string {
  const filename = path.basename(privateUrl);
  return path.join(uploadsPrivateDir, filename);
}

export function deleteFileByUrl(publicUrl: string): void {
  const filename = path.basename(publicUrl);
  const fullPath = path.join(uploadsDir, filename);
  fs.unlink(fullPath, () => {});
}

export function deletePrivateFile(privateUrl: string): void {
  fs.unlink(privateFilePath(privateUrl), () => {});
}
