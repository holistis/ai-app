/**
 * FILE: server/_core/pdfGenerator.ts
 * VERBETERD:
 * - page-break-inside: avoid op alle secties en items → geen afgekapte zinnen
 * - Uitgebreid 6-maanden plan met stap-voor-stap instructies per conditie
 * - Gut-brain as / parasympathicus uitleg als dedicated sectie
 * - Professionele typografie en opmaak
 */

import { launch } from "puppeteer";

export async function generatePDFBuffer(html: string): Promise<Buffer> {
  let browser;
  const startTime = Date.now();

  try {
    console.log(`[PDF] Starting PDF generation - HTML size: ${html.length} bytes`);

    browser = await launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfData = await page.pdf({
      format: "A4",
      margin: { top: "20mm", right: "18mm", bottom: "20mm", left: "18mm" },
      printBackground: true,
    });

    const buffer = Buffer.from(pdfData);
    console.log(
      `[PDF] ✅ SUCCESS - Generated ${buffer.length} bytes in ${Date.now() - startTime}ms`
    );
    return buffer;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[PDF] ❌ FAILED after ${Date.now() - startTime}ms - ${errorMessage}`);
    throw new Error(`Failed to generate PDF: ${errorMessage}`);
  } finally {
    if (browser) await browser.close();
  }
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface ReportInput {
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
}

// ─── HTML BUILDER ─────────────────────────────────────────────────────────────

export function buildReportHTML(report: ReportInput): string {
  // ── Parse velden ──
  let keyInsights: string[] = [];
  let recommendations: string[] = [];
  let protocols: Record<string, string[]> = {};
  let scientificReferences: string[] = [];

  try { keyInsights = typeof report.keyInsights === "string" ? JSON.parse(report.keyInsights) : (report.keyInsights || []); } catch { keyInsights = []; }
  try { recommendations = typeof report.recommendations === "string" ? JSON.parse(report.recommendations) : (report.recommendations || []); } catch { recommendations = []; }
  try {
    if (typeof report.protocols === "string") protocols = JSON.parse(report.protocols);
    else if (report.protocols && typeof report.protocols === "object") protocols = report.protocols;
  } catch { protocols = {}; }
  try { scientificReferences = typeof report.scientificReferences === "string" ? JSON.parse(report.scientificReferences) : (report.scientificReferences || []); } catch { scientificReferences = []; }

  const esc = (s: string) =>
    (s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const mdToHtml = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/## (.+)/g, '<h3 class="content-h3">$1</h3>')
      .replace(/# (.+)/g, '<h2 class="content-h2">$1</h2>')
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>");

  const conditionLabels: Record<string, string> = {
    chronic_fatigue: "Chronische Vermoeidheid",
    digestive_issues: "Spijsverteringsproblemen",
    solk: "SOLK",
    auto_immuun: "Auto-Immuun Klachten",
    alk: "ALK — Aspecifieke Klachten",
  };

  const protocolLabels: Record<string, string> = {
    nutrition: "Voedingsprotocol",
    supplements: "Supplementen",
    lifestyle: "Leefstijl",
    mentalPractices: "Mentale Praktijken",
  };

  const conditionName = conditionLabels[report.conditionType || ""] || report.conditionType || "";
  const isFullReport = report.reportType === "full_report";
  const today = new Date().toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // ── GUT-BRAIN AS UITLEG ──
  const gutBrainHtml = buildGutBrainSection(report.conditionType || "");

  // ── 6-MAANDEN PLAN ──
  const sixMonthHtml = buildSixMonthPlan(report.conditionType || "", isFullReport);

  // ── PROTOCOLLEN ──
  const protocolsHtml = Object.entries(protocols)
    .map(([key, items]) => {
      const label = protocolLabels[key] || key;
      const arr = Array.isArray(items) ? items : [];
      return `
        <div class="protocol-block avoid-break">
          <h4 class="protocol-title">${esc(label)}</h4>
          ${arr.map((item: string, i: number) => `
            <div class="protocol-item avoid-break">
              <span class="num">${i + 1}</span>
              <span>${esc(item)}</span>
            </div>`).join("")}
        </div>`;
    }).join("");

  // ── INZICHTEN ──
  const insightsHtml = keyInsights
    .map((insight: string, i: number) => `
      <div class="insight-item avoid-break">
        <span class="insight-num">${i + 1}</span>
        <span>${esc(insight)}</span>
      </div>`)
    .join("");

  // ── AANBEVELINGEN ──
  const recsHtml = recommendations
    .map((rec: string) => `
      <div class="rec-item avoid-break">
        <span class="rec-check">✓</span>
        <span>${esc(rec)}</span>
      </div>`)
    .join("");

  // ── REFERENTIES ──
  const refsHtml = scientificReferences
    .map((ref: string, i: number) => `
      <div class="ref-item avoid-break">
        <span class="ref-num">[${i + 1}]</span>
        <span>${esc(ref)}</span>
      </div>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    /* ── RESET ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── BASE ── */
    body {
      font-family: Georgia, 'Times New Roman', serif;
      color: #1a1a2e;
      background: white;
      font-size: 12px;
      line-height: 1.75;
    }

    /* ── PAGE BREAK CONTROL — CRITICAL ── */
    .avoid-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .page-break-before {
      page-break-before: always;
      break-before: always;
    }
    h1, h2, h3, h4 {
      page-break-after: avoid;
      break-after: avoid;
    }

    /* ── COVER ── */
    .cover {
      background: linear-gradient(135deg, #4338ca 0%, #4f46e5 50%, #7c3aed 100%);
      color: white;
      padding: 48px 45px 40px;
      page-break-after: always;
      break-after: always;
    }
    .cover-badge {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      border-radius: 20px;
      padding: 4px 14px;
      font-size: 10px;
      font-weight: bold;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 16px;
      font-family: Arial, sans-serif;
    }
    .cover h1 {
      font-size: 28px;
      font-weight: bold;
      margin-bottom: 6px;
      line-height: 1.3;
    }
    .cover .cover-sub {
      font-size: 16px;
      opacity: 0.85;
      margin-bottom: 4px;
      font-family: Arial, sans-serif;
    }
    .cover .cover-patient {
      font-size: 14px;
      font-weight: bold;
      margin-top: 14px;
      font-family: Arial, sans-serif;
    }
    .cover .cover-meta {
      font-size: 10px;
      opacity: 0.65;
      margin-top: 10px;
      font-family: Arial, sans-serif;
    }
    .cover-divider {
      border: none;
      border-top: 1px solid rgba(255,255,255,0.3);
      margin: 22px 0;
    }

    /* ── BODY CONTENT ── */
    .body-content {
      padding: 0;
    }

    /* ── SECTIONS ── */
    .section {
      margin-bottom: 28px;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
      padding-bottom: 8px;
      border-bottom: 2px solid #4f46e5;
      page-break-after: avoid;
      break-after: avoid;
    }
    .section-icon {
      width: 28px;
      height: 28px;
      background: #4f46e5;
      color: white;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      flex-shrink: 0;
      font-family: Arial, sans-serif;
    }
    .section-title {
      font-size: 16px;
      font-weight: bold;
      color: #1a1a2e;
      font-family: Arial, sans-serif;
    }

    /* ── SUMMARY BOX ── */
    .summary-box {
      background: #f0f4ff;
      border-left: 4px solid #4f46e5;
      border-radius: 0 8px 8px 0;
      padding: 16px 20px;
      line-height: 1.8;
      font-style: italic;
      color: #374151;
    }

    /* ── MAIN CONTENT ── */
    .main-content {
      line-height: 1.85;
      color: #2d3748;
    }
    .main-content p {
      margin-bottom: 12px;
    }
    .content-h2 {
      font-size: 15px;
      font-weight: bold;
      color: #1a1a2e;
      margin: 18px 0 8px;
      font-family: Arial, sans-serif;
      page-break-after: avoid;
      break-after: avoid;
    }
    .content-h3 {
      font-size: 13px;
      font-weight: bold;
      color: #4f46e5;
      margin: 14px 0 6px;
      font-family: Arial, sans-serif;
      page-break-after: avoid;
      break-after: avoid;
    }

    /* ── INSIGHTS ── */
    .insight-item {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
      align-items: flex-start;
      padding: 12px 14px;
      background: #fafafa;
      border-radius: 8px;
      border-left: 3px solid #fbbf24;
    }
    .insight-num {
      background: #fef3c7;
      color: #92400e;
      min-width: 24px;
      height: 24px;
      border-radius: 50%;
      text-align: center;
      line-height: 24px;
      font-size: 10px;
      font-weight: bold;
      flex-shrink: 0;
      font-family: Arial, sans-serif;
    }

    /* ── AANBEVELINGEN ── */
    .rec-item {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
      align-items: flex-start;
      line-height: 1.65;
    }
    .rec-check {
      color: #059669;
      font-weight: bold;
      flex-shrink: 0;
      margin-top: 1px;
    }

    /* ── PROTOCOLLEN ── */
    .protocol-block {
      margin-bottom: 20px;
      padding: 16px;
      background: #f8f9ff;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    .protocol-title {
      font-size: 13px;
      font-weight: bold;
      color: #374151;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid #e5e7eb;
      font-family: Arial, sans-serif;
    }
    .protocol-item {
      display: flex;
      gap: 10px;
      margin-bottom: 8px;
      align-items: flex-start;
    }
    .num {
      background: #e0e7ff;
      color: #3730a3;
      min-width: 20px;
      height: 20px;
      border-radius: 50%;
      text-align: center;
      line-height: 20px;
      font-size: 9px;
      font-weight: bold;
      flex-shrink: 0;
      font-family: Arial, sans-serif;
    }

    /* ── 6-MAANDEN PLAN ── */
    .month-block {
      margin-bottom: 22px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      overflow: hidden;
    }
    .month-header {
      background: linear-gradient(90deg, #4f46e5, #7c3aed);
      color: white;
      padding: 10px 16px;
      font-family: Arial, sans-serif;
    }
    .month-num {
      font-size: 10px;
      font-weight: bold;
      letter-spacing: 0.08em;
      opacity: 0.8;
      text-transform: uppercase;
    }
    .month-title {
      font-size: 14px;
      font-weight: bold;
    }
    .month-body {
      padding: 14px 16px;
      background: white;
    }
    .month-step {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
      align-items: flex-start;
      line-height: 1.65;
    }
    .month-step-dot {
      min-width: 8px;
      height: 8px;
      background: #4f46e5;
      border-radius: 50%;
      margin-top: 6px;
      flex-shrink: 0;
    }
    .month-step-text strong {
      display: block;
      font-weight: bold;
      color: #1a1a2e;
      margin-bottom: 2px;
    }
    .month-step-text p {
      color: #6b7280;
      font-size: 11px;
      line-height: 1.6;
      margin: 0;
    }
    .month-locked {
      padding: 14px 16px;
      background: #f9fafb;
      text-align: center;
      color: #9ca3af;
      font-size: 11px;
      font-family: Arial, sans-serif;
    }

    /* ── GUT-BRAIN SECTIE ── */
    .gut-brain-box {
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
      border: 1px solid #bbf7d0;
      border-radius: 10px;
      padding: 18px 20px;
      margin-bottom: 16px;
    }
    .gut-brain-box h4 {
      font-size: 13px;
      font-weight: bold;
      color: #065f46;
      margin-bottom: 8px;
      font-family: Arial, sans-serif;
    }
    .gut-brain-box p {
      font-size: 11.5px;
      color: #374151;
      line-height: 1.75;
      margin-bottom: 8px;
    }
    .gut-brain-box p:last-child {
      margin-bottom: 0;
    }

    /* ── ANS SECTIE ── */
    .ans-box {
      background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%);
      border: 1px solid #fbcfe8;
      border-radius: 10px;
      padding: 18px 20px;
      margin-bottom: 16px;
    }
    .ans-box h4 {
      font-size: 13px;
      font-weight: bold;
      color: #831843;
      margin-bottom: 8px;
      font-family: Arial, sans-serif;
    }
    .ans-box p {
      font-size: 11.5px;
      color: #374151;
      line-height: 1.75;
      margin-bottom: 8px;
    }
    .ans-box p:last-child {
      margin-bottom: 0;
    }

    /* ── REFERENTIES ── */
    .ref-item {
      display: flex;
      gap: 8px;
      margin-bottom: 7px;
      align-items: flex-start;
      line-height: 1.55;
    }
    .ref-num {
      color: #4f46e5;
      font-weight: bold;
      font-size: 10px;
      flex-shrink: 0;
      margin-top: 1px;
      font-family: Arial, sans-serif;
    }

    /* ── DISCLAIMER ── */
    .disclaimer {
      background: #fef9c3;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 10px;
      color: #78350f;
      line-height: 1.65;
      margin-top: 24px;
      font-family: Arial, sans-serif;
    }

    /* ── LOCKED NOTICE ── */
    .locked-notice {
      background: #fef3c7;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 14px 18px;
      text-align: center;
      color: #92400e;
      font-size: 11px;
      font-family: Arial, sans-serif;
      line-height: 1.65;
    }

    /* ── FOOTER ── */
    .footer {
      margin-top: 32px;
      border-top: 1px solid #e5e7eb;
      padding-top: 12px;
      text-align: center;
      font-size: 9px;
      color: #9ca3af;
      font-family: Arial, sans-serif;
    }

    @media print {
      .avoid-break { page-break-inside: avoid; break-inside: avoid; }
      .page-break-before { page-break-before: always; break-before: always; }
      h1, h2, h3, h4 { page-break-after: avoid; break-after: avoid; }
      .month-block { page-break-inside: avoid; break-inside: avoid; }
      .protocol-block { page-break-inside: avoid; break-inside: avoid; }
      .insight-item { page-break-inside: avoid; break-inside: avoid; }
      .rec-item { page-break-inside: avoid; break-inside: avoid; }
    }
  </style>
</head>
<body>

  <!-- ═══════════ COVER ═══════════ -->
  <div class="cover">
    <div class="cover-badge">${isFullReport ? "Volledig Gezondheidsrapport" : "Inzicht Rapport"}</div>
    <h1>Holistisch<br>Gezondheidsrapport</h1>
    <div class="cover-sub">${conditionName ? esc(conditionName) : "Persoonlijke Gezondheidsanalyse"}</div>
    ${report.patientName ? `<div class="cover-patient">Opgesteld voor: ${esc(report.patientName)}</div>` : ""}
    <hr class="cover-divider">
    <div class="cover-meta">
      Gegenereerd op ${today} &nbsp;|&nbsp; Holistisch AI Kliniek — ai.holistischadviseur.nl
    </div>
  </div>

  <!-- ═══════════ BODY ═══════════ -->
  <div class="body-content">

    ${report.summary ? `
    <!-- SAMENVATTING -->
    <div class="section avoid-break">
      <div class="section-header">
        <div class="section-icon">📋</div>
        <div class="section-title">Samenvatting</div>
      </div>
      <div class="summary-box">${esc(report.summary).replace(/\n/g, "<br>")}</div>
    </div>` : ""}

    ${report.content ? `
    <!-- ANALYSE -->
    <div class="section">
      <div class="section-header avoid-break">
        <div class="section-icon">🔍</div>
        <div class="section-title">Persoonlijke Analyse</div>
      </div>
      <div class="main-content"><p>${mdToHtml(report.content)}</p></div>
    </div>` : ""}

    ${keyInsights.length > 0 ? `
    <!-- INZICHTEN -->
    <div class="section">
      <div class="section-header avoid-break">
        <div class="section-icon">💡</div>
        <div class="section-title">Sleutelinzichten</div>
      </div>
      ${insightsHtml}
    </div>` : ""}

    <!-- GUT-BRAIN AS & PARASYMPATHICUS -->
    ${gutBrainHtml}

    ${recommendations.length > 0 ? `
    <!-- AANBEVELINGEN -->
    <div class="section">
      <div class="section-header avoid-break">
        <div class="section-icon">✅</div>
        <div class="section-title">Aanbevelingen</div>
      </div>
      ${recsHtml}
    </div>` : ""}

    ${Object.keys(protocols).length > 0 ? `
    <!-- PROTOCOLLEN -->
    <div class="section">
      <div class="section-header avoid-break">
        <div class="section-icon">⚗️</div>
        <div class="section-title">Jouw Protocollen</div>
      </div>
      ${protocolsHtml}
    </div>` : !isFullReport ? `
    <div class="section avoid-break">
      <div class="section-header">
        <div class="section-icon">⚗️</div>
        <div class="section-title">Persoonlijke Protocollen</div>
      </div>
      <div class="locked-notice">
        De volledige protocollen zijn beschikbaar in het Volledig Rapport (€34,95).<br>
        Bezoek <strong>ai.holistischadviseur.nl</strong> om het volledige rapport te ontgrendelen.
      </div>
    </div>` : ""}

    <!-- 6-MAANDEN HERSTELPLAN -->
    <div class="section page-break-before">
      <div class="section-header avoid-break">
        <div class="section-icon">📅</div>
        <div class="section-title">Jouw 6-Maanden Persoonlijk Herstelplan</div>
      </div>
      <p style="color:#6b7280; font-size:11px; margin-bottom:18px; font-family:Arial,sans-serif;">
        ${isFullReport
          ? "Hieronder vind je een gedetailleerd, stap-voor-stap herstelplan op maat voor jouw situatie. Volg dit plan in het aangegeven tempo en pas het aan op basis van hoe je je voelt."
          : "Maand 1 en 2 zijn direct beschikbaar. Ontgrendel maand 3–6 met het Volledig Rapport (€34,95) via ai.holistischadviseur.nl."}
      </p>
      ${sixMonthHtml}
    </div>

    ${scientificReferences.length > 0 ? `
    <!-- REFERENTIES -->
    <div class="section">
      <div class="section-header avoid-break">
        <div class="section-icon">📚</div>
        <div class="section-title">Wetenschappelijke Referenties</div>
      </div>
      ${refsHtml}
    </div>` : ""}

    <!-- DISCLAIMER -->
    <div class="disclaimer avoid-break">
      <strong>Medische Disclaimer:</strong> De informatie en adviezen in dit rapport zijn uitsluitend bedoeld ter informatie en ondersteuning. Wij stellen geen medische diagnoses en geven geen medisch advies. Raadpleeg altijd een arts of gekwalificeerde zorgverlener bij klachten, twijfel of voor het starten van nieuwe behandelingen, voeding of supplementen. Het gebruik van dit rapport is volledig op eigen verantwoordelijkheid. Holistisch Adviseur (ai.holistischadviseur.nl) is niet aansprakelijk voor eventuele gevolgen van het gebruik van de verstrekte informatie.
    </div>

    <div class="footer">
      Holistisch AI Kliniek &nbsp;·&nbsp; ai.holistischadviseur.nl &nbsp;·&nbsp; info@holistischadviseur.nl &nbsp;·&nbsp; © ${new Date().getFullYear()}
    </div>

  </div><!-- /body-content -->
</body>
</html>`;
}

// ─── GUT-BRAIN AS & ANS SECTIE ────────────────────────────────────────────────

function buildGutBrainSection(conditionType: string): string {
  const showGutBrain = ["digestive_issues", "solk", "chronic_fatigue", "auto_immuun", "alk"].includes(conditionType);
  if (!showGutBrain) return "";

  const gutBrainText = `
    <div class="gut-brain-box avoid-break">
      <h4>🧠 De Darm-Hersen-As: Waarom Jouw Darmen Je Brein Beïnvloeden</h4>
      <p>
        Je darmen en hersenen staan via de <strong>nervus vagus</strong> — de langste zenuw van je lichaam — in directe communicatie met elkaar.
        Dit netwerk heet de <em>darm-hersen-as</em>. Zo'n <strong>90% van alle informatie</strong> over je lichaamstoestand reist via deze as
        van de darmen naar de hersenen, niet andersom. Je darmen produceren ook meer dan <strong>90% van het serotonine</strong> in je lichaam —
        het hormoon dat je stemming, slaap en stressreactie reguleert.
      </p>
      <p>
        Wanneer de darmbarrière beschadigd raakt — door stress, antibiotica, bewerkte voeding of een infectie — kunnen bacteriën, schimmels
        en afvalstoffen die normaal in de darm horen, door de darmwand lekken. Dit noemen we <em>intestinale permeabiliteit</em>,
        ook bekend als <strong>"leaky gut"</strong>. Deze stoffen komen in de bloedbaan terecht en veroorzaken een systemische laaggradige ontsteking.
      </p>
      <p>
        In de meest ernstige gevallen kunnen deze stoffen <strong>de bloedhersenbarrière bereiken</strong> — de beschermende laag
        rond de hersenen. Dit kan leiden tot neuroinflammatie, hersenmist, angstgevoelens, somberheid en zelfs <strong>paniekaanvallen</strong>.
        Niet omdat er "iets mis is in je hoofd", maar omdat je darmgezondheid letterlijk de chemie van je hersenen beïnvloedt.
      </p>
    </div>`;

  const ansText = `
    <div class="ans-box avoid-break">
      <h4>⚡ Het Autonome Zenuwstelsel: Gas & Rem</h4>
      <p>
        Je lichaam heeft een ingebouwd systeem dat reageert op gevaar en ontspanning: het <strong>autonome zenuwstelsel (ANS)</strong>.
        Dit bestaat uit twee tegengestelde takken: de <em>sympathicus</em> ("gaspedaal" — vecht-of-vluchtreactie)
        en de <em>parasympathicus</em> ("rem" — rust en herstel).
      </p>
      <p>
        Bij chronische stress, pijn, slaaptekort of darmontsteking schiet het lichaam automatisch in de <strong>sympathische modus</strong>.
        Je hartslag stijgt, spijsvertering vertraagt, spieren spannen aan en stresshormonen zoals cortisol en adrenaline worden aangemaakt.
        Op de lange termijn leidt dit tot uitputting, angst, slaapproblemen en een overprikkeld immuunsysteem.
      </p>
      <p>
        Het goede nieuws: de parasympathicus activeer je actief. <strong>Diepe buikademhaling, koudwatertherapie, meditatie,
        beweging in de natuur en een vaste slaaproutine</strong> zijn wetenschappelijk bewezen manieren om het zenuwstelsel
        terug in balans te brengen. Dit protocol bevat concrete oefeningen om dit dagelijks toe te passen.
      </p>
    </div>`;

  return `
    <div class="section">
      <div class="section-header avoid-break">
        <div class="section-icon">🔗</div>
        <div class="section-title">Verbindingen in Jouw Lichaam</div>
      </div>
      ${gutBrainText}
      ${ansText}
    </div>`;
}

// ─── 6-MAANDEN PLAN ───────────────────────────────────────────────────────────

interface MonthPlan {
  title: string;
  steps: { title: string; detail: string }[];
}

function buildSixMonthPlan(conditionType: string, isFullReport: boolean): string {
  const plans = getSixMonthPlans(conditionType);

  return plans.map((month, i) => {
    const isLocked = !isFullReport && i >= 2;
    return `
      <div class="month-block avoid-break">
        <div class="month-header">
          <div class="month-num">MAAND ${i + 1}</div>
          <div class="month-title">${month.title}</div>
        </div>
        ${isLocked
          ? `<div class="month-locked">🔒 Beschikbaar in het Volledig Rapport — ai.holistischadviseur.nl</div>`
          : `<div class="month-body">
              ${month.steps.map(step => `
                <div class="month-step avoid-break">
                  <div class="month-step-dot"></div>
                  <div class="month-step-text">
                    <strong>${step.title}</strong>
                    <p>${step.detail}</p>
                  </div>
                </div>`).join("")}
            </div>`
        }
      </div>`;
  }).join("");
}

function getSixMonthPlans(conditionType: string): MonthPlan[] {
  const plans: Record<string, MonthPlan[]> = {

    // ── CHRONISCHE VERMOEIDHEID ──
    chronic_fatigue: [
      {
        title: "Fundament Leggen — Energiedrain stoppen",
        steps: [
          {
            title: "Eliminatiedieet starten",
            detail: "Verwijder suiker, gluten, alcohol en bewerkte voeding. Dit is de meest directe manier om de laaggradige ontsteking te verlagen die energie verbruikt. Eet in week 1-4 alleen onbewerkt vlees, vis, groenten, rijst en aardappelen. Maak een eetdagboek bij om patronen te herkennen.",
          },
          {
            title: "Slaapritme instellen",
            detail: "Ga elke dag op hetzelfde tijdstip naar bed en sta op hetzelfde tijdstip op — ook in het weekend. Doel: 22:30 uur in bed, 07:00 uur opstaan. Geen schermen na 21:00. Magnesium glycinaat 400mg voor het slapen helpt de slaapkwaliteit aantoonbaar te verbeteren.",
          },
          {
            title: "Basis supplementen",
            detail: "Start met: Magnesium glycinaat 400mg (slaap + energieproductie), Vitamine B-complex 's ochtends (mitochondriale functie), CoQ10 100-200mg bij ontbijt (celenergie), Vitamine D3 2000-4000IU + K2 100mcg (immuunregulatie). Deze zijn verkrijgbaar bij onder andere Now Foods, Pure Encapsulations of Bol.com.",
          },
        ],
      },
      {
        title: "Darmherstel — Energiebron repareren",
        steps: [
          {
            title: "Microbioom opbouwen",
            detail: "Voeg dagelijks gefermenteerde producten toe: kefir (250ml per dag), zuurkool (1-2 eetlepels bij de maaltijd), kimchi of kombucha. Voeg ook een probiotica supplement toe: Multi-strain probiotica 25 miljard CFU 's ochtends op nuchtere maag (bijv. Lactobacillus acidophilus + Bifidobacterium lactis combinatie).",
          },
          {
            title: "Post-exertionele drempel bewaken",
            detail: "Bijhoud dagelijks je energieniveau op schaal 1-10. Rust wanneer je een 6 of lager scoort — dit is geen zwakte maar strategie. Begin met 10-15 minuten lichte beweging per dag (wandelen), verhoog pas als je 3 opeenvolgende dagen op 7+ scoort.",
          },
          {
            title: "L-glutamine en darmwandherstel",
            detail: "Neem 5g L-glutamine opgelost in water op nuchtere maag. Dit is de brandstof voor de cellen van je darmwand. Voeg ook zink 15-30mg per dag toe — dit versterkt de tight junctions in de darmwand waardoor minder schadelijke stoffen in de bloedbaan lekken.",
          },
        ],
      },
      {
        title: "Energie & Herstel — Mitochondriën herstellen",
        steps: [
          {
            title: "CoQ10 en NADH protocol",
            detail: "Verhoog CoQ10 naar 300mg en voeg NADH 10mg toe. NADH is direct betrokken bij ATP-productie in de mitochondriën. Studies tonen aan dat dit bij ME/CVS patiënten significant energie verbetert. Neem beide bij het ontbijt.",
          },
          {
            title: "Beweging uitbreiden",
            detail: "Bouw op naar 20-30 minuten wandelen per dag. Voeg 2x per week lichte krachttraining toe (weerstandsbanden of lichaamsgewicht). Herstel 48 uur tussen sessies. Stop VOOR je je uitgeput voelt — dit is de sleutel bij post-exertionele malaise.",
          },
          {
            title: "Adaptogenen introduceren",
            detail: "Start met Ashwagandha (KSM-66 extract) 300-600mg: vermindert cortisol en verbetert energieniveaus. Voeg Rhodiola Rosea 200-400mg toe in de ochtend: verbetert mentale helderheid en vermindert vermoeidheid. Neem adaptogens niet na 14:00 om slaap niet te verstoren.",
          },
        ],
      },
      {
        title: "Diepgaand Herstel — Neurologie stabiliseren",
        steps: [
          {
            title: "Vagus zenuw activering",
            detail: "Dagelijks 2x de 4-7-8 ademhaling: inademen 4 seconden, vasthouden 7 seconden, uitademen 8 seconden. Dit activeert direct de parasympathicus en verlaagt cortisol. Voeg koude douche (30 seconden koud aan het eind) toe — dit stimuleert de nervus vagus krachtig.",
          },
          {
            title: "Mycotherapie overwegen",
            detail: "Lion's Mane paddenstoel (1000mg per dag) stimuleert NGF (nerve growth factor) en kan de cognitieve functie en energie bij ME/CVS verbeteren. Reishi (600mg 's avonds) ondersteunt immuunregulatie en slaapkwaliteit. Verkrijgbaar bij o.a. Purasana of Root & Bones.",
          },
          {
            title: "Hormoonpanel laten testen",
            detail: "Laat de volgende waarden controleren: cortisol (bij voorkeur salivatest 4x per dag), schildklier TSH/fT3/fT4, insuline nuchtere waarden, geslachtshormonen. Breng de resultaten mee naar de volgende afspraak voor gerichte aanpassing van het protocol.",
          },
        ],
      },
      {
        title: "Stabilisatie — Winst consolideren",
        steps: [
          {
            title: "Trigger-checklist",
            detail: "Maak een persoonlijke lijst van alles dat je energie verbruikt (stresssituaties, mensen, activiteiten) versus alles dat energie geeft. Elimineer actief de grootste drainers. Plan dagelijks minimaal één energiegevende activiteit.",
          },
          {
            title: "Supplementen verfijnen",
            detail: "Laat vitamine B12 (actief methylcobalamine), folaat (actief methylfolaat), ijzer en ferritine testen. Veel ME/CVS patiënten hebben een tekort aan actief B12 wat de energieproductie blokkeert. Pas supplementen aan op basis van je bloedwaarden.",
          },
          {
            title: "Slaap verdiepen",
            detail: "Voeg GABA 500mg of L-theanine 200mg toe voor het slapen voor een diepere slaap. Overweeg een slaapmasker en oordopjes voor optimale omgeving. Houd een slaaplogboek bij om de kwaliteit te monitoren.",
          },
        ],
      },
      {
        title: "Langetermijn — Zelfmanagement en preventie",
        steps: [
          {
            title: "Onderhoudsfase en monitoring",
            detail: "Ga elke 3 maanden terug naar de baseline-check: energieniveau, slaap, stemming, spijsvertering. Pas supplementen aan als waarden veranderen. Maak een 'gezondheidskalender' met kwartaalchecks bij een functioneel arts.",
          },
          {
            title: "Stressresilience opbouwen",
            detail: "Dagelijks 10 minuten meditatie of mindfulness (apps: Calm, Headspace, Waking Up). Leer je grenzen kennen en communiceren. Bouw een steunnetwerk op van mensen die je situatie begrijpen. Overweeg een therapeut gespecialiseerd in chronische aandoeningen.",
          },
          {
            title: "Preventie van terugval",
            detail: "Houd een 'vroege waarschuwingslijst' bij: de eerste signalen dat je overvraagt. Maak een 'crisisplan' van concrete stappen (rust, aanpassen voeding, melden bij zorgverlener). Behandel infecties vroeg en agressief — herstel na een infectie kan maanden kosten als je ME/CVS hebt.",
          },
        ],
      },
    ],

    // ── SPIJSVERTERINGS­PROBLEMEN ──
    digestive_issues: [
      {
        title: "Remove — Triggers elimineren",
        steps: [
          {
            title: "4R Protocol starten: Remove",
            detail: "Verwijder in week 1-4: gluten (brood, pasta, bier), zuivelproducten, suiker, alcohol en NSAID's als dat mogelijk is. Dit zijn de meest voorkomende triggers voor darmontsteking en permeabiliteit. Vervang door: rijst, aardappelen, groenten, vlees, vis, eieren en kokosmelk.",
          },
          {
            title: "Bewust eten",
            detail: "Kauw elke hap minimaal 20 keer — spijsvertering begint in de mond. Eet op vaste tijden. Eet nooit haastig of onder stress (dit schakelt de spijsvertering letterlijk uit via het sympathisch zenuwstelsel). Neem 10 minuten rust na de maaltijd.",
          },
          {
            title: "Spijsverteringsenzymen",
            detail: "Neem brede-spectrum spijsverteringsenzymen bij elke maaltijd (bijv. Now Foods Super Enzymes). Dit ontlast de alvleesklier en helpt voedingsstoffen beter absorberen, zeker in de eliminatiefase wanneer de darmen herstellen.",
          },
        ],
      },
      {
        title: "Replace & Reinoculate — Herstellen",
        steps: [
          {
            title: "Microbioom heropbouwen",
            detail: "Voeg dagelijks toe: kefir 250ml (bevat 30+ bacteriestammen), zuurkool 2 eetlepels (Lactobacillus plantarum), kimchi of kombucha. Combineer met probiotica supplement: Lactobacillus rhamnosus GG + Bifidobacterium longum combinatie. Begin langzaam (1x per dag) en bouw op.",
          },
          {
            title: "Prebiotica als voeding voor de bacteriën",
            detail: "Voeg vezelrijke voeding toe: artisjok, prei, ui, knoflook, asperges en groene bananen bevatten inuline en FOS — de lievelingskost van gunstige darmbacteriën. Verhoog vezel geleidelijk (per week 5g extra) om opgeblazen gevoel te vermijden.",
          },
          {
            title: "Voedingstriggers identificeren",
            detail: "Houd 4 weken een voedseldagboek bij: schrijf op wat je eet én hoe je je daarna voelt (1-10 op klachten). Na week 4 introduceer je één voedingsgroep per week terug. Let de eerste 72 uur op reacties. Dit is de wetenschappelijk bewezen methode om intoleranties te ontdekken.",
          },
        ],
      },
      {
        title: "Repair — Darmwand herstellen",
        steps: [
          {
            title: "L-glutamine protocol",
            detail: "Neem 5g L-glutamine opgelost in water, 2x per dag op nuchtere maag (bij het opstaan en voor het slapen). Glutamine is de primaire energiebron van darmcellen en essentieel voor het herstel van de darmbarrière. Voeg zink carnosine 75mg toe voor extra darmwandbescherming.",
          },
          {
            title: "Bone broth / bouillon",
            detail: "Drink dagelijks 250-500ml zelfgemaakte of kwalitatieve bouillon. Bone broth bevat collageen, glycine en glutamine die de darmwand direct voeden en repareren. Dit is één van de meest effectieve en goedkope darmherstelingrediënten.",
          },
          {
            title: "Darm-stress connectie aanpakken",
            detail: "Dagelijks 5 minuten diepe buikademhaling voor de maaltijd activeert de parasympathicus — dit is essentieel voor goede spijsvertering. De sympathicus (stressmodus) vertraagt letterlijk de darmbeweging en vermindert maagzuurproductie. Geen maaltijden overslaan.",
          },
        ],
      },
      {
        title: "Rebalance — Fijnafstemming",
        steps: [
          {
            title: "SIBO uitsluiten",
            detail: "Laat een waterstof-ademtest doen als je nog klachten hebt na 3 maanden protocol. Small Intestinal Bacterial Overgrowth (SIBO) wordt vaak over het hoofd gezien en reageert op een specifiek low-FODMAP dieet + antibiotische kruiden (oregano-olie, berberine).",
          },
          {
            title: "Maagzuur optimaliseren",
            detail: "Lage maagzuurproductie (hypochlorhydria) is een onderschatte oorzaak van spijsverteringsproblemen. Test dit met de baking soda test of laat testen via je arts. Betaïne HCL met pepsine kan bij lage maagzuurproductie helpen.",
          },
          {
            title: "Leverondersteuning",
            detail: "De lever produceert gal dat essentieel is voor vetvertering. Voeg mariadistel (silymarin 280mg), artisjokextract en bittere kruiden toe. Vermijd alcohol en beperk NSAID gebruik. Drink dagelijks 1,5-2L water voor optimale galproductie.",
          },
        ],
      },
      {
        title: "Stabilisatie — Duurzame darmgezondheid",
        steps: [
          {
            title: "Langetermijn microbioom onderhoud",
            detail: "Eet minstens 30 verschillende plantaardige voedingsmiddelen per week — dit is de meest bewezen strategie voor een divers microbioom (studie Sonnenburg, Nature 2021). Varieer groenten, fruit, noten, zaden, peulvruchten en kruiden.",
          },
          {
            title: "Stressmanagement structureel",
            detail: "Plan dagelijks 20 minuten voor herstelactiviteiten: wandelen, meditatie, yoga of een warm bad. Bouw een duidelijk onderscheid tussen werktijd en rusttijd. Chronische stress is één van de belangrijkste onderhoudsfactoren van darmaandoeningen.",
          },
          {
            title: "Periodiek testen",
            detail: "Laat elk jaar een darmflora-test doen (bijv. via Viome of GutPersonal) en bloedwaarden checken: vitamine B12, ijzer, ferritine, vitamine D, folaat. Tekorten zijn common bij langdurige spijsverteringsproblemen.",
          },
        ],
      },
      {
        title: "Langetermijn — Preventie en zelfmanagement",
        steps: [
          {
            title: "Seizoensgebonden aanpassing",
            detail: "Eet seizoensgebonden — dit is de meest natuurlijke manier om het microbioom divers te houden. Herfst/winter: warme, gekookte voeding, meer vetten en eiwitten. Lente/zomer: meer vers, rauw en gefermenteerd.",
          },
          {
            title: "Vroege interventie bij terugval",
            detail: "Herken de vroege signalen (opgeblazen gevoel na maaltijden, terugkeer van stoelgangproblemen) en reageer direct: 2 weken terug naar eliminatiedieet, probiotica verhogen, stress verlagen. Wacht niet totdat het ernstig is.",
          },
          {
            title: "Community en support",
            detail: "Verbind met andere mensen met soortgelijke klachten. Kennis delen versnelt herstel. Overweeg begeleiding van een orthomoleculair therapeut of functioneel arts voor langetermijn monitoring.",
          },
        ],
      },
    ],

    // ── SOLK ──
    solk: [
      {
        title: "Fundament — Lichaam leren begrijpen",
        steps: [
          {
            title: "Psycho-educatie: wat is SOLK?",
            detail: "SOLK (Somatisch Onverklaarbare Lichamelijke Klachten) zijn reële, lichamelijke klachten met een neurobiologische basis. Je zenuwstelsel verwerkt prikkels anders dan gemiddeld. Dit is geen 'aanstelling' — het is aantoonbaar in hersenscans. De eerste stap is dit accepteren en begrijpen.",
          },
          {
            title: "Symptoomdagboek",
            detail: "Houd 4 weken bij: wanneer je klachten hebt (tijdstip, situatie), hoe ernstig (1-10), wat er vlak voor gebeurde (stress, voeding, slaap). Dit onthult patronen die je zelf niet zag en geeft de therapeut of arts waardevolle informatie.",
          },
          {
            title: "Ademhaling als directe interventie",
            detail: "De 4-7-8 ademhaling (inademen 4s, vasthouden 7s, uitademen 8s) activeert de parasympathicus in minder dan 60 seconden. Doe dit 3x per dag, ook als je je goed voelt. Dit traint je zenuwstelsel om sneller terug te schakelen van stress naar rust.",
          },
        ],
      },
      {
        title: "Zenuwstelsel Reguleren",
        steps: [
          {
            title: "Graded Activity — opbouwen zonder overbelasting",
            detail: "Begin met 10 minuten lichte activiteit per dag (wandelen). Verhoog elke week met 5 minuten als je geen verergering ervaart. Het doel is het zenuwstelsel gradueel te leren dat bewegen veilig is. Stop VOOR je je uitgeput voelt.",
          },
          {
            title: "Body scan meditatie",
            detail: "Dagelijks 15 minuten: lig op je rug, sluit je ogen en scan langzaam van voeten naar hoofd. Merk elke sensatie op zonder oordeel — pijn, spanning, tinteling. Dit verbetert de interocepie (lichaamsbewustzijn) en verlaagt catastroferende gedachten over klachten.",
          },
          {
            title: "Slaaphygiëne optimaliseren",
            detail: "Vaste slaaptijden, donkere en koele slaapkamer (18°C), geen schermen 1 uur voor bed. Neem Magnesium glycinaat 400mg + L-theanine 200mg voor het slapen. Slaaptekort versterkt pijnperceptie significant — dit is een prioriteit.",
          },
        ],
      },
      {
        title: "Emotionele Verwerking",
        steps: [
          {
            title: "Verbinding tussen emoties en lichamelijke klachten",
            detail: "Vraag jezelf bij elke klachtepisode: 'Welke emotie voelde ik net?' Niet om de oorzaak te zoeken, maar om het patroon te leren kennen. Onderdrukken van emoties vergroot lichamelijke spanning aantoonbaar (polyvagaaltheorie, Porges 2011).",
          },
          {
            title: "Therapeutische ondersteuning",
            detail: "CGT (Cognitieve Gedragstherapie) en ACT (Acceptance and Commitment Therapy) zijn wetenschappelijk bewezen effectief bij SOLK. Zoek een therapeut gespecialiseerd in psychosomatische klachten. Dit is geen bewijs dat klachten 'in je hoofd zitten' — het is herstelzorg voor je zenuwstelsel.",
          },
          {
            title: "Journaling",
            detail: "Schrijf 10 minuten per dag over je ervaringen — geen structuur nodig. Vrij schrijven verlaagt aantoonbaar cortisol en verbetert immuunfunctie (Pennebaker, 1997). Focus op situaties die emotioneel beladen zijn.",
          },
        ],
      },
      {
        title: "Verdieping — Trauma en zenuwstelsel",
        steps: [
          {
            title: "Polyvagaaltheorie en veiligheid",
            detail: "Het zenuwstelsel van mensen met SOLK heeft vaak geleerd om 'on alert' te staan. Dit is een aanpassingsmechanisme, geen zwakte. Oefen 'safety signals': bewuste activiteiten die het zenuwstelsel vertellen dat het veilig is — zingen, sociale verbinding, rustige omgevingen.",
          },
          {
            title: "Lichaamsgerichte therapie overwegen",
            detail: "EMDR, Somatic Experiencing of Sensorimotor Psychotherapy kunnen ingesloten spanning in het lichaam loslaten die reguliere therapie niet bereikt. Vraag je huisarts of therapeut naar doorverwijzing.",
          },
          {
            title: "Voeding en ontsteking",
            detail: "Laaggradige ontsteking versterkt pijnperceptie. Elimineer suiker, bewerkte voeding en alcohol. Voeg omega-3 (2g per dag), kurkuma met piperine (500mg) en vitamine D3 (2000-4000IU) toe. Dit verlaagt pro-inflammatoire cytokinen die pijnsignalen versterken.",
          },
        ],
      },
      {
        title: "Stabilisatie — Terugval voorkomen",
        steps: [
          {
            title: "Stressors inventariseren",
            detail: "Maak een lijst van je grootste stressors en rangschik ze op impact. Pak de top 3 actief aan: delegeer, vermijd, of verander je perspectief. Chronische stressors onderhouden SOLK-klachten.",
          },
          {
            title: "Sociale verbinding",
            detail: "Isolatie verergert SOLK aantoonbaar. Plan wekelijks contact met mensen die je begrijpen en accepteren. Lotgenotencontact (bijv. SOLK Forum NL) kan enorm helpen.",
          },
          {
            title: "Herstelplan bij terugval",
            detail: "Schrijf nu, wanneer je je goed voelt, op: wat zijn de vroege signalen? Wat helpt dan het meest? Dit plan gebruik je de volgende keer als preventie en snelle interventie.",
          },
        ],
      },
      {
        title: "Langetermijn — Kwaliteit van leven",
        steps: [
          {
            title: "Zingeving en waarden",
            detail: "Wanneer je leven goed aansluit bij je diepste waarden, vermindert de impact van klachten. Identificeer je 3 kernwaarden en evalueer hoe je dagelijks leven daarmee overeenkomt. Kleine aanpassingen kunnen grote impact hebben op welzijn.",
          },
          {
            title: "Beweging als medicijn",
            detail: "Bouw naar 30-45 minuten matige beweging per dag — dit is de meest effectieve langetermijn interventie bij chronische pijn en SOLK. Kies activiteiten die je leuk vindt: wandelen, zwemmen, yoga, fietsen.",
          },
          {
            title: "Reguliere check-ins",
            detail: "Plan elk kwartaal een evaluatiemoment: hoe gaat het met de symptomen, slaap, stress, beweging? Pas het plan aan. Herstel van SOLK is niet lineair — pieken en dalen horen erbij.",
          },
        ],
      },
    ],

    // ── AUTO-IMMUUN ──
    auto_immuun: [
      {
        title: "AIP Eliminatiefase — Ontstekingslast verlagen",
        steps: [
          {
            title: "AIP dieet starten (Auto-Immuun Paleo)",
            detail: "Week 1-6: verwijder gluten, zuivel, eieren, nachtschadeplanten (tomaat, paprika, aubergine), noten, zaden, peulvruchten, alcohol en NSAID's. Eet: vlees, vis, gevogelte, groenten (niet nachtschadefamilie), zoete aardappel, coconut, olijfolie en fruit. Dit is de meest evidence-based voedingsaanpak bij auto-immuun.",
          },
          {
            title: "Vitamine D3 optimaliseren",
            detail: "Laat je vitamine D niveau testen. Streef naar 100-150 nmol/L. Neem D3 4000-6000IU per dag met K2 100-200mcg (voorkomt calciumafzetting in verkeerde plekken). Vitamine D is een hormoon dat het immuunsysteem direct moduleert en ontsteking remt.",
          },
          {
            title: "Omega-3 ontstekingsremmend protocol",
            detail: "Neem EPA/DHA visolie 2-3g per dag bij de maaltijd. Omega-3 vetzuren verlagen prostaglandines en cytokines die auto-immuunreacties aandrijven. Eet ook 2-3x per week vette vis: zalm, makreel, haring of sardines.",
          },
        ],
      },
      {
        title: "Darmpermeabiliteit herstellen",
        steps: [
          {
            title: "Leaky gut protocol",
            detail: "Neem L-glutamine 5g op nuchtere maag (2x per dag), zink carnosine 75mg, vitamine A 10.000IU (tijdelijk, max 3 maanden) en bone broth dagelijks. Bij auto-immuunziekten is een doorlaatbare darmwand bijna altijd aanwezig — dit herstellen is fundamenteel.",
          },
          {
            title: "Histamine-intolerantie aanpakken",
            detail: "Als je reageert op rode wijn, oude kaas, tomaten, spinazie of gefermenteerde voeding, heb je mogelijk histamine-intolerantie. Vermijd hoog-histamine voeding en neem DAO-enzym supplement bij maaltijden. Vitamine B6, koper en vitamine C ondersteunen de DAO-productie.",
          },
          {
            title: "Probiotica specifiek voor auto-immuun",
            detail: "Lactobacillus rhamnosus GG en Bifidobacterium bifidum zijn het best onderzocht bij auto-immuunziekten. Begin met een lage dosis (1-5 miljard CFU) en bouw langzaam op. Bij sommige auto-immuunziekten kunnen probiotica eerst reacties geven.",
          },
        ],
      },
      {
        title: "Herïntroductie en monitoring",
        steps: [
          {
            title: "Voedingsherïntroductie",
            detail: "Na 6 weken AIP: introduceer één voedingsgroep per week terug. Begin met eieren (dag 1: eigeel, dag 4: heel ei). Wacht 72 uur per voedingsgroep en observeer: huid, gewrichten, vermoeidheid, spijsvertering. Houd een herïntroductiedagboek bij.",
          },
          {
            title: "Ontstekingsmarkers testen",
            detail: "Laat testen: CRP, BSE, TNF-alpha, interleukine-6, ANA-screen, schildklierfunctie (TSH, fT3, fT4, TPO-antilichamen). Dit geeft een objectief beeld van de ontstekingsactiviteit en helpt het protocol te personaliseren.",
          },
          {
            title: "Stressmanagement als prioriteit",
            detail: "Cortisol onderdrukt immuunregulatie en kan auto-immuunactiviteit triggeren. Dagelijks 10 minuten meditatie, dagelijkse beweging en vaste slaaptijden zijn niet optioneel. Overweeg een adaptogeen: Ashwagandha 300mg of Holy Basil (Tulsi) 500mg.",
          },
        ],
      },
      {
        title: "Verdieping — Functionele geneeskunde",
        steps: [
          {
            title: "Toxinebelasting verlagen",
            detail: "Schakel over op biologische voeding (prioriteit: de 'dirty dozen' — aardbeien, spinazie, appels). Gebruik schoonmaakproducten zonder parfum en chemicaliën. Verminder plastic gebruik voor voedselbewaring. Omgevingstoxines kunnen auto-immuunactiviteit versterken.",
          },
          {
            title: "Mycotherapie bij auto-immuun",
            detail: "Reishi (Ganoderma lucidum) 600-1200mg per dag is het meest onderzochte medicijnpaddenstoelextract bij auto-immuunziekten — het moduleert (niet onderdrukt) het immuunsysteem. Maitake en Shiitake als voeding zijn ook waardevol.",
          },
          {
            title: "Laaggradige infecties uitsluiten",
            detail: "Sommige auto-immuunziekten worden getriggerd of onderhouden door chronische infecties (EBV, CMV, Lyme, Candida). Laat uitgebreid testen en bespreek met een functioneel arts. Behandeling van de onderliggende infectie kan auto-immuunactiviteit significant verlagen.",
          },
        ],
      },
      {
        title: "Stabilisatie",
        steps: [
          {
            title: "Onderhoudsfase voeding",
            detail: "Na 6 maanden weet je welke voeding je verdraagt. Bouw een persoonlijk 'veilig voedingslijst'. Blijf gluten en zuivel levenslang vermijden als je hier op reageert — re-exposure triggert snel opnieuw immuunactiviteit.",
          },
          {
            title: "Slaap als immuunherstel",
            detail: "Tijdens diepe slaap (slow-wave slaap) produceert het lichaam cytokines die immuunregulatie ondersteunen en beschadigde cellen repareren. Optimale slaap is niet luxe — het is immuuntherapie. Streef naar 8-9 uur en consistente tijden.",
          },
          {
            title: "Kwartaalcontroles",
            detail: "Laat elk kwartaal bloedwaarden testen: vitamine D, auto-antilichamen, CRP en specifieke markers voor jouw aandoening. Houd een symptoomdagboek bij om trends te herkennen voordat ze verergeren.",
          },
        ],
      },
      {
        title: "Langetermijn — Remissie behouden",
        steps: [
          {
            title: "Zelfmanagement vaardigheden",
            detail: "Leer je eigen 'vlam van ontsteking' herkennen: welke factoren triggeren je? Stress, voeding, slaaptekort, infectie? Schrijf dit op en maak een gepersonaliseerd crisisprotocol dat je direct kunt inzetten.",
          },
          {
            title: "Beweging als immuunmodulator",
            detail: "Matige beweging (30-45 minuten per dag, hartslag 60-70% max) heeft een anti-inflammatoir effect. Intensieve training kan bij auto-immuun juist ontsteking verergeren. Wandelen, zwemmen en yoga zijn ideale keuzes.",
          },
          {
            title: "Levenslange aanpassing",
            detail: "Auto-immuunziekten kennen periodes van verergering en verbetering. Accepteer dat dit een marathon is, geen sprint. Bouw een team van zorgverleners om je heen: huisarts, reumatoloog/specialist, diëtist en eventueel psycholoog.",
          },
        ],
      },
    ],

    // ── ALK ──
    alk: [
      {
        title: "Fundament — Bewegen en voeding",
        steps: [
          {
            title: "Elimineer pro-inflammatoire voeding",
            detail: "Verwijder suiker, bewerkte voeding, transvetten en alcohol. Voeg ontstekingsremmende voeding toe: vette vis 3x per week, olijfolie extra vierge, kurkuma (met zwarte peper), gember, groene bladgroenten. Dit verlaagt aantoonbaar de pijnperceptie.",
          },
          {
            title: "Dagelijkse beweging opbouwen",
            detail: "Start met 15 minuten wandelen per dag. Verhoog elke week met 5 minuten. Na 4 weken voeg je 2x per week lichte core-versterking toe (buikoefeningen, bruggetjes). Core kracht vermindert de belasting op rug, heupen en gewrichten.",
          },
          {
            title: "Ergonomie aanpassen",
            detail: "Als je veel zit: stel je beeldscherm op ooghoogte in, gebruik een ergonomische stoel of zitbal. Sta elk uur 5 minuten op. Een goed geplaatste werkplek reduceert chronische spanning die aspecifieke klachten veroorzaakt.",
          },
        ],
      },
      {
        title: "Spierbalans en houding",
        steps: [
          {
            title: "Mediterraan dieet als basis",
            detail: "Dit is het best onderzochte dieet voor chronische pijn en aspecifieke klachten. Basis: vis, gevogelte, groenten, fruit, olijfolie, peulvruchten, noten en volle granen. Minimaliseer rood vlees en bewerkte producten. De middel-mediterrane aanpak verlaagt CRP significant.",
          },
          {
            title: "Slaap als herstelmoment",
            detail: "Tijdens slaap herstellen spieren en gewrichten. Streef naar 8 uur op vaste tijden. Gebruik een goed matras dat de wervelkolom neutraal houdt. Magnesium malaat 400mg voor het slapen vermindert spierspanning en verbetert slaapkwaliteit.",
          },
          {
            title: "Beweging uitbreiden naar 30 minuten",
            detail: "Voeg naast wandelen ook zwemmen of fietsen toe — dit zijn low-impact activiteiten die gewrichten niet overbelasten. Overweeg een fysiotherapeut voor een persoonlijk oefenprogramma gericht op jouw specifieke klachtenpatroon.",
          },
        ],
      },
      {
        title: "Gerichte supplementen en pijnmanagement",
        steps: [
          {
            title: "Magnesium malaat",
            detail: "Magnesium malaat (400-600mg) is specifiek onderzocht bij spierpijn en fibromyalgie. Malaat (appelzuur) is betrokken bij de citroenzuurcyclus en energieproductie in spiercellen. Neem gesplitst: 200mg bij ontbijt, 200mg voor het slapen.",
          },
          {
            title: "Curcumine protocol",
            detail: "Curcumine (uit kurkuma) 500-1000mg per dag met piperine (zwarte peper) voor 20x betere opname — dit is klinisch aangetoond vergelijkbaar met ibuprofen bij gewrichtspijn, zonder de maagschade. Kies een gestandaardiseerd extract (bijv. Meriva of BCM-95).",
          },
          {
            title: "Warmte- en koudetherapie",
            detail: "Warmte (warmwaterkruik, bad) ontspant spieren en vergroot doorbloeding. Koude (ijspak, koude douche) vermindert ontsteking. Wissel warm-koud: 2 minuten warm, 30 seconden koud, 3 cycli. Dit verbetert doorbloeding en vermindert pijn.",
          },
        ],
      },
      {
        title: "Verdieping — Stress en pijn",
        steps: [
          {
            title: "Pijnneurologie begrijpen",
            detail: "Chronische pijn verandert hoe het zenuwstelsel pijn verwerkt (centrale sensitisatie). Stress, slaaptekort en negatieve gedachten versterken dit. Positieve verwachting (placebo-effect) is wetenschappelijk bewezen pijnverlichtend. Mindfulness-gebaseerde pijntherapie (MBSR) is effectief aangetoond.",
          },
          {
            title: "Slaap en pijn doorbreken",
            detail: "Slaaptekort verlaagt de pijndrempel significant — slechts 2 nachten slecht slapen verhoogt pijngevoeligheid met 25%. Prioriteer slaap. Voeg indien nodig een slaapprotocol toe: GABA 500mg + L-theanine 200mg + Valeriaan 400mg.",
          },
          {
            title: "Aquatherapie overwegen",
            detail: "Bewegen in water (aquajoggen, zwemmen, aquagroepslessen) vermindert gewrichtsbelasting terwijl alle spiergroepen worden geactiveerd. Dit is bijzonder effectief bij ALK en fibromyalgieachtige klachten.",
          },
        ],
      },
      {
        title: "Stabilisatie",
        steps: [
          {
            title: "Bewegingsroutine vastzetten",
            detail: "Op dit punt moet beweging een vaste gewoonte zijn. Plan het in je agenda zoals een vergadering. Varieer: wandelen, zwemmen, yoga, stretching. Maak het sociaal: loop met iemand mee, sluit je aan bij een groep.",
          },
          {
            title: "Voedingsoptimalisatie",
            detail: "Laat vitamine D, magnesium en omega-3 bloedwaarden testen. Tekorten zijn common bij chronische klachten. Pas suppletie aan op je waarden. Een orthomoleculair therapeut of diëtist kan hierbij helpen.",
          },
          {
            title: "Pijnmanagement toolkit",
            detail: "Stel een persoonlijke toolkit samen: 3 ademhalingsoefeningen, 2 spierverlichtingsoefeningen, 1 meditatie, warmte/koude protocol. Gebruik deze bij de eerste tekenen van verergering.",
          },
        ],
      },
      {
        title: "Langetermijn — Actieve leefstijl",
        steps: [
          {
            title: "Bewegen als levensstijl",
            detail: "Doel: 150 minuten matige beweging per week (WHO richtlijn). Dit is ook bewezen preventief voor cardiovasculaire ziekte, diabetes en depressie. Zoek activiteiten die je leuk vindt — plezier is de beste motivatie.",
          },
          {
            title: "Periodieke screening",
            detail: "Jaarlijks bloedwaarden controleren en bespreken met de huisarts. Bij aanhoudende klachten na 6 maanden protocol: doorverwijzing naar reumatoloog of pijnkliniek voor uitgebreidere diagnostiek.",
          },
          {
            title: "Preventie en zelfregie",
            detail: "Jij bent de expert over jouw lichaam. Leer je signalen kennen. Handeel vroeg bij terugval. Houd een gezondheidslogboek bij — niet om obsessief bezig te zijn, maar om patronen te herkennen en slimme keuzes te maken.",
          },
        ],
      },
    ],
  };

  return plans[conditionType] || plans["digestive_issues"];
}
