import { z } from "zod";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { reports, anamnesis } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import { notifyOwner } from "../_core/notification";
import { sendReportEmails } from "../_core/email";
import { generatePDFBuffer } from "../_core/pdfGeneratorV2";
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

export const reportsRouter = router({
  generateFullReport: protectedProcedure
    .input(
      z.object({
        reportId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const existingReport = await db
        .select()
        .from(reports)
        .where(
          and(
            eq(reports.id, input.reportId),
            eq(reports.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existingReport.length) {
        throw new Error("Report not found");
      }

      const report = existingReport[0];

      const anamnesisData = await db
        .select()
        .from(anamnesis)
        .where(eq(anamnesis.id, report.anamnesisId))
        .limit(1) as any;

      if (!anamnesisData.length) {
        throw new Error("Anamnesis data not found");
      }

      const anamnesisResponses = (anamnesisData[0]?.responses || {}) as Record<string, any>;

      const fullReport = await generateFullReportContent(
        anamnesisData[0]?.conditionType || "other",
        anamnesisResponses,
        ctx.user.name || "Patiënt"
      );

      await db
        .update(reports)
        .set({
          reportType: "full_report" as any,
          content: fullReport.content,
          summary: fullReport.summary,
          keyInsights: JSON.stringify(fullReport.keyInsights || []),
          recommendations: JSON.stringify(fullReport.recommendations || []),
          protocols: JSON.stringify(fullReport.protocols || {}),
          scientificReferences: JSON.stringify(fullReport.scientificReferences || []),
          status: "generated" as any,
          updatedAt: new Date(),
        })
        .where(eq(reports.id, input.reportId));

      try {
        await notifyOwner({
          title: `📊 Volledig Rapport Gegenereerd: ${ctx.user.name || ctx.user.email}`,
          content: `👤 Patiënt: ${ctx.user.name || "Onbekend"} (${ctx.user.email || "geen email"})
📌 Rapport ID: #${input.reportId}
📅 Datum: ${new Date().toLocaleString("nl-NL")}

✅ Volledig rapport succesvol gegenereerd en beschikbaar voor de patiënt.
🔗 Admin: ${ctx.req.headers.origin || "https://ai.holistischadviseur.nl"}/admin`,
        });
      } catch (notifError) {
        console.warn("[Notify] Failed to notify owner about full report:", notifError);
      }

      const origin = (ctx.req.headers.origin as string) || "https://ai.holistischadviseur.nl";
      sendReportEmails({
        patientName: ctx.user.name || "Patiënt",
        patientEmail: ctx.user.email || "",
        conditionType: anamnesisData[0]?.conditionType || "other",
        reportType: "full_report",
        reportId: input.reportId,
        reportData: {
          title: `Volledig Gezondheidsrapport - ${anamnesisData[0]?.conditionType || "Analyse"}`,
          content: fullReport.content,
          summary: fullReport.summary,
          keyInsights: fullReport.keyInsights,
          recommendations: fullReport.recommendations,
          protocols: fullReport.protocols,
          scientificReferences: fullReport.scientificReferences,
        },
        reportUrl: `${origin}/rapport`,
      }).catch(err => console.warn("[Email] Failed to send full report emails:", err));

      return {
        success: true,
        message: "Volledig rapport gegenereerd",
        report: fullReport,
      };
    }),

  downloadReportPDF: protectedProcedure
    .input(
      z.object({
        reportId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      console.log(`[PDF-Download] START - User ${ctx.user.id} requesting PDF for report ${input.reportId}`);
      
      try {
        const db = await getDb();
        if (!db) {
          console.error(`[PDF-Download] ❌ Database not available`);
          throw new Error("Database not available");
        }
        
        const whereConditions = [eq(reports.id, input.reportId)];
        if (ctx.user.role !== 'admin') {
          whereConditions.push(eq(reports.userId, ctx.user.id));
        }
        
        const reportData = await db
          .select()
          .from(reports)
          .where(and(...whereConditions))
          .limit(1);

        if (!reportData.length) {
          throw new Error("Report not found");
        }

        const report = reportData[0];

        if (report.pdfUrl) {
          return { success: true, pdfUrl: report.pdfUrl };
        }

        const htmlContent = generatePDFContent(report);

        let pdfBuffer: Buffer;
        const pdfStartTime = Date.now();
        try {
          pdfBuffer = await generatePDFBuffer(htmlContent);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          console.error(`[PDF-Download] ❌ PDF generation FAILED: ${errorMsg}`);
          throw new Error(`Failed to generate PDF: ${errorMsg}`);
        }

        const fileName = `rapport-${report.id}-${Date.now()}.pdf`;
        try {
          const { url } = await storagePut(
            `reports/${ctx.user.id}/${fileName}`,
            pdfBuffer,
            "application/pdf"
          );

          try {
            await db
              .update(reports)
              .set({ pdfUrl: url, updatedAt: new Date() } as any)
              .where(eq(reports.id, input.reportId));
          } catch (dbError) {
            console.error(`[PDF-Download] ⚠️ Database update failed:`, dbError);
          }

          console.log(`[PDF-Download] ✅ COMPLETE in ${Date.now() - pdfStartTime}ms`);
          return { success: true, pdfUrl: url };
        } catch (s3Error) {
          const errorMsg = s3Error instanceof Error ? s3Error.message : "Unknown error";
          throw new Error(`Failed to upload PDF to S3: ${errorMsg}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error(`[PDF-Download] ❌ ENDPOINT ERROR: ${errorMsg}`);
        throw error;
      }
    }),

  getReport: protectedProcedure
    .input(z.object({ reportId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const reportData = await db
        .select()
        .from(reports)
        .where(and(eq(reports.id, input.reportId), eq(reports.userId, ctx.user.id)))
        .limit(1);

      if (!reportData.length) throw new Error("Report not found");
      return reportData[0];
    }),

  listReports: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return await db.select().from(reports).where(eq(reports.userId, ctx.user.id));
  }),

  getReportAdmin: adminProcedure
    .input(z.object({ reportId: z.number() }))
    .query(async ({ ctx, input }) => {
      console.log(`[getReportAdmin] Admin ${ctx.user.id} requesting report ${input.reportId}`);
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const reportData = await db
        .select()
        .from(reports)
        .where(eq(reports.id, input.reportId))
        .limit(1);

      if (!reportData.length) throw new Error("Report not found");
      return reportData[0];
    }),

  deleteReport: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const report = await db
        .select()
        .from(reports)
        .where(and(eq(reports.id, input.id), eq(reports.userId, ctx.user.id)))
        .limit(1);

      if (!report.length) throw new Error("Report not found");

      await db.delete(reports).where(eq(reports.id, input.id));
      return { success: true };
    }),
});

async function generateFullReportContent(
  conditionType: string,
  responses: Record<string, any>,
  userName: string
) {
  const conditionLabel: Record<string, string> = {
    chronic_fatigue: "Chronische Vermoeidheid",
    digestive_issues: "Spijsverteringsproblemen",
    solk: "SOLK (Somatisch Onverklaarbare Lichamelijke Klachten)",
    alk: "ALK (Aspecifieke Lichamelijke Klachten)",
  };
  // ✅ FIX 1: altijd de Nederlandse naam gebruiken, nooit de technische sleutel
  const conditionName = conditionLabel[conditionType] || conditionType;

  const stressLevel = responses.stress_level || responses.stressNiveau || "onbekend";
  const sleepHours = responses.sleep_hours || responses.slaapUren || "onbekend";
  const bloodValues = responses.blood_values || responses.bloedwaarden || "";
  const previousTreatments = responses.previous_treatments || responses.eerderePogingen || "";
  const medications = responses.medications || responses.medicatie || "";

  const prompt = `Je bent een holistische gezondheidsadviseur van Holistisch Adviseur (holistischadviseur.nl) met diepgaande kennis van voeding, leefstijl, darmgezondheid, de HPA-as, oxidatieve stress, mineraalbalans en natuurlijke genezing.

${AI_KNOWLEDGE_BASE}

Je schrijft een VOLLEDIG BETAALD RAPPORT (€34,95) voor ${userName} met de klacht: ${conditionName}.

⚠️ HEEL BELANGRIJK — TAALREGEL:
- Gebruik NOOIT technische variabelenamen zoals "digestive_issues", "chronic_fatigue", "solk", "alk" in de tekst van het rapport.
- Gebruik ALTIJD de Nederlandse naam: "${conditionName}"
- Schrijf alsof je een brief schrijft aan een patiënt — warm, persoonlijk en professioneel.

## PATIËNT GEGEVENS
Naam: ${userName}
Klacht: ${conditionName}
Stressniveau: ${stressLevel}
Slaap: ${sleepHours} uur
Bloedwaarden/tekorten: ${bloodValues || "Niet opgegeven"}
Eerdere behandelingen: ${previousTreatments || "Geen opgegeven"}
Medicatie/supplementen: ${medications || "Geen"}

Volledige anamnese:
${JSON.stringify(responses, null, 2)}

## JOUW HOLISTISCHE FILOSOFIE
- Input bepaalt output: klachten zijn signalen dat de input niet klopt
- Het lichaam wil genezen als het de juiste omstandigheden krijgt
- Werk met correlaties en patronen, niet met losse symptomen
- Voorzichtig en gefaseerd: begin met elimineren, dan opbouwen

## CORRELATIES DIE JE MOET HERKENNEN
- Chronische stress + darmklachten → darm-brein as disbalans + verhoogde cortisol → oxidatieve stress → mineralentekorten (koper, magnesium, zink, B1, omega-3)
- Vermoeidheid + brain fog → mitochondriale disfunctie → ATP-productie verstoord
- Hoge stress + slaapproblemen → HPA-as uitputting → bijniermoeheid → cortisol ritme verstoord
- Darmklachten + huidproblemen + stemmingswisselingen → leaky gut + dysbiose → systemische ontsteking

## VEILIGHEIDSREGELS
- Geef GEEN medische diagnoses
- Adviseer altijd een arts te raadplegen bij twijfel of ernstige klachten
- Werk VOORZICHTIG en GEFASEERD

Genereer een JSON-response met deze exacte structuur:
{
  "content": "[Minimaal 8 uitgebreide alinea's: (1) Warme persoonlijke opening met naam ${userName}, (2) Analyse van de klachten en patronen, (3) Correlaties en onderliggende oorzaken met uitleg WAAROM, (4) Wat er gebeurt als niets gedaan wordt, (5) Wat er verbetert bij opvolging, (6) Uitleg over het 6-maanden herstelplan, (7) Specifieke aandacht voor bloedwaarden/tekorten, (8) Motiverende afsluiting met call-to-action]",
  "summary": "[2-3 alinea's: kernbevindingen en de rode draad van het herstelplan]",
  "keyInsights": ["Inzicht 1 met uitleg", "Inzicht 2", "Inzicht 3", "Inzicht 4", "Inzicht 5"],
  "recommendations": ["Aanbeveling 1 met uitleg waarom", "Aanbeveling 2", "Aanbeveling 3", "Aanbeveling 4", "Aanbeveling 5"],
  "protocols": {
    "nutrition": ["Voedingsprotocol week 1-4: eliminatiefase", "Voedingsprotocol week 5-8: opbouwfase", "Voedingsprotocol week 9-12: optimalisatiefase"],
    "supplements": ["Supplement 1 met dosering en timing", "Supplement 2", "Supplement 3"],
    "lifestyle": ["Leefstijlverandering 1 met concrete stappen", "Leefstijl 2", "Leefstijl 3"],
    "mentalPractices": ["Mentale praktijk 1", "Praktijk 2", "Praktijk 3"]
  },
  "scientificReferences": ["Referentie 1", "Referentie 2", "Referentie 3", "Referentie 4", "Referentie 5"]
}

## 6-MAANDEN HERSTELPLAN (verwerk in content)
Maand 1-2: Stabilisatiefase — verwijder triggers, herstel slaapritme, start stressmanagement
Maand 3-4: Herstelfase — gefermenteerde voeding, gerichte supplementen, dagelijkse beweging
Maand 5-6: Optimalisatiefase — evalueer bloedwaarden, pas supplementen aan, bouw intensiteit op

## CALL TO ACTION (verplicht aan het einde van content)
"Dit is slechts het begin van jouw gezondheidsreis. Voor persoonlijke begeleiding bij het uitvoeren van dit 6-maanden herstelplan kunt u contact opnemen via info@holistischadviseur.nl. Samen bespreken we uw voortgang en passen we het plan aan op basis van uw ervaringen."

Zorg dat het rapport minimaal 1500 woorden is, persoonlijk en warm (gebruik naam ${userName}), wetenschappelijk onderbouwd maar begrijpelijk.`;

  const conditionKnowledge = getConditionSpecificKnowledge(conditionType);

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Je bent een holistische gezondheidsadviseur van Holistisch Adviseur (holistischadviseur.nl), opgericht door Abdellah Ouadoudi.

${AI_CORE_MINDSET}
${MULTI_LAYER_ANALYSIS}
${CORRELATION_ENGINE}
${VALIDATION_SYSTEM}
${HOLISTIC_CORE_PRINCIPLES}
${conditionKnowledge}
${REPORT_STRUCTURE}
${SLEEP_REBOOT_PROTOCOL}

BELANGRIJK: Gebruik nooit technische variabelenamen in de rapporttekst. Schrijf altijd in natuurlijk Nederlands.
Je genereert altijd uitgebreide, wetenschappelijk onderbouwde rapporten van minimaal 1500 woorden.`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "full_health_report",
          strict: true,
          schema: {
            type: "object",
            properties: {
              content: { type: "string" },
              summary: { type: "string" },
              keyInsights: { type: "array", items: { type: "string" } },
              recommendations: { type: "array", items: { type: "string" } },
              protocols: {
                type: "object",
                properties: {
                  nutrition: { type: "array", items: { type: "string" } },
                  supplements: { type: "array", items: { type: "string" } },
                  lifestyle: { type: "array", items: { type: "string" } },
                  mentalPractices: { type: "array", items: { type: "string" } },
                },
                required: ["nutrition", "supplements", "lifestyle", "mentalPractices"],
                additionalProperties: false,
              },
              scientificReferences: { type: "array", items: { type: "string" } },
            },
            required: ["content", "summary", "keyInsights", "recommendations", "protocols", "scientificReferences"],
            additionalProperties: false,
          },
        },
      } as any,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No content from LLM");

    const contentStr = typeof content === "string" ? content : JSON.stringify(content);
    
    let parsed: any;
    try {
      parsed = JSON.parse(contentStr);
    } catch (parseError) {
      const jsonMatch = contentStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error(`Failed to parse LLM response as JSON: ${parseError}`);
      }
    }
    
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('LLM response is not an object');
    }
    
    if (typeof parsed.content !== 'string') {
      parsed.content = JSON.stringify(parsed.content);
    }

    // ✅ FIX 2: zorg dat protocols altijd de juiste structuur heeft met named keys
    if (parsed.protocols) {
      // Als protocols een array is of numeric keys heeft, herstel de structuur
      const isNumericKeys = Object.keys(parsed.protocols).every(k => !isNaN(Number(k)));
      if (Array.isArray(parsed.protocols) || isNumericKeys) {
        console.warn('[Full Report] protocols had wrong structure, using empty defaults');
        parsed.protocols = {
          nutrition: [],
          supplements: [],
          lifestyle: [],
          mentalPractices: [],
        };
      }
      // Zorg dat alle verwachte keys bestaan
      parsed.protocols.nutrition = parsed.protocols.nutrition || [];
      parsed.protocols.supplements = parsed.protocols.supplements || [];
      parsed.protocols.lifestyle = parsed.protocols.lifestyle || [];
      parsed.protocols.mentalPractices = parsed.protocols.mentalPractices || [];
    }
    
    console.log('[Full Report] Generated with content length:', parsed.content?.length, 'insights:', parsed.keyInsights?.length);
    return parsed;
  } catch (error) {
    console.error("Error generating full report:", error);
    throw error;
  }
}

function generatePDFContent(report: any): string {
  let keyInsights: string[] = [];
  let recommendations: string[] = [];
  let protocols: Record<string, string[]> = {};
  let scientificReferences: string[] = [];

  try { keyInsights = typeof report.keyInsights === "string" ? JSON.parse(report.keyInsights) : (report.keyInsights || []); } catch { keyInsights = []; }
  try { recommendations = typeof report.recommendations === "string" ? JSON.parse(report.recommendations) : (report.recommendations || []); } catch { recommendations = []; }
  try { protocols = typeof report.protocols === "string" ? JSON.parse(report.protocols) : (report.protocols || {}); } catch { protocols = {}; }
  try { scientificReferences = typeof report.scientificReferences === "string" ? JSON.parse(report.scientificReferences) : (report.scientificReferences || []); } catch { scientificReferences = []; }

  const protocolLabels: Record<string, string> = {
    nutrition: "🥗 Voedingsprotocol",
    supplements: "💊 Supplementen",
    lifestyle: "🏃 Leefstijl",
    mentalPractices: "🧠 Mentale Praktijken",
  };

  // ✅ FIX 2: sla numeric keys over, toon alleen named keys
  const protocolsHtml = Object.entries(protocols)
    .filter(([key]) => {
      // Sla numeric keys over (dit zijn gebroken data structuren)
      const isNumeric = !isNaN(Number(key));
      return !isNumeric && protocolLabels[key];
    })
    .map(([key, items]) => {
      const label = protocolLabels[key] || key;
      const itemsArray = Array.isArray(items) ? items : (typeof items === 'string' ? [items] : []);
      if (itemsArray.length === 0) return "";
      const itemsHtml = itemsArray.map((item: string, i: number) =>
        `<div class="protocol-item"><span class="num">${i + 1}</span><span>${item.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span></div>`
      ).join("");
      return `<div class="protocol-section"><h3>${label}</h3>${itemsHtml}</div>`;
    }).join("");

  const contentHtml = (report.content || "")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/## (.+)/g, "<h3>$1</h3>")
    .replace(/# (.+)/g, "<h2>$1</h2>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', Arial, sans-serif; color: #1a1a2e; background: white; padding: 0; }
    .cover { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 60px 50px; min-height: 200px; }
    .cover h1 { font-size: 28px; font-weight: 700; margin-bottom: 10px; }
    .cover .subtitle { font-size: 16px; opacity: 0.9; margin-bottom: 20px; }
    .cover .meta { font-size: 13px; opacity: 0.8; }
    .content { padding: 40px 50px; }
    .section { margin-bottom: 35px; page-break-inside: avoid; }
    .section-title { font-size: 18px; font-weight: 700; color: #4f46e5; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 15px; }
    .summary-box { background: #f0f4ff; border-left: 4px solid #4f46e5; padding: 18px 20px; border-radius: 0 8px 8px 0; line-height: 1.7; color: #374151; }
    .main-content { line-height: 1.8; color: #374151; font-size: 14px; }
    .main-content h2 { font-size: 16px; color: #1a1a2e; margin: 20px 0 8px; }
    .main-content h3 { font-size: 15px; color: #4f46e5; margin: 15px 0 6px; }
    .insight-item { display: flex; gap: 12px; margin-bottom: 12px; align-items: flex-start; }
    .insight-num { background: #fef3c7; color: #92400e; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
    .rec-item { display: flex; gap: 10px; margin-bottom: 10px; align-items: flex-start; color: #374151; font-size: 14px; }
    .rec-check { color: #059669; font-size: 16px; flex-shrink: 0; }
    .protocol-section { margin-bottom: 20px; }
    .protocol-section h3 { font-size: 15px; font-weight: 600; color: #374151; margin-bottom: 10px; }
    .protocol-item { display: flex; gap: 10px; margin-bottom: 8px; align-items: flex-start; font-size: 13px; color: #4b5563; }
    .num { background: #e0f2fe; color: #0369a1; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
    .ref-item { font-size: 12px; color: #6b7280; margin-bottom: 6px; padding-left: 15px; position: relative; }
    .ref-item::before { content: '•'; position: absolute; left: 0; }
    .footer { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px 50px; text-align: center; font-size: 11px; color: #9ca3af; }
    .disclaimer { background: #fef9c3; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; font-size: 11px; color: #78350f; margin-top: 20px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="cover">
    <h1>🌿 Holistisch Gezondheidsrapport</h1>
    <div class="subtitle">${report.title || "Persoonlijke Gezondheidsanalyse"}</div>
    <div class="meta">Gegenereerd op ${new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })} | Holistisch AI Kliniek — ai.holistischadviseur.nl</div>
  </div>

  <div class="content">
    ${report.summary ? `
    <div class="section">
      <div class="section-title">📋 Samenvatting</div>
      <div class="summary-box">${(report.summary || "").replace(/\n/g, "<br>")}</div>
    </div>` : ""}

    ${report.content ? `
    <div class="section">
      <div class="section-title">🔍 Analyse & Bevindingen</div>
      <div class="main-content"><p>${contentHtml}</p></div>
    </div>` : ""}

    ${keyInsights.length > 0 ? `
    <div class="section">
      <div class="section-title">💡 Belangrijkste Inzichten</div>
      ${keyInsights.map((insight: string, i: number) => `
        <div class="insight-item">
          <div class="insight-num">${i + 1}</div>
          <div style="font-size:14px;color:#374151;line-height:1.6">${insight.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        </div>`).join("")}
    </div>` : ""}

    ${recommendations.length > 0 ? `
    <div class="section">
      <div class="section-title">✅ Aanbevelingen</div>
      ${recommendations.map((rec: string) => `
        <div class="rec-item">
          <span class="rec-check">✓</span>
          <span>${rec.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>
        </div>`).join("")}
    </div>` : ""}

    ${protocolsHtml ? `
    <div class="section">
      <div class="section-title">📋 Persoonlijke Protocollen</div>
      ${protocolsHtml}
    </div>` : ""}

    ${scientificReferences.length > 0 ? `
    <div class="section">
      <div class="section-title">📚 Wetenschappelijke Referenties</div>
      ${scientificReferences.map((ref: string) => `<div class="ref-item">${ref.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`).join("")}
    </div>` : ""}

    <div class="disclaimer">
      <strong>⚠️ Disclaimer:</strong> De informatie en adviezen in dit rapport zijn uitsluitend bedoeld ter ondersteuning en ter informatie. Wij stellen geen medische diagnoses en geven geen medisch advies. Raadpleeg altijd een arts of gekwalificeerde zorgverlener bij klachten, twijfel of vóór het starten met nieuwe behandelingen, voeding of supplementen. Wij zijn niet aansprakelijk voor eventuele gevolgen van het gebruik van de verstrekte informatie.
    </div>
  </div>

  <div class="footer">
    Holistisch AI Kliniek — ai.holistischadviseur.nl — info@holistischadviseur.nl | © ${new Date().getFullYear()}
  </div>
</body>
</html>`;

  return html;
}
