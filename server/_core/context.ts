import { clerkClient } from "@clerk/clerk-sdk-node";
import { inferAsyncReturnType } from "@trpc/server";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export async function createContext({ req, res }: any) {
  let user: any = null;

  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const decoded = await clerkClient.verifyToken(token);
      const clerkId = decoded.sub;

      if (clerkId) {
        const db = await getDb();
        if (db) {
          const existingUsers = await db
            .select()
            .from(users)
            .where(eq(users.clerkId, clerkId))
            .limit(1);

          if (existingUsers.length > 0) {
            user = existingUsers[0];
          } else {
            const adminEmail = process.env.ADMIN_EMAIL || "";
            let clerkUser: any = null;
            try {
              clerkUser = await clerkClient.users.getUser(clerkId);
            } catch {}

            const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? "";
            const name = clerkUser?.fullName ?? "";
            const role = email === adminEmail ? "admin" : "user";

            await db.insert(users).values({
              clerkId,
              email,
              name,
              role,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as any);

            const newUsers = await db
              .select()
              .from(users)
              .where(eq(users.clerkId, clerkId))
              .limit(1);

            user = newUsers[0] ?? null;
          }
        }
      }
    }
  } catch (err) {
    console.error("[Auth error]", err);
  }

  return { req, res, user };
}

export type Context = inferAsyncReturnType<typeof createContext>;
