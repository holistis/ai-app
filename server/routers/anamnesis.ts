import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { saveAnamnesis, saveReport, getUserReports, getDb } from "../db";
import { reports, anamnesis } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { 
  AI_CORE_MINDSET, 
  MULTI_LAYER_ANALYSIS, 
  CORRELATION_ENGINE, 
  VALIDATION_SYSTEM, 
  HOLISTIC_CORE_PRINCIPLES, 
  REPORT_STRUCTURE,
  SLEEP_REBOOT_PROTOCOL,
  AI_KNOWLEDGE_BASE,
  getConditionSpecificKnowledge 
} from "../knowledge/holisticBase";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";
import { sendReportEmails } from "../_core/email";
import { normalizeInput, filterByConfidence } from "../knowledge/input_normalization";
import { generateAndStorePDF } from "./pdf-generation";

// ✅ Centrale plek voor Nederlandse namen — nooit meer technische namen in rapporten
const conditionLabels: Record<string, string> = {
  chronic_fatigue: "Chronische Vermoeidheid",
  digestive_issues: "Spijsverteringsproblemen",
  solk: "SOLK (Somatisch Onverklaarbare Lichamelijke Klachten)",
  alk: "ALK (Aspecifieke Lichamelijke Klachten)",
};

function getConditionName(conditionType: string): string {
  return conditionLabels[conditionType] || conditionType;
}

// Helper to safely parse JSON array fields from MySQL
function parseArrayField(field: any): string[] {
  if (Array.isArray(field)) return field;
  if (typeof field === 'string') {
    try { return JSON.parse(field); } catch { return []; }
  }
  return [];
}

export const anamnesisRouter = router({
  submit: protectedProcedure
    .input(
      z.object({
        conditionType: z.string().min(1),
        responses: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()])).optional().default({}),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const mutationStartTime = Date.now();
      const startTime = Date.now();
      console.log(`[Rapport] Submit mutation started`);
      
      const anamnesisStart = Date.now();
      const anamnesisResult = await saveAnamnesis(
        ctx.user.id,
        input.conditionType,
        input.responses
      );
      console.log(`[Rapport] Anamnesis saved in ${Date.now() - anamnesisStart}ms`);

      const llmStart = Date.now();
      const inzichtRapport = await generateInzichtRapport(
        input.conditionType,
        input.responses,
        ctx.user.name || "Patiënt"
      );
      console.log(`[Rapport] LLM response received in ${Date.now() - llmStart}ms`);

      const insertedAnamnesisId = Array.isArray(anamnesisResult) && anamnesisResult.length > 0 ? anamnesisResult[0].id : 1;

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

      // Haal het echte rapport ID op
      const db = await getDb();
      let insertedReportId = 0;
      if (db) {
        const latestReport = await db.select().from(reports)
          .where(eq(reports.userId, ctx.user.id))
          .orderBy(desc(reports.id))
          .limit(1);
        insertedReportId = latestReport[0]?.id ?? 0;
      }

      console.log(`[Rapport] Report saved with ID: ${insertedReportId}, total time so far: ${Date.now() - startTime}ms`);
      
      const origin = (ctx.req.headers.origin as string) || "https://ai.holistischadviseur.nl";
      const emailStart = Date.now();
      console.log(`[Rapport] Starting email send with PDF generation...`);
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
      }).then(() => {
        console.log(`[Rapport] Email sent successfully in ${Date.now() - emailStart}ms`);
      }).catch(err => {
        console.warn(`[Rapport] Email send failed after ${Date.now() - emailStart}ms:`, err);
      });

      try {
        const conditionLabel = getConditionName(input.conditionType);
        await notifyOwner({
          title: `🆕 Nieuw Inzicht Rapport: ${conditionLabel}`,
          content: `📋 Patiënt: ${ctx.user.name || "Onbekend"} (${ctx.user.email || "geen email"})
📌 Klacht: ${conditionLabel}
📅 Datum: ${new Date().toLocaleString("nl-NL")}

📝 Samenvatting:
${inzichtRapport.summary?.substring(0, 300) || "Geen samenvatting"}

📧 E-mail met PDF verstuurd naar eigenaar en patiënt`,
        });
      } catch (notifError) {
        console.warn("[Notify] Failed to notify owner:", notifError);
      }

      const mutationEndTime = Date.now();
      console.log(`[Rapport] Submit mutation completed in ${mutationEndTime - mutationStartTime}ms`);
      
      return {
        success: true,
        message: "Anamnesis ingediend en rapport gegenereerd",
      };
    }),

  getReports: protectedProcedure
    .query(async ({ ctx }) => {
      const reports = await getUserReports(ctx.user.id);
      
      return reports.map((report: any) => {
        let content = report.content || "";
        let summary = report.summary || "";
        let keyInsights = parseArrayField(report.keyInsights);
        let recommendations = parseArrayField(report.recommendations);
        let protocols = parseArrayField(report.protocols);
        let scientificReferences = parseArrayField(report.scientificReferences);
        
        if (typeof content === 'string' && (content.startsWith('{') || content.startsWith('['))) {
          try {
            const parsed = JSON.parse(content);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              content = parsed.content || content;
              summary = summary || parsed.summary || "";
              if (!keyInsights.length) keyInsights = parseArrayField(parsed.keyInsights);
              if (!recommendations.length) recommendations = parseArrayField(parsed.recommendations);
              if (!protocols.length) protocols = parseArrayField(parsed.protocols);
              if (!scientificReferences.length) scientificReferences = parseArrayField(parsed.scientificReferences);
            }
          } catch {
            // content is not JSON, use as-is
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

      const existing = await db.select().from(reports)
        .where(and(eq(reports.id, input.id), eq(reports.userId, ctx.user.id)))
        .limit(1);

      if (!existing.length) throw new Error("Rapport niet gevonden");

      await db.delete(reports).where(eq(reports.id, input.id));
      return { success: true };
    }),

  regenerateLatestReport: protectedProcedure
    .mutation(async ({ ctx }) => {
      const mutationId = Math.random().toString(36).substring(7);
      const mutationStartTime = Date.now();
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`[RAPPORT-${mutationId}] ⏱️ REGENERATE MUTATION START`);
      console.log(`[RAPPORT-${mutationId}] User: ${ctx.user.id} | Email: ${ctx.user.email}`);
      console.log(`[RAPPORT-${mutationId}] Timestamp: ${new Date().toISOString()}`);
      console.log(`${'='.repeat(80)}\n`);
      
      try {
        const step1Start = Date.now();
        console.log(`[RAPPORT-${mutationId}] STEP 1: Connecting to database...`);
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        console.log(`[RAPPORT-${mutationId}] ✓ Step 1 completed in ${Date.now() - step1Start}ms\n`);

        const step2Start = Date.now();
        console.log(`[RAPPORT-${mutationId}] STEP 2: Fetching latest anamnesis...`);
        const latestAnamnesis = await db.select().from(anamnesis)
          .where(eq(anamnesis.userId, ctx.user.id))
          .orderBy(desc(anamnesis.id))
          .limit(1);
        console.log(`[RAPPORT-${mutationId}] ✓ Step 2 completed in ${Date.now() - step2Start}ms`);
        console.log(`[RAPPORT-${mutationId}] Found ${latestAnamnesis.length} anamnesis records\n`);

        if (!latestAnamnesis.length) {
          console.error(`[RAPPORT-${mutationId}] ❌ ERROR: No anamnesis found`);
          throw new Error("Geen anamnese gevonden. Vul eerst de anamnese in.");
        }

        const anamnesisData = latestAnamnesis[0];
        const conditionName = getConditionName(anamnesisData.conditionType);
        console.log(`[RAPPORT-${mutationId}] Condition: ${conditionName}, ID: ${anamnesisData.id}\n`);

        const step3Start = Date.now();
        console.log(`[RAPPORT-${mutationId}] STEP 3: Deleting old reports...`);
        await db.delete(reports).where(eq(reports.userId, ctx.user.id));
        console.log(`[RAPPORT-${mutationId}] ✓ Step 3 completed in ${Date.now() - step3Start}ms\n`);

        const step4Start = Date.now();
        console.log(`[RAPPORT-${mutationId}] STEP 4: Generating report via LLM...`);
        const inzichtRapport = await generateInzichtRapport(
          anamnesisData.conditionType,
          (typeof anamnesisData.responses === 'string' ? JSON.parse(anamnesisData.responses) : anamnesisData.responses as Record<string, any>) || {},
          ctx.user.name || "Patiënt"
        );
        const step4Duration = Date.now() - step4Start;
        console.log(`[RAPPORT-${mutationId}] ✓ Step 4 completed in ${step4Duration}ms`);
        console.log(`[RAPPORT-${mutationId}] Content length: ${inzichtRapport.content?.length || 0} chars\n`);

        const step5Start = Date.now();
        console.log(`[RAPPORT-${mutationId}] STEP 5: Saving report to database...`);
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
        const step5Duration = Date.now() - step5Start;

        const latestReport = await db.select().from(reports)
          .where(eq(reports.userId, ctx.user.id))
          .orderBy(desc(reports.id))
          .limit(1);
        const insertedId = latestReport[0]?.id ?? 0;

        console.log(`[RAPPORT-${mutationId}] ✓ Step 5 completed in ${step5Duration}ms`);
        console.log(`[RAPPORT-${mutationId}] Report ID: ${insertedId}\n`);

        const pdfStep5Start = Date.now();
        console.log(`[RAPPORT-${mutationId}] STEP 5.5: Generating and storing PDF...`);
        const pdfUrl = await generateAndStorePDF(insertedId, {
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
        }, ctx.user.id);
        const pdfStep5Duration = Date.now() - pdfStep5Start;
        if (pdfUrl) {
          console.log(`[RAPPORT-${mutationId}] ✓ Step 5.5 completed in ${pdfStep5Duration}ms, PDF opgeslagen`);
        } else {
          console.warn(`[RAPPORT-${mutationId}] ⚠️ Step 5.5 failed in ${pdfStep5Duration}ms - PDF generation failed`);
        }

        const origin = (ctx.req.headers.origin as string) || "https://ai.holistischadviseur.nl";
        const emailStart = Date.now();
        console.log(`[RAPPORT-${mutationId}] STEP 6: Triggering email send (non-blocking)...\n`);
        
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
        }).then(() => {
          console.log(`[RAPPORT-${mutationId}] ✓ Background: Email sent in ${Date.now() - emailStart}ms`);
        }).catch(err => {
          console.warn(`[RAPPORT-${mutationId}] ⚠️ Background: Email failed in ${Date.now() - emailStart}ms:`, err?.message);
        });

        const totalTime = Date.now() - mutationStartTime;
        console.log(`[RAPPORT-${mutationId}] ✅ MUTATION COMPLETE — Total: ${totalTime}ms\n`);

        return { success: true, message: "Rapport opnieuw gegenereerd", timing: { llm: step4Duration, save: step5Duration, total: totalTime } };
      } catch (error: any) {
        const errorTime = Date.now() - mutationStartTime;
        console.error(`[RAPPORT-${mutationId}] ❌ ERROR AT ${errorTime}ms: ${error?.message || String(error)}`);
        throw error;
      }
    }),
});

async function generateInzichtRapport(
  conditionType: string,
  responses: Record<string, any>,
  userName: string
) {
  // ✅ FIX 1: altijd Nederlandse naam gebruiken
  const conditionName = getConditionName(conditionType);
  const conditionKnowledge = getConditionSpecificKnowledge(conditionType);
  
  const responseLines = Object.entries(responses)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  const rawSymptomInputs: string[] = Object.values(responses)
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 2)
    .flatMap(v => v.split(/[,;.\n]+/).map(s => s.trim()).filter(s => s.length > 2));

  const rawNormalized = normalizeInput(rawSymptomInputs);
  const normalized = filterByConfidence(rawNormalized, 0.60);

  const highConfidenceList = normalized.high_confidence_symptoms.length > 0
    ? normalized.high_confidence_symptoms
        .sort((a, b) => b.confidence - a.confidence)
        .map(s => `${s.standard} (confidence: ${s.confidence.toFixed(2)})`)
        .join(', ')
    : 'geen high-confidence symptomen';

  const lowConfidenceList = normalized.low_confidence_symptoms.length > 0
    ? normalized.low_confidence_symptoms
        .sort((a, b) => b.confidence - a.confidence)
        .map(s => `${s.standard} (confidence: ${s.confidence.toFixed(2)}) [LOW_CONFIDENCE]`)
        .join(', ')
    : '';

  const activeClusters = normalized.clusters.length > 0
    ? normalized.clusters
        .map(c => `${c.cluster} (score: ${c.score.toFixed(2)}, symptomen: ${c.symptoms.join(', ')})`)
        .join('\n  ')
    : 'geen clusters actief';

  const unrecognizedNote = normalized.unrecognized.length > 0
    ? `Niet-herkende invoer (vraag door): ${normalized.unrecognized.join(', ')}`
    : '';

  console.log(`[Normalization] total_confidence: ${normalized.total_confidence}, symptoms: ${normalized.symptoms.length}, clusters: ${normalized.clusters.length}`);

  try {
    const startTime = Date.now();
    console.log(`[Rapport] Starting generateInzichtRapport for ${conditionName}`);
    
    const llmStartTime = Date.now();
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

⚠️ TAALREGEL: Gebruik NOOIT technische variabelenamen zoals "digestive_issues", "chronic_fatigue", "solk", "alk" in de tekst. Gebruik ALTIJD de Nederlandse naam: "${conditionName}".

Je schrijft UITSLUITEND lopende tekst in alinea's. NOOIT JSON, NOOIT lijsten met komma's, NOOIT haakjes of aanhalingstekens als structuur. Alleen gewone Nederlandse zinnen in alinea's.`,
        },
        {
          role: "user",
          content: `Schrijf een persoonlijke holistische analyse (gratis inzicht rapport) voor ${userName} met klachten rondom ${conditionName}.

⚠️ BELANGRIJK: Gebruik de naam "${conditionName}" in de tekst. Schrijf NOOIT "digestive_issues", "chronic_fatigue" of andere technische namen.

Antwoorden van de patiënt:
${responseLines || 'Geen specifieke antwoorden opgegeven'}

── GENORMALISEERDE SYMPTOMEN ──
HIGH-CONFIDENCE symptomen:
${highConfidenceList}

${lowConfidenceList ? `RUWE SIGNALEN (low-confidence):
${lowConfidenceList}

` : ''}Actieve clusters:
  ${activeClusters}
${unrecognizedNote ? `\n${unrecognizedNote}` : ''}
Totale signaalsterkte: ${normalized.total_confidence.toFixed(2)}
──────────────────────────────

Schrijf het rapport in EXACT deze structuur:

**HERKENNING**
Maak de patiënt zich gezien en begrepen voelen. Beschrijf wat jij herkent in hun klachten. Persoonlijk, warm, valideer hun ervaringen.

**DE LOGICA**
Leg uit WAAROM dit in hun lichaam gebeurt. Toon de correlaties en verbindingen. Maak het inzichtelijk.

**EERSTE INZICHTEN**
Geef 2-3 specifieke inzichten die zij waarschijnlijk nog niet hebben gehoord.

**WAT DIT BETEKENT**
Wat gebeurt er als niets verandert? Maak duidelijk waarom actie nodig is.

**CALL TO ACTION**
Eindig met: "Dit is slechts het begin. Het volledige 6-maanden herstelplan bevat maand-voor-maand instructies, voeding & supplementen, leefstijlprotocollen, en aanbevolen producten & diensten. Klaar om je gezondheid terug te nemen?"

Gebruik de naam ${userName}. Schrijf warm, persoonlijk en wetenschappelijk onderbouwd. ALLEEN gewone alinea's met duidelijke kopjes, geen JSON, geen lijsten.

⚠️ DISCLAIMER: Begin je rapport met deze disclaimer:
"Dit rapport is geen medisch advies en kan geen medische diagnose vervangen. Dit is een holistische analyse ter ondersteuning van je gezondheidsreis. Raadpleeg altijd een gekwalificeerde medische professional voor diagnose en behandeling."`,
        },
      ],
    });

    const llmEndTime = Date.now();
    console.log(`[Rapport] LLM response received in ${llmEndTime - llmStartTime}ms`);
    
    let finalContent = llmResponse.choices[0]?.message?.content;
    
    if (!finalContent || typeof finalContent !== 'string' || finalContent.trim().length < 50) {
      throw new Error('LLM returned empty or too-short content');
    }
    
    finalContent = finalContent.trim();
    
    if (finalContent.startsWith('{') || finalContent.startsWith('[')) {
      console.error('[Report] ERROR: LLM returned JSON instead of text!');
      throw new Error('LLM returned JSON instead of plain text');
    }
    
    finalContent = finalContent.replace(/^```[\w]*\n?/gm, '').replace(/^```$/gm, '').trim();
    
    console.log('[Report] SUCCESS - content length:', finalContent.length);
    
    const structuredData = getDefaultStructuredData(conditionType, userName);
    
    return {
      content: finalContent,
      ...structuredData,
    };
    
  } catch (error) {
    console.error('[Report] Error generating report, using fallback:', error);
    return getFallbackReport(conditionType, userName);
  }
}

function getDefaultStructuredData(conditionType: string, userName: string) {
  // ✅ FIX 2: protocols zijn nu objecten met named keys (nutrition, supplements, lifestyle, mentalPractices)
  // zodat de PDF generator ze correct kan weergeven zonder losse 0 en 1
  const conditionMap: Record<string, any> = {
    chronic_fatigue: {
      summary: `${userName} ervaart chronische vermoeidheid die verband houdt met meerdere factoren: slaapkwaliteit, darmgezondheid, stressniveau en energiebalans.`,
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
          "Vitamine B-complex (B1, B6, B12) 's ochtends — essentieel voor mitochondriale functie",
          "CoQ10 200mg bij het ontbijt — direct brandstof voor de mitochondriën",
        ],
        lifestyle: [
          "Stel vaste slaap- en waaktijden in — ook in het weekend (23:00 - 07:00 als richtlijn)",
          "Bouw dagelijkse beweging op: begin met 15 minuten wandelen, verhoog elke week",
          "Verminder schermtijd na 21:00 — blauw licht verstoort melatonineaanmaak",
        ],
        mentalPractices: [
          "Start elke ochtend met 5 minuten bewuste ademhaling (4 tellen in, 4 tellen uit)",
          "Voer een dagelijks energiedagboek bij: noteer wat energie geeft en kost",
          "Oefen de 'body scan' meditatie voor het slapen — 10 minuten via een app",
        ],
      },
      scientificReferences: [
        "Klimas, N.G. et al. (2012). Chronic fatigue syndrome: a review. Journal of Clinical Pathology.",
        "Naviaux, R.K. et al. (2016). Metabolic features of chronic fatigue syndrome. PNAS.",
      ],
    },
    digestive_issues: {
      summary: `${userName} ervaart spijsverteringsproblemen die samenhangen met de darm-brein as, het microbioom en leefstijlfactoren zoals stress en voeding.`,
      keyInsights: [
        "70% van het immuunsysteem bevindt zich in de darmen",
        "Stress via de HPA-as heeft directe invloed op de darmbeweging en het microbioom",
        "Voeding is de meest directe manier om het microbioom te herstellen",
      ],
      recommendations: [
        "Start met het elimineren van gluten en zuivel gedurende 4 weken",
        "Voeg gefermenteerde voeding toe: kefir, zuurkool, kimchi",
        "Eet langzaam en bewust, kauw elke hap minimaal 20 keer",
      ],
      protocols: {
        nutrition: [
          "Week 1-4 eliminatiefase (4R Remove): verwijder gluten, zuivel, suiker en bewerkte voeding",
          "Week 5-8 opbouwfase (4R Reinoculate): introduceer kefir, zuurkool, kimchi en yoghurt",
          "Week 9-12 reparatiefase (4R Repair): voeg L-glutamine, zink en collageen toe aan de voeding",
        ],
        supplements: [
          "Probiotica multi-strain 25 miljard CFU — neem 30 minuten voor het ontbijt",
          "L-glutamine 5g per dag — herstelt de darmwandbarrière en vermindert ontstekingen",
          "Spijsverteringsenzymen bij elke maaltijd — ondersteunt de vertering en nutriëntenopname",
        ],
        lifestyle: [
          "Eet op vaste tijden — het circadiaans ritme van de darmen is net zo belangrijk als slaap",
          "Bewuste maaltijden: geen schermen, kauw 20 keer per hap, eet langzaam",
          "Dagelijks 20-30 minuten lichte beweging na de maaltijd — stimuleert de darmbeweging",
        ],
        mentalPractices: [
          "Diepe buikademhaling voor elke maaltijd — activeert het parasympathisch zenuwstelsel voor betere spijsvertering",
          "Stressmanagement dagboek: noteer stressmomenten en de impact op je buikklachten",
          "Progressieve spierontspanning voor het slapen — vermindert nachtelijke darmklachten",
        ],
      },
      scientificReferences: [
        "Mayer, E.A. (2011). Gut feelings: the emerging biology of gut-brain communication. Nature Reviews Neuroscience.",
        "Sonnenburg, J.L. & Bäckhed, F. (2016). Diet-microbiota interactions as moderators of human metabolism. Nature.",
      ],
    },
    solk: {
      summary: `${userName} ervaart lichamelijke klachten zonder duidelijke organische oorzaak (SOLK), waarbij de verbinding tussen lichaam en geest centraal staat.`,
      keyInsights: [
        "SOLK klachten zijn reëel en hebben een neurobiologische basis",
        "Het zenuwstelsel speelt een centrale rol bij de verwerking van lichamelijke signalen",
        "Herstel vraagt om een geïntegreerde aanpak van lichaam én geest",
      ],
      recommendations: [
        "Start met dagelijkse ademhalingsoefeningen (4-7-8 techniek)",
        "Bouw lichamelijke activiteit geleidelijk op (graded activity)",
        "Onderzoek de verbinding tussen emoties en lichamelijke klachten",
      ],
      protocols: {
        nutrition: [
          "Week 1-4: elimineer ontstekingsbevorderende voeding — suiker, bewerkte producten, alcohol",
          "Week 5-8: voeg ontstekingsremmende voeding toe — vette vis, kurkuma, gember, groene groenten",
          "Week 9-12: introduceer adaptogene kruiden — ashwagandha en heilig basilicum voor stressregulatie",
        ],
        supplements: [
          "Magnesium tauraat 300mg voor het slapen — ondersteunt zenuwstelsel en spierfunctie",
          "Omega-3 vetzuren 2g per dag — vermindert systemische ontsteking en ondersteunt het brein",
          "Vitamine D3 2000-4000IU bij het ontbijt — essentieel voor immuunregulatie en stemming",
        ],
        lifestyle: [
          "Graded activity: begin met 10 minuten bewegen per dag, verhoog wekelijks met 5 minuten",
          "Vaste dagstructuur met rust- en activiteitsmomenten — voorspelbaarheid kalmeert het zenuwstelsel",
          "Slaaphygiëne optimaliseren: donkere kamer, vaste bedtijden, geen cafeïne na 14:00",
        ],
        mentalPractices: [
          "Body scan meditatie dagelijks 15 minuten — ontwikkelt bewustzijn van lichaamssignalen",
          "Journaling: schrijf dagelijks over lichaamssensaties en bijbehorende emoties",
          "Psycho-educatie: leer de verbinding tussen stress en lichamelijke klachten begrijpen",
        ],
      },
      scientificReferences: [
        "Henningsen, P. et al. (2018). Management of functional somatic syndromes and bodily distress. Psychotherapy and Psychosomatics.",
        "van Dessel, N. et al. (2014). Non-pharmacological interventions for somatoform disorders. Cochrane Database.",
      ],
    },
    alk: {
      summary: `${userName} ervaart ALK (Aspecifieke Lichamelijke Klachten) waarbij de combinatie van beweging, houding, stress en leefstijl de sleutel is tot herstel.`,
      keyInsights: [
        "Aspecifieke lichamelijke klachten hebben zelden één oorzaak",
        "Beweging is bewezen effectiever dan rust bij aspecifieke klachten",
        "Stress en slaaptekort versterken pijnperceptie significant",
      ],
      recommendations: [
        "Start met dagelijks wandelen (20-30 minuten)",
        "Leer correcte houding bij zitten en staan",
        "Voeg core-versterkende oefeningen toe (3x per week)",
      ],
      protocols: {
        nutrition: [
          "Week 1-4: elimineer pro-inflammatoire voeding — suiker, fastfood, transvetten",
          "Week 5-8: voeg anti-inflammatoire voeding toe — mediterraan dieet als basis",
          "Week 9-12: gerichte suppletie op basis van eventuele tekorten in bloedwaarden",
        ],
        supplements: [
          "Magnesium malaat 400mg — ondersteunt spierherstel en vermindert pijngevoeligheid",
          "Curcumine met piperine 500mg — krachtig anti-inflammatoir zonder maagbijwerkingen",
          "Vitamine D3 + K2 bij het ontbijt — ondersteunt botgezondheid en spierfunctie",
        ],
        lifestyle: [
          "Graduele bewegingsopbouw: start met 15 minuten wandelen, elke week 5 minuten toevoegen",
          "Ergonomische aanpassingen: werkplek, slaaphouding en schoeisel controleren",
          "Wisselend zitten en staan tijdens werk — maximaal 45 minuten aaneengesloten zitten",
        ],
        mentalPractices: [
          "Pijndagboek bijhouden — inzicht in triggers en patroonherkenning",
          "Ontspanningstechnieken: progressieve spierontspanning 2x per dag",
          "Acceptatiegerichte aanpak — leer omgaan met klachten zonder catastroferen",
        ],
      },
      scientificReferences: [
        "Hayden, J.A. et al. (2005). Exercise therapy for treatment of non-specific low back pain. Cochrane Database.",
        "Waddell, G. (2004). The Back Pain Revolution. Churchill Livingstone.",
      ],
    },
  };
  
  return conditionMap[conditionType] || conditionMap.digestive_issues;
}

function getFallbackReport(conditionType: string, userName: string) {
  // ✅ FIX 1: Nederlandse naam gebruiken, nooit technische naam
  const conditionName = getConditionName(conditionType);

  return {
    content: `Dit rapport is geen medisch advies en kan geen medische diagnose vervangen. Dit is een holistische analyse ter ondersteuning van je gezondheidsreis. Raadpleeg altijd een gekwalificeerde medische professional voor diagnose en behandeling.

**HERKENNING**

Beste ${userName},

Bedankt voor het invullen van de anamnese. Op basis van je antwoorden over ${conditionName} hebben we een eerste analyse gemaakt. Je klachten wijzen op een patroon dat we vaker zien bij mensen met vergelijkbare symptomen.

**DE LOGICA**

De onderliggende oorzaken zijn vaak een combinatie van leefstijlfactoren, voeding, stress en slaap. Een holistische aanpak richt zich op het herstel van balans in het lichaam door meerdere factoren tegelijk aan te pakken.

**EERSTE INZICHTEN**

Het lichaam geeft met klachten een signaal dat er iets uit balans is. Symptomen zijn geen vijand, maar informatie. De sleutel is om de onderliggende oorzaak aan te pakken, niet alleen het symptoom te onderdrukken.

**WAT DIT BETEKENT**

Zonder aanpak kunnen klachten verergeren en leiden tot meer complexe gezondheidsproblemen. Met de juiste aanpak is herstel goed mogelijk.

**CALL TO ACTION**

Dit is slechts het begin. Het volledige 6-maanden herstelplan bevat maand-voor-maand instructies, voeding & supplementen, leefstijlprotocollen, en aanbevolen producten & diensten. Klaar om je gezondheid terug te nemen?`,
    ...getDefaultStructuredData(conditionType, userName),
  };
}
