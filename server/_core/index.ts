import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import cors from "cors";

// Clerk imports
import { clerkClient, requireAuth } from "@clerk/express";

async function startServer() {
  const app = express();
  const server = createServer(app);

  // 1. CORS instellingen (nu via de officiële cors package voor stabiliteit)
  app.use(cors({
    origin: process.env.VITE_APP_URL || "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
  }));

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // 2. DE REDIRECT FIX: Auth middleware van Clerk
  // We staan /sign-in en /sign-up toe zonder dat de auth-check ze blokkeert
  app.use((req, res, next) => {
    const publicRoutes = ['/sign-in', '/sign-up', '/api/clerk-webhook'];
    
    // Als de route in de lijst staat, negeer de verplichte login
    if (publicRoutes.some(route => req.path.startsWith(route))) {
      return next();
    }
    
    // Voor alle andere pagina's: check of de gebruiker is ingelogd
    return requireAuth()(req, res, next);
  });

  // 3. TRPC endpoint
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // 4. Static files en Vite setup
  serveStatic(app);
  if (process.env.NODE_ENV !== "production") {
    await setupVite(app, server);
  }

  // 5. Start de machine
  const PORT = process.env.PORT || 8080;
  server.listen(PORT, () =>
    console.log(`Server running on port ${PORT}`)
  );
}

startServer().catch(console.error);
