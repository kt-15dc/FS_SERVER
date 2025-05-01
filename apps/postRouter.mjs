import { Router } from "express";
import connectionPool from "../utils/db.mjs";
import { createClient } from "@supabase/supabase-js";
import validatePostData from "../middlewares/postValidations.mjs";

// Optional: Setup Supabase if you plan to use it for file uploads in the future
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const postRouter = Router();

postRouter.post("/", validatePostData, async (req, res) => {
  const newPost = req.body;

  try {
    const query = `
      INSERT INTO posts (title, image, category_id, description, content, status_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

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

postRouter.get("/:id", async (req, res) => {
  const postId = req.params.id;

  try {
    const result = await connectionPool.query(
      "SELECT * FROM posts WHERE id = $1",
      [postId]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Server could not find a requested post" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching post:", err);
    return res.status(500).json({
      message: "Server could not read post because database connection",
      error: err.message,
    });
  }
});

postRouter.patch("/:id", async (req, res) => {
  const postId = req.params.id;
  const updatePatch = req.body;

  const fields = [];
  const values = [];
  let index = 1;

  const allowedKeys = [
    "title",
    "image",
    "category_id",
    "description",
    "content",
    "status_id",
  ];
  for (const key of Object.keys(updatePatch)) {
    if (allowedKeys.includes(key) && updatePatch[key] !== undefined) {
      fields.push(`${key} = $${index}`);
      values.push(updatePatch[key]);
      index++;
    }
  }

  if (fields.length === 0) {
    return res
      .status(400)
      .json({ error: "No valid fields provided for update." });
  }

  values.push(postId);

  try {
    const result = await connectionPool.query(
      `UPDATE posts
        SET ${fields.join(", ")}
        WHERE id = $${index}
        RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: "Server could not find a requested post to update" });
    }

    return res.status(200).json({
      message: "Updated post sucessfully",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("Error updating post:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      details: err.message,
    });
  }
});

postRouter.delete("/:id", async (req, res) => {
  const postId = req.params.id;

  try {
    const result = await connectionPool.query(
      "DELETE FROM posts WHERE id = $1",
      [postId]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "Server could not find a requested post to delete" });
    }

    return res.status(200).json({ message: "Deleted post successfully" });
  } catch (err) {
    console.error("Error deleting post:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      details: err.message,
    });
  }
});

postRouter.get("/", async (req, res) => {
  try {
    const category = req.query.category || "";
    const keyword = req.query.keyword || "";
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 6;
    const status = req.query.status || "";

    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(100, limit));
    const offset = (safePage - 1) * safeLimit;

    // 1. Prepare main query
    let query = `
        SELECT posts.id, posts.image, categories.name AS category, posts.title,
               posts.description, posts.date, posts.content, statuses.status, posts.likes_count
        FROM posts
        INNER JOIN categories ON posts.category_id = categories.id
        INNER JOIN statuses ON posts.status_id = statuses.id
      `;

    let values = [];
    let filterConditions = [];

    if (category) {
      values.push(`%${category}%`);
      filterConditions.push(`categories.name ILIKE $${values.length}`);
    }

    if (keyword) {
      values.push(`%${keyword}%`);
      const keywordIndex = values.length;
      filterConditions.push(
        `(posts.title ILIKE $${keywordIndex} OR posts.description ILIKE $${keywordIndex} OR posts.content ILIKE $${keywordIndex})`
      );
    }

    if (status) {
      values.push(status);
      filterConditions.push(`statuses.status = $${values.length}`);
    }

    if (filterConditions.length > 0) {
      query += ` WHERE ` + filterConditions.join(" AND ");
    }

    // 2. Add ORDER, LIMIT, OFFSET
    query += ` ORDER BY posts.date DESC LIMIT $${values.length + 1} OFFSET $${
      values.length + 2
    }`;
    values.push(safeLimit, offset);

    // 3. Execute main query
    const result = await connectionPool.query(query, values);

    // 4. Count query for pagination metadata
    let countQuery = `
        SELECT COUNT(*)
        FROM posts
        INNER JOIN categories ON posts.category_id = categories.id
        INNER JOIN statuses ON posts.status_id = statuses.id
      `;

    let countValues = [];
    let countConditions = [];

    if (category) {
      countValues.push(`%${category}%`);
      countConditions.push(`categories.name ILIKE $${countValues.length}`);
    }

    if (keyword) {
      countValues.push(`%${keyword}%`);
      const keywordIndex = countValues.length;
      countConditions.push(
        `(posts.title ILIKE $${keywordIndex} OR posts.description ILIKE $${keywordIndex} OR posts.content ILIKE $${keywordIndex})`
      );
    }

    if (status) {
      countValues.push(status);
      countConditions.push(`statuses.status = $${countValues.length}`);
    }

    if (countConditions.length > 0) {
      countQuery += ` WHERE ` + countConditions.join(" AND ");
    }

    const countResult = await connectionPool.query(countQuery, countValues);
    const totalPosts = parseInt(countResult.rows[0].count, 10);

    // 5. Prepare pagination response
    const results = {
      totalPosts,
      totalPages: Math.ceil(totalPosts / safeLimit),
      currentPage: safePage,
      limit: safeLimit,
      posts: result.rows,
    };

    if (offset + safeLimit < totalPosts) {
      results.nextPage = safePage + 1;
    }

    if (offset > 0) {
      results.previousPage = safePage - 1;
    }

    return res.status(200).json(results);
  } catch (err) {
    console.error("Error fetching posts:", err);
    return res.status(500).json({
      message: "Server could not read post because database issue",
      error: err.message,
    });
  }
});

export default postRouter;
