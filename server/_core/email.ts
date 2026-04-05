Waarom ben jij beter dan ChatGPT - Manus
Lite
Done. ClerkProvider props updated with correct configuration.
Export only client/src/main.tsx as a downloadable file.
Lite
Exporting main.tsx file.
Lite
Updated main.tsx file ready for download.
File: main.tsx (2.1 KB)
Contains:
ClerkProvider with correct props:
signInUrl="/sign-in"
signUpUrl="/sign-up"
signInFallbackRedirectUrl="/"
publishableKey from environment variable
main.tsx
Code · 2.03 KB
View all files in this task
How was this result?
In server/_core/email.ts, find where emails are sent and update the "from" email address to use the verified domain.
Change any "from" address to: Holistisch AI Kliniek <info@holistischadviseur.nl>
Also make sure the RESEND_API_KEY environment variable is used correctly.
Edit the file directly. No explanations.

als je dit hebt gedaan geef me dan 
exporteer je alleen server/_core/email.ts en upload je die naar GitHub ter vervanging. ik wil die kunnen openen zoals je eerder hebt gedaan. meer niet 
Lite
Updating email.ts with verified domain and checking RESEND_API_KEY usage.
Lite
Updated email.ts ready for download.
File: email.ts (17 KB)
Changes made:
FROM_EMAIL updated to: Holistisch AI Kliniek <info@holistischadviseur.nl>
RESEND_API_KEY correctly used via ENV.resendApiKey or process.env.RESEND_API_KEY
All email functions use the verified domain
email.ts
Code · 16.57 KB
View all files in this task
Task completed
How was this result?
Suggested follow-ups




server
/
_core
/
email.ts
123456789101112131415161718192021222324252627
/**
 * Email delivery helper using Resend API
 * Sends reports and notifications to info@holistischadviseur.nl
 */

import { ENV } from "./env";
import { generatePDFBuffer, buildReportHTML } from "./pdfGenerator";

const OWNER_EMAIL = "info@holistischadviseur.nl";
const FROM_EMAIL = "Holistisch AI Kliniek <info@holistischadviseur.nl>";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
  }>;
}

async function sendEmail(options: EmailOptions): Promise<boolean> {
  const apiKey = (ENV as any).resendApiKey || process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY not configured, skipping email");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        attachments: options.attachments ? options.attachments.map(att => ({
          filename: att.filename,
          content: att.content instanceof Buffer ? att.content.toString('base64') : att.content,
        })) : undefined,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.warn(`[Email] Failed to send email: ${response.status} ${err}`);
      return false;
    }

    const data = await response.json();
    console.log(`[Email] Sent successfully: ${data.id}`);
    return true;
  } catch (error) {
    console.warn("[Email] Error sending email:", error);
    return false;
  }
}

/**
 * Send a new report notification to the owner
 */
export async function emailOwnerNewReport(params: {
  patientName: string;
  patientEmail: string;
  conditionType: string;
  reportType: string;
  reportContent: string;
  reportId: number;
}): Promise<boolean> {
  const conditionLabels: Record<string, string> = {
    chronic_fatigue: "Chronische Vermoeidheid",
    digestive_issues: "Spijsverteringsproblemen",
    solk: "SOLK",
    alk: "ALK",
  };
  const conditionName = conditionLabels[params.conditionType] || params.conditionType;
  const reportTypeName = params.reportType === "full_report" ? "Volledig Rapport (€34,95)" : "Inzicht Rapport (gratis)";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
  .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
  .header h1 { margin: 0; font-size: 24px; }
  .header p { margin: 8px 0 0; opacity: 0.9; }
  .info-box { background: #f8f9fa; border-left: 4px solid #4f46e5; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
  .info-box h3 { margin: 0 0 10px; color: #4f46e5; }
  .report-content { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 25px; margin: 20px 0; white-space: pre-wrap; line-height: 1.7; }
  .footer { text-align: center; color: #888; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
</style></head>
<body>
  <div class="header">
    <h1>📋 Nieuw Rapport Gegenereerd</h1>
    <p>${reportTypeName}</p>
  </div>
  
  <div class="info-box">
    <h3>Patiënt Informatie</h3>
    <p><strong>Naam:</strong> ${params.patientName}</p>
    <p><strong>E-mail:</strong> ${params.patientEmail}</p>
    <p><strong>Klacht:</strong> ${conditionName}</p>
    <p><strong>Rapport Type:</strong> ${reportTypeName}</p>
    <p><strong>Rapport ID:</strong> #${params.reportId}</p>
    <p><strong>Datum:</strong> ${new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}</p>
  </div>

  <h2 style="color: #4f46e5;">📄 Volledig Rapport</h2>
  <div class="report-content">${params.reportContent.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>
  
  <div class="footer">
    <p>Holistisch AI Kliniek — <a href="https://ai.holistischadviseur.nl">ai.holistischadviseur.nl</a></p>
    <p>Admin dashboard: <a href="https://ai.holistischadviseur.nl/admin">Bekijk alle rapporten</a></p>
  </div>
</body>
</html>`;

  return sendEmail({
    to: OWNER_EMAIL,
    subject: `📋 Nieuw rapport: ${params.patientName} — ${conditionName}`,
    html,
  });
}

/**
 * Send payment confirmation to owner
 */
export async function emailOwnerPayment(params: {
  patientName: string;
  patientEmail: string;
  amount: number;
  currency: string;
}): Promise<boolean> {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
  .header { background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
  .amount { font-size: 48px; font-weight: bold; text-align: center; color: #059669; margin: 20px 0; }
  .info-box { background: #f0fdf4; border-left: 4px solid #059669; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
  .footer { text-align: center; color: #888; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
</style></head>
<body>
  <div class="header">
    <h1>💰 Nieuwe Betaling Ontvangen!</h1>
    <p>Volledig Rapport betaald</p>
  </div>
  
  <div class="amount">€${(params.amount / 100).toFixed(2)}</div>
  
  <div class="info-box">
    <p><strong>Klant:</strong> ${params.patientName}</p>
    <p><strong>E-mail:</strong> ${params.patientEmail}</p>
    <p><strong>Bedrag:</strong> €${(params.amount / 100).toFixed(2)} ${params.currency.toUpperCase()}</p>
    <p><strong>Datum:</strong> ${new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}</p>
  </div>
  
  <div class="footer">
    <p>Holistisch AI Kliniek — <a href="https://ai.holistischadviseur.nl">ai.holistischadviseur.nl</a></p>
  </div>
</body>
</html>`;

  return sendEmail({
    to: OWNER_EMAIL,
    subject: `💰 Betaling ontvangen: €${(params.amount / 100).toFixed(2)} van ${params.patientName}`,
    html,
  });
}

/**
 * Send report confirmation to patient
 */
export async function emailPatientReport(params: {
  patientName: string;
  patientEmail: string;
  reportUrl: string;
}): Promise<boolean> {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
  .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
  .btn { display: inline-block; background: #4f46e5; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
  .footer { text-align: center; color: #888; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
</style></head>
<body>
  <div class="header">
    <h1>🌿 Jouw Rapport is Klaar!</h1>
    <p>Holistisch AI Kliniek</p>
  </div>
  
  <p>Beste ${params.patientName},</p>
  <p>Goed nieuws! Jouw persoonlijke holistische gezondheidsanalyse is klaar. Het rapport bevat een diepgaande analyse van jouw klachten, de onderliggende oorzaken, en een gepersonaliseerd herstelplan voor de komende 12 maanden.</p>
  
  <div style="text-align: center;">
    <a href="${params.reportUrl}" class="btn">📋 Bekijk Mijn Rapport</a>
  </div>
  
  <p>Heb je vragen over het rapport of wil je persoonlijke begeleiding? Neem dan contact op via <a href="mailto:info@holistischadviseur.nl">info@holistischadviseur.nl</a>.</p>
  
  <p>Met holistische groet,<br><strong>Holistisch AI Kliniek</strong></p>
  
  <div class="footer">
    <p><a href="https://ai.holistischadviseur.nl">ai.holistischadviseur.nl</a> — info@holistischadviseur.nl</p>
    <p style="font-size: 10px; color: #aaa;">De informatie in dit rapport is uitsluitend ter informatie en vervangt geen medisch advies.</p>
  </div>
</body>
</html>`;

  return sendEmail({
    to: params.patientEmail,
    subject: `🌿 Jouw holistische gezondheidsrapport is klaar — Holistisch AI Kliniek`,
    html,
  });
}

/**
 * MAIN FUNCTION: Send report emails with PDF attachment to both owner and patient
 * Call this after every report generation (inzicht rapport AND full report)
 * MODIFICATION: Always send full report PDF to admin, even for free reports
 */
export async function sendReportEmails(params: {
  patientName: string;
  patientEmail: string;
  conditionType: string;
  reportType: string;
  reportId: number;
  reportData: {
    title?: string;
    summary?: string;
    content?: string;
    keyInsights?: any;
    recommendations?: any;
    protocols?: any;
    scientificReferences?: any;
  };
  reportUrl: string;
}): Promise<void> {
  const conditionLabels: Record<string, string> = {
    chronic_fatigue: "Chronische Vermoeidheid",
    digestive_issues: "Spijsverteringsproblemen",
    solk: "SOLK",
    alk: "ALK / Gewrichtsklachten",
  };
  const conditionName = conditionLabels[params.conditionType] || params.conditionType;
  const isFullReport = params.reportType === "full_report";
  const reportTypeName = isFullReport ? "Volledig Rapport (€34,95)" : "Inzicht Rapport (gratis)";
  const dateStr = new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  const pdfFilename = `holistisch-rapport-${params.patientName.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.pdf`;

  // Generate PDF buffer - ALWAYS generate for admin
  let pdfBuffer: Buffer | null = null;
  try {
    const html = buildReportHTML({
      ...params.reportData,
      reportType: params.reportType,
      conditionType: params.conditionType,
      patientName: params.patientName,
    });
    pdfBuffer = await generatePDFBuffer(html);
    console.log(`[Email] PDF generated: ${pdfBuffer.length} bytes`);
  } catch (err) {
    console.warn("[Email] PDF generation failed, sending without attachment:", err);
  }

  // For patient: only send PDF if full report
  const patientAttachments = (isFullReport && pdfBuffer)
    ? [{ filename: pdfFilename, content: pdfBuffer }]
    : [];
  
  // For admin: ALWAYS send PDF attachment (even for free reports)
  const adminAttachments = pdfBuffer
    ? [{ filename: pdfFilename, content: pdfBuffer }]
    : [];

  // 1. Email to OWNER with full report content + PDF (ALWAYS includes PDF)
  const ownerHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
  .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; padding: 30px; border-radius: 12px; margin-bottom: 25px; }
  .header h1 { margin: 0; font-size: 22px; }
  .header p { margin: 6px 0 0; opacity: 0.9; font-size: 14px; }
  .info-box { background: #f8f9fa; border-left: 4px solid #4f46e5; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
  .info-box p { margin: 5px 0; font-size: 14px; }
  .report-preview { background: #f0f4ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 20px; margin: 20px 0; font-size: 13px; line-height: 1.7; white-space: pre-wrap; max-height: 400px; overflow: hidden; }
  .footer { text-align: center; color: #888; font-size: 11px; margin-top: 25px; padding-top: 15px; border-top: 1px solid #e5e7eb; }
  .badge { display: inline-block; background: ${isFullReport ? "#059669" : "#6366f1"}; color: white; padding: 3px 10px; border-radius: 12px; font-size: 12px; margin-left: 8px; }
</style></head>
<body>
  <div class="header">
    <h1>📋 Nieuw Rapport Gegenereerd <span class="badge">${isFullReport ? "BETAALD" : "GRATIS"}</span></h1>
    <p>${reportTypeName} — ${conditionName} — ${dateStr}</p>
  </div>
  <div class="info-box">
    <p><strong>Patiënt:</strong> ${params.patientName}</p>
    <p><strong>E-mail:</strong> ${params.patientEmail}</p>
    <p><strong>Klacht:</strong> ${conditionName}</p>
    <p><strong>Rapport type:</strong> ${reportTypeName}</p>
    <p><strong>Rapport ID:</strong> #${params.reportId}</p>
  </div>
  <p style="font-size:14px">Het volledige rapport is bijgevoegd als PDF. Je kunt het ook bekijken via het admin dashboard:</p>
  <p style="margin: 15px 0;"><a href="https://ai.holistischadviseur.nl/admin" style="background:#4f46e5;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;">Bekijk Admin Dashboard</a></p>
  ${params.reportData.content ? `<div class="report-preview">${(params.reportData.content || "").substring(0, 1500)}${(params.reportData.content || "").length > 1500 ? "...\n\n[Zie PDF bijlage voor volledig rapport]" : ""}</div>` : ""}
  <div class="footer">
    <p>Holistisch AI Kliniek — <a href="https://ai.holistischadviseur.nl">ai.holistischadviseur.nl</a></p>
  </div>
</body></html>`;

  // 2. Email to PATIENT with link + PDF (only PDF for full reports)
  const patientHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
  .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; padding: 35px 30px; border-radius: 12px; margin-bottom: 25px; text-align: center; }
  .header h1 { margin: 0; font-size: 22px; }
  .header p { margin: 8px 0 0; opacity: 0.9; }
  .btn { display: inline-block; background: #4f46e5; color: white; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; font-size: 15px; }
  .highlight { background: #f0f4ff; border-radius: 8px; padding: 15px 20px; margin: 20px 0; font-size: 14px; line-height: 1.7; }
  .footer { text-align: center; color: #888; font-size: 11px; margin-top: 25px; padding-top: 15px; border-top: 1px solid #e5e7eb; }
</style></head>
<body>
  <div class="header">
    <h1>🌿 Jouw Rapport is Klaar!</h1>
    <p>Holistisch AI Kliniek</p>
  </div>
  <p style="font-size:15px">Beste <strong>${params.patientName}</strong>,</p>
  <p style="font-size:14px;line-height:1.7;margin:15px 0">Jouw persoonlijke holistische gezondheidsanalyse is klaar! ${isFullReport ? "Het volledig rapport bevat een diepgaande analyse, onderliggende oorzaken, gepersonaliseerde protocollen en een 12-maanden herstelplan." : "Het inzicht rapport geeft je een eerste kijk op de mogelijke oorzaken van jouw klachten."}</p>
  ${params.reportData.summary ? `<div class="highlight"><strong>Samenvatting:</strong><br>${params.reportData.summary.substring(0, 300)}${params.reportData.summary.length > 300 ? "..." : ""}</div>` : ""}
  <div style="text-align:center">
    <a href="${params.reportUrl}" class="btn">📋 Bekijk Mijn Rapport Online</a>
  </div>
  <p style="font-size:13px;color:#666;margin:15px 0">${isFullReport ? "Het volledige rapport is ook bijgevoegd als PDF in deze e-mail, zodat je het kunt opslaan en later kunt raadplegen." : "Je kunt het rapport online bekijken en als PDF downloaden."}</p>
  ${!isFullReport ? `<div style="background:#fef3c7;border-radius:8px;padding:15px 20px;margin:20px 0;font-size:13px"><strong>🔓 Upgrade naar het Volledig Rapport (€34,95)</strong><br>Ontvang uitgebreide protocollen, een 12-maanden herstelplan en wetenschappelijke onderbouwing.</div>` : ""}
  <p style="font-size:14px">Heb je vragen? Neem contact op via <a href="mailto:info@holistischadviseur.nl">info@holistischadviseur.nl</a>.</p>
  <p style="font-size:14px">Met holistische groet,<br><strong>Holistisch AI Kliniek</strong></p>
  <div class="footer">
    <p><a href="https://ai.holistischadviseur.nl">ai.holistischadviseur.nl</a> — info@holistischadviseur.nl</p>
    <p style="font-size:10px;color:#aaa">De informatie in dit rapport vervangt geen medisch advies. Raadpleeg altijd een arts bij twijfel.</p>
  </div>
</body></html>`;

  // Send both emails in parallel (don't block on errors)
  const [ownerResult, patientResult] = await Promise.allSettled([
    sendEmail({
      to: OWNER_EMAIL,
      subject: `📋 Nieuw rapport: ${params.patientName} — ${conditionName} [${isFullReport ? "BETAALD" : "GRATIS"}]`,
      html: ownerHtml,
      attachments: adminAttachments,
    }),
    sendEmail({
      to: params.patientEmail,
      subject: `🌿 Jouw holistische gezondheidsrapport is klaar — Holistisch AI Kliniek`,
      html: patientHtml,
      attachments: patientAttachments,
    }),
  ]);

  console.log(`[Email] Owner email: ${ownerResult.status === "fulfilled" && ownerResult.value ? "✅ sent" : "❌ failed"} (with PDF)`);
  console.log(`[Email] Patient email (${params.patientEmail}): ${patientResult.status === "fulfilled" && patientResult.value ? "✅ sent" : "❌ failed"} ${isFullReport ? "(with PDF)" : "(no PDF)"}`);
}
