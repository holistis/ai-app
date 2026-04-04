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
    // Clerk middleware attaches auth info to req
    const clerkUserId = (opts.req as any).auth?.userId;
    if (clerkUserId) {
      // Fetch user from database using Clerk userId
      const dbUser = await db.getUserByClerkId(clerkUserId);
      user = dbUser || null;
    }
  } catch (error) {
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
