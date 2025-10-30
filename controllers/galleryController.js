// controllers/galleryController.js
import { ddbDoc, DDB_TABLE } from "../config/db.js";
import {
   PutCommand,
  QueryCommand,
   UpdateCommand,
   TransactWriteCommand,
 DeleteCommand,
  GetCommand,              // ⬅️ เพิ่มตัวนี้
 } from "@aws-sdk/lib-dynamodb";
import crypto from "node:crypto";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, S3_BUCKET } from "../config/awsS3.js";
import { GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
/**
 * สร้างรูป (อัปโหลดเมทาดาต้เขา DynamoDB)
 * หมายเหตุ: การอัปโหลดไฟล์จริงให้ทำกับ S3 แยก แล้วส่ง s3Key มาทาง body
 */
async function deleteAllComments(ddbDoc, tableName, imageId) {
  let lastKey;
  do {
    const q = await ddbDoc.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :pref)",
      ExpressionAttributeValues: { ":pk": `IMG#${imageId}`, ":pref": "COMMENT#" },
      ExclusiveStartKey: lastKey,
      Limit: 100
    }));
    const items = q.Items ?? [];
    // แบ่งเป็นชุดละ <=25 สำหรับ BatchWrite
    for (let i = 0; i < items.length; i += 25) {
      const chunk = items.slice(i, i + 25);
      const requestItems = {};
      requestItems[tableName] = chunk.map(it => ({
        DeleteRequest: { Key: { PK: it.PK, SK: it.SK } }
      }));
      await ddbDoc.send(new BatchWriteCommand({ RequestItems: requestItems }));
    }
    lastKey = q.LastEvaluatedKey;
  } while (lastKey);
}
async function enrichItemsWithPresignedUrl(items) {
  const urls = [];
  for (const it of items) {
    if (!it.s3Key) {
      urls.push({ ...it, imageUrl: null });
      continue;
    }
    const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: it.s3Key });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 }); // หมดอายุ 5 นาที
    urls.push({ ...it, imageUrl: url });
  }
  return urls;
}



export const createImage = async (req, res) => {
  try {
    const ownerId = req.user?.userId || "u1";
    const imageId = crypto.randomUUID();
    const now = Date.now();

    // รับ s3Key จากฝั่ง client หลังอัปโหลดเสร็จ
    const { s3Key, title = "", description = "", isPublic = false, tags = [] } = req.body;
    if (!s3Key) return res.status(400).json({ message: "S3_KEY_REQUIRED" });

    const item = {
      PK: `IMG#${imageId}`,
      SK: "METADATA",
      imageId, ownerId, title, description, s3Key,
      isPublic: !!isPublic, createdAt: now,
      likeCount: 0, commentCount: 0, tags,
      GSI3PK: `OWNER#${ownerId}`, GSI3SK: `CREATED#${now}#${imageId}`,
      ...(isPublic ? { GSI4PK: "PUBLIC#1", GSI4SK: `CREATED#${now}#${imageId}` } : {})
    };

    await ddbDoc.send(new PutCommand({ TableName: DDB_TABLE, Item: item }));
    res.status(201).json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "CREATE_IMAGE_FAILED", error: String(err) });
  }
};
/** ดึงรายการ public (ใช้ GSI4) */
export const listPublic = async (req, res) => {
  try {
    const { next } = req.query;
    const r = await ddbDoc.send(
      new QueryCommand({
        TableName: DDB_TABLE,
        IndexName: "GSI4",
        KeyConditionExpression: "GSI4PK = :pk",
        ExpressionAttributeValues: { ":pk": "PUBLIC#1" },
        ScanIndexForward: false,
        Limit: 20,
        ExclusiveStartKey: next
          ? JSON.parse(Buffer.from(next, "base64").toString())
          : undefined,
      })
    );

    const items = await enrichItemsWithPresignedUrl(r.Items ?? []);
    const cursor = r.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(r.LastEvaluatedKey)).toString("base64")
      : null;

    res.json({ items, next: cursor });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "LIST_PUBLIC_FAILED", error: String(err) });
  }
};

/** ดึงแกลเลอรีของผู้ใช้ (ใช้ GSI3) */
export const getMyGallery = async (req, res) => {
  try {
    const userId = req.user.userId;

    // ดึงรายการรูปของผู้ใช้จาก DynamoDB โดยใช้ GSI3
    const r = await ddbDoc.send(
      new QueryCommand({
        TableName: DDB_TABLE,
        IndexName: "GSI3", // index สำหรับ owner
        KeyConditionExpression: "GSI3PK = :pk",
        ExpressionAttributeValues: { ":pk": `OWNER#${userId}` },
        ScanIndexForward: false,
        Limit: 50, // ดึงสูงสุด 50 รูป
      })
    );

    // enrich ด้วย presigned URL สำหรับดูรูปใน S3 (อายุ 5 นาที)
    const items = await Promise.all(
      (r.Items ?? []).map(async (it) => {
        let url = null;
        if (it.s3Key) {
          const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: it.s3Key });
          url = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 });
        }
        return { ...it, imageUrl: url };
      })
    );

    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "GET_MY_GALLERY_FAILED", error: String(err) });
  }
};


/** อัปเดตคำอธิบาย (เฉพาะเจ้าของ) */
export const updateDescription = async (req, res) => {
  try {
    const { imageId } = req.params;
    const { description } = req.body;
    const userId = req.user?.userId || "u1";

    await ddbDoc.send(
      new UpdateCommand({
        TableName: DDB_TABLE,
        Key: { PK: `IMG#${imageId}`, SK: "METADATA" },
        UpdateExpression: "SET description = :desc, updatedAt = :ts",
        ConditionExpression: "GSI3PK = :owner",
        ExpressionAttributeValues: {
          ":desc": description,
          ":ts": Date.now(),
          ":owner": `OWNER#${userId}`,
        },
      })
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "UPDATE_DESCRIPTION_FAILED",
      error: String(err),
    });
  }
};

/** สลับสถานะ public/private + อัปเดต/ลบคีย์ GSI4 ให้สอดคล้อง */
export const togglePublic = async (req, res) => {
  try {
    const { imageId } = req.params;
    const { isPublic } = req.body;
    const userId = req.user?.userId || "u1";

    if (isPublic) {
      // set public + เติม GSI4PK/GSI4SK (ใช้ createdAt เดิม)
      // ถ้าไม่รู้ createdAt เดิม ให้ approximate ด้วยตอนนี้ก็ได้ แต่ผลเรียงอาจต่างเล็กน้อย
      const now = Date.now();
      await ddbDoc.send(
        new UpdateCommand({
          TableName: DDB_TABLE,
          Key: { PK: `IMG#${imageId}`, SK: "METADATA" },
          UpdateExpression:
            "SET isPublic = :pub, GSI4PK = :g4pk, GSI4SK = :g4sk",
          ConditionExpression: "GSI3PK = :owner",
          ExpressionAttributeValues: {
            ":pub": true,
            ":g4pk": "PUBLIC#1",
            ":g4sk": `CREATED#${now}#${imageId}`,
            ":owner": `OWNER#${userId}`,
          },
        })
      );
    } else {
      // set private + REMOVE คีย์ GSI4 เพื่อไม่ให้ติด index public
      await ddbDoc.send(
        new UpdateCommand({
          TableName: DDB_TABLE,
          Key: { PK: `IMG#${imageId}`, SK: "METADATA" },
          UpdateExpression: "SET isPublic = :pub REMOVE GSI4PK, GSI4SK",
          ConditionExpression: "GSI3PK = :owner",
          ExpressionAttributeValues: {
            ":pub": false,
            ":owner": `OWNER#${userId}`,
          },
        })
      );
    }

    res.json({ ok: true, isPublic: !!isPublic });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "TOGGLE_PUBLIC_FAILED", error: String(err) });
  }
};

/** ลบภาพ (เฉพาะเจ้าของ) */
export const deleteImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    const userId = req.user?.userId || "u1";

    // 1) ดึงเมตาดาต้ามาดู s3Key ก่อน
    const meta = await ddbDoc.send(new GetCommand({
      TableName: DDB_TABLE,
      Key: { PK: `IMG#${imageId}`, SK: "METADATA" },
    }));
    if (!meta.Item) return res.status(404).json({ message: "NOT_FOUND" });
    if (meta.Item.GSI3PK !== `OWNER#${userId}`) return res.status(403).json({ message: "FORBIDDEN" });

    // 2) ลบใน DynamoDB (ของเดิมคุณทำอยู่แล้ว)
    await ddbDoc.send(new DeleteCommand({
      TableName: DDB_TABLE,
      Key: { PK: `IMG#${imageId}`, SK: "METADATA" },
      ConditionExpression: "GSI3PK = :owner",
      ExpressionAttributeValues: { ":owner": `OWNER#${userId}` }
    }));

    // 3) ลบไฟล์ใน S3 (ถ้ามี s3Key)
    if (meta.Item.s3Key) {
      await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: meta.Item.s3Key }));
    }
    await deleteAllComments(ddbDoc, DDB_TABLE, imageId);
    
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DELETE_IMAGE_FAILED", error: String(err) });
  }
};

/** กดไลก์/ยกเลิกไลก์ ในครั้งเดียว (toggle) */
export const toggleLike = async (req, res) => {
  const { imageId } = req.params;
  const userId = req.user?.userId || "u1";
  const ts = Date.now();

  try {
    // 1) พยายาม LIKE ครั้งแรก: ถ้ามีอยู่แล้วจะโดน ConditionalCheckFailed
    await ddbDoc.send(
      new TransactWriteCommand({
        ReturnCancellationReasons: true, // <-- เพิ่มบรรทัดนี้
        TransactItems: [
          {
            Put: {
              TableName: DDB_TABLE,
              Item: {
                PK: `IMG#${imageId}`,
                SK: `LIKE#${userId}`,
                imageId,
                userId,
                createdAt: ts,
              },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          {
            Update: {
              TableName: DDB_TABLE,
              Key: { PK: `IMG#${imageId}`, SK: "METADATA" },
              UpdateExpression:
                "SET likeCount = if_not_exists(likeCount, :z) + :one",
              ExpressionAttributeValues: { ":z": 0, ":one": 1 },
            },
          },
        ],
      })
    );

    return res.json({ ok: true, liked: true });
  } catch (err) {
    // 2) ถ้า Like ซ้ำ → จับ TransactionCanceled + มีเหตุผลเป็น ConditionalCheckFailed ⇒ ให้ UNLIKE
    const isCondFail =
      err?.name === "TransactionCanceledException" &&
      Array.isArray(err.CancellationReasons) &&
      err.CancellationReasons.some(r => r?.Code === "ConditionalCheckFailed");

    if (isCondFail || /ConditionalCheckFailed/i.test(String(err?.message))) {
      try {
        await ddbDoc.send(
          new TransactWriteCommand({
            ReturnCancellationReasons: true,
            TransactItems: [
              {
                Delete: {
                  TableName: DDB_TABLE,
                  Key: { PK: `IMG#${imageId}`, SK: `LIKE#${userId}` },
                  ConditionExpression: "attribute_exists(PK)",
                },
              },
              {
                Update: {
                  TableName: DDB_TABLE,
                  Key: { PK: `IMG#${imageId}`, SK: "METADATA" },
                  UpdateExpression:
                    "SET likeCount = if_not_exists(likeCount, :z) - :one",
                  ExpressionAttributeValues: { ":z": 0, ":one": 1 },
                },
              },
            ],
          })
        );
        return res.json({ ok: true, liked: false });
      } catch (e2) {
        return res
          .status(500)
          .json({ message: "TOGGLE_UNLIKE_FAILED", error: String(e2) });
      }
    }

    // error อื่น ๆ
    return res
      .status(500)
      .json({ message: "TOGGLE_LIKE_FAILED", error: String(err) });
  }
};

/** ดึงผู้ใช้ที่กดไลก์รูปนี้ */
export const getLikeUser = async (req, res) => {
  try {
    const { imageId } = req.params;
    const r = await ddbDoc.send(
      new QueryCommand({
        TableName: DDB_TABLE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :pref)",
        ExpressionAttributeValues: {
          ":pk": `IMG#${imageId}`,
          ":pref": "LIKE#",
        },
        Limit: 100,
      })
    );
    const users = (r.Items ?? []).map((it) => it.userId);
    res.json({ users, count: users.length });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "GET_LIKE_USER_FAILED", error: String(err) });
  }
};



/** ทำ alias ให้ตรงกับ routes */
export const uploadImage = createImage;
export const getPublicGallery = listPublic;
