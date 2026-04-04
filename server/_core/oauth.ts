import type { Express } from "express";

export async function registerOAuthRoutes(app: Express) {
  // Clerk handles OAuth automatically via middleware
  // No callback route needed - Clerk SDK manages the flow
  console.log("[Clerk] OAuth routes registered (handled by Clerk SDK)");
}
