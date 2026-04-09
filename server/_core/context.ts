import { clerkClient } from "@clerk/express";
import { inferAsyncReturnType } from "@trpc/server";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export async function createContext({ req, res }: any) {
  let user: any = null;

  try {
    const clerkId = req.auth?.userId;

    if (clerkId) {
      let clerkUser: any = null;
      try {
        clerkUser = await clerkClient.users.getUser(clerkId);
      } catch {}

      const clerkRole = clerkUser?.publicMetadata?.role as string | undefined;
      const email = clerkUser?.emailAddresses?.[0]?.emailAddress || "";
      const isAdmin = clerkRole === "admin" || email === process.env.ADMIN_EMAIL;
      const role = isAdmin ? "admin" : "user";

      const db = await getDb();
      if (db) {
        let existing = await db
          .select()
          .from(users)
          .where(eq(users.clerkId, clerkId))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(users)
            .set({ role, updatedAt: new Date() })
            .where(eq(users.clerkId, clerkId));
          user = { ...existing[0], role };
        } else {
          const name = clerkUser?.fullName || "";
          await db.insert(users).values({
            clerkId,
            email,
            name,
            role,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any);
          const newUser = await db
            .select()
            .from(users)
            .where(eq(users.clerkId, clerkId))
            .limit(1);
          user = newUser[0] ?? null;
        }
      }
    }
  } catch (err) {
    console.error("[Auth error]", err);
  }

  return { req, res, user };
}

export type Context = inferAsyncReturnType<typeof createContext>;
