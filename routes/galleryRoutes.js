import { Router } from "express";
import requireAuth from "../middlewares/requireAuth.js";
import upload from "../utils/uploadStorage.js";
import {
  uploadImage,
  getMyGallery,
  getPublicGallery,
  updateDescription,
  togglePublic,
  deleteImage,
  toggleLike,
  getLikeUser,
} from "../controllers/galleryController.js";

const r = Router();

// public gallery
r.get("/public", getPublicGallery);

// my gallery (ต้องล็อกอิน)
r.get("/me", requireAuth, getMyGallery);

// สร้างรูป (อัปโหลดเมทาดาต้า + รับไฟล์จาก multer)
r.post("/", requireAuth, uploadImage);

// อัปเดตคำอธิบาย
r.put("/:imageId/description", requireAuth, updateDescription);

// สลับ public/private
r.patch("/:imageId/toggle-public", requireAuth, togglePublic);

// ลบภาพ
r.delete("/:imageId", requireAuth, deleteImage);

// ไลก์/ยกเลิกไลก์
r.post("/:imageId/like", requireAuth, toggleLike);

// รายชื่อคนกดไลก์
r.get("/:imageId/likes", getLikeUser);

export default r;
