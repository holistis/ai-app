/**
 * Server-side PDF generation using Puppeteer (Chrome/Chromium)
 * Converts HTML to PDF buffer for email attachments and downloads
 * This replaces WeasyPrint which has Python environment issues
 */

import { launch } from "puppeteer";

/**
 * Generate a PDF buffer from HTML content using Puppeteer
 */
export async function generatePDFBuffer(html: string): Promise<Buffer> {
  let browser;
  const startTime = Date.now();
  const htmlSize = html.length;
  
  try {
    console.log(`[PDF] Starting PDF generation - HTML size: ${htmlSize} bytes`);
    
    // Launch browser
    browser = await launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Set content
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Generate PDF
    const pdfData = await page.pdf({
      format: 'A4',
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      printBackground: true,
    });

    // Convert to Buffer
    const buffer = Buffer.from(pdfData);
    const generationTime = Date.now() - startTime;
    const pdfSize = buffer.length;
    
    console.log(`[PDF] ✅ SUCCESS - Generated ${pdfSize} bytes in ${generationTime}ms`);
    
    return buffer;
  } catch (error) {
    const generationTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[PDF] ❌ FAILED after ${generationTime}ms - ${errorMessage}`);
    throw new Error(`Failed to generate PDF: ${errorMessage}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generate styled HTML for a report (used for both PDF and email)
 */
export function buildReportHTML(report: {
  title?: string;
  summary?: string;
  content?: string;
  keyInsights?: any;
  recommendations?: any;
  protocols?: any;
  scientificReferences?: any;
  reportType?: string;
  conditionType?: string;
  patientName?: string;
}): string {
  // Parse JSON fields safely
  let keyInsights: string[] = [];
  let recommendations: string[] = [];
  let protocols: Record<string, string[]> = {};
  let scientificReferences: string[] = [];

  try { keyInsights = typeof report.keyInsights === "string" ? JSON.parse(report.keyInsights) : (report.keyInsights || []); } catch { keyInsights = []; }
  try { recommendations = typeof report.recommendations === "string" ? JSON.parse(report.recommendations) : (report.recommendations || []); } catch { recommendations = []; }
  try {
    if (typeof report.protocols === "string") {
      protocols = JSON.parse(report.protocols);
    } else if (report.protocols && typeof report.protocols === 'object') {
      protocols = report.protocols;
    } else {
      protocols = {};
    }
  } catch { protocols = {}; }
  try { scientificReferences = typeof report.scientificReferences === "string" ? JSON.parse(report.scientificReferences) : (report.scientificReferences || []); } catch { scientificReferences = []; }

  const protocolLabels: Record<string, string> = {
    nutrition: "Voedingsprotocol",
    supplements: "Supplementen",
    lifestyle: "Leefstijl",
    mentalPractices: "Mentale Praktijken",
  };

  const conditionLabels: Record<string, string> = {
    chronic_fatigue: "Chronische Vermoeidheid",
    digestive_issues: "Spijsverteringsproblemen",
    solk: "SOLK",
    alk: "ALK / Gewrichtsklachten",
  };

  const isFullReport = report.reportType === "full_report";
  const conditionName = conditionLabels[report.conditionType || ""] || report.conditionType || "";
  const reportTypeName = isFullReport ? "Volledig Gezondheidsrapport" : "Inzicht Rapport";

  const escapeHtml = (str: string) => str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const contentHtml = (report.content || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/## (.+)/g, "<h3>$1</h3>")
    .replace(/# (.+)/g, "<h2>$1</h2>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  const protocolsHtml = Object.entries(protocols).map(([key, items]) => {
    const label = protocolLabels[key] || key;
    // Ensure items is always an array
    const itemsArray = Array.isArray(items) ? items : (typeof items === 'string' ? [items] : []);
    const itemsHtml = itemsArray.map((item: string, i: number) =>
      `<div class="protocol-item"><span class="num">${i + 1}</span><span>${escapeHtml(item)}</span></div>`
    ).join("");
    return `<div class="protocol-section"><h4>${label}</h4>${itemsHtml}</div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1a1a2e; background: white; font-size: 13px; }
    .cover { background: #4f46e5; color: white; padding: 50px 45px 40px; }
    .cover h1 { font-size: 26px; font-weight: bold; margin-bottom: 8px; }
    .cover .subtitle { font-size: 15px; opacity: 0.9; margin-bottom: 6px; }
    .cover .meta { font-size: 11px; opacity: 0.75; margin-top: 15px; }
    .cover .patient { font-size: 14px; margin-top: 10px; font-weight: bold; }
    .content { padding: 35px 45px; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 16px; font-weight: bold; color: #4f46e5; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 12px; }
    .summary-box { background: #f0f4ff; border-left: 4px solid #4f46e5; padding: 15px 18px; border-radius: 0 6px 6px 0; line-height: 1.7; }
    .main-content { line-height: 1.8; color: #374151; }
    .main-content h2 { font-size: 15px; color: #1a1a2e; margin: 18px 0 6px; }
    .main-content h3 { font-size: 14px; color: #4f46e5; margin: 12px 0 5px; }
    .insight-item { display: flex; gap: 10px; margin-bottom: 10px; align-items: flex-start; }
    .insight-num { background: #fef3c7; color: #92400e; width: 22px; height: 22px; border-radius: 50%; text-align: center; line-height: 22px; font-size: 10px; font-weight: bold; flex-shrink: 0; }
    .rec-item { margin-bottom: 8px; padding-left: 20px; position: relative; line-height: 1.6; }
    .rec-item::before { content: "✓"; position: absolute; left: 0; color: #059669; font-weight: bold; }
    .protocol-section { margin-bottom: 18px; }
    .protocol-section h4 { font-size: 13px; font-weight: bold; color: #374151; margin-bottom: 8px; border-bottom: 1px solid #f3f4f6; padding-bottom: 4px; }
    .protocol-item { display: flex; gap: 8px; margin-bottom: 6px; align-items: flex-start; }
    .num { background: #e0f2fe; color: #0369a1; width: 20px; height: 20px; border-radius: 50%; text-align: center; line-height: 20px; font-size: 10px; font-weight: bold; flex-shrink: 0; }
    .ref-item { font-size: 11px; color: #6b7280; margin-bottom: 5px; padding-left: 12px; position: relative; }
    .ref-item::before { content: "•"; position: absolute; left: 0; }
    .disclaimer { background: #fef9c3; border: 1px solid #fde68a; border-radius: 6px; padding: 10px 14px; font-size: 10px; color: #78350f; margin-top: 20px; line-height: 1.6; }
    .footer { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 15px 45px; text-align: center; font-size: 10px; color: #9ca3af; }
    .locked-notice { background: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; padding: 12px 16px; text-align: center; color: #92400e; font-size: 12px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="cover">
    <h1>Holistisch Gezondheidsrapport</h1>
    <div class="subtitle">${reportTypeName}${conditionName ? ` — ${conditionName}` : ""}</div>
    ${report.patientName ? `<div class="patient">Opgesteld voor: ${escapeHtml(report.patientName)}</div>` : ""}
    <div class="meta">Gegenereerd op ${new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })} | Holistisch AI Kliniek — ai.holistischadviseur.nl</div>
  </div>

  <div class="content">
    ${report.summary ? `
    <div class="section">
      <div class="section-title">Samenvatting</div>
      <div class="summary-box">${escapeHtml(report.summary).replace(/\n/g, "<br>")}</div>
    </div>` : ""}

    ${report.content ? `
    <div class="section">
      <div class="section-title">Analyse &amp; Bevindingen</div>
      <div class="main-content"><p>${contentHtml}</p></div>
    </div>` : ""}

    ${keyInsights.length > 0 ? `
    <div class="section">
      <div class="section-title">Belangrijkste Inzichten</div>
      ${keyInsights.map((insight: string, i: number) => `
        <div class="insight-item">
          <div class="insight-num">${i + 1}</div>
          <div style="line-height:1.6">${escapeHtml(insight)}</div>
        </div>`).join("")}
    </div>` : ""}

    ${recommendations.length > 0 ? `
    <div class="section">
      <div class="section-title">Aanbevelingen</div>
      ${recommendations.map((rec: string) => `<div class="rec-item">${escapeHtml(rec)}</div>`).join("")}
    </div>` : ""}

    ${Object.keys(protocols).length > 0 ? `
    <div class="section">
      <div class="section-title">Persoonlijke Protocollen</div>
      ${protocolsHtml}
    </div>` : isFullReport ? "" : `
    <div class="section">
      <div class="section-title">Persoonlijke Protocollen</div>
      <div class="locked-notice">
        De volledige protocollen zijn beschikbaar in het Volledig Rapport (€34,95).<br>
        Bezoek <strong>ai.holistischadviseur.nl</strong> om het volledige rapport te ontgrendelen.
      </div>
    </div>`}

    ${scientificReferences.length > 0 ? `
    <div class="section">
      <div class="section-title">Wetenschappelijke Referenties</div>
      ${scientificReferences.map((ref: string) => `<div class="ref-item">${escapeHtml(ref)}</div>`).join("")}
    </div>` : ""}

    <div class="disclaimer">
      <strong>Disclaimer:</strong> De informatie en adviezen in dit rapport zijn uitsluitend bedoeld ter ondersteuning en ter informatie. Wij stellen geen medische diagnoses en geven geen medisch advies. Raadpleeg altijd een arts of gekwalificeerde zorgverlener bij klachten, twijfel of voor het starten met nieuwe behandelingen, voeding of supplementen. Wij zijn niet aansprakelijk voor eventuele gevolgen van het gebruik van de verstrekte informatie. Het gebruik van deze website en AI-tool is volledig op eigen verantwoordelijkheid.
    </div>
  </div>

  <div class="footer">
    Holistisch AI Kliniek — ai.holistischadviseur.nl — info@holistischadviseur.nl | &copy; ${new Date().getFullYear()}
  </div>
</body>
</html>`;
}
