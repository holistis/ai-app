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
          // Fetch Clerk user info to get email
          const clerkUser = await clerkClient.users.getUser(clerkUserId);
          const userEmail = clerkUser.emailAddresses[0]?.emailAddress || "unknown";
          const userName = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim();
          
          // Check if email matches ADMIN_EMAIL
          const adminEmail = process.env.ADMIN_EMAIL;
          const isAdmin = adminEmail && userEmail === adminEmail;
          const role = isAdmin ? "admin" : "user";
          
          console.log(`[Context] Creating user with email: ${userEmail}, role: ${role}`);
          
          // Create user with clerkId, email, and appropriate role
          await db.upsertUserFromClerk(
            clerkUserId,
            userEmail,
            userName,
            role
          );
          
          // Fetch the newly created user
          dbUser = await db.getUserByClerkId(clerkUserId);
          console.log(`[Context] Successfully created new user: ${clerkUserId} with role: ${role}`);
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
