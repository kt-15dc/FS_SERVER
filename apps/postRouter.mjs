import { Router } from "express";
import connectionPool from "../utils/db.mjs";
import { createClient } from "@supabase/supabase-js";

// Optional: Setup Supabase if you plan to use it for file uploads in the future
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const postRouter = Router();

postRouter.post("/", async (req, res) => {
  const newPost = req.body;

  // Helper: check for null, undefined, or empty string (trimmed)
  const isInvalid = (value) =>
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "");

  try {
    const query = `
      INSERT INTO posts (title, image, category_id, description, content, status_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    if (isInvalid(newPost.title)) {
      return res.status(400).json({ message: "Title is required" });
    }
    if (isInvalid(newPost.image)) {
      return res.status(400).json({ message: "Image is required" });
    }
    if (isInvalid(newPost.category_id)) {
      return res.status(400).json({ message: "Category ID is required" });
    }
    if (isInvalid(newPost.description)) {
      return res.status(400).json({ message: "Description is required" });
    }
    if (isInvalid(newPost.content)) {
      return res.status(400).json({ message: "Content is required" });
    }
    if (isInvalid(newPost.status_id)) {
      return res.status(400).json({ message: "Status ID is required" });
    }

    const values = [
      newPost.title,
      newPost.image,
      Number(newPost.category_id),
      newPost.description,
      newPost.content,
      Number(newPost.status_id),
    ];

    await connectionPool.query(query, values);
    return res.status(201).json({ message: "Created post successfully" });
  } catch (err) {
    console.error("Post creation failed:", err);
    return res.status(500).json({
      message: "Server could not create post due to database error",
      error: err.message,
    });
  }
});

export default postRouter;
