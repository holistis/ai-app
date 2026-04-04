import { getDb } from "../db";
import { reports } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { buildReportHTML, generatePDFBuffer } from "../_core/pdfGenerator";
import { storagePut } from "../storage";

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

    // Step 3: Upload to S3
    console.log(`[PDF-Gen-${mutationId}] Step 3: Uploading to S3...`);
    const fileName = `rapport-${reportId}-${Date.now()}.pdf`;
    const { url: pdfUrl } = await storagePut(
      `reports/${userId}/${fileName}`,
      pdfBuffer,
      "application/pdf"
    );
    console.log(`[PDF-Gen-${mutationId}] ✅ S3 upload successful: ${pdfUrl}`);

    // Step 4: Update database with pdfUrl
    console.log(`[PDF-Gen-${mutationId}] Step 4: Updating database...`);
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .update(reports)
      .set({
        pdfUrl: pdfUrl,
        updatedAt: new Date(),
      } as any)
      .where(eq(reports.id, reportId));
    
    const totalTime = Date.now() - pdfStartTime;
    console.log(`[PDF-Gen-${mutationId}] ✅ COMPLETE - Total time: ${totalTime}ms`);
    console.log(`[PDF-Gen-${mutationId}] PDF URL saved to database: ${pdfUrl}`);

    return pdfUrl;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "";
    console.error(`[PDF-Gen-${mutationId}] ❌ ERROR: ${errorMsg}`);
    console.error(`[PDF-Gen-${mutationId}] Stack: ${errorStack}`);
    return null;
  }
}
