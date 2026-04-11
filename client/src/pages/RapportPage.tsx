Zeker! Ik heb beide bestanden volledig herschreven volgens de gevraagde verbeterpunten. Hieronder vind je de complete, verbeterde code die je direct kunt plakken.

### 1. client/src/pages/AnamnesisQuestionnaire.tsx
Dit bestand is nu volledig conversationeel (één vraag per keer), bevat de adaptieve logica voor stress en trauma, en heeft het nieuwe samenvattingsscherm.

```tsx
// FILE: client/src/pages/AnamnesisQuestionnaire.tsx
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, ChevronLeft, ChevronRight, Check } from "lucide-react";

const STORAGE_KEY = "anamnesis_draft_v2";

// ─── ZIEKTEBEELDEN ────────────────────────────────────────────────────────────

const CONDITION_TYPES = [
  {
    id: "chronic_fatigue",
    label: "Chronische Vermoeidheid",
    description: "Aanhoudende moeheid die niet overgaat na rust",
    icon: "🔋",
  },
  {
    id: "digestive_issues",
    label: "Spijsverteringsproblemen",
    description: "Maag- en darmklachten, opgeblazen gevoel, onregelmatige stoelgang",
    icon: "🌿",
  },
  {
    id: "solk",
    label: "SOLK",
    description: "Lichamelijke klachten zonder duidelijke medische oorzaak",
    icon: "🧩",
  },
  {
    id: "auto_immuun",
    label: "Auto-Immuun Klachten",
    description: "Immuunsysteem gerelateerde klachten zoals ontstekingen, uitslag, gewrichtspijn",
    icon: "🛡️",
  },
  {
    id: "alk",
    label: "ALK — Aspecifieke Klachten",
    description: "Vage lichamelijke klachten die moeilijk te categoriseren zijn",
    icon: "🌀",
  },
];

// ─── VRAGENTYPE ───────────────────────────────────────────────────────────────

type Question = {
  id: string;
  label: string;
  sublabel?: string;
  type: "select" | "number" | "text" | "textarea" | "scale";
  options?: string[];
  section: string;
  showIf?: (r: Record<string, any>, ct: string) => boolean;
  optional?: boolean;
};

// ─── ALLE VRAGEN ──────────────────────────────────────────────────────────────

const ALL_QUESTIONS: Question[] = [
  // BASISINFO
  { id: "age", label: "Hoe oud ben je?", type: "number", section: "basic_info" },
  { id: "gender", label: "Wat is je geslacht?", type: "select", options: ["Man", "Vrouw", "Anders"], section: "basic_info" },
  { id: "main_complaint", label: "Beschrijf in je eigen woorden wat je het meest dwars zit.", sublabel: "Er is geen goed of fout antwoord — wees zo eerlijk als je wilt.", type: "textarea", section: "basic_info" },
  { id: "duration", label: "Hoe lang heb je deze klachten al?", sublabel: "Bijvoorbeeld: '3 maanden', '2 jaar'", type: "text", section: "basic_info" },

  // SLAAP
  { id: "sleep_hours", label: "Hoeveel uur slaap je gemiddeld per nacht?", type: "number", section: "sleep" },
  { id: "sleep_quality", label: "Hoe goed slaap je? Geef een cijfer van 1 tot 10.", sublabel: "1 = heel slecht, 10 = uitstekend", type: "scale", section: "sleep" },
  { id: "sleep_direction", label: "Welke richting ligt je hoofd als je slaapt?", type: "select", options: ["Oost", "West", "Noord", "Zuid", "Weet ik niet"], section: "sleep" },

  // VOEDING
  { id: "diet_type", label: "Hoe zou je je eetpatroon omschrijven?", type: "select", options: ["Ik eet alles", "Vegetarisch", "Veganistisch", "Keto / low-carb", "Anders"], section: "nutrition" },
  { id: "water_intake", label: "Hoeveel liter water drink je gemiddeld per dag?", type: "number", section: "nutrition" },
  { id: "digestion", label: "Hoe goed werkt je spijsvertering? Geef een cijfer van 1 tot 10.", type: "scale", section: "nutrition" },

  // LEEFSTIJL
  { id: "exercise", label: "Hoeveel uur per week beweeg je?", sublabel: "Tel alles mee: sporten, wandelen, fietsen", type: "number", section: "lifestyle" },
  { id: "stress_level", label: "Hoeveel stress ervaar je op dit moment? Geef een cijfer van 1 tot 10.", sublabel: "1 = nauwelijks stress, 10 = extreme stress", type: "scale", section: "lifestyle" },
  { id: "stress_sources", label: "Waar komt die stress vandaan?", sublabel: "Werk, relaties, gezondheid, financiën — alles is relevant", type: "textarea", section: "lifestyle", showIf: (r) => parseInt(r.stress_level) >= 4 },

  // CONDITIE SPECIFIEK: CHRONIC FATIGUE
  { id: "orthostatic_intolerance", label: "Word je duizelig of zwart voor ogen als je snel opstaat?", type: "select", options: ["Ja, altijd", "Soms", "Zelden", "Nee"], section: "condition_specific", showIf: (_, ct) => ct === "chronic_fatigue" },
  
  // CONDITIE SPECIFIEK: SOLK
  { id: "trauma_history", label: "Heb je ingrijpende ervaringen meegemaakt die mogelijk verband houden met je klachten?", sublabel: "Dit is volledig optioneel.", type: "select", options: ["Ja, wil ik toelichten", "Mogelijk", "Nee"], section: "condition_specific", showIf: (_, ct) => ct === "solk" },
  { id: "trauma_details", label: "Als je wilt, beschrijf kort wat er is gebeurd.", type: "textarea", section: "condition_specific", showIf: (r, ct) => ct === "solk" && r.trauma_history === "Ja, wil ik toelichten", optional: true },

  // DOELEN
  { id: "primary_goal", label: "Wat wil jij het allerliefst bereiken met dit programma?", type: "textarea", section: "goals" },
  { id: "commitment", label: "Hoe gemotiveerd ben je om echt iets te veranderen?", sublabel: "1 = ik twijfel nog, 10 = ik ben er helemaal klaar voor", type: "scale", section: "goals" },
];

const SECTION_LABELS: Record<string, string> = {
  basic_info: "Basis",
  sleep: "Slaap",
  nutrition: "Voeding",
  lifestyle: "Leefstijl",
  condition_specific: "Specifiek",
  goals: "Doelen",
};

// ─── SCALE COMPONENT ──────────────────────────────────────────────────────────

function ScaleInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const current = parseInt(value) || 0;
  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
        <button
          key={n}
          onClick={() => onChange(String(n))}
          className={`h-12 rounded-xl font-bold transition-all border-2 ${
            current === n ? "bg-indigo-600 border-indigo-600 text-white scale-105" : "bg-white border-gray-100 text-gray-600 hover:border-indigo-300"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function AnamnesisQuestionnaire() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"condition" | "questions" | "summary">("condition");
  const [conditionType, setConditionType] = useState("");
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [currentQ, setCurrentQ] = useState(0);

  const activeQuestions = ALL_QUESTIONS.filter(q => q.showIf ? q.showIf(responses, conditionType) : true);
  const progress = (currentQ / activeQuestions.length) * 100;

  const submitMutation = trpc.anamnesis.submit.useMutation({
    onSuccess: () => {
      toast.success("Bedankt! Je rapport wordt nu gegenereerd.");
      localStorage.removeItem(STORAGE_KEY);
      setLocation("/rapport");
    }
  });

  const handleNext = () => {
    if (currentQ < activeQuestions.length - 1) {
      setCurrentQ(prev => prev + 1);
    } else {
      setStep("summary");
    }
  };

  const handleValueChange = (id: string, val: any, autoAdvance = false) => {
    setResponses(prev => ({ ...prev, [id]: val }));
    if (autoAdvance) {
      setTimeout(handleNext, 280);
    }
  };

  if (step === "condition") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">Welkom, {user?.name}</h1>
            <p className="text-gray-500 mt-2">Kies het ziektebeeld dat het meest op jou van toepassing is.</p>
          </div>
          <div className="grid gap-4">
            {CONDITION_TYPES.map((c) => (
              <Card 
                key={c.id} 
                className="p-4 cursor-pointer hover:border-indigo-500 transition-all group"
                onClick={() => { setConditionType(c.id); setStep("questions"); }}
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{c.icon}</span>
                  <div>
                    <h3 className="font-bold text-lg group-hover:text-indigo-600">{c.label}</h3>
                    <p className="text-sm text-gray-500">{c.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (step === "questions") {
    const q = activeQuestions[currentQ];
    return (
      <div className="min-h-screen bg-white flex flex-col items-center p-6">
        <div className="w-full max-w-xl">
          <div className="mb-12">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-gray-400 mt-2 uppercase tracking-widest font-semibold">
              {SECTION_LABELS[q.section]} — Vraag {currentQ + 1} van {activeQuestions.length}
            </p>
          </div>

          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 leading-tight">{q.label}</h2>
              {q.sublabel && <p className="text-gray-500 mt-2">{q.sublabel}</p>}
            </div>

            <div className="py-4">
              {q.type === "scale" && <ScaleInput value={responses[q.id]} onChange={(v) => handleValueChange(q.id, v, true)} />}
              {q.type === "select" && (
                <div className="grid gap-3">
                  {q.options?.map(opt => (
                    <button
                      key={opt}
                      onClick={() => handleValueChange(q.id, opt, true)}
                      className="w-full p-4 text-left rounded-2xl border-2 border-gray-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all font-medium"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
              {q.type === "textarea" && (
                <textarea
                  className="w-full p-4 rounded-2xl border-2 border-gray-100 focus:border-indigo-500 outline-none h-32"
                  value={responses[q.id] || ""}
                  onChange={(e) => handleValueChange(q.id, e.target.value)}
                  placeholder="Typ hier je antwoord..."
                />
              )}
              {(q.type === "text" || q.type === "number") && (
                <input
                  type={q.type}
                  className="w-full p-4 rounded-2xl border-2 border-gray-100 focus:border-indigo-500 outline-none"
                  value={responses[q.id] || ""}
                  onChange={(e) => handleValueChange(q.id, e.target.value)}
                />
              )}
            </div>

            <div className="flex gap-4">
              {currentQ > 0 && (
                <Button variant="ghost" onClick={() => setCurrentQ(prev => prev - 1)} className="rounded-xl">
                  <ChevronLeft className="mr-2 h-4 w-4" /> Vorige
                </Button>
              )}
              <div className="flex-1" />
              {q.type !== "select" && q.type !== "scale" && (
                <Button onClick={handleNext} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-8">
                  {currentQ === activeQuestions.length - 1 ? "Controleer antwoorden" : "Volgende"} <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Kloppen deze antwoorden?</h2>
          <p className="text-gray-500 mt-2">Je kunt elk antwoord nog aanpassen voordat we je rapport maken.</p>
        </div>
        <Card className="divide-y divide-gray-100">
          {activeQuestions.map((q, idx) => (
            <div key={q.id} className="p-4 flex justify-between items-start gap-4 hover:bg-gray-50 cursor-pointer" onClick={() => { setStep("questions"); setCurrentQ(idx); }}>
              <div className="flex-1">
                <p className="text-xs font-bold text-indigo-600 uppercase mb-1">{SECTION_LABELS[q.section]}</p>
                <p className="text-sm font-medium text-gray-900">{q.label}</p>
                <p className="text-sm text-gray-500 mt-1">{responses[q.id] || <span className="italic text-gray-300">Niet ingevuld</span>}</p>
              </div>
              <div className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Bewerk</div>
            </div>
          ))}
        </Card>
        <Button 
          className="w-full h-14 text-lg bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-xl shadow-indigo-100"
          onClick={() => submitMutation.mutate({ conditionType, responses })}
          disabled={submitMutation.isPending}
        >
          {submitMutation.isPending ? <Loader2 className="animate-spin" /> : "Verstuur en maak rapport →"}
        </Button>
      </div>
    </div>
  );
}
```

### 2. client/src/pages/RapportPage.tsx
Dit bestand is nu geoptimaliseerd voor een schone weergave, inclusief de parallelle flow en de "Smart Polling".

```tsx
// FILE: client/src/pages/RapportPage.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { 
  Loader2, ArrowLeft, Lightbulb, CheckCircle, 
  BookOpen, FlaskConical, RefreshCw, Download, 
  Utensils, Pill, Activity, Brain 
} from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

// --- HELPERS ---
function parseJsonField(field: any): string[] {
  if (Array.isArray(field)) return field;
  if (typeof field === "string") {
    try {
      const parsed = JSON.parse(field);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  return [];
}

function parseProtocolsField(field: any): Record<string, string[]> | null {
  if (field && typeof field === "object" && !Array.isArray(field)) return field;
  if (typeof field === "string" && field.length > 2) {
    try {
      const parsed = JSON.parse(field);
      return (parsed && typeof parsed === "object") ? parsed : null;
    } catch { return null; }
  }
  return null;
}

function normalizeReport(report: any) {
  if (!report) return null;
  return {
    ...report,
    keyInsights: parseJsonField(report.keyInsights),
    recommendations: parseJsonField(report.recommendations),
    protocols: parseProtocolsField(report.protocols),
    scientificReferences: parseJsonField(report.scientificReferences),
  };
}

const PROTOCOL_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  nutrition: { label: "Voeding", icon: Utensils, color: "text-green-600" },
  supplements: { label: "Supplementen", icon: Pill, color: "text-blue-600" },
  lifestyle: { label: "Leefstijl", icon: Activity, color: "text-orange-600" },
  mentalPractices: { label: "Mentale Rust", icon: Brain, color: "text-purple-600" },
};

export default function RapportPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const utils = trpc.useUtils();

  const reportsQuery = trpc.anamnesis.getReports.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: (query) => (isRegenerating || !query.state.data?.[0]?.content) ? 3000 : false,
  });

  const regenerateMutation = trpc.anamnesis.regenerateLatestReport.useMutation({
    onSuccess: () => { toast.success("Hergeneratie gestart..."); setIsRegenerating(true); },
    onSettled: () => utils.anamnesis.getReports.invalidate()
  });

  const report = normalizeReport(reportsQuery.data?.[0]);

  useEffect(() => {
    if (report?.content && isRegenerating) setIsRegenerating(false);
  }, [report?.content, isRegenerating]);

  if (reportsQuery.isLoading || (isRegenerating && !report?.content)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white p-6">
        <Loader2 className="animate-spin w-10 h-10 text-indigo-600 mb-4" />
        <h2 className="text-xl font-bold">Je rapport wordt opgesteld...</h2>
        <p className="text-gray-500">Dit duurt ongeveer 30-45 seconden.</p>
      </div>
    );
  }

  if (!report) return <div className="p-10 text-center">Geen rapport gevonden.</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setLocation("/")}><ArrowLeft className="mr-2 w-4 h-4" /> Terug</Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => regenerateMutation.mutate()} disabled={isRegenerating}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRegenerating ? "animate-spin" : ""}`} /> Opnieuw
            </Button>
            <Button size="sm" className="bg-indigo-600" onClick={() => window.open(`/api/pdf/${report.id}`, "_blank")}>
              <Download className="w-4 h-4 mr-2" /> PDF
            </Button>
          </div>
        </div>

        <Card className="overflow-hidden border-0 shadow-xl">
          <div className="bg-indigo-700 p-8 text-white">
            <h1 className="text-3xl font-bold">Jouw Holistische Analyse</h1>
            <p className="opacity-80 mt-1">Gegenereerd op {new Date(report.createdAt).toLocaleDateString("nl-NL")}</p>
          </div>

          <div className="p-8 space-y-10">
            {/* Samenvatting */}
            <section>
              <h2 className="text-xl font-bold flex items-center gap-2 mb-4"><Lightbulb className="text-amber-500" /> Kerninzicht</h2>
              <div className="prose prose-indigo max-w-none text-gray-700 leading-relaxed">
                <Streamdown content={report.summary || report.content} />
              </div>
            </section>

            {/* Aanbevelingen */}
            <section className="grid md:grid-cols-2 gap-4">
              {report.recommendations.map((rec: string, i: number) => (
                <div key={i} className="flex gap-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                  <CheckCircle className="w-5 h-5 text-indigo-600 shrink-0" />
                  <p className="text-sm font-medium text-indigo-900">{rec}</p>
                </div>
              ))}
            </section>

            {/* Protocollen */}
            {report.protocols && (
              <section className="space-y-4">
                <h2 className="text-xl font-bold">Gepersonaliseerde Protocollen</h2>
                <div className="grid sm:grid-cols-2 gap-6">
                  {Object.entries(report.protocols).map(([key, items]: [string, any]) => {
                    const config = PROTOCOL_LABELS[key] || { label: key, icon: FlaskConical, color: "text-gray-600" };
                    return (
                      <div key={key} className="space-y-3">
                        <div className="flex items-center gap-2 font-bold text-gray-800">
                          <config.icon className={`w-5 h-5 ${config.color}`} /> {config.label}
                        </div>
                        <ul className="space-y-2">
                          {items.map((item: string, idx: number) => (
                            <li key={idx} className="text-sm text-gray-600 flex gap-2">
                              <span className="text-indigo-300">•</span> {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
```
