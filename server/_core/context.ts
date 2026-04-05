import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { clerkClient } from "@clerk/clerk-sdk-node";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // Try to get Clerk user ID from multiple sources
    let clerkUserId: string | null = null;

    // 1. Check if Clerk middleware already attached auth info
    const clerkAuth = (opts.req as any).auth;
    if (clerkAuth?.userId) {
      clerkUserId = clerkAuth.userId;
    }

    // 2. If not, try to verify JWT token from Authorization header
    if (!clerkUserId) {
      const authHeader = opts.req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        try {
          // Verify token with Clerk
          const decoded = await clerkClient.verifyToken(token);
          clerkUserId = decoded.sub;
        } catch (tokenError) {
          console.log("[Context] Failed to verify token:", tokenError);
        }
      }
    }

    // 3. If we have a Clerk user ID, fetch or create the user
    if (clerkUserId) {
      console.log(`[Context] Authenticated with Clerk user: ${clerkUserId}`);
      
      // Get user from database
      let dbUser = await db.getUserByClerkId(clerkUserId);
      
      // If user doesn't exist, create them
      if (!dbUser) {
        try {
          // Fetch user info from Clerk
          const clerkUser = await clerkClient.users.getUser(clerkUserId);
          
          // Create user in database
          const result = await db.upsertUserFromClerk(
            clerkUserId,
            clerkUser.emailAddresses[0]?.emailAddress || "",
            `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim()
          );
          
          // Fetch the created user
          dbUser = await db.getUserByClerkId(clerkUserId);
          
          console.log(`[Context] Created new user: ${clerkUserId}`);
        } catch (clerkError) {
          console.error(`[Context] Failed to fetch/create user from Clerk:`, clerkError);
        }
      }
      
      user = dbUser || null;
    }
  } catch (error) {
    console.error("[Context] Unexpected error:", error);
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
