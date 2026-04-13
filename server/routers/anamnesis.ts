// FILE: server/routers/anamnesis.ts
// VERBETERD:
// - LLM prompt vraagt expliciet om gut-brain uitleg, ANS/parasympathicus, angstaanvallen
// - 6-maanden plan verplicht stap-voor-stap in de LLM output
// - Rijkere defaultStructuredData met uitgebreide protocols
// - Betere fallback content

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
  getConditionSpecificKnowledge,
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
    try {
      return JSON.parse(field);
    } catch {
      return [];
    }
  }
  return [];
}

// ─── ROUTER ───────────────────────────────────────────────────────────────────

export const anamnesisRouter = router({

  submit: protectedProcedure
    .input(
      z.object({
        conditionType: z.string().min(1),
        responses: z
          .record(
            z.string(),
            z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()])
          )
          .optional()
          .default({}),
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
        console.log(
          `[Rapport] STAP 2 OK — lengte: ${inzichtRapport.content?.length} in ${Date.now() - startTime}ms`
        );

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
        }).catch((err) => console.warn(`[Rapport] Email mislukt:`, err?.message));

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
        console.error(
          `[Rapport] ❌ CRASH op submit na ${Date.now() - startTime}ms:`,
          err?.message || String(err)
        );
        console.error(
          `[Rapport] ❌ STACK:`,
          err?.stack?.split("\n").slice(0, 6).join("\n")
        );
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
        try {
          protocols = JSON.parse(protocols);
        } catch {
          protocols = {};
        }
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
            if (!recommendations.length)
              recommendations = parseArrayField(parsed.recommendations);
            if (!scientificReferences.length)
              scientificReferences = parseArrayField(parsed.scientificReferences);
          }
        } catch {
          /* gebruik origineel */
        }
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
      console.log(
        `[RAPPORT-${mutationId}] LLM klaar in ${Date.now() - llmStart}ms`
      );

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
      ).catch((err) =>
        console.warn(`[RAPPORT-${mutationId}] PDF mislukt:`, err?.message)
      );

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
      console.error(
        `[RAPPORT-${mutationId}] ❌ FOUT na ${Date.now() - startTime}ms:`,
        error?.message
      );
      console.error(
        `[RAPPORT-${mutationId}] STACK:`,
        error?.stack?.split("\n").slice(0, 5).join("\n")
      );
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

  // Detecteer of er angst/paniek signalen zijn in de antwoorden
  const hasAnxiety =
    (responses.anxiety &&
      ["Ja, regelmatig of ernstig", "Ja, heel veel", "Soms"].includes(
        String(responses.anxiety)
      )) ||
    (responses.stress_level && parseInt(String(responses.stress_level)) >= 6) ||
    (responses.anxiety_panic &&
      ["Ja, regelmatig", "Soms"].includes(String(responses.anxiety_panic)));

  const anxietyInstruction = hasAnxiety
    ? `
⚡ BELANGRIJK: Deze patiënt rapporteert angst of hoge stress. Leg in de analyse uit hoe:
1. Darmpermeabiliteit ("leaky gut") afvalstoffen in de bloedbaan laat die uiteindelijk de bloedhersenbarrière kunnen bereiken en neurotransmitters/hersenfunctie verstoren
2. Het autonome zenuwstelsel (sympathicus vs parasympathicus) uit balans raakt bij chronische klachten
3. Concrete stappen om de parasympathicus te activeren (ademhaling, koud water, beweging, natuur)
Schrijf dit in begrijpelijke taal, zonder medisch jargon, maar wetenschappelijk correct.`
    : "";

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

Je schrijft UITSLUITEND lopende tekst in alinea's. NOOIT JSON. Alleen gewone Nederlandse zinnen met kopjes (gebruik ** voor vetgedrukte koppen).

STIJL: Warm, persoonlijk, wetenschappelijk onderbouwd. Schrijf zoals een expert die ook echt begaan is met de patiënt.`,
        },
        {
          role: "user",
          content: `Schrijf een uitgebreid, persoonlijk holistisch rapport voor ${userName} met klachten rondom ${conditionName}.

Antwoorden van de patiënt:
${responseLines || "Geen specifieke antwoorden opgegeven"}

${anxietyInstruction}

Schrijf het rapport in EXACT deze structuur, met ruime toelichting bij elk onderdeel:

**HERKENNING**
Maak de patiënt zich gezien en begrepen. Persoonlijk en warm — gebruik hun naam. Benoem 2-3 specifieke dingen uit hun antwoorden die je herkent. Valideer hun ervaringen.

**WAT ER SPEELT IN JE LICHAAM**
Leg in begrijpelijke taal uit WAT er fysiologisch gebeurt. Beschrijf de onderliggende mechanismen. ${hasAnxiety ? "Leg HIER de darm-hersen-as uit en hoe darmpermeabiliteit angst kan veroorzaken. Leg de sympathicus vs parasympathicus balans uit en waarom die verstoord is. Maak dit concreet: 'Als je darmen afvalstoffen doorlaten...' — schrijf dit in minimaal 2 alinea's." : "Beschrijf de relevante fysiologische mechanismen voor deze patiënt."}

**DE VERBANDEN DIE JIJ MISSCHIEN NOG NIET ZAG**
Beschrijf 3-4 specifieke correlaties tussen de antwoorden van de patiënt. Verbind slaap met energie, voeding met klachten, stress met lichamelijke symptomen. Wees concreet en noemelijk — niet generiek.

**EERSTE AANBEVELINGEN**
Geef 5-7 concrete, direct uitvoerbare stappen die de patiënt MORGEN kan beginnen. Wees specifiek: doseringen, tijdstippen, productnamen, hoe lang. Geen vage adviezen.

**JOUW 6-MAANDEN HERSTELPLAN (PREVIEW)**
Beschrijf kort per maand de focus:
- Maand 1: [focus en waarom dit de eerste stap is]
- Maand 2: [focus en wat dit opbouwt op maand 1]
- Maand 3-6: [kort: "ontgrendel het volledige plan via holistischadviseur.nl"]

**CALL TO ACTION**
Eindig persoonlijk met: "Dit is jouw startpunt, ${userName}. Het volledige 6-maanden herstelplan bevat week-voor-week instructies, complete voedings- en supplementenprotocollen, en wetenschappelijke onderbouwing. Klaar om je gezondheid terug te nemen?"

Begin met de volgende disclaimer op een aparte regel:
"⚠️ Dit rapport is geen medisch advies en vervangt geen medische diagnose of behandeling. Raadpleeg altijd een gekwalificeerde medische professional."

Schrijf minimaal 800 woorden. Wees grondig, persoonlijk en nuttig.`,
        },
      ],
    });

    let finalContent = llmResponse.choices[0]?.message?.content;

    if (
      !finalContent ||
      typeof finalContent !== "string" ||
      finalContent.trim().length < 100
    ) {
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

    console.log(
      `[Rapport] ✅ LLM content ontvangen — ${finalContent.length} tekens`
    );

    return {
      content: finalContent,
      ...getDefaultStructuredData(conditionType, userName, responses),
    };
  } catch (error) {
    console.error("[Rapport] LLM fout, fallback wordt gebruikt:", error);
    return getFallbackReport(conditionType, userName);
  }
}

// ─── DEFAULT STRUCTURED DATA ──────────────────────────────────────────────────

function getDefaultStructuredData(
  conditionType: string,
  userName: string,
  responses: Record<string, any> = {}
) {
  const hasAnxiety =
    responses.anxiety &&
    ["Ja, regelmatig of ernstig", "Ja, heel veel", "Soms"].includes(
      String(responses.anxiety)
    );

  const sharedInsights = hasAnxiety
    ? [
        "Je darmen en hersenen communiceren via de nervus vagus — bij darmontsteking kunnen signalen de hersenen bereiken en angstgevoelens veroorzaken",
        "Darmpermeabiliteit ('leaky gut') laat bacteriële afvalstoffen in de bloedbaan die via de bloedhersenbarrière de hersenfunctie kunnen verstoren",
        "Je zenuwstelsel staat mogelijk te veel in de 'aan-modus' (sympathicus). Dagelijkse ademhalingsoefeningen activeren aantoonbaar de parasympathicus",
      ]
    : [];

  const conditionMap: Record<string, any> = {

    chronic_fatigue: {
      summary: `${userName} ervaart chronische vermoeidheid die verband houdt met slaapkwaliteit, darmgezondheid, mitochondriale functie en het autonome zenuwstelsel.`,
      keyInsights: [
        ...sharedInsights,
        "Chronische vermoeidheid heeft vrijwel altijd meerdere onderliggende oorzaken tegelijk — een enkelvoudige aanpak werkt niet",
        "De mitochondriën (energiefabrieken van je cellen) functioneren suboptimaal — specifieke supplementen kunnen dit direct verbeteren",
        "Post-exertionele malaise betekent dat het lichaam niet herstelt van inspanning zoals het zou moeten — de volgorde van interventies is cruciaal",
        "De darm-hersen-as speelt een directe rol bij energieproductie via serotonine en het microbioom",
      ].filter(Boolean),
      recommendations: [
        "Begin direct met Magnesium glycinaat 400mg voor het slapen — verbetert slaapkwaliteit en energieproductie in de eerste week",
        "Stel een vast slaap-waakritme in: zelfde tijden ook in het weekend — dit is de meest effectieve eerste stap",
        "Elimineer suiker en bewerkte voeding gedurende 4 weken — dit verlaagt de laaggradige ontsteking die energie verbruikt",
        "Voeg CoQ10 100-200mg bij het ontbijt toe — dit is direct brandstof voor de mitochondriën",
        "Neem Vitamine B-complex 's ochtends — essentieel voor de energieproductie op celniveau",
        "Begin met 10 minuten wandelen per dag — stop VOOR je uitgeput raakt (dit is de sleutelregel bij ME/CVS)",
        "Houd een energiedagboek bij: noteer dagelijks je energieniveau 1-10 en wat je deed",
      ],
      protocols: {
        nutrition: [
          "Week 1-4 eliminatiefase: verwijder suiker, gluten, alcohol, bewerkte voeding en plantaardige oliën",
          "Week 5-8 opbouwfase: voeg vette vis (2-3x week), olijfolie en gefermenteerde voeding toe",
          "Week 9-12 optimalisatiefase: introduceer adaptogene kruiden (ashwagandha, rhodiola) en functionele paddenstoelen (lion's mane)",
          "Eet elke 4-5 uur op vaste tijden om de bloedsuiker stabiel te houden — schommelingen verergeren vermoeidheid",
        ],
        supplements: [
          "Magnesium glycinaat 400mg voor het slapen — slaapkwaliteit en ontspanning spieren",
          "Vitamine B-complex 's ochtends — mitochondriale energieproductie (kies methylB12 en methylfolaat)",
          "CoQ10 100-200mg bij ontbijt — directe cel-energie (bij voorkeur ubiquinol vorm)",
          "Vitamine D3 2000-4000IU + K2 100mcg — immuunregulatie en energie",
          "Omega-3 EPA/DHA 2g per dag — ontstekingsremming en hersenfunctie",
          "L-glutamine 5g op nuchtere maag — darmwandherstel en leaky gut",
        ],
        lifestyle: [
          "Vaste slaap- en waaktijden (ook weekend) — dit is de meest effectieve stap voor energieherstel",
          "Geen schermen na 21:00 — blauw licht onderdrukt melatonine en verstoort slaaparchitectuur",
          "Beweging opbouwen: week 1-4: 10 min wandelen, week 5-8: 15-20 min, week 9-12: 20-30 min",
          "Maximale activiteitsduur bewaken — stop altijd VOOR je uitgeput raakt",
          "Koude douche (30 sec koud als afsluiting) — activeert vagus zenuw en parasympathicus",
        ],
        mentalPractices: [
          "4-7-8 ademhaling 3x per dag (inademen 4s, vasthouden 7s, uitademen 8s) — activeert parasympathicus",
          "Energiedagboek bijhouden: dagelijks energie 1-10 + activiteiten",
          "Body scan meditatie voor het slapen — verlaagt cortisol en verbetert slaapdiepte",
          "Grenzen stellen en communiceren — verborgen energieverspillers elimineren",
        ],
      },
      scientificReferences: [
        "Naviaux, R.K. et al. (2016). Metabolic features of chronic fatigue syndrome. PNAS, 113(37).",
        "Klimas, N.G. et al. (2012). Chronic fatigue syndrome: a review. Journal of Clinical Pathology.",
        "Jason, L.A. et al. (2015). Pacing and ME/CFS: guidelines for patient management. AAEM.",
        "Myhill, S. et al. (2009). Chronic fatigue syndrome and mitochondrial dysfunction. International Journal of Clinical and Experimental Medicine.",
      ],
    },

    digestive_issues: {
      summary: `${userName} ervaart spijsverteringsproblemen die samenhangen met de darm-hersen-as, het microbioom en leefstijlfactoren. De darmen beïnvloeden via de nervus vagus direct de hersenfunctie, stemming en energieniveaus.`,
      keyInsights: [
        ...sharedInsights,
        "70% van het immuunsysteem bevindt zich in de darmen — darmgezondheid is immuungezondheid",
        "Het darmmicrobioom produceert meer dan 90% van je serotonine — darmklachten zijn direct verbonden met stemming en mentale helderheid",
        "Stress vertraagt letterlijk de darmbeweging via het autonome zenuwstelsel — de parasympathicus is essentieel voor spijsvertering",
        "Antibiotica vernietigt zowel slechte als goede bacteriën — herstel duurt maanden en vereist actieve opbouw",
      ].filter(Boolean),
      recommendations: [
        "Start direct met multi-strain probiotica 25 miljard CFU op nuchtere maag — begin hier vandaag mee",
        "Elimineer gluten en zuivel 4 weken volledig — dit zijn de meest voorkomende triggers voor darmontsteking",
        "Voeg L-glutamine 5g op nuchtere maag toe (2x per dag) — herstelt de darmbarrière",
        "Kauw elke hap 20 keer — spijsvertering begint in de mond, dit is niet overdreven",
        "Voeg dagelijks zuurkool (2 eetlepels) of kefir (250ml) toe — levende culturen herstellen het microbioom",
        "Eet op vaste tijden, nooit haastig — stress bij het eten schakelt de spijsvertering letterlijk uit",
        "Neem spijsverteringsenzymen bij elke maaltijd de eerste 8 weken — ontlast de alvleesklier",
      ],
      protocols: {
        nutrition: [
          "Week 1-4 Remove: elimineer gluten, zuivel, suiker, bewerkte voeding en alcohol",
          "Week 5-8 Reinoculate: voeg kefir, zuurkool, kimchi en probiotica toe",
          "Week 9-12 Repair: L-glutamine, zink carnosine, bone broth dagelijks",
          "Week 13+ Rebalance: herïntroductie één voedingsgroep per week, dagboek bijhouden",
        ],
        supplements: [
          "Probiotica multi-strain 25 miljard CFU — 30 min voor het ontbijt op nuchtere maag",
          "L-glutamine 5g opgelost in water — 2x per dag op nuchtere maag (ochtend + voor bed)",
          "Spijsverteringsenzymen (brede spectrum) bij elke maaltijd — eerste 8 weken",
          "Zink carnosine 75mg — darmwandhescherming en herstel tight junctions",
          "Omega-3 EPA/DHA 2g per dag — ontstekingsremming in de darmwand",
          "Vitamine D3 2000IU — immuunregulatie in de darmen",
        ],
        lifestyle: [
          "Eet op 3 vaste tijden per dag — vermijd snacken tussendoor",
          "10 minuten rusten na elke maaltijd — geen haast of schermen",
          "Diepe buikademhaling (5 diepe ademhalingen) VOOR elke maaltijd — activeert parasympathicus",
          "Dagelijks 20-30 minuten wandelen na de avondmaaltijd — stimuleert darmperistaltiek",
          "Maximaal 45 minuten aaneengesloten zitten — beweging bevordert darmfunctie",
        ],
        mentalPractices: [
          "Darm-stress dagboek: houd bij wanneer klachten erger zijn en wat er emotioneel speelde",
          "Progressieve spierontspanning voor het slapen — verlaagt cortisol en ontspant darmspieren",
          "Bewust eten: geen schermen, geen haast, proef je voedsel bewust",
          "Stress-interventieplan: identificeer je 3 grootste stressors en maak een actieplan",
        ],
      },
      scientificReferences: [
        "Mayer, E.A. (2011). Gut feelings: the emerging biology of gut–brain communication. Nature Reviews Neuroscience.",
        "Sonnenburg, J.L. & Bäckhed, F. (2016). Diet–microbiota interactions as moderators of human metabolism. Nature.",
        "Fasano, A. (2012). Leaky gut and autoimmune diseases. Clinical Reviews in Allergy & Immunology.",
        "Cryan, J.F. et al. (2019). The microbiota-gut-brain axis. Physiological Reviews.",
      ],
    },

    solk: {
      summary: `${userName} ervaart lichamelijke klachten (SOLK) waarbij de darm-hersen-as, het autonome zenuwstelsel en de verwerking van prikkels centraal staan. Deze klachten zijn reëel en hebben een neurobiologische basis.`,
      keyInsights: [
        ...sharedInsights,
        "SOLK-klachten zijn aantoonbaar zichtbaar in hersenscans — ze zijn reëel, niet psychisch",
        "Het zenuwstelsel heeft geleerd om prikkels anders te verwerken — dit is aanpasbaar via gerichte interventies",
        "De polyvagaaltheorie legt uit waarom chronische stress lichamelijke klachten veroorzaakt zonder organische oorzaak",
        "Gradual Exposure en ACT-therapie zijn de meest bewezen behandelmethoden bij SOLK",
      ].filter(Boolean),
      recommendations: [
        "Begin direct met 4-7-8 ademhaling 3x per dag — dit is de snelste manier om het zenuwstelsel te kalmeren",
        "Houd 4 weken een symptoomdagboek bij — noteer klachten, tijdstip, situatie en emotie ervoor",
        "Start met 10 minuten wandelen per dag — gradueel bewegen is bewezen effectief bij SOLK",
        "Overleg met je huisarts over verwijzing naar een CGT of ACT therapeut gespecialiseerd in SOLK",
        "Voeg Magnesium tauraat 300mg voor het slapen toe — kalmerende werking op het zenuwstelsel",
        "Elimineer suiker en cafeïne gedurende 2 weken — beide verhogen de stressreactie van het zenuwstelsel",
        "Plan dagelijks 20 minuten herstelactiviteit: wandelen, warm bad, rustige muziek",
      ],
      protocols: {
        nutrition: [
          "Week 1-4: elimineer suiker, alcohol, cafeïne en bewerkte voeding",
          "Week 5-8: anti-inflammatoir mediterraan dieet als basis",
          "Week 9-12: voeg adaptogene kruiden toe: ashwagandha 300mg, holy basil 500mg",
          "Eet op vaste tijden — onregelmatig eten vergroot stress voor het zenuwstelsel",
        ],
        supplements: [
          "Magnesium tauraat 300mg voor het slapen — kalmerend voor het zenuwstelsel",
          "Omega-3 EPA/DHA 2g per dag — neurobescherming en ontstekingsremming",
          "Vitamine D3 2000-4000IU — immuunregulatie en stemming",
          "Ashwagandha (KSM-66) 300mg 's ochtends — verlaagt cortisol en stressreactiviteit",
          "L-theanine 200mg bij hoge stress — kalmerend zonder sedatie",
        ],
        lifestyle: [
          "Vaste dagstructuur met duidelijke rust- en activiteitsmomenten",
          "Gradual activity: begin 10 min, verhoog elke 2 weken met 5 minuten",
          "Slaaphygiëne: vaste tijden, donker, 18°C, geen schermen 1 uur voor bed",
          "Zorg voor dagelijks daglicht — minimaal 30 minuten buiten",
          "Sociaal contact plannen — isolatie verergert SOLK aantoonbaar",
        ],
        mentalPractices: [
          "Body scan meditatie dagelijks 15 minuten — verbetert lichaamsbewustzijn",
          "Journaling 10 minuten per dag — vrij schrijven over ervaringen en gevoelens",
          "Cognitieve herstructurering: catastroferende gedachten identificeren en bijstellen",
          "Polyvagaal oefeningen: zingen, hummen, sociale lach — activeren ventrale vagus",
        ],
      },
      scientificReferences: [
        "Henningsen, P. et al. (2018). Management of functional somatic syndromes and bodily distress. Psychotherapy and Psychosomatics.",
        "van Dessel, N. et al. (2014). Non-pharmacological interventions for somatoform disorders. Cochrane Database of Systematic Reviews.",
        "Porges, S.W. (2011). The Polyvagal Theory: Neurophysiological Foundations of Emotions. Norton.",
        "Deary, V. et al. (2007). The cognitive behavioural model of medically unexplained symptoms. Clinical Psychology Review.",
      ],
    },

    auto_immuun: {
      summary: `${userName} ervaart auto-immuun gerelateerde klachten waarbij het immuunsysteem ontregeld is. Darmherstel, het verlagen van de ontstekingslast en het reguleren van het zenuwstelsel vormen de basis van herstel.`,
      keyInsights: [
        ...sharedInsights,
        "Auto-immuunziekten ontstaan door een samenspel van genetische aanleg, darmpermeabiliteit en omgevingsfactoren — alle drie zijn beïnvloedbaar",
        "De Fasano-theorie: leaky gut is een noodzakelijke voorwaarde voor auto-immuunziekte — darmherstel is dus fundamenteel",
        "Vitamine D is geen vitamine maar een hormoon dat het immuunsysteem direct moduleert — een tekort verhoogt auto-immuunactiviteit significant",
        "Histamine-intolerantie speelt bij 30-40% van auto-immuunpatiënten een onderschatte rol",
      ].filter(Boolean),
      recommendations: [
        "Start direct met AIP eliminatiedieet — dit is de meest bewezen voedingsaanpak bij auto-immuunziekten",
        "Laat je vitamine D niveau testen — streef naar 100-150 nmol/L en supplement D3 4000-6000IU + K2",
        "Neem omega-3 EPA/DHA 2-3g per dag — klinisch bewezen anti-inflammatoir op gelijke hoogte als ibuprofenwerkzaamheid",
        "Voeg L-glutamine 5g 2x per dag toe — herstelt de darmbarrière die bij auto-immuun altijd is aangetast",
        "Minimaliseer stress actief — cortisol triggert immuunactiviteit en verergert auto-immuunreacties",
        "Laat ontstekingsmarkers testen: CRP, BSE, cytokines en specifieke antilichamen",
        "Overweeg Reishi paddenstoel 600mg per dag — moduleert (niet onderdrukt) het immuunsysteem",
      ],
      protocols: {
        nutrition: [
          "Week 1-6 AIP eliminatiefase: verwijder gluten, zuivel, eieren, nachtschadeplanten, noten, zaden, peulvruchten",
          "Week 7-12 herïntroductie: één voedingsgroep per week terugintroduceren, 72 uur observeren",
          "Onderhoudsfase: mediterraan/AIP hybride dieet op basis van jouw tolerantielijst",
          "Vermijd hoog-histamine voeding als je histaminegevoelig bent: oude kazen, rode wijn, tomaten, spinazie",
        ],
        supplements: [
          "Vitamine D3 4000-6000IU + K2 100-200mcg bij het ontbijt — immuunmodulatie",
          "Omega-3 EPA/DHA 2-3g per dag bij de maaltijd — pro-resolvins aanmaken",
          "L-glutamine 5g 2x per dag op nuchtere maag — darmbarrière herstel",
          "Curcumine (BCM-95 of Meriva) 500-1000mg — NF-kB ontstekingsremmend",
          "Reishi paddenstoelextract 600mg — immuunmodulatie via beta-glucanen",
          "Zink 15-30mg — tight junction herstel en immuunbalans",
        ],
        lifestyle: [
          "Stress is niet optioneel te beperken — chronisch cortisol triggert auto-immuunactiviteit",
          "Minimaal 8-9 uur slaap — tijdens slaap vindt immuunregulatie en celreparatie plaats",
          "Dagelijks 30 minuten matige beweging — heeft direct anti-inflammatoir effect",
          "Vermijd toxinebelasting: biologische voeding, plasticvrije bewaring, schone schoonmaakmiddelen",
          "Koudwatertherapie (30 sec koud douchen) — moduleert het immuunsysteem",
        ],
        mentalPractices: [
          "Dagelijks 10-15 minuten meditatie — verlaagt cortisol en pro-inflammatoire cytokinen",
          "ACT-therapie bij chronische ziekte — acceptatie verlaagt aantoonbaar de ontstekingslast",
          "Symptoomdagboek: triggers identificeren (voeding, stress, slaap, seizoen)",
          "Positieve sociale verbinding — isolatie verhoogt cortisol en immuunactiviteit",
        ],
      },
      scientificReferences: [
        "Fasano, A. (2012). Leaky gut and autoimmune diseases. Clinical Reviews in Allergy & Immunology.",
        "Vojdani, A. (2014). Environmental triggers and autoimmunity. Autoimmune Diseases.",
        "Holick, M.F. (2007). Vitamin D deficiency. New England Journal of Medicine.",
        "Calder, P.C. (2015). Marine omega-3 fatty acids and inflammatory processes. Biochimica et Biophysica Acta.",
      ],
    },

    alk: {
      summary: `${userName} ervaart aspecifieke lichamelijke klachten waarbij beweging, voeding, stress en slaap de sleutelfactoren zijn. Een geïntegreerde aanpak richt zich op het verlagen van de ontstekingslast en het opbouwen van functionele belastbaarheid.`,
      keyInsights: [
        ...sharedInsights,
        "Aspecifieke klachten hebben zelden één oorzaak — een integrale aanpak werkt significant beter dan enkel pijnstilling",
        "Beweging is bij ALK bewezen effectiever dan rust — het zenuwstelsel moet leren dat beweging veilig is",
        "Centrale sensitisatie: chronische pijn verandert hoe het zenuwstelsel pijnprikkels verwerkt — dit is terugkeerbaar",
        "Slaaptekort verlaagt de pijndrempel met 25% al na 2 nachten — slaap is pijntherapie",
      ].filter(Boolean),
      recommendations: [
        "Start direct met 15-20 minuten wandelen per dag — dit is de meest effectieve eerste stap bij ALK",
        "Voeg Magnesium malaat 400mg toe (200mg ochtend + 200mg voor bed) — specifiek onderzocht bij spierpijn",
        "Elimineer suiker, bewerkte voeding en alcohol — verhogen chronische ontsteking en pijngevoeligheid",
        "Neem Curcumine met piperine 500mg per dag — gelijk aan ibuprofenwerkzaamheid zonder maagschade",
        "Pas ergonomie aan: beeldscherm op ooghoogte, elk uur 5 minuten bewegen",
        "Stel vaste slaaptijden in — slaaptekort is de meest onderschatte factor bij chronische pijn",
        "Overweeg aquatherapie (zwemmen/aquajoggen) — low-impact en bewezen effectief bij ALK",
      ],
      protocols: {
        nutrition: [
          "Week 1-4: elimineer pro-inflammatoire voeding: suiker, bewerkte producten, transvetten, alcohol",
          "Week 5-8: mediterraan dieet als basis — vis 3x week, olijfolie, groenten, fruit, noten",
          "Week 9-12: gerichte suppletie op basis van bloedwaarden",
          "Vermijd nachtschadeplanten als je opmerkt dat deze klachten verergeren",
        ],
        supplements: [
          "Magnesium malaat 400mg gesplitst (200mg ontbijt, 200mg voor bed) — spierpijn en energie",
          "Curcumine (BCM-95) 500mg met piperine — ontstekingsremming gelijkwaardig aan NSAID",
          "Vitamine D3 2000-4000IU + K2 100mcg — immuunregulatie en pijnmodulatie",
          "Omega-3 EPA/DHA 2g per dag — prostaglandine verlaging",
          "GABA 500mg + L-theanine 200mg voor het slapen — pijnvrije nachtrust",
        ],
        lifestyle: [
          "Dagelijkse beweging opbouwen: week 1: 15 min, week 2: 20 min, week 3: 25 min",
          "Ergonomische aanpassingen werkplek — elke 45 minuten bewegen",
          "Warmte-koude wisselbaden: 2 min warm, 30 sec koud, 3 cycli",
          "Vaste slaaptijden — slaaptekort verhoogt pijngevoeligheid significant",
          "Daglicht: minimaal 30 minuten buiten per dag",
        ],
        mentalPractices: [
          "Pijndagboek: triggers, intensiteit, wat helpt — patronen zichtbaar maken",
          "MBSR (Mindfulness Based Stress Reduction) — wetenschappelijk bewezen bij chronische pijn",
          "Progressieve spierontspanning 2x per dag — direct pijnverlagend effect",
          "Pijnneurologie educatie: begrijpen HOE pijn werkt vermindert pijnintensiteit aantoonbaar",
        ],
      },
      scientificReferences: [
        "Hayden, J.A. et al. (2005). Exercise therapy for non-specific low back pain. Cochrane Database.",
        "Moseley, G.L. (2003). A pain neuromatrix approach to patients with chronic pain. Manual Therapy.",
        "Walker, M. (2017). Why We Sleep: Unlocking the Power of Sleep and Dreams. Scribner.",
        "Daily, J.W. et al. (2016). Efficacy of turmeric extracts in pain treatment. Journal of Medicinal Food.",
      ],
    },
  };

  return (
    conditionMap[conditionType] || {
      ...conditionMap.digestive_issues,
      summary: `${userName} ervaart klachten waarvoor een holistische aanpak via voeding, leefstijl en mentale gezondheid het meest effectief is.`,
    }
  );
}

// ─── FALLBACK RAPPORT ─────────────────────────────────────────────────────────

function getFallbackReport(conditionType: string, userName: string) {
  const conditionName = getConditionName(conditionType);

  return {
    content: `⚠️ Dit rapport is geen medisch advies en vervangt geen medische diagnose of behandeling. Raadpleeg altijd een gekwalificeerde medische professional.

**HERKENNING**

Beste ${userName},

Op basis van je antwoorden over ${conditionName} hebben we een persoonlijke analyse gemaakt. Je klachten wijzen op een patroon dat we vaker zien — en het goede nieuws is dat er concrete stappen zijn die je kunt zetten.

**WAT ER SPEELT IN JE LICHAAM**

Bij ${conditionName} spelen vaak meerdere systemen tegelijk een rol. Je darmen, je zenuwstelsel en je immuunsysteem zijn nauw verbonden. De darm-hersen-as — de directe verbinding tussen je darmen en hersenen via de nervus vagus — zorgt ervoor dat wat in je darmen gebeurt, direct invloed heeft op je energie, stemming en mentale helderheid.

Wanneer de darmbarrière doorlaatbaarder wordt dan normaal, kunnen afvalstoffen in de bloedbaan terechtkomen. Dit veroorzaakt een laaggradige ontsteking door het hele lichaam en kan via de bloedhersenenbarrière ook de hersenfunctie beïnvloeden. Dit mechanisme verklaart waarom veel mensen met ${conditionName} ook last hebben van hersenmist, stemmingswisselingen of angstgevoelens.

Tegelijkertijd kan je autonome zenuwstelsel uit balans zijn. Bij chronische klachten staat het lichaam te veel in de 'aan-modus' (sympathicus). Dit verbruikt energie, verstoort de spijsvertering en verhoogt ontstekingsreacties. De parasympathicus — je herstelmodus — activeer je actief via ademhaling, beweging en rust.

**DE VERBANDEN**

De klachten die je beschrijft hangen met elkaar samen. Slaaptekort verhoogt ontstekingsmarkers. Stress verstoort de darmfunctie. Darmklachten beïnvloeden je energie. Energie beïnvloedt je motivatie om te bewegen. Dit zijn geen losse problemen maar één systeem dat uit balans is.

**EERSTE AANBEVELINGEN**

Begin morgen met deze stappen: (1) Stel vaste slaaptijden in — zelfde tijden ook in het weekend. (2) Elimineer suiker en bewerkte voeding de komende 4 weken. (3) Voeg Magnesium glycinaat 400mg toe voor het slapen. (4) Begin met 10 minuten wandelen per dag. (5) Doe 3x per dag 5 diepe buikademhalingen — dit activeert direct je parasympathicus.

**CALL TO ACTION**

Dit is jouw startpunt, ${userName}. Het volledige 6-maanden herstelplan bevat week-voor-week instructies, complete voedings- en supplementenprotocollen, en wetenschappelijke onderbouwing. Klaar om je gezondheid terug te nemen?`,
    ...getDefaultStructuredData(conditionType, userName),
  };
}
