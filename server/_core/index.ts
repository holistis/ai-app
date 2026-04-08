import express, { Express } from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { requireAuth } from "@clerk/express";
import cors from "cors";

export async function initServer(app: Express) {
  // 1. Basis Middleware
  app.use(cors());
  app.use(express.json());

  // 2. Clerk Auth Middleware met uitzondering voor publieke routes
  // Dit stopt de "Too many redirects" loop
  app.use((req, res, next) => {
    const publicRoutes = ['/sign-in', '/sign-up', '/api/clerk-webhook'];
    
    // Controleer of de huidige route in de lijst met publieke routes staat
    if (publicRoutes.some(route => req.path.startsWith(route))) {
      return next();
    }
    
    // Voor alle andere routes: vereis inloggen
    return requireAuth()(req, res, next);
  });

  // 3. tRPC API Route
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // 4. Overige routes (zoals Vite of statische bestanden)
  // Deze worden pas uitgevoerd als de gebruiker door de auth hierboven is
}
