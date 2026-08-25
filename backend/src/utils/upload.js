import multer from "multer";
import path from "path";
import fs from "fs";

// Files are saved to:
// /uploads/candidate-documents/{caseId}/
//
// Only the resulting URL is stored in PostgreSQL
// (CandidateDocument.fileUrl).
//
// Later, if you move to S3/Spaces, you can replace
// the storage engine without changing the rest of the application.

const UPLOAD_ROOT = path.join(
  process.cwd(),
  "uploads",
  "candidate-documents"
);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const caseId = req.params.id || "misc";

    const dir = path.join(UPLOAD_ROOT, caseId);

    fs.mkdirSync(dir, { recursive: true });

    cb(null, dir);
  },

  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

    const extension = path.extname(file.originalname);

    cb(null, `${unique}${extension}`);
  },
});

export const documentUpload = multer({
  storage,

  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB per file
  },
});

export function toPublicUrl(req, absoluteFilePath) {
  const relative = path
    .relative(process.cwd(), absoluteFilePath)
    .replace(/\\/g, "/");

  const base =
    process.env.PUBLIC_FILE_BASE_URL ||
    `${req.protocol}://${req.get("host")}`;

  return `${base}/${relative}`;
}