import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { coachingSessions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

export const coachRouter = router({
  sendMessage: protectedProcedure
    .input(
      z.object({
        message: z.string(),
        conversationHistory: z.array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Build conversation for LLM
      const messages = [
        {
          role: "system" as const,
          content: `Je bent een holistische gezondheidscoach die gebruikers helpt hun gezondheidsreis voort te zetten.
          
Je geeft:
- Praktische, dagelijkse tips
- Motivatie en ondersteuning
- Vragen om voortgang te begrijpen
- Aanpassingen op basis van feedback

Wees warm, ondersteunend en praktisch. Focus op kleine, haalbare stappen.`,
        },
        ...input.conversationHistory.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        {
          role: "user" as const,
          content: input.message,
        },
      ];

      // Get response from LLM
      const response = await invokeLLM({
        messages: messages as any,
      });

      const assistantMessage =
        response.choices[0]?.message?.content || "Ik kon geen antwoord genereren.";

      // Save to database
      await db.insert(coachingSessions).values({
        userId: ctx.user.id,
        userMessage: input.message,
        assistantMessage: assistantMessage,
        createdAt: new Date(),
      } as any);

      return {
        message: assistantMessage,
      };
    }),

  getHistory: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const sessions = await db
      .select()
      .from(coachingSessions)
      .where(eq(coachingSessions.userId, ctx.user.id))
      .orderBy((t) => t.createdAt);

    return sessions;
  }),
});
