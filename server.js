import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import path from "path";
import morgan from "morgan";
import apiRouter from "./routes/router.js";
// ถ้ามี connectDB สำหรับ Dynamo ให้คงไว้
import { connectDB } from "./config/db.js";
import jwt from "jsonwebtoken";

dotenv.config();
const app = express();
const ROOT = process.cwd();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use(express.static("public"));

await connectDB();

// ==== view engine + user-in-ejs ====
app.set("views", path.join(ROOT, "views"));
app.set("view engine", "ejs");
app.use((req, res, next) => {
  const token = req.cookies?.authToken;
  if (!token) { res.locals.user = null; return next(); }
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: p.userId, name: p.name, role: p.role };
    res.locals.user = { _id: p.userId, name: p.name };
  } catch { res.locals.user = null; }
  next();
});

// ==== API (ต้องมี endpoint ที่ข้อ 1) ====
app.use("/api", apiRouter);

// ==== View routes ====
const requireAuth = (req, res, next) => (res.locals.user ? next() : res.redirect("/login"));
app.get("/", (_req, res) => res.redirect("/login"));
app.get("/login", (_req, res) => res.render("auth/login"));
app.get("/register", (_req, res) => res.render("auth/register"));
app.get("/gallery/all", requireAuth, (_req, res) => res.render("gallery/all-gallery"));
app.get("/gallery/fav", requireAuth, (_req, res) => res.render("gallery/fav"));
app.get("/gallery/my",  requireAuth, (_req, res) => res.render("gallery/mind-gallery",));

// // serve ไฟล์ที่อัปโหลดผ่านเซิร์ฟเวอร์ (ถ้ายังใช้โฟลเดอร์ local)
// app.use("/uploads", express.static(path.resolve("uploads")));

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server on http://localhost:${process.env.PORT || 3000}`);
});
