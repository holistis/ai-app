// server/_core/context.ts
import { clerkClient, getAuth } from "@clerk/clerk-sdk-node";
import { inferAsyncReturnType } from "@trpc/server";

export async function createContext({ req, res }: any) {
  let userId: string | null = null;

  try {
    // Pak de token van de header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);

      // Verifieer token via Clerk
      const session = await clerkClient.sessions.verifySessionToken(token);

      if (session?.userId) {
        userId = session.userId;
      }
    }
  } catch (err) {
    console.error("[Clerk auth error]", err);
  }

  return { req, res, userId };
}

export type Context = inferAsyncReturnType<typeof createContext>;
