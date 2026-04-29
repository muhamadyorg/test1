import { Router } from "express";
import { db, productsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const rows = await db.execute(
    sql`SELECT DISTINCT jsonb_array_elements(attributes)->>'key' AS key FROM products WHERE jsonb_array_length(attributes) > 0`
  );
  const keys = (rows.rows as { key: string }[]).map((r) => r.key).filter(Boolean);
  res.json(keys);
});

export default router;
