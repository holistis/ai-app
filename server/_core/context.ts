import { clerkClient } from "@clerk/clerk-sdk-node";
import { inferAsyncReturnType } from "@trpc/server";

export async function createContext({ req, res }: any) {
  let user: any = null;

  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const decoded = await clerkClient.verifyToken(token);
      user = { id: decoded.sub };
    }
  } catch (err) {
    console.error("[Clerk auth error]", err);
  }

  return { req, res, user };
}

export type Context = inferAsyncReturnType<typeof createContext>;
