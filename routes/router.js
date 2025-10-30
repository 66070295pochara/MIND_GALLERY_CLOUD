import { Router } from "express";
import authRoutes from "./authRoutes.js";
import userRoutes from "./userRoutes.js";
import galleryRoutes from "./galleryRoutes.js";
import commentRoutes from "./commentRoutes.js";
import s3Routes from "./s3Routes.js";
const api = Router();

api.use("/auth", authRoutes);
api.use("/", userRoutes);
api.use("/gallery", galleryRoutes);
api.use("/", commentRoutes);
api.use("/", s3Routes);

export default api;
