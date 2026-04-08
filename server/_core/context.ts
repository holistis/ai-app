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
        // ✅ Haal altijd de Clerk gebruiker op om de rol te lezen
        let clerkUser: any = null;
        try {
          clerkUser = await clerkClient.users.getUser(clerkId);
        } catch {}

        // ✅ Rol komt uit Clerk publicMetadata (jij had dit al goed staan)
        const clerkRole = clerkUser?.publicMetadata?.role as string | undefined;
        const email = clerkUser?.emailAddresses?.[0]?.emailAddress || "";

        // ✅ Admin check: Clerk metadata OF de ADMIN_EMAIL variabele
        const isAdmin =
          clerkRole === "admin" || email === process.env.ADMIN_EMAIL;
        const role = isAdmin ? "admin" : "user";

        const db = await getDb();
        if (db) {
          let existing = await db
            .select()
            .from(users)
            .where(eq(users.clerkId, clerkId))
            .limit(1);

          if (existing.length > 0) {
            // ✅ Update altijd de rol zodat hij nooit verouderd is
            await db
              .update(users)
              .set({ role, updatedAt: new Date() })
              .where(eq(users.clerkId, clerkId));

            user = { ...existing[0], role };
          } else {
            // 🆕 Eerste keer login → gebruiker aanmaken
            const name = clerkUser?.fullName || "";
            await db.insert(users).values({
              clerkId,
              email,
              name,
              role,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as any);

            let newUser = await db
              .select()
              .from(users)
              .where(eq(users.clerkId, clerkId))
              .limit(1);
            user = newUser[0] ?? null;
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
