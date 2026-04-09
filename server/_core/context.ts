import dotenv from "dotenv";
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}
import { verifyToken, createClerkClient } from "@clerk/backend";
import { inferAsyncReturnType } from "@trpc/server";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export async function createContext({ req, res }: any) {
  let user: any = null;

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("[Auth] Geen Bearer token ontvangen");
      return { req, res, user: null };
    }

    const token = authHeader.substring(7);

    const decoded = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    const clerkId = decoded.sub;
    console.log("[Auth] Token geldig voor:", clerkId);

    let clerkUser: any = null;
    try {
      clerkUser = await clerkClient.users.getUser(clerkId);
    } catch (e) {
      console.error("[Auth] Kon Clerk user niet ophalen:", e);
    }

    const clerkRole = clerkUser?.publicMetadata?.role as string | undefined;
    const email = clerkUser?.emailAddresses?.[0]?.emailAddress || "";
    const isAdmin = clerkRole === "admin" || email === process.env.ADMIN_EMAIL;
    const role = isAdmin ? "admin" : "user";

    const db = await getDb();
    if (db) {
      const existing = await db
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
  } catch (err: any) {
    console.error("[Auth] Token verificatie mislukt:", err.message);
  }

  return { req, res, user };
}

export type Context = inferAsyncReturnType<typeof createContext>;
