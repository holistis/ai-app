// FILE: client/src/pages/AnamnesisQuestionnaire.tsx
// VERBETERD: conversationeel (1 vraag tegelijk), adaptieve logica,
// patiëntvriendelijke taal, samenvatting vóór submit, betere UX

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";

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
  { id: "duration", label: "Hoe lang heb je deze klachten al?", sublabel: "Bijvoorbeeld: '3 maanden', '2 jaar', 'zolang ik me kan herinneren'", type: "text", section: "basic_info" },

  // SLAAP
  { id: "sleep_hours", label: "Hoeveel uur slaap je gemiddeld per nacht?", type: "number", section: "sleep" },
  { id: "sleep_quality", label: "Hoe goed slaap je? Geef een cijfer van 1 tot 10.", sublabel: "1 = heel slecht, 10 = uitstekend", type: "scale", section: "sleep" },
  { id: "sleep_issues", label: "Heb je slaapproblemen? Zo ja, beschrijf wat er speelt.", sublabel: "Denk aan: moeilijk inslapen, wakker worden, niet uitgerust wakker worden", type: "textarea", section: "sleep", optional: true },
  { id: "sleep_direction", label: "Welke richting ligt je hoofd als je slaapt?", type: "select", options: ["Oost", "West", "Noord", "Zuid", "Weet ik niet"], section: "sleep" },

  // VOEDING
  { id: "diet_type", label: "Hoe zou je je eetpatroon omschrijven?", type: "select", options: ["Ik eet alles", "Vegetarisch", "Veganistisch", "Keto / low-carb", "Anders"], section: "nutrition" },
  { id: "water_intake", label: "Hoeveel liter water drink je gemiddeld per dag?", type: "number", section: "nutrition" },
  { id: "digestion", label: "Hoe goed werkt je spijsvertering? Geef een cijfer van 1 tot 10.", sublabel: "1 = heel slecht / veel klachten, 10 = perfect", type: "scale", section: "nutrition" },
  { id: "gut_issues", label: "Heb je last van je buik of darmen? Beschrijf wat je ervaart.", sublabel: "Denk aan: opgeblazen gevoel, pijn, onregelmatige stoelgang", type: "textarea", section: "nutrition", optional: true },
  { id: "fermented_foods", label: "Eet je wel eens gefermenteerde producten?", sublabel: "Zoals yoghurt, kefir, zuurkool, kimchi of kombucha", type: "select", options: ["Ja, bijna dagelijks", "Soms", "Zelden", "Nooit"], section: "nutrition" },

  // LEEFSTIJL
  { id: "exercise", label: "Hoeveel uur per week beweeg je?", sublabel: "Tel alles mee: sporten, wandelen, fietsen", type: "number", section: "lifestyle" },
  { id: "exercise_type", label: "Welke vorm van beweging doe je?", type: "textarea", section: "lifestyle", optional: true },
  { id: "stress_level", label: "Hoeveel stress ervaar je op dit moment? Geef een cijfer van 1 tot 10.", sublabel: "1 = nauwelijks stress, 10 = extreme stress", type: "scale", section: "lifestyle" },
  { id: "stress_sources", label: "Waar komt die stress vandaan?", sublabel: "Werk, relaties, gezondheid, financiën — alles is relevant", type: "textarea", section: "lifestyle", showIf: (r) => parseInt(r.stress_level) >= 4 },
  { id: "grounding", label: "Hoe vaak loop je buiten op blote voeten of zit je in de natuur?", type: "select", options: ["Dagelijks", "Meerdere keren per week", "Wekelijks", "Zelden", "Nooit"], section: "lifestyle" },

  // OMGEVING
  { id: "screen_time", label: "Hoeveel uur per dag kijk je naar schermen?", sublabel: "Telefoon, laptop, tv — combineer alles", type: "number", section: "environment" },
  { id: "sunlight_exposure", label: "Hoeveel daglicht krijg je gemiddeld per dag?", type: "select", options: ["Minder dan 1 uur", "1 tot 2 uur", "2 tot 4 uur", "Meer dan 4 uur"], section: "environment" },
  { id: "blue_light_protection", label: "Gebruik je iets om je te beschermen tegen blauw licht van schermen?", sublabel: "Zoals een blauw-licht bril of nachtmodus op je telefoon", type: "select", options: ["Ja, altijd", "Soms", "Zelden", "Nee"], section: "environment" },
  { id: "emf_exposure", label: "Hoe sterk is je dagelijkse blootstelling aan wifi en mobiele signalen?", type: "select", options: ["Heel hoog (thuis + werk constant online)", "Gemiddeld", "Laag", "Weet ik niet"], section: "environment" },

  // EMOTIONEEL
  { id: "mental_clarity", label: "Hoe helder voelt je hoofd overdag? Geef een cijfer van 1 tot 10.", sublabel: "1 = veel hersenmist / wazig, 10 = super scherp en gefocust", type: "scale", section: "emotional" },
  { id: "emotional_balance", label: "Hoe stabiel voel je je emotioneel? Geef een cijfer van 1 tot 10.", sublabel: "1 = heel wisselvallig / overweldigd, 10 = stabiel en in balans", type: "scale", section: "emotional" },
  { id: "anxiety", label: "Heb je last van angst of een onrustig gevoel?", type: "select", options: ["Ja, heel veel", "Soms", "Zelden", "Nooit"], section: "emotional" },
  { id: "depression", label: "Heb je last van een somber of neerslachtig gevoel?", type: "select", options: ["Ja, heel veel", "Soms", "Zelden", "Nooit"], section: "emotional" },
  { id: "spiritual_connection", label: "Hoe is je verbinding met jezelf en wat jou energie geeft?", sublabel: "Denk aan zingeving, rust, natuur, religie of meditatie — elk antwoord is goed", type: "textarea", section: "emotional", optional: true },

  // MEDISCH
  { id: "medications", label: "Welke medicijnen gebruik je op dit moment?", sublabel: "Schrijf 'geen' als je niets gebruikt", type: "textarea", section: "medical" },
  { id: "supplements", label: "Welke supplementen neem je?", sublabel: "Vitaminen, mineralen, kruidenpreparaten — alles telt", type: "textarea", section: "medical", optional: true },
  { id: "allergies", label: "Heb je allergiën of voedselintoleranties?", sublabel: "Schrijf 'geen' als er niets bekend is", type: "textarea", section: "medical" },
  { id: "past_treatments", label: "Wat heb je al geprobeerd om je klachten te verbeteren?", sublabel: "Arts, specialist, dieet, therapie, supplementen — alles is relevant", type: "textarea", section: "medical", optional: true },

  // CONDITIE: CHRONIC FATIGUE
  { id: "fatigue_onset", label: "Wanneer begon de vermoeidheid, en was er een aanleiding?", sublabel: "Bijvoorbeeld: na een infectie, na een stressvolle periode, of geleidelijk", type: "textarea", section: "condition_specific", showIf: (_, ct) => ct === "chronic_fatigue" },
  { id: "post_exertional_malaise", label: "Word jij erger na een inspanning — ook na lichte activiteit?", sublabel: "Zoals een wandeling, een gesprek, of een drukke dag", type: "select", options: ["Ja, altijd", "Soms", "Zelden", "Nee"], section: "condition_specific", showIf: (_, ct) => ct === "chronic_fatigue" },
  { id: "sleep_restful", label: "Voel je je uitgerust na 8 of meer uur slaap?", type: "select", options: ["Nooit — ik word moe wakker", "Zelden", "Soms", "Meestal wel"], section: "condition_specific", showIf: (_, ct) => ct === "chronic_fatigue" },
  { id: "brain_fog", label: "Heb je last van hersenmist — moeite met denken, concentreren of onthouden?", type: "select", options: ["Ja, ernstig", "Ja, matig", "Soms", "Nee"], section: "condition_specific", showIf: (_, ct) => ct === "chronic_fatigue" },
  { id: "temperature_regulation", label: "Heb je last van koude handen of voeten, of zweet je snel?", sublabel: "Dit wijst op moeite met temperatuurregulatie", type: "select", options: ["Ja, altijd", "Soms", "Zelden", "Nee"], section: "condition_specific", showIf: (_, ct) => ct === "chronic_fatigue" },
  { id: "orthostatic_intolerance", label: "Word je duizelig of zwart voor ogen als je snel opstaat?", type: "select", options: ["Ja, altijd", "Soms", "Zelden", "Nee"], section: "condition_specific", showIf: (_, ct) => ct === "chronic_fatigue" },
  { id: "viral_history", label: "Heb je ooit een ernstige infectie gehad waarna je je nooit meer helemaal hersteld hebt?", sublabel: "Zoals COVID, Epstein-Barr (klierkoorts), de ziekte van Lyme", type: "select", options: ["Ja, bevestigd", "Mogelijk, ik vermoed het", "Nee", "Weet ik niet"], section: "condition_specific", showIf: (_, ct) => ct === "chronic_fatigue" },
  { id: "mold_exposure", label: "Ben je ooit blootgesteld aan schimmel thuis of op het werk?", type: "select", options: ["Ja, zeker", "Mogelijk", "Nee", "Weet ik niet"], section: "condition_specific", showIf: (_, ct) => ct === "chronic_fatigue" },

  // CONDITIE: DIGESTIVE ISSUES
  { id: "main_symptoms_gut", label: "Wat zijn je voornaamste maag- of darmklachten?", type: "textarea", section: "condition_specific", showIf: (_, ct) => ct === "digestive_issues" },
  { id: "bowel_pattern", label: "Hoe is je stoelgang doorgaans?", type: "select", options: ["Hard en moeilijk", "Normaal", "Zacht en los", "Diarree", "Wisselend tussen verstopping en diarree"], section: "condition_specific", showIf: (_, ct) => ct === "digestive_issues" },
  { id: "bloating", label: "Heb je last van een opgeblazen buik?", type: "select", options: ["Ja, bijna altijd", "Na maaltijden", "Soms", "Nee"], section: "condition_specific", showIf: (_, ct) => ct === "digestive_issues" },
  { id: "food_triggers", label: "Zijn er voedingsmiddelen die jouw klachten verergeren?", sublabel: "Schrijf alles op wat je opvalt", type: "textarea", section: "condition_specific", showIf: (_, ct) => ct === "digestive_issues" },
  { id: "antibiotic_history", label: "Heb je ooit meerdere kuren antibiotica gehad?", type: "select", options: ["Ja, meerdere kuren", "Ja, één keer", "Nee", "Weet ik niet"], section: "condition_specific", showIf: (_, ct) => ct === "digestive_issues" },
  { id: "stress_gut_relation", label: "Merk je dat je buikklachten erger worden bij stress?", type: "select", options: ["Ja, duidelijk verband", "Soms", "Geen verband", "Weet ik niet"], section: "condition_specific", showIf: (_, ct) => ct === "digestive_issues" },
  { id: "abdominal_pain", label: "Heb je buikpijn? Zo ja, waar zit die en wanneer heb je er last van?", type: "textarea", section: "condition_specific", showIf: (_, ct) => ct === "digestive_issues", optional: true },
  { id: "fermented_intake", label: "Eet of drink je gefermenteerde producten zoals kefir, zuurkool of kimchi?", type: "select", options: ["Ja, dagelijks", "Soms", "Zelden", "Nooit"], section: "condition_specific", showIf: (_, ct) => ct === "digestive_issues" },

  // CONDITIE: SOLK
  { id: "symptom_locations", label: "Waar in je lichaam voel je klachten? Beschrijf alle plekken.", type: "textarea", section: "condition_specific", showIf: (_, ct) => ct === "solk" },
  { id: "symptom_intensity", label: "Hoe ernstig zijn de klachten gemiddeld? Geef een cijfer van 1 tot 10.", sublabel: "1 = licht ongemak, 10 = ondraaglijk", type: "scale", section: "condition_specific", showIf: (_, ct) => ct === "solk" },
  { id: "medical_tests_done", label: "Welke medische onderzoeken heb je al gedaan?", sublabel: "Bloedonderzoek, scans, specialisten — alles telt", type: "textarea", section: "condition_specific", showIf: (_, ct) => ct === "solk", optional: true },
  { id: "stress_symptoms_relation", label: "Worden je klachten erger als je gestrest of angstig bent?", type: "select", options: ["Ja, duidelijk", "Soms", "Nee", "Weet ik niet"], section: "condition_specific", showIf: (_, ct) => ct === "solk" },
  { id: "anxiety_panic", label: "Heb je last van angst of paniekaanvallen?", type: "select", options: ["Ja, regelmatig", "Soms", "Zelden", "Nooit"], section: "condition_specific", showIf: (_, ct) => ct === "solk" },
  { id: "trauma_history", label: "Heb je ingrijpende ervaringen meegemaakt die mogelijk verband houden met je klachten?", sublabel: "Je hoeft niets te vertellen wat je niet wilt — dit is volledig optioneel", type: "select", options: ["Ja, wil ik toelichten", "Mogelijk", "Nee"], section: "condition_specific", showIf: (_, ct) => ct === "solk" },
  { id: "trauma_details", label: "Als je wilt, beschrijf kort wat er is gebeurd.", type: "textarea", section: "condition_specific", showIf: (r, ct) => ct === "solk" && r.trauma_history === "Ja, wil ik toelichten", optional: true },
  { id: "relaxation_improves", label: "Verbeteren je klachten als je ontspant of minder stress hebt?", type: "select", options: ["Ja, duidelijk", "Soms", "Geen effect", "Weet ik niet"], section: "condition_specific", showIf: (_, ct) => ct === "solk" },

  // CONDITIE: AUTO-IMMUUN
  { id: "autoimmune_condition", label: "Welke auto-immuunaandoening heb je, of wat vermoed je?", sublabel: "Bijvoorbeeld: hashimoto, lupus, reuma, MS, coeliakie", type: "textarea", section: "condition_specific", showIf: (_, ct) => ct === "auto_immuun" },
  { id: "histamine_symptoms", label: "Krijg je na bepaalde voeding klachten zoals hoofdpijn, huiduitslag of hartkloppingen?", sublabel: "Dit kan wijzen op histamine-intolerantie", type: "select", options: ["Ja, regelmatig", "Soms", "Zelden", "Nee"], section: "condition_specific", showIf: (_, ct) => ct === "auto_immuun" },
  { id: "joint_muscle_pain", label: "Heb je last van gewrichts- of spierpijn?", type: "select", options: ["Ja, ernstig", "Matig", "Licht", "Nee"], section: "condition_specific", showIf: (_, ct) => ct === "auto_immuun" },
  { id: "skin_problems", label: "Heb je huidproblemen zoals eczeem, psoriasis of uitslag?", type: "select", options: ["Ja, ernstig", "Matig", "Licht", "Nee"], section: "condition_specific", showIf: (_, ct) => ct === "auto_immuun" },
  { id: "food_triggers_autoimmune", label: "Welke voedingsmiddelen verergeren jouw klachten?", type: "textarea", section: "condition_specific", showIf: (_, ct) => ct === "auto_immuun", optional: true },
  { id: "vitamin_d_tested", label: "Is je vitamine D niveau ooit gemeten?", type: "select", options: ["Ja, was te laag", "Ja, was normaal", "Ja, was te hoog", "Nooit gemeten"], section: "condition_specific", showIf: (_, ct) => ct === "auto_immuun" },
  { id: "inflammation_markers", label: "Zijn er ontstekingswaarden gemeten in je bloed?", sublabel: "Zoals CRP of BSE", type: "select", options: ["Ja, waren verhoogd", "Ja, waren normaal", "Nooit gemeten"], section: "condition_specific", showIf: (_, ct) => ct === "auto_immuun" },
  { id: "mold_chemical_exposure", label: "Ben je ooit blootgesteld aan schimmel of chemicaliën?", type: "select", options: ["Ja, zeker", "Mogelijk", "Nee", "Weet ik niet"], section: "condition_specific", showIf: (_, ct) => ct === "auto_immuun" },

  // CONDITIE: ALK
  { id: "main_symptoms_alk", label: "Beschrijf al je klachten zo volledig mogelijk.", type: "textarea", section: "condition_specific", showIf: (_, ct) => ct === "alk" },
  { id: "symptom_duration_alk", label: "Hoe lang heb je deze klachten al?", type: "text", section: "condition_specific", showIf: (_, ct) => ct === "alk" },
  { id: "symptom_pattern_alk", label: "Zijn de klachten constant of wisselend?", type: "select", options: ["Constant aanwezig", "Wisselend", "In aanvallen", "Seizoensgebonden"], section: "condition_specific", showIf: (_, ct) => ct === "alk" },
  { id: "lifestyle_impact", label: "Hoe beïnvloeden de klachten je dagelijks leven?", sublabel: "Werk, sociale contacten, sport, huishouden", type: "textarea", section: "condition_specific", showIf: (_, ct) => ct === "alk" },
  { id: "vitamin_d_alk", label: "Is je vitamine D niveau ooit gemeten?", type: "select", options: ["Ja, was laag", "Ja, was normaal", "Nooit gemeten"], section: "condition_specific", showIf: (_, ct) => ct === "alk" },

  // DOELEN
  { id: "primary_goal", label: "Wat wil jij het allerliefst bereiken met dit programma?", sublabel: "Wees zo concreet mogelijk — dit helpt ons een persoonlijk plan te maken", type: "textarea", section: "goals" },
  { id: "expectations", label: "Wat verwacht je van dit programma?", type: "textarea", section: "goals", optional: true },
  { id: "commitment", label: "Hoe gemotiveerd ben je om echt iets te veranderen? Geef een cijfer van 1 tot 10.", sublabel: "1 = ik twijfel nog, 10 = ik ben er helemaal klaar voor", type: "scale", section: "goals" },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function getActiveQuestions(ct: string, r: Record<string, any>): Question[] {
  return ALL_QUESTIONS.filter((q) => (q.showIf ? q.showIf(r, ct) : true));
}

function isAnswered(q: Question, r: Record<string, any>): boolean {
  if (q.optional) return true;
  const val = r[q.id];
  if (val === undefined || val === null) return false;
  if (typeof val === "string" && val.trim() === "") return false;
  return true;
}

const SECTION_LABELS: Record<string, string> = {
  basic_info: "Basisinformatie",
  sleep: "Slaap & Rust",
  nutrition: "Voeding",
  lifestyle: "Leefstijl",
  environment: "Omgeving",
  emotional: "Emotioneel & Mentaal",
  medical: "Medische Achtergrond",
  condition_specific: "Specifieke Vragen",
  goals: "Jouw Doelen",
};

// ─── SCALE COMPONENT ──────────────────────────────────────────────────────────

function ScaleInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const current = parseInt(value) || 0;
  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            onClick={() => onChange(String(n))}
            className={`w-11 h-11 rounded-xl font-bold text-sm transition-all duration-150 border-2 ${
              current === n
                ? "bg-indigo-600 border-indigo-600 text-white scale-110 shadow-lg"
                : "bg-white border-gray-200 text-gray-700 hover:border-indigo-400 hover:bg-indigo-50"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {current > 0 && (
        <p className="text-sm text-indigo-600 font-medium">Je koos: {current} / 10</p>
      )}
    </div>
  );
}

// ─── SAMENVATTING SCHERM ──────────────────────────────────────────────────────

function SummaryScreen({
  conditionType,
  responses,
  activeQuestions,
  onEdit,
  onSubmit,
  isSubmitting,
}: {
  conditionType: string;
  responses: Record<string, any>;
  activeQuestions: Question[];
  onEdit: (idx: number) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  const condition = CONDITION_TYPES.find((c) => c.id === conditionType);

  // Groepeer per sectie
  const grouped: Record<string, Question[]> = {};
  activeQuestions.forEach((q) => {
    if (!grouped[q.section]) grouped[q.section] = [];
    grouped[q.section].push(q);
  });

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-2xl font-bold text-gray-900">Controleer je antwoorden</h2>
        <p className="text-gray-500 mt-1 text-sm">
          Klik op een antwoord om het aan te passen, of stuur direct in.
        </p>
      </div>

      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 mb-2">
        {condition?.icon} {condition?.label}
      </div>

      {Object.entries(grouped).map(([section, qs]) => (
        <div key={section} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="font-semibold text-gray-600 text-xs uppercase tracking-widest">
              {section === "condition_specific" ? `Specifiek: ${condition?.label}` : SECTION_LABELS[section]}
            </h3>
          </div>
          <div className="divide-y divide-gray-50">
            {qs.map((q) => {
              const qIdx = activeQuestions.findIndex((aq) => aq.id === q.id);
              const val = responses[q.id];
              return (
                <button
                  key={q.id}
                  onClick={() => onEdit(qIdx)}
                  className="w-full text-left px-5 py-4 hover:bg-indigo-50 transition-colors group"
                >
                  <div className="text-xs text-gray-400 mb-0.5 group-hover:text-indigo-400 truncate">
                    {q.label}
                  </div>
                  <div className="font-medium text-gray-800 text-sm">
                    {val !== undefined && val !== null && val !== "" ? String(val) : (
                      <span className="text-gray-300 italic">{q.optional ? "Overgeslagen" : "Niet ingevuld"}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="pt-2">
        <button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold rounded-2xl text-lg transition-all shadow-lg shadow-indigo-200"
        >
          {isSubmitting ? "Rapport wordt gemaakt..." : "Verstuur & Genereer Mijn Rapport →"}
        </button>
        <p className="text-center text-xs text-gray-400 mt-3">
          Je ontvangt daarna direct jouw persoonlijke holistische analyse.
        </p>
      </div>
    </div>
  );
}

// ─── HOOFD COMPONENT ──────────────────────────────────────────────────────────

export default function AnamnesisQuestionnaire() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<"condition" | "questions" | "summary">("condition");
  const [conditionType, setConditionType] = useState<string>("");
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showError, setShowError] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Draft
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.conditionType) setConditionType(d.conditionType);
        if (d.responses) setResponses(d.responses);
        if (d.step) setStep(d.step);
        if (d.currentQ !== undefined) setCurrentQ(d.currentQ);
        toast.info("Je vorige antwoorden zijn hersteld.", { duration: 3000 });
      }
    } catch {}
    setDraftLoaded(true);
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ conditionType, responses, step, currentQ }));
    } catch {}
  }, [conditionType, responses, step, currentQ, draftLoaded]);

  const submitMutation = trpc.anamnesis.submit.useMutation();

  // Actieve vragen
  const activeQuestions = getActiveQuestions(conditionType, responses);
  const totalQ = activeQuestions.length;
  const q = activeQuestions[currentQ];
  const currentVal = q ? responses[q.id] : undefined;
  const answered = q ? isAnswered(q, responses) : true;

  // Progress
  const progressPct =
    step === "condition" ? 2
    : step === "summary" ? 100
    : Math.round(((currentQ + 1) / totalQ) * 96);

  function handleConditionNext() {
    if (!conditionType) { setShowError(true); return; }
    setCurrentQ(0);
    setStep("questions");
    window.scrollTo(0, 0);
  }

  function handleAnswer(val: any) {
    if (!q) return;
    setResponses((prev) => ({ ...prev, [q.id]: val }));
    setShowError(false);
  }

  function handleNext() {
    if (!answered) { setShowError(true); return; }
    setShowError(false);
    if (currentQ < totalQ - 1) {
      setCurrentQ(currentQ + 1);
      window.scrollTo(0, 0);
    } else {
      setStep("summary");
      window.scrollTo(0, 0);
    }
  }

  function handlePrev() {
    setShowError(false);
    if (currentQ > 0) {
      setCurrentQ(currentQ - 1);
      window.scrollTo(0, 0);
    } else {
      setStep("condition");
      window.scrollTo(0, 0);
    }
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      const cleaned: Record<string, string | number | boolean> = {};
      for (const [k, v] of Object.entries(responses)) {
        if (v !== undefined && v !== null && v !== "") cleaned[k] = v;
      }
      await submitMutation.mutateAsync({ conditionType, responses: cleaned });
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      toast.success("Anamnese ingediend! Je rapport wordt gegenereerd...");
      setLocation("/rapport");
    } catch (error: any) {
      const msg = error?.message || "";
      if (msg.includes("UNAUTHORIZED") || msg.includes("Please login") || msg.includes("10001")) {
        toast.error("Je sessie is verlopen. Log opnieuw in.");
        setTimeout(() => { window.location.href = "/"; }, 2000);
      } else {
        toast.error(`Er is een fout opgetreden: ${msg || "Probeer het opnieuw"}`);
      }
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600">
        Je moet ingelogd zijn om de anamnese in te vullen.
      </div>
    );
  }

  // Genereer-overlay
  if (isSubmitting) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full mx-4 text-center">
          <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-6">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Je rapport wordt gemaakt</h2>
          <p className="text-gray-500 mb-6 text-sm leading-relaxed">
            Onze AI analyseert jouw antwoorden en stelt een persoonlijk holistisch rapport op. Dit duurt 15–30 seconden.
          </p>
          <div className="space-y-3 text-left">
            {[
              { dot: "bg-indigo-500", text: "Antwoorden worden geanalyseerd...", delay: "0s" },
              { dot: "bg-indigo-400", text: "Holistische patronen worden herkend...", delay: "0.4s" },
              { dot: "bg-indigo-300", text: "Persoonlijk rapport wordt opgesteld...", delay: "0.8s" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-gray-500">
                <div className={`w-2 h-2 rounded-full ${item.dot} animate-pulse`} style={{ animationDelay: item.delay }} />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-8 px-4">
      <div className="max-w-xl mx-auto">

        {/* PROGRESS BAR */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-indigo-600">
              {step === "condition" ? "Kies je ziektebeeld"
                : step === "summary" ? "Samenvatting"
                : `Vraag ${currentQ + 1} van ${totalQ}`}
            </span>
            <span className="text-xs text-gray-400">{progressPct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* ── STAP 1: ZIEKTEBEELD ── */}
        {step === "condition" && (
          <div>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Welkom{user.name ? `, ${user.name.split(" ")[0]}` : ""}! 👋
              </h1>
              <p className="text-gray-500 leading-relaxed">
                Om een persoonlijk rapport te maken, beginnen we met het ziektebeeld dat het beste aansluit bij jouw situatie.
              </p>
            </div>

            {showError && !conditionType && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                Kies een ziektebeeld om door te gaan.
              </div>
            )}

            <div className="space-y-3 mb-8">
              {CONDITION_TYPES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setConditionType(c.id); setShowError(false); }}
                  className={`w-full p-4 border-2 rounded-2xl text-left transition-all duration-150 ${
                    conditionType === c.id
                      ? "border-indigo-500 bg-indigo-50 shadow-md"
                      : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">{c.icon}</span>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{c.label}</div>
                      <div className="text-sm text-gray-500 mt-0.5">{c.description}</div>
                    </div>
                    {conditionType === c.id && (
                      <div className="mt-1 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={handleConditionNext}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-lg transition-all shadow-lg shadow-indigo-200"
            >
              Volgende →
            </button>
          </div>
        )}

        {/* ── STAP 2: VRAGEN ── */}
        {step === "questions" && q && (
          <div key={q.id}>
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-5">

              {/* Sectie badge */}
              <div className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-4">
                {q.section === "condition_specific"
                  ? CONDITION_TYPES.find(c => c.id === conditionType)?.label
                  : SECTION_LABELS[q.section]}
              </div>

              {/* Vraag */}
              <h2 className="text-xl font-bold text-gray-900 mb-1 leading-snug">
                {q.label}
                {q.optional && (
                  <span className="ml-2 text-xs font-normal text-gray-400">(optioneel)</span>
                )}
              </h2>
              {q.sublabel && (
                <p className="text-sm text-gray-500 mb-5">{q.sublabel}</p>
              )}

              {showError && !answered && !q.optional && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                  Vul dit veld in om door te gaan.
                </div>
              )}

              <div className="mt-4">
                {/* SELECT: grote radiobuttons, auto-advance */}
                {q.type === "select" && (
                  <div className="space-y-2">
                    {q.options?.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => {
                          handleAnswer(opt);
                          setTimeout(handleNext, 280);
                        }}
                        className={`w-full text-left px-4 py-3.5 border-2 rounded-xl transition-all duration-150 font-medium flex items-center gap-3 ${
                          currentVal === opt
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                            : "border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/40"
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all ${
                          currentVal === opt ? "bg-indigo-600 border-indigo-600" : "border-gray-300"
                        }`} />
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {/* SCALE */}
                {q.type === "scale" && (
                  <ScaleInput value={currentVal || ""} onChange={handleAnswer} />
                )}

                {/* NUMBER */}
                {q.type === "number" && (
                  <input
                    type="number"
                    value={currentVal || ""}
                    onChange={(e) => handleAnswer(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleNext()}
                    placeholder="Voer een getal in"
                    className={`w-full px-4 py-3 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition ${
                      showError && !answered ? "border-red-300 bg-red-50" : "border-gray-200"
                    }`}
                    autoFocus
                  />
                )}

                {/* TEXT */}
                {q.type === "text" && (
                  <input
                    type="text"
                    value={currentVal || ""}
                    onChange={(e) => handleAnswer(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleNext()}
                    placeholder="Typ je antwoord..."
                    className={`w-full px-4 py-3 text-base border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition ${
                      showError && !answered ? "border-red-300 bg-red-50" : "border-gray-200"
                    }`}
                    autoFocus
                  />
                )}

                {/* TEXTAREA */}
                {q.type === "textarea" && (
                  <textarea
                    value={currentVal || ""}
                    onChange={(e) => handleAnswer(e.target.value)}
                    rows={4}
                    placeholder="Typ je antwoord..."
                    className={`w-full px-4 py-3 text-base border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition resize-none ${
                      showError && !answered ? "border-red-300 bg-red-50" : "border-gray-200"
                    }`}
                    autoFocus
                  />
                )}
              </div>
            </div>

            {/* Navigatie — niet bij select (auto-advance) */}
            {q.type !== "select" && (
              <div className="flex gap-3">
                <button
                  onClick={handlePrev}
                  className="px-5 py-4 border-2 border-gray-200 text-gray-600 font-semibold rounded-2xl hover:bg-gray-50 transition"
                >
                  ← Terug
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-200"
                >
                  {currentQ === totalQ - 1 ? "Controleer antwoorden →" : "Volgende →"}
                </button>
              </div>
            )}

            {/* Terug bij select */}
            {q.type === "select" && (
              <button
                onClick={handlePrev}
                className="w-full py-3 border-2 border-gray-200 text-gray-500 font-semibold rounded-2xl hover:bg-gray-50 transition text-sm"
              >
                ← Vorige vraag
              </button>
            )}

            {/* Sla over bij optioneel */}
            {q.optional && q.type !== "select" && (
              <button
                onClick={handleNext}
                className="w-full mt-2 py-2 text-gray-400 text-sm hover:text-gray-600 transition"
              >
                Sla over
              </button>
            )}
          </div>
        )}

        {/* ── STAP 3: SAMENVATTING ── */}
        {step === "summary" && (
          <SummaryScreen
            conditionType={conditionType}
            responses={responses}
            activeQuestions={activeQuestions}
            onEdit={(idx) => { setCurrentQ(idx); setStep("questions"); window.scrollTo(0, 0); }}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        )}

      </div>
    </div>
  );
}
