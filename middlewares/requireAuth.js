// middlewares/requireAuth.js
import jwt from "jsonwebtoken";

export default function requireAuth(req, res, next) {
  const token =
  req.cookies?.access_token ||  // <-- ชื่อ cookie ที่เซ็ตไว้ตอน login
  req.cookies?.authToken ||     // เผื่อใช้ชื่อเก่า
  req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { userId: p.userId, username: p.username, role: p.role || "user" };
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}
