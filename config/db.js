// config/db.js
import dotenv from "dotenv";
import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";

dotenv.config();

// ===== Env =====
export const DDB_TABLE = process.env.DDB_TABLE || "MindGallery";
const region = process.env.AWS_REGION || "ap-southeast-1";

// ===== Credentials selector =====
function buildCredentials() {
  const id = process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.AWS_SECRET_ACCESS_KEY;
  const token = process.env.AWS_SESSION_TOKEN; // ใช้กับ temporary creds (ขึ้นต้น ASIA...)

  if (id && secret && token) {
    // Temporary credentials (STS)
    return { accessKeyId: id, secretAccessKey: secret, sessionToken: token };
  }
  if (id && secret) {
    // Permanent access keys (AKIA...)
    return { accessKeyId: id, secretAccessKey: secret };
  }
  // ไม่มี .env → ลองใช้ AWS CLI profile (หรือ Instance Role เมื่อ deploy)
  return fromIni({ profile: process.env.AWS_PROFILE || "default" });
}

// ===== Clients =====
const ddb = new DynamoDBClient({
  region,
  credentials: buildCredentials(),
});

export const ddbDoc = DynamoDBDocumentClient.from(ddb, {
  marshallOptions: { removeUndefinedValues: true, convertClassInstanceToMap: true },
});

// ===== Optional: log/healthcheck ตอนสตาร์ต =====
export const connectDB = async () => {
  console.log(`[DynamoDB] ✅ Region: ${region}`);
  console.log(`[DynamoDB] ✅ Table : ${DDB_TABLE}`);
  // (ไม่จำเป็น) เช็คต่อว่า key ใช้ได้จริง
  // try {
  //   const t = await ddb.send(new ListTablesCommand({}));
  //   console.log(`[DynamoDB] Tables:`, t.TableNames);
  // } catch (e) {
  //   console.error(`[DynamoDB] Connection failed:`, e);
  // }
};
