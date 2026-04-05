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
    // Get Clerk auth from request (attached by clerkMiddleware)
    const auth = (opts.req as any).auth;
    const clerkUserId = auth?.userId;

    if (clerkUserId) {
      console.log(`[Context] Authenticated with Clerk user: ${clerkUserId}`);
      
      // Get user from database by clerkId
      let dbUser = await db.getUserByClerkId(clerkUserId);
      
      // If user doesn't exist, create them
      if (!dbUser) {
        try {
          // Fetch Clerk user info
          const clerkUser = await clerkClient.users.getUser(clerkUserId);
          
          // Create user in database with Clerk info
          await db.upsertUserFromClerk(
            clerkUserId,
            clerkUser.emailAddresses[0]?.emailAddress || "",
            `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim()
          );
          
          // Fetch the created user
          dbUser = await db.getUserByClerkId(clerkUserId);
          console.log(`[Context] Created new user: ${clerkUserId}`);
        } catch (error) {
          console.error(`[Context] Failed to create user from Clerk:`, error);
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
