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
