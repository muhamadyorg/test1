import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes/index.js";
import authRouter from "./routes/auth.js";
import catalogsRouter from "./routes/catalogs.js";
import productsRouter from "./routes/products.js";
import usersRouter from "./routes/users.js";
import attributesRouter from "./routes/attributes.js";
import uploadsRouter, { UPLOADS_DIR } from "./routes/uploads.js";
import backupRouter from "./routes/backup.js";
import { logger } from "./lib/logger.js";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    role?: "admin" | "user";
  }
}

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "shop-catalog-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use("/api", router);
app.use("/api/auth", authRouter);
app.use("/api/catalogs", catalogsRouter);
app.use("/api/products", productsRouter);
app.use("/api/users", usersRouter);
app.use("/api/attributes", attributesRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/uploads", express.static(UPLOADS_DIR));
app.use("/api/backup", backupRouter);

export default app;
