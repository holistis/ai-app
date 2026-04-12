import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { anamnesisRouter } from "./routers/anamnesis";
import { paymentsRouter } from "./routers/payments";
import { reportsRouter } from "./routers/reports";
import { coachRouter } from "./routers/coach";
import { adminRouter } from "./routers/admin";
import { chatRouter } from "./routers/chat";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  anamnesis: anamnesisRouter,
  payments: paymentsRouter,
  reports: reportsRouter,
  coach: coachRouter,
  admin: adminRouter,
  chat: chatRouter,
  auth: router({
    me: publicProcedure.query(opts => {
      const user = opts.ctx.user;
      if (user) {
        console.log(`[Auth.me] User: ${user.id}, Email: ${user.email}, Role: ${user.role}`);
      }
      return user;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      // With Clerk, logout is handled on the frontend
      // This endpoint is kept for compatibility
      console.log(`[Auth.logout] Logout called`);
      return {
        success: true,
      } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
