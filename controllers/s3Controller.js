import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, S3_BUCKET } from "../config/awsS3.js";

function safeName(name = "") {
  return name.replace(/[^\w.\-]/g, "_");
}

export const getUploadPresign = async (req, res) => {
  try {
    const userId = req.user?.userId || "u1"; // ต้องล็อกอินก่อนขอ URL
    const { filename, filetype } = req.query;
    if (!filename || !filetype) {
      return res.status(400).json({ message: "filename_filetype_required" });
    }

    const key = `uploads/${userId}/${Date.now()}_${safeName(filename)}`;
    const cmd = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: filetype,
      // ถ้าต้องการ server-side encryption:
      // ServerSideEncryption: "AES256",
    });

    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 300 }); // 60 วินาที
    res.json({ uploadUrl, key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "PRESIGN_FAILED", error: String(err) });
  }
};
