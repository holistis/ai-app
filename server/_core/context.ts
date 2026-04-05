import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";

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
    // Get Clerk auth from request (attached by middleware in index.ts)
    const auth = (opts.req as any).auth;
    const clerkUserId = auth?.userId;

    if (clerkUserId) {
      console.log(`[Context] Authenticated with Clerk user: ${clerkUserId}`);
      
      // Step 1: Look up user in database by clerkId
      let dbUser = await db.getUserByClerkId(clerkUserId);
      
      // Step 2: If user NOT found, create new user
      if (!dbUser) {
        console.log(`[Context] User not found, creating new user for Clerk ID: ${clerkUserId}`);
        try {
          // Create user with clerkId, email "unknown", role "user"
          await db.upsertUserFromClerk(
            clerkUserId,
            "unknown",
            ""
          );
          
          // Fetch the newly created user
          dbUser = await db.getUserByClerkId(clerkUserId);
          console.log(`[Context] Successfully created new user: ${clerkUserId}`);
        } catch (createError) {
          console.error(`[Context] Failed to create user:`, createError);
        }
      }
      
      // Step 3: Return user in context
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
