// routes/userRoutes.js
import { Router } from "express";
// ถ้า requireAuth ของคุณเป็น default export (ตามรูป)
import requireAuth from "../middlewares/requireAuth.js"; // <-- ใส่ s และ .js

import { getMe, updateAboutMe } from "../controllers/userController.js";

const router = Router();
router.get("/me", requireAuth, getMe);
router.patch("/me/about", requireAuth, updateAboutMe);

export default router;
