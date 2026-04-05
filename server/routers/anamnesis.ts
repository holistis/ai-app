import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { saveAnamnesis, saveReport, getUserReports, getDb } from "../db";
import { reports, anamnesis } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
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
      
      // Save anamnesis
      const anamnesisStart = Date.now();
      const anamnesisResult = await saveAnamnesis(
        ctx.user.id,
        input.conditionType,
        input.responses
      );
      console.log(`[Rapport] Anamnesis saved in ${Date.now() - anamnesisStart}ms`);

      // Generate "Inzicht Rapport" (initial insights)
      const llmStart = Date.now();
      const inzichtRapport = await generateInzichtRapport(
        input.conditionType,
        input.responses,
        ctx.user.name || "Patiënt"
      );
      console.log(`[Rapport] LLM response received in ${Date.now() - llmStart}ms`);

      // Get the inserted ID from result
      const insertedId = Array.isArray(anamnesisResult) && anamnesisResult.length > 0 ? anamnesisResult[0].id : 1;

      // Save report
      await saveReport(ctx.user.id, insertedId, {
        reportType: "inzicht_rapport",
        title: `Holistische Gezondheidsanalyse - ${input.conditionType}`,
        content: inzichtRapport.content,
        summary: inzichtRapport.summary,
        keyInsights: inzichtRapport.keyInsights,
        recommendations: inzichtRapport.recommendations,
        protocols: inzichtRapport.protocols,
        scientificReferences: inzichtRapport.scientificReferences,
      });

      console.log(`[Rapport] Report saved, total time so far: ${Date.now() - startTime}ms`);
      
      // Send emails with PDF to owner and patient (non-blocking)
      const origin = (ctx.req.headers.origin as string) || "https://ai.holistischadviseur.nl";
      const emailStart = Date.now();
      console.log(`[Rapport] Starting email send with PDF generation...`);
      sendReportEmails({
        patientName: ctx.user.name || "Patiënt",
        patientEmail: ctx.user.email || "",
        conditionType: input.conditionType,
        reportType: "inzicht_rapport",
        reportId: insertedId,
        reportData: {
          title: `Holistische Gezondheidsanalyse - ${input.conditionType}`,
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

      // Also notify via Manus notification
      try {
        const conditionLabels: Record<string, string> = {
          chronic_fatigue: "Chronische Vermoeidheid",
          digestive_issues: "Spijsverteringsproblemen",
          solk: "SOLK",
          alk: "ALK",
        };
        const conditionLabel = conditionLabels[input.conditionType] || input.conditionType;
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
      
      // Normalize each report to ensure content and JSON fields are correct
      return reports.map((report: any) => {
        let content = report.content || "";
        let summary = report.summary || "";
        let keyInsights = parseArrayField(report.keyInsights);
        let recommendations = parseArrayField(report.recommendations);
        let protocols = parseArrayField(report.protocols);
        let scientificReferences = parseArrayField(report.scientificReferences);
        
        // If content looks like a full JSON object, extract the fields
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

      // Verify report belongs to user
      const existing = await db.select().from(reports)
        .where(and(eq(reports.id, input.id), eq(reports.userId, ctx.user.id)))
        .limit(1);

      if (!existing.length) throw new Error("Rapport niet gevonden");

      await db.delete(reports).where(eq(reports.id, input.id));
      return { success: true };
    }),

  // Regenerate the latest report using the existing anamnesis data
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
        // Step 1: Database connection
        const step1Start = Date.now();
        console.log(`[RAPPORT-${mutationId}] STEP 1: Connecting to database...`);
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        console.log(`[RAPPORT-${mutationId}] ✓ Step 1 completed in ${Date.now() - step1Start}ms\n`);

        // Step 2: Fetch anamnesis
        const step2Start = Date.now();
        console.log(`[RAPPORT-${mutationId}] STEP 2: Fetching latest anamnesis...`);
        const latestAnamnesis = await db.select().from(anamnesis)
          .where(eq(anamnesis.userId, ctx.user.id))
          .limit(1);
        console.log(`[RAPPORT-${mutationId}] ✓ Step 2 completed in ${Date.now() - step2Start}ms`);
        console.log(`[RAPPORT-${mutationId}] Found ${latestAnamnesis.length} anamnesis records\n`);

        if (!latestAnamnesis.length) {
          console.error(`[RAPPORT-${mutationId}] ❌ ERROR: No anamnesis found`);
          throw new Error("Geen anamnese gevonden. Vul eerst de anamnese in.");
        }

        const anamnesisData = latestAnamnesis[0];
        console.log(`[RAPPORT-${mutationId}] Condition: ${anamnesisData.conditionType}, ID: ${anamnesisData.id}\n`);

        // Step 3: Delete old reports
        const step3Start = Date.now();
        console.log(`[RAPPORT-${mutationId}] STEP 3: Deleting old reports...`);
        await db.delete(reports).where(eq(reports.userId, ctx.user.id));
        console.log(`[RAPPORT-${mutationId}] ✓ Step 3 completed in ${Date.now() - step3Start}ms\n`);

        // Step 4: Generate report via LLM
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

        // Step 5: Save report
        const step5Start = Date.now();
        console.log(`[RAPPORT-${mutationId}] STEP 5: Saving report to database...`);
        const result = await saveReport(ctx.user.id, anamnesisData.id, {
          reportType: "inzicht_rapport",
          title: `Holistische Gezondheidsanalyse - ${anamnesisData.conditionType}`,
          content: inzichtRapport.content,
          summary: inzichtRapport.summary,
          keyInsights: inzichtRapport.keyInsights,
          recommendations: inzichtRapport.recommendations,
          protocols: inzichtRapport.protocols,
          scientificReferences: inzichtRapport.scientificReferences,
        });
        const step5Duration = Date.now() - step5Start;
        const insertedId = (result as any).insertId ? (result as any).insertId : 0;
        console.log(`[RAPPORT-${mutationId}] ✓ Step 5 completed in ${step5Duration}ms`);
        console.log(`[RAPPORT-${mutationId}] Report ID: ${insertedId}\n`);

        // Step 5.5: Generate and store PDF
        const pdfStep5Start = Date.now();
        console.log(`[RAPPORT-${mutationId}] STEP 5.5: Generating and storing PDF...`);
        const pdfUrl = await generateAndStorePDF(insertedId, {
          title: `Holistische Gezondheidsanalyse - ${anamnesisData.conditionType}`,
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
          console.log(`[RAPPORT-${mutationId}] ✓ Step 5.5 completed in ${pdfStep5Duration}ms, PDF URL: ${pdfUrl}`);
        } else {
          console.warn(`[RAPPORT-${mutationId}] ⚠️ Step 5.5 failed in ${pdfStep5Duration}ms - PDF generation failed`);
        }

        // Time before email
        const timeBeforeEmail = Date.now() - mutationStartTime;
        console.log(`[RAPPORT-${mutationId}] ⏱️ TIME BEFORE EMAIL: ${timeBeforeEmail}ms`);
        console.log(`[RAPPORT-${mutationId}] Breakdown: LLM=${step4Duration}ms, Save=${step5Duration}ms\n`);

        // Step 6: Trigger email (fire and forget)
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
            title: `Holistische Gezondheidsanalyse - ${anamnesisData.conditionType}`,
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
        console.log(`[RAPPORT-${mutationId}] ${'='.repeat(80)}`);
        console.log(`[RAPPORT-${mutationId}] ✅ MUTATION COMPLETE`);
        console.log(`[RAPPORT-${mutationId}] Total time: ${totalTime}ms`);
        console.log(`[RAPPORT-${mutationId}] Response sent to frontend`);
        console.log(`[RAPPORT-${mutationId}] ${'='.repeat(80)}\n`);

        return { success: true, message: "Rapport opnieuw gegenereerd", timing: { llm: step4Duration, save: step5Duration, total: totalTime } };
      } catch (error: any) {
        const errorTime = Date.now() - mutationStartTime;
        console.error(`[RAPPORT-${mutationId}] ${'='.repeat(80)}`);
        console.error(`[RAPPORT-${mutationId}] ❌ ERROR AT ${errorTime}ms`);
        console.error(`[RAPPORT-${mutationId}] Message: ${error?.message || String(error)}`);
        console.error(`[RAPPORT-${mutationId}] ${'='.repeat(80)}\n`);
        throw error;
      }
    }),
});

async function generateInzichtRapport(
  conditionType: string,
  responses: Record<string, any>,
  userName: string
) {
  const conditionKnowledge = getConditionSpecificKnowledge(conditionType);
  
  // Build a readable summary of the patient's responses
  const responseLines = Object.entries(responses)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  // ── INPUT NORMALIZATION LAYER ──────────────────────────────────────────────
  // Extract all string values from responses as raw symptom inputs
  const rawSymptomInputs: string[] = Object.values(responses)
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 2)
    .flatMap(v => v.split(/[,;.\n]+/).map(s => s.trim()).filter(s => s.length > 2));

  // Run normalization pipeline
  const rawNormalized = normalizeInput(rawSymptomInputs);
  // Filter out low-confidence signals (threshold 0.60)
  const normalized = filterByConfidence(rawNormalized, 0.60);

  // Build normalized context for the AI prompt
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
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const startTime = Date.now();
    console.log(`[Rapport] Starting generateInzichtRapport for ${conditionType}`);
    
    // Single LLM call: generate ONLY plain text narrative
    // No JSON, no structured output, no response_format
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

Je schrijft UITSLUITEND lopende tekst in alinea's. NOOIT JSON, NOOIT lijsten met komma's, NOOIT haakjes of aanhalingstekens als structuur. Alleen gewone Nederlandse zinnen in alinea's.`,
        },
        {
          role: "user",
          content: `Schrijf een persoonlijke holistische analyse (gratis inzicht rapport) voor ${userName} met klachten rondom ${conditionType}.

Antwoorden van de patiënt:
${responseLines || 'Geen specifieke antwoorden opgegeven'}

── GENORMALISEERDE SYMPTOMEN (input normalization layer) ──
HIGH-CONFIDENCE symptomen (primaire input voor correlatie engine):
${highConfidenceList}

${lowConfidenceList ? `RUWE SIGNALEN (low-confidence, jij bepaalt relevantie):
${lowConfidenceList}

` : ''}Actieve clusters (gebaseerd op high-confidence):
  ${activeClusters}
${unrecognizedNote ? `\n${unrecognizedNote}` : ''}
Totale signaalsterkte (high-confidence): ${normalized.total_confidence.toFixed(2)}
──────────────────────────────────────────────────────────

Gebruik de HIGH-CONFIDENCE symptomen en actieve clusters als primaire input voor de correlatie engine.
De LOW-CONFIDENCE signalen zijn ruwe patiëntinput die jij kunt evalueren en eventueel integreren in je analyse als ze relevant zijn.

Pas het AI Denkmodel toe:
1. Analyseer de symptomen en patronen die je ziet in de antwoorden
2. Leg de correlaties uit die je herkent (gebruik de Correlatie Engine)
3. Geef 2-4 mogelijke verklaringen, NOOIT 1 conclusie
4. Motiveer via logica: "Als dit blijft, dan..."

Schrijf het rapport in EXACT deze structuur met duidelijke kopjes:

**HERKENNING**
Maak de patiënt zich gezien en begrepen voelen. Beschrijf wat jij herkent in hun klachten. Persoonlijk, warm, valideer hun ervaringen.

**DE LOGICA**
Leg uit WAAROM dit in hun lichaam gebeurt. Toon de correlaties en verbindingen. Maak het inzichtelijk.

**EERSTE INZICHTEN**
Geef 2-3 specifieke inzichten die zij waarschijnlijk nog niet hebben gehoord. Iets wat voelt als "eindelijk, dit snap ik nu!"

**WAT DIT BETEKENT**
Wat gebeurt er als niets verandert? Maak duidelijk waarom actie nodig is.

**CALL TO ACTION**
Eindig met: "Dit is slechts het begin. Het volledige 6-maanden herstelplan bevat maand-voor-maand instructies, voeding & supplementen, leefstijlprotocollen, en aanbevolen producten & diensten. Klaar om je gezondheid terug te nemen?"

Gebruik de naam ${userName}. Schrijf warm, persoonlijk en wetenschappelijk onderbouwd. ALLEEN gewone alinea's met duidelijke kopjes, geen JSON, geen lijsten.

⚠️ DISCLAIMER: Begin je rapport met deze disclaimer (één alinea, duidelijk zichtbaar):
"Dit rapport is geen medisch advies en kan geen medische diagnose vervangen. Dit is een holistische analyse ter ondersteuning van je gezondheidsreis. Raadpleeg altijd een gekwalificeerde medische professional voor diagnose en behandeling."`,
        },
      ],
    });

    const llmEndTime = Date.now();
    console.log(`[Rapport] LLM response received in ${llmEndTime - llmStartTime}ms`);
    
    let finalContent = llmResponse.choices[0]?.message?.content;
    
    // Validate: content must be a non-empty string
    if (!finalContent || typeof finalContent !== 'string' || finalContent.trim().length < 50) {
      throw new Error('LLM returned empty or too-short content');
    }
    
    finalContent = finalContent.trim();
    
    // Safety check: if content looks like JSON (starts with { or [), it's wrong
    // In that case use the fallback
    if (finalContent.startsWith('{') || finalContent.startsWith('[')) {
      console.error('[Report] ERROR: LLM returned JSON instead of text! Content starts with:', finalContent.substring(0, 50));
      throw new Error('LLM returned JSON instead of plain text');
    }
    
    // Strip any accidental markdown code fences
    finalContent = finalContent.replace(/^```[\w]*\n?/gm, '').replace(/^```$/gm, '').trim();
    
    console.log('[Report] SUCCESS - content length:', finalContent.length, 'starts with:', finalContent.substring(0, 60));
    
    // Generate simple structured data based on condition type (no LLM needed)
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
      protocols: [
        "Circadiaans Ritme Herstel Protocol: Vaste slaaptijden, ochtendlicht, geen schermen na 21:00",
        "Darmherstel Basis Protocol: Elimineer triggers, voeg probiotica en vezels toe",
      ],
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
      protocols: [
        "4R Darmherstel Protocol: Remove, Replace, Reinoculate, Repair",
        "Anti-inflammatoir Voedingsprotocol: Elimineer triggers, voeg ontstekingsremmende voeding toe",
      ],
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
      protocols: [
        "Zenuwstelsel Regulatie Protocol: Ademhaling, grounding, veiligheid",
        "Lichaam-Geest Integratie Protocol: Mindfulness, beweging, expressie",
      ],
      scientificReferences: [
        "Henningsen, P. et al. (2018). Management of functional somatic syndromes and bodily distress. Psychotherapy and Psychosomatics.",
        "van Dessel, N. et al. (2014). Non-pharmacological interventions for somatoform disorders. Cochrane Database.",
      ],
    },
    alk: {
      summary: `${userName} ervaart ALK (Aspecifieke Lage Rugklachten) waarbij de combinatie van beweging, houding, stress en leefstijl de sleutel is tot herstel.`,
      keyInsights: [
        "Aspecifieke rugklachten hebben zelden één oorzaak",
        "Beweging is bewezen effectiever dan rust bij lage rugklachten",
        "Stress en slaaptekort versterken pijnperceptie significant",
      ],
      recommendations: [
        "Start met dagelijks wandelen (20-30 minuten)",
        "Leer correcte houding bij zitten en staan",
        "Voeg core-versterkende oefeningen toe (3x per week)",
      ],
      protocols: [
        "Bewegings Herstel Protocol: Graduele opbouw van activiteit",
        "Pijnmanagement Protocol: Ademhaling, ontspanning, beweging",
      ],
      scientificReferences: [
        "Hayden, J.A. et al. (2005). Exercise therapy for treatment of non-specific low back pain. Cochrane Database.",
        "Waddell, G. (2004). The Back Pain Revolution. Churchill Livingstone.",
      ],
    },
  };
  
  return conditionMap[conditionType] || conditionMap.digestive_issues;
}

function getFallbackReport(conditionType: string, userName: string) {
  return {
    content: `Beste ${userName},

Bedankt voor het invullen van de anamnese. Op basis van je antwoorden over ${conditionType} hebben we een eerste analyse gemaakt.

Je klachten wijzen op een patroon dat we vaker zien bij mensen met vergelijkbare symptomen. De onderliggende oorzaken zijn vaak een combinatie van leefstijlfactoren, voeding, stress en slaap. Een holistische aanpak richt zich op het herstel van balans in het lichaam door meerdere factoren tegelijk aan te pakken.

Het volledige rapport bevat gedetailleerde protocollen, voedingsadviezen en een persoonlijk herstelplan. We kijken ernaar uit om je verder te begeleiden op je weg naar herstel.`,
    ...getDefaultStructuredData(conditionType, userName),
  };
}
