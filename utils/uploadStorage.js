// utils/uploadStorage.js
import multer from "multer";

const MB = Number(process.env.MAX_UPLOAD_MB || 10);
const storage = multer.memoryStorage(); // เก็บไฟล์ในหน่วยความจำ

function fileFilter(_req, file, cb) {
  // whitelist ประเภทภาพที่ยอมรับ
  const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype);
  if (!ok) return cb(new Error("UNSUPPORTED_FILE_TYPE"));
  cb(null, true);
}

export default multer({
  storage,
  limits: { fileSize: MB * 1024 * 1024 },
  fileFilter,
});
