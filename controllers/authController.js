import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { ddbDoc, DDB_TABLE } from "../config/db.js";
import { QueryCommand, PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const ACCESS_TTL = 15 * 60;                // 15 นาที
const REFRESH_TTL = 7 * 24 * 60 * 60;      // 7 วัน

function setAccessCookie(res, token) {
  res.cookie("authToken", token, {                // ← เปลี่ยนชื่อให้ตรงของเก่า
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ACCESS_TTL * 1000,
    path: "/",
    domain: process.env.COOKIE_DOMAIN || undefined,
  });
}

function setRefreshCookie(res, token) {
  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: REFRESH_TTL * 1000,
    path: "/api/auth", // จำกัดเส้นทาง refresh
    domain: process.env.COOKIE_DOMAIN || undefined,
  });
}
// optional: cookie ธรรมดาสำหรับ double-submit CSRF
function setCsrfCookie(res, token) {
  res.cookie("csrf_token", token, {
    httpOnly: false, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: ACCESS_TTL * 1000, path: "/",
    domain: process.env.COOKIE_DOMAIN || undefined,
  });
}

export async function register(req, res) {
  try {
    const { username, email, password, name = "" } = req.body;
    if (!username || !email || !password) return res.status(400).json({ message: "missing fields" });

    // เช็คซ้ำด้วย GSI1/GSI2
    const uDup = await ddbDoc.send(new QueryCommand({
      TableName: DDB_TABLE, IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk AND GSI1SK = :sk",
      ExpressionAttributeValues: { ":pk": `USERNAME#${username}`, ":sk": "PROFILE" }, Limit: 1
    }));
    if (uDup.Count) return res.status(409).json({ message: "USERNAME_TAKEN" });
    const eDup = await ddbDoc.send(new QueryCommand({
      TableName: DDB_TABLE, IndexName: "GSI2",
      KeyConditionExpression: "GSI2PK = :pk AND GSI2SK = :sk",
      ExpressionAttributeValues: { ":pk": `EMAIL#${email}`, ":sk": "PROFILE" }, Limit: 1
    }));
    if (eDup.Count) return res.status(409).json({ message: "EMAIL_TAKEN" });

    const userId = crypto.randomUUID();
    const hash = await bcrypt.hash(password, 10);
    const now = Date.now();

    await ddbDoc.send(new PutCommand({
      TableName: DDB_TABLE,
      Item: {
        PK: `USER#${userId}`, SK: "PROFILE",
        userId, username, email, name, role: "user", createdAt: now,
        passwordHash: hash,
        GSI1PK: `USERNAME#${username}`, GSI1SK: "PROFILE",
        GSI2PK: `EMAIL#${email}`,    GSI2SK: "PROFILE",
      },
      ConditionExpression: "attribute_not_exists(PK)"
    }));

    res.status(201).json({ userId, username, email, name });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "REGISTER_FAILED" });
  }
}

export async function login(req, res) {
  try {
    const { username, password } = req.body;
    const r = await ddbDoc.send(new QueryCommand({
      TableName: DDB_TABLE, IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk AND GSI1SK = :sk",
      ExpressionAttributeValues: { ":pk": `USERNAME#${username}`, ":sk": "PROFILE" }, Limit: 1
    }));
    const user = r.Items?.[0];
    if (!user) return res.status(401).json({ message: "invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash || "");
    if (!ok) return res.status(401).json({ message: "invalid credentials" });

    // jti สำหรับ revoke ทีหลัง
    const jti = crypto.randomUUID();
    const access = jwt.sign(
      { userId: user.userId,
    username: user.username,
    name: user.name,          // ✅ เพิ่มบรรทัดนี้
    role: user.role || "user",
    jti},
      process.env.JWT_SECRET,
      { expiresIn: ACCESS_TTL }
    );
    const refreshId = crypto.randomUUID();
    const refresh = jwt.sign(
      { userId: user.userId, rid: refreshId },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: REFRESH_TTL }
    );

    // optional: เก็บ refresh ล่าสุดที่ user เพื่อทำ rotation (ไม่เก็บใน plaintext cookie ฝั่ง DB ก็พอ)
    await ddbDoc.send(new UpdateCommand({
      TableName: DDB_TABLE, Key: { PK: `USER#${user.userId}`, SK: "PROFILE" },
      UpdateExpression: "SET lastRefreshId = :rid",
      ExpressionAttributeValues: { ":rid": refreshId }
    }));

    setAccessCookie(res, access);
    setRefreshCookie(res, refresh);
    setCsrfCookie(res, crypto.randomUUID()); // ถ้าจะใช้ double-submit
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "LOGIN_FAILED" });
  }
}

// ส่ง access token ใหม่ด้วย refresh (rotation)
export async function refresh(req, res) {
  try {
    const token = req.cookies?.refresh_token;
    if (!token) return res.status(401).json({ message: "no refresh" });

    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const { userId, rid } = payload;

    // เช็คว่า rid ยังตรงกับของ user (rotation ป้องกัน reuse)
    const r = await ddbDoc.send(new GetCommand({
      TableName: DDB_TABLE, Key: { PK: `USER#${userId}`, SK: "PROFILE" }
    }));
    if (!r.Item || r.Item.lastRefreshId !== rid) return res.status(401).json({ message: "invalid refresh" });

    // ออกชุดใหม่
    const newJti = crypto.randomUUID();
    const access = jwt.sign({ userId, jti: newJti }, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL });
    const newRid = crypto.randomUUID();
    const newRefresh = jwt.sign({ userId, rid: newRid }, process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL });

    await ddbDoc.send(new UpdateCommand({
      TableName: DDB_TABLE, Key: { PK: `USER#${userId}`, SK: "PROFILE" },
      UpdateExpression: "SET lastRefreshId = :rid",
      ExpressionAttributeValues: { ":rid": newRid }
    }));

    setAccessCookie(res, access);
    setRefreshCookie(res, newRefresh);
    res.json({ ok: true });
  } catch (e) {
    res.status(401).json({ message: "refresh failed" });
  }
}

export function logout(_req, res) {
  res.clearCookie("authToken", { path: "/" });      // ✅ เปลี่ยนให้ตรงกับที่ตั้งตอน login
  res.clearCookie("refresh_token", { path: "/api/auth" });
  res.clearCookie("csrf_token", { path: "/" });
  res.json({ ok: true });
}

// แจก CSRF token (สำหรับ double-submit)
export function csrf(_req, res) {
  const t = crypto.randomUUID();
  res.cookie("csrf_token", t, {
    httpOnly: false, sameSite: "lax",
    secure: process.env.NODE_ENV === "production", path: "/"
  });
  res.json({ csrfToken: t });
}
// controllers/galleryController.js