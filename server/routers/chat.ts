// FILE: server/routers/chat.ts
// Chatbot die het rapport van de gebruiker kent
// Rate limit: max 20 berichten per gebruiker per uur

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { reports } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

// ─── IN-MEMORY RATE LIMITER ───────────────────────────────────────────────────
// Simpele rate limiter — reset automatisch elk uur
// Voor productie: vervang door Redis, maar dit werkt goed voor nu

const chatRateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, maxPerHour = 20): boolean {
  const now = Date.now();
  const existing = chatRateLimit.get(userId);

  if (!existing || now > existing.resetAt) {
    // Nieuw uur of eerste keer
    chatRateLimit.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }

  if (existing.count >= maxPerHour) {
    return false; // limiet bereikt
  }

  existing.count++;
  return true;
}

// ─── RAPPORT RATE LIMITER (bescherming tegen misbruik) ────────────────────────
const rapportRateLimit = new Map<string, { count: number; resetAt: number }>();

export function checkRapportRateLimit(userId: string, maxPerDay = 5): boolean {
  const now = Date.now();
  const existing = rapportRateLimit.get(userId);

  if (!existing || now > existing.resetAt) {
    rapportRateLimit.set(userId, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    return true;
  }

  if (existing.count >= maxPerDay) {
    return false;
  }

  existing.count++;
  return true;
}

// ─── CHAT ROUTER ─────────────────────────────────────────────────────────────

export const chatRouter = router({
  sendMessage: protectedProcedure
    .input(
      z.object({
        reportId: z.number(),
        messages: z.array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Rate limit check
      const allowed = checkRateLimit(ctx.user.id.toString());
      if (!allowed) {
        throw new Error(
          "Je hebt het maximum aantal berichten voor dit uur bereikt. Probeer het over een uur opnieuw."
        );
      }

      const db = await getDb();
      if (!db) throw new Error("Database niet beschikbaar");

      // Haal rapport op — controleer dat het van deze gebruiker is
      const reportRows = await db
        .select()
        .from(reports)
        .where(
          and(
            eq(reports.id, input.reportId),
            eq(reports.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!reportRows.length) {
        throw new Error("Rapport niet gevonden");
      }

      const report = reportRows[0];

      // Bouw context-bewuste system prompt
      const systemPrompt = `Je bent een persoonlijke holistische gezondheidsadviseur van Holistisch Adviseur (holistischadviseur.nl).

Je helpt de gebruiker ${ctx.user.name || "de patiënt"} vragen te beantwoorden over hun persoonlijk holistische gezondheidsrapport.

RAPPORT VAN DEZE GEBRUIKER:
---
${report.content || "Rapport inhoud niet beschikbaar"}
---

SAMENVATTING: ${report.summary || "Niet beschikbaar"}

REGELS:
- Beantwoord ALLEEN vragen die betrekking hebben op dit rapport of de gezondheid van deze persoon
- Verwijs altijd naar de specifieke informatie uit hun rapport
- Gebruik altijd Nederlands
- Wees warm, persoonlijk en praktisch
- Als je iets niet weet, zeg dat eerlijk
- Geef NOOIT medische diagnoses — verwijs altijd naar een arts voor diagnose en behandeling
- Houd antwoorden beknopt (max 150 woorden) tenzij gevraagd om meer detail
- Als iemand vraagt buiten gezondheid om, wijs vriendelijk terug naar het rapport`;

      // Bouw berichten voor LLM
      const llmMessages = [
        { role: "system" as const, content: systemPrompt },
        ...input.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      const response = await invokeLLM({
        messages: llmMessages,
        maxTokens: 512, // beknopte antwoorden voor chat
      });

      const aiContent = response.choices[0]?.message?.content;
      if (!aiContent || typeof aiContent !== "string") {
        throw new Error("Geen antwoord ontvangen van AI");
      }

      return {
        content: aiContent.trim(),
        role: "assistant" as const,
      };
    }),
});
