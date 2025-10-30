// routes/commentRoutes.js
import { Router } from "express";
import requireAuth from "../middlewares/requireAuth.js";
import {
  addComment,
  listComments,
  getAllCommentByID,
  updateComment,
  deleteCommentByID,
} from "../controllers/commentController.js";

/**
 * คุณมี 2 สไตล์ให้เลือกใช้:
 * 1) ใช้ path เต็ม (ตามไฟล์นี้) => mount ตรงๆ ที่ app.use("/", r)
 * 2) หรือจะ mount ที่ /images/:imageId/comments แล้วเปลี่ยน path เป็น "/" ก็ได้
 */

const r = Router({ mergeParams: true });

// ดึงคอมเมนต์ของรูป
r.get("/images/:imageId/comments", getAllCommentByID); // หรือจะใช้ listComments ก็ได้

// เพิ่มคอมเมนต์ (ต้องล็อกอิน)
r.post("/images/:imageId/comments", requireAuth, addComment);

// แก้ไขคอมเมนต์ (ต้องล็อกอิน) → ต้องส่ง ?ts=<timestamp> มาด้วย
r.put(
  "/images/:imageId/comments/:commentId",
  requireAuth,
  updateComment
); // /images/123/comments/abc?ts=1730123456789

// ลบคอมเมนต์ (ต้องล็อกอิน) → ต้องส่ง ?ts=<timestamp> มาด้วย
r.delete(
  "/images/:imageId/comments/:commentId",
  requireAuth,
  deleteCommentByID
); // /images/123/comments/abc?ts=1730123456789

export default r;
