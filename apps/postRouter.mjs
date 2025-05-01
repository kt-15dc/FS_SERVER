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

  for (const key in updatePatch) {
    if (updatePatch[key] !== undefined) {
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

app.get("/posts", async (req, res) => {
  // ลอจิกในอ่านข้อมูลโพสต์ทั้งหมดในระบบ
  try {
    // 1) Access ข้อมูลใน Body จาก Request ด้วย req.body
    const category = req.query.category || "";
    const keyword = req.query.keyword || "";
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 6;

    // 2) ทำให้แน่ใจว่า query parameter page และ limit จะมีค่าอย่างต่ำเป็น 1
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(100, limit));
    const offset = (safePage - 1) * safeLimit;
    // offset คือค่าที่ใช้ในการข้ามจำนวนข้อมูลบางส่วนตอน query ข้อมูลจาก database
    // ถ้า page = 2 และ limit = 6 จะได้ offset = (2 - 1) * 6 = 6 หมายความว่าต้องข้ามแถวไป 6 แถวแรก และดึงแถวที่ 7-12 แทน

    // 3) เขียน Query เพื่อ Insert ข้อมูลโพสต์ ด้วย Connection Pool
    let query = `
            SELECT posts.id, posts.image, categories.name AS category, posts.title, posts.description, posts.date, posts.content, statuses.status, posts.likes_count
            FROM posts
            INNER JOIN categories ON posts.category_id = categories.id
            INNER JOIN statuses ON posts.status_id = statuses.id
          `;
    let values = [];

    // 4) เขียน query จากเงื่อนไขของการใส่ query parameter category และ keyword
    if (category && keyword) {
      query += `
              WHERE categories.name ILIKE $1 
              AND (posts.title ILIKE $2 OR posts.description ILIKE $2 OR posts.content ILIKE $2)
            `;
      values = [`%${category}%`, `%${keyword}%`];
    } else if (category) {
      query += " WHERE categories.name ILIKE $1";
      values = [`%${category}%`];
    } else if (keyword) {
      query += `
              WHERE posts.title ILIKE $1 
              OR posts.description ILIKE $1 
              OR posts.content ILIKE $1
            `;
      values = [`%${keyword}%`];
    }

    // 5) เพิ่มการ odering ตามวันที่, limit และ offset
    query += ` ORDER BY posts.date DESC LIMIT $${values.length + 1} OFFSET $${
      values.length + 2
    }`;

    values.push(safeLimit, offset);

    // 6) Execute the main query (ดึงข้อมูลของบทความ)
    const result = await connectionPool.query(query, values);

    // 7) สร้าง Query สำหรับนับจำนวนทั้งหมดตามเงื่อนไข พื่อใช้สำหรับ pagination metadata
    let countQuery = `
            SELECT COUNT(*)
            FROM posts
            INNER JOIN categories ON posts.category_id = categories.id
            INNER JOIN statuses ON posts.status_id = statuses.id
          `;
    let countValues = values.slice(0, -2); // ลบค่า limit และ offset ออกจาก values

    if (category && keyword) {
      countQuery += `
              WHERE categories.name ILIKE $1 
              AND (posts.title ILIKE $2 OR posts.description ILIKE $2 OR posts.content ILIKE $2)
            `;
    } else if (category) {
      countQuery += " WHERE categories.name ILIKE $1";
    } else if (keyword) {
      countQuery += `
              WHERE posts.title ILIKE $1 
              OR posts.description ILIKE $1 
              OR posts.content ILIKE $1
            `;
    }

    const countResult = await connectionPool.query(countQuery, countValues);
    const totalPosts = parseInt(countResult.rows[0].count, 10);

    // 8) สร้าง response พร้อมข้อมูลการแบ่งหน้า (pagination)
    const results = {
      totalPosts,
      totalPages: Math.ceil(totalPosts / safeLimit),
      currentPage: safePage,
      limit: safeLimit,
      posts: result.rows,
    };
    // เช็คว่ามีหน้าถัดไปหรือไม่
    if (offset + safeLimit < totalPosts) {
      results.nextPage = safePage + 1;
    }
    // เช็คว่ามีหน้าก่อนหน้าหรือไม่
    if (offset > 0) {
      results.previousPage = safePage - 1;
    }
    // 9) Return ตัว Response กลับไปหา Client ว่าสร้างสำเร็จ
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
