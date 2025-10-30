// config/awsS3.js
import dotenv from "dotenv";
import { S3Client } from "@aws-sdk/client-s3";
import { fromIni } from "@aws-sdk/credential-providers";

dotenv.config();

const region = process.env.AWS_REGION ;

function buildCredentials() {
  const id = process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.AWS_SECRET_ACCESS_KEY;
  const token = process.env.AWS_SESSION_TOKEN;
  if (id && secret && token) return { accessKeyId: id, secretAccessKey: secret, sessionToken: token };
  if (id && secret) return { accessKeyId: id, secretAccessKey: secret };
  return fromIni({ profile: process.env.AWS_PROFILE || "default" });
}

export const s3 = new S3Client({ region, credentials: buildCredentials() });
export const S3_BUCKET = process.env.S3_BUCKET;
