import { Router } from "express";
import bcrypt from "bcrypt";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateUserBody, UpdateUserBody } from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";

const router = Router();

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    createdAt: u.createdAt,
  };
}

router.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const users = await db.select().from(usersTable).orderBy(usersTable.username);
  res.json(users.map(formatUser));
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { username, password, role } = parsed.data;
  const hash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({ username, passwordHash: hash, role })
    .returning();
  res.status(201).json(formatUser(user));
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const update: Record<string, unknown> = {};
  if (parsed.data.username) update.username = parsed.data.username;
  if (parsed.data.password) update.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  if (parsed.data.role) update.role = parsed.data.role;
  const [user] = await db.update(usersTable).set(update).where(eq(usersTable.id, id)).returning();
  res.json(formatUser(user));
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).send();
});

export default router;
