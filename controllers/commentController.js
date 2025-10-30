// controllers/commentController.js
import { ddbDoc, DDB_TABLE } from "../config/db.js";
import {
  PutCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
  GetCommand,  
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import crypto from "node:crypto";
import { GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
/** เพิ่มคอมเมนต์ */
export const addComment = async (req, res) => {
  try {
    const { imageId } = req.params;
    const authorId = req.user?.userId || "u1";
    const commentId = crypto.randomUUID();
    const ts = Date.now();
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "TEXT_REQUIRED" });
    }
    
    
      await ddbDoc.send(new TransactWriteCommand({
        
      TransactItems: [
        // 0) เช็กรูปว่ายังมีอยู่ (METADATA ต้องมี)
     {
        ConditionCheck: {
          TableName: DDB_TABLE,
          Key: { PK: `IMG#${imageId}`, SK: "METADATA" },
          ConditionExpression: "attribute_exists(PK)"
        }
      },
        {
          Put: {
            TableName: DDB_TABLE,
            Item: {
              PK: `IMG#${imageId}`,
              SK: `COMMENT#${ts}#${commentId}`,
              commentId,
              imageId,
              authorId,
              text: text.trim(),
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
              "SET commentCount = if_not_exists(commentCount, :z) + :one",
            ExpressionAttributeValues: { ":z": 0, ":one": 1 },
          },
        },
      ],
    }));

    res.status(201).json({
      ok: true,
      comment: { commentId, imageId, authorId, text: text.trim(), createdAt: ts },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "ADD_COMMENT_FAILED", error: String(err) });
  }
};

/** ดึงคอมเมนต์ทั้งหมดของรูป (ล่าสุดก่อน) */
export const listComments = async (req, res) => {
  try {
    const { imageId } = req.params;
    const r = await ddbDoc.send(
      new QueryCommand({
        TableName: DDB_TABLE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :pref)",
        ExpressionAttributeValues: {
          ":pk": `IMG#${imageId}`,
          ":pref": "COMMENT#",
        },
        ScanIndexForward: false,
        Limit: 50, // ปรับได้
      })
    );
    res.json(r.Items ?? []);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "LIST_COMMENTS_FAILED", error: String(err) });
  }
};

/** แก้ไขคอมเมนต์ (เฉพาะเจ้าของคอมเมนต์) */
export const updateComment = async (req, res) => {
  try {
    const { imageId, commentId } = req.params;
    const { ts } = req.query;
    const { text } = req.body;
    const me = req.user?.userId || "u1";

    if (!ts) return res.status(400).json({ message: "TS_REQUIRED" });
    if (!text || !text.trim())
      return res.status(400).json({ message: "TEXT_REQUIRED" });

    await ddbDoc.send(
      new UpdateCommand({
        TableName: DDB_TABLE,
        Key: { PK: `IMG#${imageId}`, SK: `COMMENT#${ts}#${commentId}` },
        // ⬇️ ใช้ alias (#t) แทนชื่อ field ที่เป็น reserved word
        UpdateExpression: "SET #t = :t, updatedAt = :u",
        ExpressionAttributeNames: { "#t": "text" },
        ConditionExpression: "authorId = :me",
        ExpressionAttributeValues: {
          ":t": text.trim(),
          ":u": Date.now(),
          ":me": me,
        },
      })
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    const isCond = (err.name || "").includes("ConditionalCheckFailed");
    res.status(isCond ? 403 : 500).json({
      message: isCond ? "FORBIDDEN_NOT_AUTHOR" : "UPDATE_COMMENT_FAILED",
      error: String(err),
    });
  }
};

/** ลบคอมเมนต์ (เฉพาะเจ้าของคอมเมนต์) */
export const deleteCommentByID = async (req, res) => {
  try {
    const { imageId, commentId } = req.params;
    const { ts } = req.query;
    const me = req.user?.userId || "u1";

    if (!ts) return res.status(400).json({ message: "TS_REQUIRED" });

    await ddbDoc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Delete: {
              TableName: DDB_TABLE,
              Key: { PK: `IMG#${imageId}`, SK: `COMMENT#${ts}#${commentId}` },
              ConditionExpression: "authorId = :me",
              ExpressionAttributeValues: { ":me": me },
            },
          },
          {
            Update: {
              TableName: DDB_TABLE,
              Key: { PK: `IMG#${imageId}`, SK: "METADATA" },
              UpdateExpression:
                "SET commentCount = if_not_exists(commentCount, :z) - :one",
              ExpressionAttributeValues: { ":z": 0, ":one": 1 },
            },
          },
        ],
      })
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    const isCond = (err.name || "").includes("ConditionalCheckFailed");
    res.status(isCond ? 403 : 500).json({
      message: isCond ? "FORBIDDEN_NOT_AUTHOR" : "DELETE_COMMENT_FAILED",
      error: String(err),
    });
  }
};

/** alias ชื่อให้เข้ากับ router เดิม */
export const getAllCommentByID = listComments;
