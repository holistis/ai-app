import { getDb } from "../db";
import { reports } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { buildReportHTML, generatePDFBuffer } from "../_core/pdfGenerator";

export async function generateAndStorePDF(reportId: number, reportData: any, userId: number): Promise<string | null> {
  const mutationId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`[PDF-Gen-${mutationId}] START - Report ${reportId}`);
    const pdfStartTime = Date.now();

    // Step 1: Generate HTML
    console.log(`[PDF-Gen-${mutationId}] Step 1: Building HTML...`);
    const html = buildReportHTML({
      ...reportData,
      patientName: reportData.patientName || "Patiënt",
    });
    console.log(`[PDF-Gen-${mutationId}] HTML built: ${html.length} bytes`);

    // Step 2: Generate PDF buffer
    console.log(`[PDF-Gen-${mutationId}] Step 2: Generating PDF buffer...`);
    const pdfBuffer = await generatePDFBuffer(html);
    console.log(`[PDF-Gen-${mutationId}] PDF generated: ${pdfBuffer.length} bytes`);

    // Step 3: Convert to base64
    console.log(`[PDF-Gen-${mutationId}] Step 3: Converting to base64...`);
    const base64String = pdfBuffer.toString('base64');
    const pdfDataUrl = `data:application/pdf;base64,${base64String}`;
    console.log(`[PDF-Gen-${mutationId}] Base64 encoded: ${pdfDataUrl.length} chars`);

    // Step 4: Update database with base64 pdfUrl
    console.log(`[PDF-Gen-${mutationId}] Step 4: Updating database...`);
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .update(reports)
      .set({
        pdfUrl: pdfDataUrl,
        updatedAt: new Date(),
      } as any)
      .where(eq(reports.id, reportId));
    
    const totalTime = Date.now() - pdfStartTime;
    console.log(`[PDF-Gen-${mutationId}] ✅ COMPLETE - Total time: ${totalTime}ms`);
    console.log(`[PDF-Gen-${mutationId}] PDF base64 saved to database (${pdfDataUrl.length} chars)`);

    return pdfDataUrl;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "";
    console.error(`[PDF-Gen-${mutationId}] ❌ ERROR: ${errorMsg}`);
    console.error(`[PDF-Gen-${mutationId}] Stack: ${errorStack}`);
    return null;
  }
}
