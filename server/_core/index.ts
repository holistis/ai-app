import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

// Clerk imports
import { clerkClient, requireAuth } from "@clerk/express";

async function startServer() {
  const app = express();
  const server = createServer(app);

  // CORS instellingen
  app.use((req, res, next) => {
    const origin = req.headers.origin || "*";
    res.header("Access-Control-Allow-Origin", origin);
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Auth middleware van Clerk
  app.use(requireAuth()); // vereist dat gebruiker ingelogd is

  // TRPC endpoint
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Static files en Vite setup
  serveStatic(app);
  if (process.env.NODE_ENV !== "production") {
    await setupVite(app, server);
  }

  const PORT = process.env.PORT || 8080;
  server.listen(PORT, () =>
    console.log(`Server running on port ${PORT}`)
  );
}

startServer().catch(console.error);