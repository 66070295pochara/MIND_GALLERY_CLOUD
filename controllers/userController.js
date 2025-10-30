// controllers/userController.js
import { ddbDoc, DDB_TABLE } from "../config/db.js";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// GET /api/users/me
export const getMe = async (req, res) => {
  try {
    const userId = req.user?.userId; // ตั้งจาก middleware requireAuth
    if (!userId) return res.status(401).json({ message: "UNAUTHORIZED" });

    const r = await ddbDoc.send(new GetCommand({
      TableName: DDB_TABLE,
      Key: { PK: `USER#${userId}`, SK: "PROFILE" },
    }));
    if (!r.Item) return res.status(404).json({ message: "NOT_FOUND" });

    const { passwordHash, GSI1PK, GSI1SK, GSI2PK, GSI2SK, ...publicProfile } = r.Item;
    res.json(publicProfile);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "GET_ME_FAILED" });
  }
};

// PATCH /api/users/me/about { about: string }
export const updateAboutMe = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "UNAUTHORIZED" });

    const about = String(req.body.about ?? "").slice(0, 2000);
    const r = await ddbDoc.send(new UpdateCommand({
      TableName: DDB_TABLE,
      Key: { PK: `USER#${userId}`, SK: "PROFILE" },
      UpdateExpression: "SET #about = :about, updatedAt = :ts",
      ExpressionAttributeNames: { "#about": "about" },
      ExpressionAttributeValues: { ":about": about, ":ts": Date.now() },
      ReturnValues: "ALL_NEW",
    }));

    const { passwordHash, GSI1PK, GSI1SK, GSI2PK, GSI2SK, ...publicProfile } = r.Attributes ?? {};
    res.json(publicProfile);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "UPDATE_ABOUT_FAILED" });
  }
};
