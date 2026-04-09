import dotenv from "dotenv";
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { clerkMiddleware, requireAuth } from "@clerk/express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_PATH = path.resolve(__dirname, "../dist/public");

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.set("trust proxy", 1);
  app.use(clerkMiddleware());

  app.use((req, res, next) => {
    const origin = req.headers.origin || "*";
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(express.static(DIST_PATH));

  app.post("/api/clerk-webhook", (req, res) => {
    res.sendStatus(200);
  });

  // 🔍 DEBUG - tijdelijk om te zien wat er binnenkomt
  app.use("/api/trpc", (req, res, next) => {
    const authHeader = req.headers.authorization;
    console.log("[DEBUG] Auth header aanwezig:", !!authHeader);
    console.log("[DEBUG] Auth header waarde:", authHeader?.substring(0, 40) || "GEEN");
    next();
  });

  app.use(
    "/api/trpc",
    requireAuth(),
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  app.get("*", (req, res) => {
    if (path.extname(req.path)) {
      return res.status(404).send("Bestand niet gevonden");
    }
    res.sendFile(path.join(DIST_PATH, "index.html"));
  });

  const PORT = process.env.PORT || 8080;
  server.listen(PORT, () => {
    console.log(`✅ Server draait op poort ${PORT}`);
  });
}

startServer().catch(console.error);
