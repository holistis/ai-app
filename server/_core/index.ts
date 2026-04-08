import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { requireAuth } from "@clerk/express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Twee mapjes omhoog vanuit server/_core/ → project root → dan dist/
const DIST_PATH = path.resolve(__dirname, "../../dist/public");

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ✅ 1. Railway proxy fix
  app.set("trust proxy", 1);

  // ✅ 2. CORS – handmatig, zonder extern pakket (dit werkt altijd)
  app.use((req, res, next) => {
    const origin = req.headers.origin || "*";
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });

  // ✅ 3. Body parsers
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ✅ 4. Statische bestanden EERST – vóór elke beveiliging
  app.use(express.static(DIST_PATH));

  // ✅ 5. Clerk webhook – geen auth nodig
  app.post("/api/clerk-webhook", (req, res) => {
    res.sendStatus(200);
  });

  // ✅ 6. Alleen de API is beveiligd
  app.use(
    "/api/trpc",
    requireAuth(),
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // ✅ 7. SPA catch-all – alles wat geen bestand is → index.html
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
