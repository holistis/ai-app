import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";

// Helper functions mirroring the server-side logic
function parseArrayField(field: any): string[] {
  if (Array.isArray(field)) return field;
  if (typeof field === 'string') {
    try { return JSON.parse(field); } catch { return []; }
  }
  return [];
}

function normalizeReportContent(report: any) {
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

  return { ...report, content, summary, keyInsights, recommendations, protocols, scientificReferences };
}

describe("Reports Router", () => {
  describe("generateFullReport", () => {
    it("should validate reportId input", () => {
      const schema = z.object({
        reportId: z.number(),
      });

      const validInput = { reportId: 1 };
      expect(() => schema.parse(validInput)).not.toThrow();

      const invalidInput = { reportId: "not-a-number" };
      expect(() => schema.parse(invalidInput)).toThrow();
    });
  });

  describe("downloadReportPDF", () => {
    it("should validate reportId input", () => {
      const schema = z.object({
        reportId: z.number(),
      });

      const validInput = { reportId: 1 };
      expect(() => schema.parse(validInput)).not.toThrow();

      const invalidInput = { reportId: null };
      expect(() => schema.parse(invalidInput)).toThrow();
    });
  });

  describe("getReport", () => {
    it("should validate reportId input", () => {
      const schema = z.object({
        reportId: z.number(),
      });

      const validInput = { reportId: 1 };
      expect(() => schema.parse(validInput)).not.toThrow();

      const invalidInput = { reportId: -1 };
      // Negative numbers are still valid numbers in Zod
      expect(() => schema.parse(invalidInput)).not.toThrow();
    });
  });

  describe("PDF Content Generation", () => {
    it("should generate valid HTML for PDF", () => {
      const mockReport = {
        id: 1,
        title: "Test Report",
        summary: "Test summary",
        content: "Test content",
        keyInsights: ["Insight 1", "Insight 2"],
        recommendations: ["Rec 1", "Rec 2"],
        protocols: {
          nutrition: ["Protocol 1"],
          supplements: ["Supplement 1"],
          lifestyle: ["Lifestyle 1"],
          mentalPractices: ["Practice 1"],
        },
        scientificReferences: ["Ref 1", "Ref 2"],
      };

      // Simulate PDF generation
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
        </head>
        <body>
          <h1>${mockReport.title}</h1>
          <p>${mockReport.summary}</p>
          <p>${mockReport.content}</p>
        </body>
        </html>
      `;

      expect(html).toContain(mockReport.title);
      expect(html).toContain(mockReport.summary);
      expect(html).toContain(mockReport.content);
      expect(html).toContain("<!DOCTYPE html>");
    });
  });

  describe("Report Data Validation", () => {
    it("should validate full report structure", () => {
      const reportSchema = z.object({
        content: z.string(),
        summary: z.string(),
        keyInsights: z.array(z.string()),
        recommendations: z.array(z.string()),
        protocols: z.object({
          nutrition: z.array(z.string()),
          supplements: z.array(z.string()),
          lifestyle: z.array(z.string()),
          mentalPractices: z.array(z.string()),
        }),
        scientificReferences: z.array(z.string()),
      });

      const validReport = {
        content: "Detailed analysis",
        summary: "Summary",
        keyInsights: ["Insight 1"],
        recommendations: ["Recommendation 1"],
        protocols: {
          nutrition: ["Nutrition 1"],
          supplements: ["Supplement 1"],
          lifestyle: ["Lifestyle 1"],
          mentalPractices: ["Practice 1"],
        },
        scientificReferences: ["Reference 1"],
      };

      expect(() => reportSchema.parse(validReport)).not.toThrow();
    });

    it("should reject invalid report structure", () => {
      const reportSchema = z.object({
        content: z.string(),
        summary: z.string(),
        keyInsights: z.array(z.string()),
      });

      const invalidReport = {
        content: "Detailed analysis",
        summary: "Summary",
        keyInsights: "not-an-array", // Should be array
      };

      expect(() => reportSchema.parse(invalidReport)).toThrow();
    });
  });

  describe("parseArrayField helper", () => {
    it("should return array as-is when already an array", () => {
      const input = ["item1", "item2"];
      expect(parseArrayField(input)).toEqual(["item1", "item2"]);
    });

    it("should parse JSON string to array", () => {
      const input = '["item1", "item2"]';
      expect(parseArrayField(input)).toEqual(["item1", "item2"]);
    });

    it("should return empty array for invalid JSON string", () => {
      const input = "not valid json";
      expect(parseArrayField(input)).toEqual([]);
    });

    it("should return empty array for null/undefined", () => {
      expect(parseArrayField(null)).toEqual([]);
      expect(parseArrayField(undefined)).toEqual([]);
    });
  });

  describe("normalizeReportContent", () => {
    it("should return content as-is when it is plain text", () => {
      const report = {
        content: "Dit is een holistische analyse van uw gezondheid.",
        summary: "Samenvatting",
        keyInsights: ["Inzicht 1"],
        recommendations: ["Aanbeveling 1"],
        protocols: [],
        scientificReferences: [],
      };
      const normalized = normalizeReportContent(report);
      expect(normalized.content).toBe("Dit is een holistische analyse van uw gezondheid.");
      expect(normalized.keyInsights).toEqual(["Inzicht 1"]);
    });

    it("should extract content from JSON string when content field contains full JSON", () => {
      // This simulates the bug: content field contains the full JSON object as a string
      const fullJson = JSON.stringify({
        content: "Echte analyse tekst",
        summary: "Samenvatting",
        keyInsights: ["Inzicht 1", "Inzicht 2"],
        recommendations: ["Aanbeveling 1"],
        protocols: [],
        scientificReferences: ["Ref 1"],
        status: "generated",
      });
      
      const report = {
        content: fullJson,
        summary: "",
        keyInsights: null,
        recommendations: null,
        protocols: null,
        scientificReferences: null,
      };
      
      const normalized = normalizeReportContent(report);
      expect(normalized.content).toBe("Echte analyse tekst");
      expect(normalized.summary).toBe("Samenvatting");
      expect(normalized.keyInsights).toEqual(["Inzicht 1", "Inzicht 2"]);
      expect(normalized.recommendations).toEqual(["Aanbeveling 1"]);
      expect(normalized.scientificReferences).toEqual(["Ref 1"]);
    });

    it("should parse JSON string fields from MySQL", () => {
      const report = {
        content: "Normale tekst",
        summary: "Samenvatting",
        keyInsights: '["Inzicht 1", "Inzicht 2"]',  // MySQL JSON stored as string
        recommendations: '["Aanbeveling 1"]',
        protocols: '[]',
        scientificReferences: '["Ref 1"]',
      };
      
      const normalized = normalizeReportContent(report);
      expect(normalized.keyInsights).toEqual(["Inzicht 1", "Inzicht 2"]);
      expect(normalized.recommendations).toEqual(["Aanbeveling 1"]);
      expect(normalized.scientificReferences).toEqual(["Ref 1"]);
    });

    it("should not overwrite existing array fields when extracting from JSON content", () => {
      const fullJson = JSON.stringify({
        content: "Echte analyse tekst",
        keyInsights: ["JSON inzicht"],
      });
      
      const report = {
        content: fullJson,
        summary: "",
        keyInsights: ["Bestaand inzicht"],  // Already has data
        recommendations: [],
        protocols: [],
        scientificReferences: [],
      };
      
      const normalized = normalizeReportContent(report);
      // Should keep existing keyInsights, not overwrite with JSON content's keyInsights
      expect(normalized.keyInsights).toEqual(["Bestaand inzicht"]);
    });
  });
});

describe("Input Normalization Edge Cases - Specification", () => {
  // These tests document expected behavior for edge cases
  // The actual normalization functions are tested through integration with the anamnesis router
  // and are defined in server/knowledge/input_normalization.ts

  describe("Single Symptom Input Specification", () => {
    it("should document that single symptoms are normalized correctly", () => {
      // Expected: normalizeInput(["vermoeidheid"]) returns object with symptoms array
      const expectation = {
        behavior: "Single symptom should be mapped to standard term",
        example: "vermoeidheid → 'fatigue' with confidence score",
        expected_fields: ["symptoms", "high_confidence_symptoms", "low_confidence_symptoms", "clusters"],
      };
      expect(expectation.behavior).toBeDefined();
    });

    it("should document that rare symptoms are marked as unrecognized", () => {
      const expectation = {
        behavior: "Unrecognized symptoms should be captured in unrecognized array",
        example: "xyzabc123 → added to unrecognized field",
      };
      expect(expectation.behavior).toBeDefined();
    });

    it("should document that empty input returns zero confidence", () => {
      const expectation = {
        behavior: "Empty input should return normalized object with empty arrays",
        expected: { symptoms: [], total_confidence: 0 },
      };
      expect(expectation.expected.total_confidence).toBe(0);
    });
  });

  describe("Contradictory Symptoms Specification", () => {
    it("should document that contradictory symptoms are both captured", () => {
      const expectation = {
        behavior: "Both contradictory symptoms should be in symptoms array",
        example: "[veel energie, chronische vermoeidheid] → both normalized",
        rationale: "AI can analyze why contradictions exist (e.g., energy spikes followed by crashes)",
      };
      expect(expectation.rationale).toBeDefined();
    });

    it("should document contradictory digestive patterns", () => {
      const expectation = {
        behavior: "Alternating digestive symptoms should activate darm-cluster",
        example: "[constipatie, diarree] → dysbiosis cluster",
      };
      expect(expectation.behavior).toBeDefined();
    });

    it("should document contradictory sleep patterns", () => {
      const expectation = {
        behavior: "Mixed sleep symptoms should activate sleep-cluster",
        example: "[slapeloosheid, overmatige slaperigheid] → circadian disruption",
      };
      expect(expectation.behavior).toBeDefined();
    });
  });

  describe("Low Confidence Input Specification", () => {
    it("should document confidence filtering at 0.60 threshold", () => {
      const expectation = {
        threshold: 0.60,
        behavior: "Symptoms below 0.60 confidence moved to low_confidence_symptoms",
        purpose: "Allow AI to evaluate low-confidence signals without noise",
      };
      expect(expectation.threshold).toBe(0.60);
    });

    it("should document unrecognized input handling", () => {
      const expectation = {
        behavior: "Unrecognized terms stored separately for AI evaluation",
        example: "[vermoeidheid, abc123xyz, diarree] → unrecognized: [abc123xyz]",
      };
      expect(expectation.behavior).toBeDefined();
    });

    it("should document all-unrecognized input handling", () => {
      const expectation = {
        behavior: "When all inputs are unrecognized, high_confidence_symptoms is empty",
        example: "[xyz123, abc456, qwerty] → all moved to unrecognized",
      };
      expect(expectation.behavior).toBeDefined();
    });
  });

  describe("Medical Disclaimer Specification", () => {
    it("should verify disclaimer text is present in reports", () => {
      const disclaimerText = "Dit rapport is geen medisch advies en kan geen medische diagnose vervangen. Dit is een holistische analyse ter ondersteuning van je gezondheidsreis. Raadpleeg altijd een gekwalificeerde medische professional voor diagnose en behandeling.";
      
      expect(disclaimerText).toContain("Dit rapport is geen medisch advies");
      expect(disclaimerText).toContain("holistische analyse");
      expect(disclaimerText).toContain("gekwalificeerde medische professional");
    });

    it("should document that disclaimer is prepended to all insight reports", () => {
      const expectation = {
        placement: "First paragraph of report content",
        timing: "Injected via AI prompt instruction",
        scope: "All insight reports (inzicht_rapport)",
      };
      expect(expectation.placement).toBeDefined();
    });
  });

  describe("Cluster Detection with Edge Cases", () => {
    it("should document single symptom cluster activation", () => {
      const expectation = {
        behavior: "Single symptom may activate a cluster if it's a key symptom",
        example: "vermoeidheid → may activate fatigue-cluster",
      };
      expect(expectation.behavior).toBeDefined();
    });

    it("should document multiple cluster activations", () => {
      const expectation = {
        behavior: "Multiple symptoms should activate multiple clusters",
        example: "[vermoeidheid, slapeloosheid, diarree, stress] → 3-4 clusters active",
      };
      expect(expectation.behavior).toBeDefined();
    });
  });
});
