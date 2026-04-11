import { ENV } from "./env";
import fs from "fs";
import path from "path";

// ============================================================
// AUTOMATISCHE KNOWLEDGE BASE LOADER
// Laadt ALLE .json bestanden uit de knowledge_base map.
// Voeg gewoon een nieuw .json bestand toe aan die map
// en herstart de server — het wordt automatisch meegenomen.
// ============================================================

function loadKnowledgeBase(): Record<string, any> {
  const knowledgeBasePath = path.join(process.cwd(), "knowledge_base");
  const combined: Record<string, any> = {};

  if (!fs.existsSync(knowledgeBasePath)) {
    console.warn("[KnowledgeBase] Map niet gevonden:", knowledgeBasePath);
    return combined;
  }

  const files = fs.readdirSync(knowledgeBasePath).filter(f => f.endsWith(".json"));

  if (files.length === 0) {
    console.warn("[KnowledgeBase] Geen JSON bestanden gevonden in:", knowledgeBasePath);
    return combined;
  }

  for (const file of files) {
    const filePath = path.join(knowledgeBasePath, file);
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content);
      const key = file.replace(".json", ""); // bestandsnaam zonder extensie
      combined[key] = parsed;
      console.log(`[KnowledgeBase] ✅ Geladen: ${file}`);
    } catch (err) {
      console.error(`[KnowledgeBase] ❌ Fout bij laden van ${file}:`, err);
    }
  }

  console.log(`[KnowledgeBase] Totaal geladen: ${files.length} bestanden`);
  return combined;
}

// Wordt één keer geladen bij serverstart
export const knowledgeBase = loadKnowledgeBase();

// ============================================================
// SYSTEM PROMPT — automatisch opgebouwd uit alle geladen kennis
// ============================================================
export const HOLISTIC_SYSTEM_PROMPT = `
Je bent een holistische AI gezondheidsadviseur van Holistisch AI Kliniek.

Je werkt altijd conform de onderstaande kennisbank die jouw medische expertise vormt.
Deze kennisbank is automatisch samengesteld uit alle beschikbare kennisbestanden.

KENNISBANK:
${Object.keys(knowledgeBase).length > 0
  ? JSON.stringify(knowledgeBase, null, 2)
  : "Kennisbank niet beschikbaar."}

JOUW TAAK:
Op basis van de anamnese van de gebruiker genereer je een persoonlijk, wetenschappelijk onderbouwd rapport in het Nederlands.

RAPPORTSTRUCTUUR (gebruik altijd exact deze volgorde):

1. HERKENNING
   - Benoem de specifieke klachten van deze persoon bij naam
   - Toon empathie en begrip
   - Valideer hun ervaring — laat zien dat je ze begrijpt

2. DE LOGICA
   - Leg uit WAAROM deze klachten ontstaan in het lichaam
   - Verbind de symptomen aan de onderliggende mechanismen uit de kennisbank
   - Gebruik begrijpelijke taal, geen vakjargon

3. EERSTE INZICHTEN
   - Geef 2-3 inzichten die ze waarschijnlijk nog niet hebben gehoord
   - Maak het persoonlijk en relevant voor hun specifieke situatie
   - Geef hoop en motivatie

4. WAT DIT BETEKENT
   - Wat gebeurt er als niets verandert?
   - Wees eerlijk maar niet alarmerend
   - Creëer urgentie en motivatie tot actie

5. JOUW 6-MAANDEN HERSTELPLAN
   - Maand 1-2: Stabilisatie fase
   - Maand 3-4: Herstel fase
   - Maand 5-6: Optimalisatie fase
   - Geef concrete acties per fase passend bij hun ziektebeeld

6. VOEDING & SUPPLEMENTEN
   - Specifieke aanbevelingen met doseringen uit de kennisbank
   - Leg uit waarom elk supplement helpt
   - Noem voeding om te vermijden én te eten

7. LEEFSTIJL PROTOCOL
   - Slaap, beweging en stress management
   - Passend bij hun huidige energieniveau

8. AANBEVOLEN PRODUCTEN & DIENSTEN
   - Concrete productaanbevelingen
   - Geef alternatieven waar mogelijk

9. VOLGENDE STAP
   - Dit rapport is een begin, niet het einde
   - Nodig uit voor persoonlijke begeleiding

TOON: Meelevend, wetenschappelijk onderbouwd, hoopvol en praktisch.
TAAL: Altijd Nederlands.
LENGTE: Uitgebreid en gedetailleerd — dit is een professioneel rapport.

DISCLAIMER (altijd onderaan toevoegen):
"⚠️ Dit rapport is uitsluitend informatief en vervangt geen medisch advies. Raadpleeg altijd een gekwalificeerde therapeut of arts voor persoonlijke behandeling."
`;

// ============================================================
// TYPES
// ============================================================
export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") return part;
  if (part.type === "image_url") return part;
  if (part.type === "file_url") return part;
  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");
    return { role, name, tool_call_id, content };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return { role, name, content: contentParts[0].text };
  }

  return { role, name, content: contentParts };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;
  if (toolChoice === "none" || toolChoice === "auto") return toolChoice;

  if (toolChoice === "required") {
    if (!tools || tools.length === 0)
      throw new Error("tool_choice 'required' was provided but no tools were configured");
    if (tools.length > 1)
      throw new Error("tool_choice 'required' needs a single tool or specify the tool name explicitly");
    return { type: "function", function: { name: tools[0].function.name } };
  }

  if ("name" in toolChoice) {
    return { type: "function", function: { name: toolChoice.name } };
  }

  return toolChoice;
};

const resolveApiUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";

const assertApiKey = () => {
  if (!ENV.forgeApiKey) throw new Error("OPENAI_API_KEY is not configured");
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema)
      throw new Error("responseFormat json_schema requires a defined schema object");
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;
  if (!schema.name || !schema.schema)
    throw new Error("outputSchema requires both name and schema");

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const payload: Record<string, unknown> = {
    model: "gemini-2.5-flash",
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) payload.tools = tools;

  const normalizedToolChoice = normalizeToolChoice(toolChoice || tool_choice, tools);
  if (normalizedToolChoice) payload.tool_choice = normalizedToolChoice;

  const callerMaxTokens = (params as any).maxTokens || (params as any).max_tokens;
  payload.max_tokens = callerMaxTokens || 4096;
  payload.thinking = { budget_tokens: 128 };

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });
  if (normalizedResponseFormat) payload.response_format = normalizedResponseFormat;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90_000);

  let response: Response;
  try {
    response = await fetch(resolveApiUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`);
  }

  return (await response.json()) as InvokeResult;
}
