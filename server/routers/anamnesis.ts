// FILE: server/routers/anamnesis.ts

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { saveAnamnesis, saveReport, getUserReports, getDb } from "../db";
import { reports, anamnesis } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  AI_CORE_MINDSET,
  MULTI_LAYER_ANALYSIS,
  CORRELATION_ENGINE,
  HOLISTIC_CORE_PRINCIPLES,
  AI_KNOWLEDGE_BASE,
  getConditionSpecificKnowledge
} from "../knowledge/holisticBase";
import { invokeLLM, knowledgeBase } from "../_core/llm";
import { notifyOwner } from "../_core/notification";
import { sendReportEmails } from "../_core/email";
import { generateAndStorePDF } from "./pdf-generation";

// ─── CONDITION LABELS ─────────────────────────────────────────────────────────

const conditionLabels: Record<string, string> = {
  chronic_fatigue: "Chronische Vermoeidheid",
  digestive_issues: "Spijsverteringsproblemen",
  solk: "SOLK (Somatisch Onverklaarbare Lichamelijke Klachten)",
  auto_immuun: "Auto-Immuun Gerelateerde Klachten",
  alk: "ALK (Aspecifieke Lichamelijke Klachten)",
};

function getConditionName(conditionType: string): string {
  return conditionLabels[conditionType] || conditionType;
}

// ─── KENNISBANK HELPER ────────────────────────────────────────────────────────

function getKnowledgeForCondition(conditionType: string): string {
  const conditionKeyMap: Record<string, string> = {
    chronic_fatigue: "chronische_vermoeidheid",
    digestive_issues: "spijsverterings_problemen",
    solk: "solk",
    auto_immuun: "auto_immuun_gerelateerde_klachten",
    alk: "alk",
  };

  const key = conditionKeyMap[conditionType];
  const data = knowledgeBase?.conditions_merged?.conditions?.[key];

  if (!data) return "";

  return `
## KENNISBANK: ${getConditionName(conditionType).toUpperCase()}

### Oorzaken
${data.oorzaken?.map((o: string) => `- ${o}`).join("\n") || ""}

### Mechanismen & Interventies
${JSON.stringify(data.mechanismen, null, 2)}

### Coaching Protocol
${JSON.stringify(data.coaching_protocol, null, 2)}
`;
}

// ─── PARSE HELPERS ────────────────────────────────────────────────────────────

function parseArrayField(field: any): string[] {
  if (Array.isArray(field)) return field;
  if (typeof field === "string") {
    try { return JSON.parse(field); } catch { return []; }
  }
  return [];
}

// ─── ROUTER ───────────────────────────────────────────────────────────────────

export const anamnesisRouter = router({

  submit: protectedProcedure
    .input(
      z.object({
        conditionType: z.string().min(1),
        responses: z.record(
          z.string(),
          z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()])
        ).optional().default({}),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();
      console.log(`[Rapport] Submit mutation started — condition: ${input.conditionType}`);

      try {
        // STAP 1: Sla anamnese op
        console.log(`[Rapport] STAP 1: Anamnese opslaan...`);
        const anamnesisResult = await saveAnamnesis(
          ctx.user.id,
          input.conditionType,
          input.responses
        );
        console.log(`[Rapport] STAP 1 OK in ${Date.now() - startTime}ms`);

        // STAP 2: Genereer rapport via LLM
        console.log(`[Rapport] STAP 2: Rapport genereren via LLM...`);
        const inzichtRapport = await generateInzichtRapport(
          input.conditionType,
          input.responses,
          ctx.user.name || "Patiënt"
        );
        console.log(`[Rapport] STAP 2 OK — lengte: ${inzichtRapport.content?.length} in ${Date.now() - startTime}ms`);

        // STAP 3: Sla rapport op
        console.log(`[Rapport] STAP 3: Rapport opslaan...`);
        const insertedAnamnesisId =
          Array.isArray(anamnesisResult) && anamnesisResult.length > 0
            ? anamnesisResult[0].id
            : 1;

        const conditionName = getConditionName(input.conditionType);

        await saveReport(ctx.user.id, insertedAnamnesisId, {
          reportType: "inzicht_rapport",
          title: `Holistische Gezondheidsanalyse - ${conditionName}`,
          content: inzichtRapport.content,
          summary: inzichtRapport.summary,
          keyInsights: inzichtRapport.keyInsights,
          recommendations: inzichtRapport.recommendations,
          protocols: inzichtRapport.protocols,
          scientificReferences: inzichtRapport.scientificReferences,
        });
        console.log(`[Rapport] STAP 3 OK in ${Date.now() - startTime}ms`);

        // STAP 4: Haal rapport ID op
        const db = await getDb();
        let insertedReportId = 0;
        if (db) {
          const latestReport = await db
            .select()
            .from(reports)
            .where(eq(reports.userId, ctx.user.id))
            .orderBy(desc(reports.id))
            .limit(1);
          insertedReportId = latestReport[0]?.id ?? 0;
        }
        console.log(`[Rapport] Rapport ID: ${insertedReportId}`);

        // STAP 5: Email (non-blocking)
        const origin =
          (ctx.req.headers.origin as string) || "https://ai.holistischadviseur.nl";

        sendReportEmails({
          patientName: ctx.user.name || "Patiënt",
          patientEmail: ctx.user.email || "",
          conditionType: input.conditionType,
          reportType: "inzicht_rapport",
          reportId: insertedReportId,
          reportData: {
            title: `Holistische Gezondheidsanalyse - ${conditionName}`,
            content: inzichtRapport.content,
            summary: inzichtRapport.summary,
            keyInsights: inzichtRapport.keyInsights,
            recommendations: inzichtRapport.recommendations,
            protocols: inzichtRapport.protocols,
            scientificReferences: inzichtRapport.scientificReferences,
          },
          reportUrl: `${origin}/rapport`,
        }).catch((err) =>
          console.warn(`[Rapport] Email mislukt:`, err?.message)
        );

        // STAP 6: Notificatie eigenaar (non-blocking)
        notifyOwner({
          title: `🆕 Nieuw Rapport: ${getConditionName(input.conditionType)}`,
          content: `👤 ${ctx.user.name || "Onbekend"} (${ctx.user.email || "geen email"})
📌 ${getConditionName(input.conditionType)}
📅 ${new Date().toLocaleString("nl-NL")}
📝 ${inzichtRapport.summary?.substring(0, 200) || "Geen samenvatting"}`,
        }).catch((err) => console.warn("[Notify] Mislukt:", err));

        console.log(`[Rapport] ✅ Volledig afgerond in ${Date.now() - startTime}ms`);

        return {
          success: true,
          message: "Anamnesis ingediend en rapport gegenereerd",
        };

      } catch (err: any) {
        console.error(`[Rapport] ❌ CRASH op submit na ${Date.now() - startTime}ms:`, err?.message || String(err));
        console.error(`[Rapport] ❌ STACK:`, err?.stack?.split("\n").slice(0, 6).join("\n"));
        throw new Error(err?.message || "Server fout bij verwerken anamnese");
      }
    }),

  getReports: protectedProcedure.query(async ({ ctx }) => {
    const reportsData = await getUserReports(ctx.user.id);

    return reportsData.map((report: any) => {
      let content = report.content || "";
      let summary = report.summary || "";
      let keyInsights = parseArrayField(report.keyInsights);
      let recommendations = parseArrayField(report.recommendations);
      let protocols = report.protocols;
      let scientificReferences = parseArrayField(report.scientificReferences);

      if (typeof protocols === "string") {
        try { protocols = JSON.parse(protocols); } catch { protocols = {}; }
      }

      if (
        typeof content === "string" &&
        (content.startsWith("{") || content.startsWith("["))
      ) {
        try {
          const parsed = JSON.parse(content);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            content = parsed.content || content;
            summary = summary || parsed.summary || "";
            if (!keyInsights.length) keyInsights = parseArrayField(parsed.keyInsights);
            if (!recommendations.length) recommendations = parseArrayField(parsed.recommendations);
            if (!scientificReferences.length) scientificReferences = parseArrayField(parsed.scientificReferences);
          }
        } catch { /* gebruik origineel */ }
      }

      return {
        ...report,
        content,
        summary,
        keyInsights,
        recommendations,
        protocols,
        scientificReferences,
      };
    });
  }),

  deleteReport: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db
        .select()
        .from(reports)
        .where(and(eq(reports.id, input.id), eq(reports.userId, ctx.user.id)))
        .limit(1);

      if (!existing.length) throw new Error("Rapport niet gevonden");

      await db.delete(reports).where(eq(reports.id, input.id));
      return { success: true };
    }),

  regenerateLatestReport: protectedProcedure.mutation(async ({ ctx }) => {
    const mutationId = Math.random().toString(36).substring(7);
    const startTime = Date.now();

    console.log(`[RAPPORT-${mutationId}] ▶ REGENERATE START — User: ${ctx.user.id}`);

    try {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const latestAnamnesis = await db
        .select()
        .from(anamnesis)
        .where(eq(anamnesis.userId, ctx.user.id))
        .orderBy(desc(anamnesis.id))
        .limit(1);

      if (!latestAnamnesis.length) {
        throw new Error("Geen anamnese gevonden. Vul eerst de anamnese in.");
      }

      const anamnesisData = latestAnamnesis[0];
      const conditionName = getConditionName(anamnesisData.conditionType);
      console.log(`[RAPPORT-${mutationId}] Conditie: ${conditionName}`);

      await db.delete(reports).where(eq(reports.userId, ctx.user.id));
      console.log(`[RAPPORT-${mutationId}] Oude rapporten verwijderd`);

      const parsedResponses =
        typeof anamnesisData.responses === "string"
          ? JSON.parse(anamnesisData.responses)
          : (anamnesisData.responses as Record<string, any>) || {};

      const llmStart = Date.now();
      const inzichtRapport = await generateInzichtRapport(
        anamnesisData.conditionType,
        parsedResponses,
        ctx.user.name || "Patiënt"
      );
      console.log(`[RAPPORT-${mutationId}] LLM klaar in ${Date.now() - llmStart}ms`);

      await saveReport(ctx.user.id, anamnesisData.id, {
        reportType: "inzicht_rapport",
        title: `Holistische Gezondheidsanalyse - ${conditionName}`,
        content: inzichtRapport.content,
        summary: inzichtRapport.summary,
        keyInsights: inzichtRapport.keyInsights,
        recommendations: inzichtRapport.recommendations,
        protocols: inzichtRapport.protocols,
        scientificReferences: inzichtRapport.scientificReferences,
      });

      const latestReport = await db
        .select()
        .from(reports)
        .where(eq(reports.userId, ctx.user.id))
        .orderBy(desc(reports.id))
        .limit(1);
      const insertedId = latestReport[0]?.id ?? 0;
      console.log(`[RAPPORT-${mutationId}] Opgeslagen met ID: ${insertedId}`);

      // PDF genereren (non-blocking)
      generateAndStorePDF(
        insertedId,
        {
          title: `Holistische Gezondheidsanalyse - ${conditionName}`,
          content: inzichtRapport.content,
          summary: inzichtRapport.summary,
          keyInsights: inzichtRapport.keyInsights,
          recommendations: inzichtRapport.recommendations,
          protocols: inzichtRapport.protocols,
          scientificReferences: inzichtRapport.scientificReferences,
          reportType: "inzicht_rapport",
          conditionType: anamnesisData.conditionType,
          patientName: ctx.user.name || "Patiënt",
        },
        ctx.user.id
      ).catch((err) => console.warn(`[RAPPORT-${mutationId}] PDF mislukt:`, err?.message));

      // Email (non-blocking)
      const origin =
        (ctx.req.headers.origin as string) || "https://ai.holistischadviseur.nl";

      sendReportEmails({
        patientName: ctx.user.name || "Patiënt",
        patientEmail: ctx.user.email || "",
        conditionType: anamnesisData.conditionType,
        reportType: "inzicht_rapport",
        reportId: insertedId,
        reportData: {
          title: `Holistische Gezondheidsanalyse - ${conditionName}`,
          content: inzichtRapport.content,
          summary: inzichtRapport.summary,
          keyInsights: inzichtRapport.keyInsights,
          recommendations: inzichtRapport.recommendations,
          protocols: inzichtRapport.protocols,
          scientificReferences: inzichtRapport.scientificReferences,
        },
        reportUrl: `${origin}/rapport`,
      }).catch((err) =>
        console.warn(`[RAPPORT-${mutationId}] Email mislukt:`, err?.message)
      );

      console.log(`[RAPPORT-${mutationId}] ✅ Klaar in ${Date.now() - startTime}ms`);

      return {
        success: true,
        message: "Rapport opnieuw gegenereerd",
        timing: { total: Date.now() - startTime },
      };

    } catch (error: any) {
      console.error(`[RAPPORT-${mutationId}] ❌ FOUT na ${Date.now() - startTime}ms:`, error?.message);
      console.error(`[RAPPORT-${mutationId}] STACK:`, error?.stack?.split("\n").slice(0, 5).join("\n"));
      throw error;
    }
  }),
});

// ─── RAPPORT GENERATIE ────────────────────────────────────────────────────────

async function generateInzichtRapport(
  conditionType: string,
  responses: Record<string, any>,
  userName: string
) {
  const conditionName = getConditionName(conditionType);
  const conditionKnowledge = getConditionSpecificKnowledge(conditionType);
  const kennisbankSectie = getKnowledgeForCondition(conditionType);

  const responseLines = Object.entries(responses)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  console.log(`[Rapport] LLM aanroepen voor: ${conditionName}`);

  try {
    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Je bent een holistische gezondheidsadviseur van Holistisch Adviseur (holistischadviseur.nl), opgericht door Abdellah Ouadoudi.

${AI_CORE_MINDSET}

${MULTI_LAYER_ANALYSIS}

${CORRELATION_ENGINE}

${HOLISTIC_CORE_PRINCIPLES}

${AI_KNOWLEDGE_BASE}

${conditionKnowledge}

${kennisbankSectie}

⚠️ TAALREGEL: Gebruik NOOIT technische variabelenamen zoals "digestive_issues", "chronic_fatigue", "solk", "alk", "auto_immuun" in de tekst. Gebruik ALTIJD de Nederlandse naam: "${conditionName}".

Je schrijft UITSLUITEND lopende tekst in alinea's. NOOIT JSON. Alleen gewone Nederlandse zinnen met kopjes.`,
        },
        {
          role: "user",
          content: `Schrijf een persoonlijke holistische analyse voor ${userName} met klachten rondom ${conditionName}.

Antwoorden van de patiënt:
${responseLines || "Geen specifieke antwoorden opgegeven"}

Schrijf het rapport in EXACT deze structuur:

**HERKENNING**
Maak de patiënt zich gezien en begrepen voelen. Persoonlijk, warm, valideer hun ervaringen.

**DE LOGICA**
Leg uit WAAROM dit in hun lichaam gebeurt. Toon correlaties en verbindingen.

**EERSTE INZICHTEN**
Geef 2-3 specifieke inzichten die zij waarschijnlijk nog niet hebben gehoord.

**WAT DIT BETEKENT**
Wat gebeurt er als niets verandert? Maak duidelijk waarom actie nodig is.

**CALL TO ACTION**
Eindig met: "Dit is slechts het begin. Het volledige 6-maanden herstelplan bevat maand-voor-maand instructies, voeding & supplementen, leefstijlprotocollen, en aanbevolen producten & diensten. Klaar om je gezondheid terug te nemen?"

Gebruik de naam ${userName}. Schrijf warm, persoonlijk en wetenschappelijk onderbouwd.

⚠️ Begin met deze disclaimer:
"Dit rapport is geen medisch advies en kan geen medische diagnose vervangen. Raadpleeg altijd een gekwalificeerde medische professional."`,
        },
      ],
    });

    let finalContent = llmResponse.choices[0]?.message?.content;

    if (!finalContent || typeof finalContent !== "string" || finalContent.trim().length < 50) {
      throw new Error("LLM gaf lege of te korte response");
    }

    finalContent = finalContent
      .trim()
      .replace(/^```[\w]*\n?/gm, "")
      .replace(/^```$/gm, "")
      .trim();

    if (finalContent.startsWith("{") || finalContent.startsWith("[")) {
      throw new Error("LLM gaf JSON terug in plaats van tekst");
    }

    console.log(`[Rapport] ✅ LLM content ontvangen — ${finalContent.length} tekens`);

    return {
      content: finalContent,
      ...getDefaultStructuredData(conditionType, userName),
    };

  } catch (error) {
    console.error("[Rapport] LLM fout, fallback wordt gebruikt:", error);
    return getFallbackReport(conditionType, userName);
  }
}

// ─── DEFAULT STRUCTURED DATA ──────────────────────────────────────────────────

function getDefaultStructuredData(conditionType: string, userName: string) {
  const conditionMap: Record<string, any> = {
    chronic_fatigue: {
      summary: `${userName} ervaart chronische vermoeidheid die verband houdt met slaapkwaliteit, darmgezondheid, stressniveau en energiebalans.`,
      keyInsights: [
        "Chronische vermoeidheid heeft vrijwel altijd meerdere onderliggende oorzaken tegelijk",
        "De darm-brein as speelt een cruciale rol bij energieproductie en herstel",
        "Circadiaans ritme herstel is de eerste stap naar duurzame energie",
      ],
      recommendations: [
        "Stel een consistent slaap-waakritme in (zelfde tijden, ook in weekend)",
        "Elimineer suiker en bewerkte voeding gedurende 4 weken",
        "Voeg dagelijkse beweging toe (minimaal 20 minuten wandelen)",
      ],
      protocols: {
        nutrition: [
          "Week 1-4 eliminatiefase: verwijder suiker, gluten, alcohol en bewerkte voeding",
          "Week 5-8 opbouwfase: voeg omega-3 rijke voeding toe (vette vis, lijnzaad, walnoten)",
          "Week 9-12 optimalisatiefase: introduceer adaptogene kruiden zoals ashwagandha en rhodiola",
        ],
        supplements: [
          "Magnesium glycinaat 400mg voor het slapen — ondersteunt slaapkwaliteit en energieproductie",
          "Vitamine B-complex 's ochtends — essentieel voor mitochondriale functie",
          "CoQ10 200mg bij het ontbijt — direct brandstof voor de mitochondriën",
        ],
        lifestyle: [
          "Vaste slaap- en waaktijden — ook in het weekend",
          "Bouw beweging op: begin met 15 minuten wandelen, verhoog elke week",
          "Verminder schermtijd na 21:00",
        ],
        mentalPractices: [
          "5 minuten bewuste ademhaling elke ochtend",
          "Dagelijks energiedagboek bijhouden",
          "Body scan meditatie voor het slapen",
        ],
      },
      scientificReferences: [
        "Klimas, N.G. et al. (2012). Chronic fatigue syndrome: a review. Journal of Clinical Pathology.",
        "Naviaux, R.K. et al. (2016). Metabolic features of chronic fatigue syndrome. PNAS.",
      ],
    },
    digestive_issues: {
      summary: `${userName} ervaart spijsverteringsproblemen die samenhangen met de darm-brein as, het microbioom en leefstijlfactoren.`,
      keyInsights: [
        "70% van het immuunsysteem bevindt zich in de darmen",
        "Stress heeft directe invloed op de darmbeweging en het microbioom",
        "Voeding is de meest directe manier om het microbioom te herstellen",
      ],
      recommendations: [
        "Start met elimineren van gluten en zuivel gedurende 4 weken",
        "Voeg gefermenteerde voeding toe: kefir, zuurkool, kimchi",
        "Eet langzaam en bewust, kauw elke hap minimaal 20 keer",
      ],
      protocols: {
        nutrition: [
          "Week 1-4 eliminatiefase: verwijder gluten, zuivel, suiker en bewerkte voeding",
          "Week 5-8 opbouwfase: introduceer kefir, zuurkool, kimchi en yoghurt",
          "Week 9-12 reparatiefase: voeg L-glutamine, zink en collageen toe",
        ],
        supplements: [
          "Probiotica multi-strain 25 miljard CFU — 30 minuten voor het ontbijt",
          "L-glutamine 5g per dag — herstelt de darmwandbarrière",
          "Spijsverteringsenzymen bij elke maaltijd",
        ],
        lifestyle: [
          "Eet op vaste tijden",
          "Geen schermen tijdens maaltijden",
          "Dagelijks 20-30 minuten lichte beweging na de maaltijd",
        ],
        mentalPractices: [
          "Diepe buikademhaling voor elke maaltijd",
          "Stressmanagement dagboek",
          "Progressieve spierontspanning voor het slapen",
        ],
      },
      scientificReferences: [
        "Mayer, E.A. (2011). Gut feelings. Nature Reviews Neuroscience.",
        "Sonnenburg, J.L. & Bäckhed, F. (2016). Diet-microbiota interactions. Nature.",
      ],
    },
    solk: {
      summary: `${userName} ervaart lichamelijke klachten zonder duidelijke organische oorzaak, waarbij de verbinding tussen lichaam en geest centraal staat.`,
      keyInsights: [
        "SOLK klachten zijn reëel en hebben een neurobiologische basis",
        "Het zenuwstelsel speelt een centrale rol bij lichamelijke signaalverwerking",
        "Herstel vraagt om een geïntegreerde aanpak van lichaam én geest",
      ],
      recommendations: [
        "Start met dagelijkse ademhalingsoefeningen (4-7-8 techniek)",
        "Bouw lichamelijke activiteit geleidelijk op",
        "Onderzoek de verbinding tussen emoties en lichamelijke klachten",
      ],
      protocols: {
        nutrition: [
          "Week 1-4: elimineer ontstekingsbevorderende voeding",
          "Week 5-8: voeg ontstekingsremmende voeding toe",
          "Week 9-12: introduceer adaptogene kruiden",
        ],
        supplements: [
          "Magnesium tauraat 300mg voor het slapen",
          "Omega-3 vetzuren 2g per dag",
          "Vitamine D3 2000-4000IU bij het ontbijt",
        ],
        lifestyle: [
          "Begin met 10 minuten bewegen per dag",
          "Vaste dagstructuur met rust- en activiteitsmomenten",
          "Slaaphygiëne optimaliseren",
        ],
        mentalPractices: [
          "Body scan meditatie dagelijks 15 minuten",
          "Journaling over lichaamssensaties en emoties",
          "Psycho-educatie over stress en lichamelijke klachten",
        ],
      },
      scientificReferences: [
        "Henningsen, P. et al. (2018). Management of functional somatic syndromes. Psychotherapy and Psychosomatics.",
        "van Dessel, N. et al. (2014). Non-pharmacological interventions for somatoform disorders. Cochrane Database.",
      ],
    },
    auto_immuun: {
      summary: `${userName} ervaart auto-immuun gerelateerde klachten waarbij het immuunsysteem ontregeld is en darmherstel de basis vormt.`,
      keyInsights: [
        "Auto-immuunklachten ontstaan door genetische aanleg, darmpermeabiliteit en omgevingsfactoren",
        "De darmen zijn de poort van het immuunsysteem — darmherstel is essentieel",
        "Histamine-intolerantie speelt bij veel auto-immuunaandoeningen een onderschatte rol",
      ],
      recommendations: [
        "Start met een eliminatiedieet om voedingstriggers te identificeren",
        "Ondersteun de darmwand met L-glutamine, zink en collageen",
        "Verlaag ontstekingslast via omega-3, vitamine D3 en kurkuma",
      ],
      protocols: {
        nutrition: [
          "Week 1-6: elimineer gluten, zuivel, nachtschadeplanten, suiker en alcohol",
          "Week 7-12: herïntroductie — één voedingsgroep per week",
          "Onderhoudsfase: mediterraan of AIP dieet",
        ],
        supplements: [
          "Vitamine D3 4000IU + K2 100mcg bij het ontbijt",
          "Omega-3 vetzuren 2-3g per dag",
          "L-glutamine 5g per dag op nuchtere maag",
        ],
        lifestyle: [
          "Stressreductie is niet optioneel — cortisol verergert auto-immuunactiviteit",
          "Minimaal 8 uur slaap",
          "Vermijd toxische belasting waar mogelijk",
        ],
        mentalPractices: [
          "Dagelijkse meditatie of ademhalingsoefeningen",
          "Journaling over symptomen en triggers",
          "Acceptatiegerichte therapie (ACT)",
        ],
      },
      scientificReferences: [
        "Fasano, A. (2012). Leaky gut and autoimmune diseases. Clinical Reviews in Allergy & Immunology.",
        "Vojdani, A. (2014). Environmental triggers and autoimmunity. Autoimmune Diseases.",
      ],
    },
    alk: {
      summary: `${userName} ervaart ALK waarbij beweging, houding, stress en leefstijl de sleutel zijn tot herstel.`,
      keyInsights: [
        "Aspecifieke lichamelijke klachten hebben zelden één oorzaak",
        "Beweging is bewezen effectiever dan rust",
        "Stress en slaaptekort versterken pijnperceptie significant",
      ],
      recommendations: [
        "Start met dagelijks wandelen (20-30 minuten)",
        "Leer correcte houding bij zitten en staan",
        "Voeg core-versterkende oefeningen toe (3x per week)",
      ],
      protocols: {
        nutrition: [
          "Week 1-4: elimineer pro-inflammatoire voeding",
          "Week 5-8: mediterraan dieet als basis",
          "Week 9-12: gerichte suppletie op basis van bloedwaarden",
        ],
        supplements: [
          "Magnesium malaat 400mg",
          "Curcumine met piperine 500mg",
          "Vitamine D3 + K2 bij het ontbijt",
        ],
        lifestyle: [
          "Start met 15 minuten wandelen, elke week 5 minuten toevoegen",
          "Ergonomische aanpassingen op de werkplek",
          "Maximaal 45 minuten aaneengesloten zitten",
        ],
        mentalPractices: [
          "Pijndagboek bijhouden",
          "Progressieve spierontspanning 2x per dag",
          "Acceptatiegerichte aanpak",
        ],
      },
      scientificReferences: [
        "Hayden, J.A. et al. (2005). Exercise therapy for non-specific low back pain. Cochrane Database.",
        "Waddell, G. (2004). The Back Pain Revolution. Churchill Livingstone.",
      ],
    },
  };

  return conditionMap[conditionType] || conditionMap.digestive_issues;
}

// ─── FALLBACK RAPPORT ─────────────────────────────────────────────────────────

function getFallbackReport(conditionType: string, userName: string) {
  const conditionName = getConditionName(conditionType);

  return {
    content: `Dit rapport is geen medisch advies en kan geen medische diagnose vervangen. Raadpleeg altijd een gekwalificeerde medische professional.

**HERKENNING**

Beste ${userName},

Op basis van je antwoorden over ${conditionName} hebben we een eerste analyse gemaakt. Je klachten wijzen op een patroon dat we vaker zien bij mensen met vergelijkbare ervaringen.

**DE LOGICA**

De onderliggende oorzaken zijn vaak een combinatie van leefstijlfactoren, voeding, stress en slaap. Een holistische aanpak richt zich op het herstel van balans door meerdere factoren tegelijk aan te pakken.

**EERSTE INZICHTEN**

Het lichaam geeft met klachten een signaal dat er iets uit balans is. Symptomen zijn geen vijand, maar informatie. De sleutel is de onderliggende oorzaak aanpakken, niet alleen het symptoom onderdrukken.

**WAT DIT BETEKENT**

Zonder aanpak kunnen klachten verergeren. Met de juiste aanpak is herstel goed mogelijk.

**CALL TO ACTION**

Dit is slechts het begin. Het volledige 6-maanden herstelplan bevat maand-voor-maand instructies, voeding & supplementen, leefstijlprotocollen, en aanbevolen producten & diensten. Klaar om je gezondheid terug te nemen?`,
    ...getDefaultStructuredData(conditionType, userName),
  };
}
