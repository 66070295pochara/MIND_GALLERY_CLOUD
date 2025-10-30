import { Router } from "express";
import { register, login, logout } from "../controllers/authController.js";

const r = Router();
r.post("/register", register);
r.post("/login", login);
r.post("/logout", logout);
export default r;
