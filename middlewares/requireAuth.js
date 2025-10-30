// middlewares/requireAuth.js
import jwt from "jsonwebtoken";

export default function requireAuth(req, res, next) {
  const token = req.cookies?.authToken || req.headers.authorization?.replace(/^Bearer\s+/,'');
  if (!token) return res.status(401).json({ message: "UNAUTHORIZED" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // ต้องมี name มาด้วย (ดูข้อ #3 ถ้า login ยังไม่ได้ยัด name ลง token)
    req.user = {
      userId: payload.userId || payload.id,
      name: payload.name || payload.username || payload.email?.split("@")[0] || "User",
      email: payload.email
    };
    res.locals.user = req.user; // เผื่อฝั่ง EJS ใช้
    next();
  } catch (e) {
    return res.status(401).json({ message: "INVALID_TOKEN" });
  }
}
