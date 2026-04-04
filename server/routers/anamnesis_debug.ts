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

// COMPREHENSIVE LOGGING VERSION OF REGENERATE MUTATION
export const regenerateLatestReportDebug = protectedProcedure
  .mutation(async ({ ctx }) => {
    const mutationStartTime = Date.now();
    const mutationId = Math.random().toString(36).substring(7);
    
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
        console.error(`[RAPPORT-${mutationId}] ❌ ERROR: No anamnesis found for user ${ctx.user.id}`);
        throw new Error("Geen anamnese gevonden. Vul eerst de anamnese in.");
      }

      const anamnesisData = latestAnamnesis[0];
      console.log(`[RAPPORT-${mutationId}] Condition type: ${anamnesisData.conditionType}`);
      console.log(`[RAPPORT-${mutationId}] Anamnesis ID: ${anamnesisData.id}\n`);

      // Step 3: Delete old reports
      const step3Start = Date.now();
      console.log(`[RAPPORT-${mutationId}] STEP 3: Deleting old reports...`);
      await db.delete(reports).where(eq(reports.userId, ctx.user.id));
      console.log(`[RAPPORT-${mutationId}] ✓ Step 3 completed in ${Date.now() - step3Start}ms\n`);

      // Step 4: Generate report via LLM
      const step4Start = Date.now();
      console.log(`[RAPPORT-${mutationId}] STEP 4: Generating report via LLM...`);
      console.log(`[RAPPORT-${mutationId}] LLM call starting (90s timeout guard in place)...`);
      
      const inzichtRapport = await generateInzichtRapportDebug(
        anamnesisData.conditionType,
        (typeof anamnesisData.responses === 'string' ? JSON.parse(anamnesisData.responses) : anamnesisData.responses as Record<string, any>) || {},
        ctx.user.name || "Patiënt",
        mutationId
      );
      
      const step4Duration = Date.now() - step4Start;
      console.log(`[RAPPORT-${mutationId}] ✓ Step 4 completed in ${step4Duration}ms`);
      console.log(`[RAPPORT-${mutationId}] Report content length: ${inzichtRapport.content?.length || 0} characters\n`);

      // Step 5: Save report to database
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
      console.log(`[RAPPORT-${mutationId}] Report saved with ID: ${insertedId}\n`);

      // Calculate time before email
      const timeBeforeEmail = Date.now() - mutationStartTime;
      console.log(`[RAPPORT-${mutationId}] ⏱️ TIME BEFORE EMAIL: ${timeBeforeEmail}ms`);
      console.log(`[RAPPORT-${mutationId}] Breakdown: LLM=${step4Duration}ms, Save=${step5Duration}ms\n`);

      // Step 6: Trigger email sending (fire and forget)
      const origin = (ctx.req.headers.origin as string) || "https://ai.holistischadviseur.nl";
      const emailStart = Date.now();
      console.log(`[RAPPORT-${mutationId}] STEP 6: Triggering email send (non-blocking)...`);
      console.log(`[RAPPORT-${mutationId}] Email will be sent in background\n`);
      
      // Fire and forget - do NOT await
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
        console.log(`[RAPPORT-${mutationId}] ✓ Background: Email sent successfully in ${Date.now() - emailStart}ms`);
      }).catch(err => {
        console.warn(`[RAPPORT-${mutationId}] ⚠️ Background: Email send failed after ${Date.now() - emailStart}ms:`, err?.message || err);
      });

      // Return response immediately (don't wait for email)
      const totalTime = Date.now() - mutationStartTime;
      console.log(`[RAPPORT-${mutationId}] ${'='.repeat(80)}`);
      console.log(`[RAPPORT-${mutationId}] ✅ MUTATION COMPLETE`);
      console.log(`[RAPPORT-${mutationId}] Total time: ${totalTime}ms`);
      console.log(`[RAPPORT-${mutationId}] Response sent to frontend`);
      console.log(`[RAPPORT-${mutationId}] ${'='.repeat(80)}\n`);
      
      return { 
        success: true, 
        message: "Rapport opnieuw gegenereerd",
        timing: {
          llm: step4Duration,
          save: step5Duration,
          total: totalTime
        }
      };
      
    } catch (error: any) {
      const errorTime = Date.now() - mutationStartTime;
      console.error(`[RAPPORT-${mutationId}] ${'='.repeat(80)}`);
      console.error(`[RAPPORT-${mutationId}] ❌ ERROR OCCURRED AT ${errorTime}ms`);
      console.error(`[RAPPORT-${mutationId}] Error message: ${error?.message || String(error)}`);
      console.error(`[RAPPORT-${mutationId}] Error type: ${error?.constructor?.name}`);
      if (error && typeof error === 'object' && 'stack' in error) {
        console.error(`[RAPPORT-${mutationId}] Stack trace:`);
        error.stack.split('\n').forEach((line: string) => {
          console.error(`[RAPPORT-${mutationId}]   ${line}`);
        });
      }
      console.error(`[RAPPORT-${mutationId}] ${'='.repeat(80)}\n`);
      throw error;
    }
  });

async function generateInzichtRapportDebug(
  conditionType: string,
  responses: Record<string, any>,
  userName: string,
  mutationId: string
) {
  const conditionKnowledge = getConditionSpecificKnowledge(conditionType);
  
  // Build a readable summary of the patient's responses
  const responseLines = Object.entries(responses)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  // ── INPUT NORMALIZATION LAYER ──────────────────────────────────────────────
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

  console.log(`[RAPPORT-${mutationId}] [Normalization] Symptoms: ${normalized.symptoms.length}, Clusters: ${normalized.clusters.length}`);

  try {
    const startTime = Date.now();
    console.log(`[RAPPORT-${mutationId}] [LLM] Starting LLM call for ${conditionType}...`);
    
    const llmStartTime = Date.now();
    console.log(`[RAPPORT-${mutationId}] [LLM] Calling invokeLLM...`);
    
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

Schrijf 4 alinea's:
1. Herkenning: "Dit is wat er waarschijnlijk speelt bij jou..." (persoonlijk, warm, valideer de klachten)
2. Logica: Waarom dit gebeurt — de correlaties en onderliggende mechanismen
3. Richting: Wat dit betekent voor herstel en een preview van het volledige rapport
4. Motiverende afsluiting met subtiele call-to-action voor het volledige rapport

Gebruik de naam ${userName}. Schrijf warm, persoonlijk en wetenschappelijk onderbouwd. ALLEEN gewone alinea's, geen JSON, geen lijsten.

⚠️ DISCLAIMER: Begin je rapport met deze disclaimer (één alinea, duidelijk zichtbaar):
"Dit rapport is geen medisch advies en kan geen medische diagnose vervangen. Dit is een holistische analyse ter ondersteuning van je gezondheidsreis. Raadpleeg altijd een gekwalificeerde medische professional voor diagnose en behandeling."`,
        },
      ],
    });

    const llmEndTime = Date.now();
    const llmDuration = llmEndTime - llmStartTime;
    console.log(`[RAPPORT-${mutationId}] [LLM] Response received in ${llmDuration}ms`);
    
    let finalContent = llmResponse.choices[0]?.message?.content;
    
    if (!finalContent || typeof finalContent !== 'string' || finalContent.trim().length < 50) {
      console.error(`[RAPPORT-${mutationId}] [LLM] ERROR: Empty or too-short content`);
      throw new Error('LLM returned empty or too-short content');
    }
    
    finalContent = finalContent.trim();
    console.log(`[RAPPORT-${mutationId}] [LLM] Content length: ${finalContent.length} chars`);
    
    if (finalContent.startsWith('{') || finalContent.startsWith('[')) {
      console.error(`[RAPPORT-${mutationId}] [LLM] ERROR: LLM returned JSON instead of text!`);
      throw new Error('LLM returned JSON instead of plain text');
    }
    
    finalContent = finalContent.replace(/^```[\w]*\n?/gm, '').replace(/^```$/gm, '').trim();
    
    console.log(`[RAPPORT-${mutationId}] [LLM] ✓ Content validated, first 60 chars: ${finalContent.substring(0, 60)}`);
    
    const structuredData = getDefaultStructuredData(conditionType, userName);
    
    return {
      content: finalContent,
      ...structuredData,
    };
    
      } catch (error: any) {
        console.error(`[RAPPORT-${mutationId}] [LLM] ❌ Error generating report:`, error?.message || String(error));
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
        "Circadian Rhythm and Sleep Quality in Chronic Fatigue Syndrome - Nature Medicine 2023",
        "Gut Microbiome and Energy Metabolism - Cell 2023",
      ],
    },
    digestive_issues: {
      summary: `${userName} ervaart spijsverteringsproblemen die waarschijnlijk verband houden met voeding, stress en darmgezondheid.`,
      keyInsights: [
        "Spijsverteringsproblemen zijn vaak het gevolg van meerdere factoren",
        "De darm-hersenas speelt een cruciale rol in digestie",
        "Voeding en levensstijl zijn primaire interventies",
      ],
      recommendations: [
        "Identificeer voedselintoleraties via eliminatiediet",
        "Voeg fermenteerde voedingsmiddelen toe",
        "Verhoog stressmanagement activiteiten",
      ],
      protocols: [
        "Darmherstel Protocol: 4-week eliminatiediet",
        "Voedingsoptimalisatie: Voeg probiotica en prebiotica toe",
      ],
      scientificReferences: [
        "Gut Microbiome and Digestive Health - Gastroenterology 2023",
      ],
    },
  };

  return conditionMap[conditionType] || {
    summary: `${userName} ervaart gezondheidsproblemen die een holistische aanpak vereisen.`,
    keyInsights: ["Holistische gezondheid vereist een multifactoriële aanpak"],
    recommendations: ["Raadpleeg een holistische gezondheidsadviseur"],
    protocols: [],
    scientificReferences: [],
  };
}

function getFallbackReport(conditionType: string, userName: string) {
  return {
    content: `Dit is een fallback rapport voor ${userName}. Het systeem kon geen rapport genereren.`,
    ...getDefaultStructuredData(conditionType, userName),
  };
}
