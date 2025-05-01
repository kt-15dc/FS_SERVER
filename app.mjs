if (process.env.NODE_ENV !== "production") {
    await import("dotenv/config");
  }  
import express from "express";
import cors from "cors";
import postRouter from "./apps/postRouter.mjs";
import categoryRouter from "./apps/categoryRouter.mjs";
import authRouter from "./apps/auth.mjs";
import profileRouter from "./apps/profileRouter.mjs";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello TechUp!");
});

app.use("/posts", postRouter);
app.use("/categories", categoryRouter);
app.use("/auth", authRouter);
app.use("/profile", profileRouter);

// 👇 Export for Vercel
export default app;
