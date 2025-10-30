import { Router } from "express";
import requireAuth from "../middlewares/requireAuth.js";
import { getUploadPresign } from "../controllers/s3Controller.js";

const r = Router();
r.get("/files/presign", requireAuth, getUploadPresign);
export default r;

export async function checkS3() {
  await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
}