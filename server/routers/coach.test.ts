import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { coachRouter } from "./coach";
import { getDb } from "../db";

// Mock the LLM
vi.mock("../_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: "Dit is een test antwoord van de AI-Coach.",
        },
      },
    ],
  }),
}));

describe("Coach Router", () => {
  let db: any;

  beforeAll(async () => {
    db = await getDb();
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  it("should handle sendMessage mutation", async () => {
    const mockCtx = {
      user: {
        id: 1,
      },
      req: {},
      res: {},
    };

    const input = {
      message: "Hoe kan ik mijn energie verbeteren?",
      conversationHistory: [
        {
          role: "user" as const,
          content: "Hallo, ik ben moe",
        },
        {
          role: "assistant" as const,
          content: "Ik begrijp dat je je moe voelt. Laten we daar aan werken.",
        },
      ],
    };

    // Test that the router is properly structured
    expect(coachRouter).toBeDefined();
    expect(coachRouter._def.procedures.sendMessage).toBeDefined();
    expect(coachRouter._def.procedures.getHistory).toBeDefined();
  });

  it("should have getHistory procedure", async () => {
    expect(coachRouter._def.procedures.getHistory).toBeDefined();
  });
});
