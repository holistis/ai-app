import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";

const STORAGE_KEY = "anamnesis_draft";

const CONDITION_TYPES = [
  { id: "chronic_fatigue", label: "Chronische Vermoeidheid", description: "Aanhoudende moeheid en energiegebrek" },
  { id: "digestive_issues", label: "Spijsverterings-Problemen", description: "Maag- en darmklachten" },
  { id: "solk", label: "SOLK", description: "Somatisch Symptoomstoornis met Onverklaarbare Lichamelijke Klachten" },
  { id: "alk", label: "ALK", description: "Aspecifieke Lichamelijke Klachten" },
];

// Condition-specific extra questions added to the medical section
const CONDITION_SPECIFIC_QUESTIONS: Record<string, Array<{id: string; label: string; type: string; options?: string[]}>> = {
  chronic_fatigue: [
    { id: "fatigue_onset", label: "Wanneer begon de vermoeidheid? (bijv. na ziekte, na stress, geleidelijk)", type: "textarea" },
    { id: "fatigue_pattern", label: "Wanneer ben je het meest vermoeid?", type: "select", options: ["'s Ochtends bij opstaan", "'s Middags", "'s Avonds", "De hele dag door", "Na inspanning"] },
    { id: "post_exertional", label: "Word je erger na lichamelijke of mentale inspanning?", type: "select", options: ["Ja, altijd", "Soms", "Zelden", "Nee"] },
    { id: "brain_fog", label: "Heb je last van hersenmist (moeite met concentreren, vergeetachtigheid)?", type: "select", options: ["Ja, ernstig", "Ja, matig", "Soms", "Nee"] },
    { id: "energy_morning", label: "Hoe is je energieniveau 's ochtends? (1-10)", type: "number" },
    { id: "caffeine_use", label: "Gebruik je cafeïne om door de dag te komen?", type: "select", options: ["Ja, veel (3+ kopjes)", "Matig (1-2 kopjes)", "Weinig", "Nee"] },
  ],
  digestive_issues: [
    { id: "bowel_frequency", label: "Hoe vaak heb je ontlasting per dag/week?", type: "text" },
    { id: "stool_type", label: "Hoe is je ontlasting?", type: "select", options: ["Hard/klonterig", "Normaal", "Zacht/los", "Diarree", "Wisselend"] },
    { id: "bloating", label: "Heb je last van een opgeblazen gevoel?", type: "select", options: ["Ja, altijd", "Na maaltijden", "Soms", "Nee"] },
    { id: "food_triggers", label: "Welke voedingsmiddelen veroorzaken klachten?", type: "textarea" },
    { id: "abdominal_pain", label: "Heb je buikpijn? Beschrijf waar en wanneer.", type: "textarea" },
    { id: "antibiotics_history", label: "Heb je in het verleden antibiotica gebruikt?", type: "select", options: ["Ja, meerdere kuren", "Ja, één keer", "Nee", "Weet niet"] },
  ],
  solk: [
    { id: "pain_locations", label: "Waar in je lichaam voel je klachten? (beschrijf alle locaties)", type: "textarea" },
    { id: "pain_intensity", label: "Hoe ernstig zijn de klachten gemiddeld? (1-10)", type: "number" },
    { id: "medical_investigations", label: "Welke medische onderzoeken heb je al gehad?", type: "textarea" },
    { id: "trauma_history", label: "Heb je ingrijpende gebeurtenissen meegemaakt die mogelijk verband houden met je klachten?", type: "select", options: ["Ja, wil ik toelichten", "Misschien", "Nee"] },
    { id: "trauma_details", label: "Als je wilt, beschrijf dan kort wat er is gebeurd (optioneel)", type: "textarea" },
    { id: "impact_daily_life", label: "Hoe beïnvloeden de klachten je dagelijks leven?", type: "textarea" },
  ],
  alk: [
    { id: "main_symptoms", label: "Beschrijf al je klachten zo volledig mogelijk", type: "textarea" },
    { id: "symptom_duration", label: "Hoe lang heb je deze klachten al?", type: "text" },
    { id: "symptom_pattern", label: "Zijn de klachten constant of wisselend?", type: "select", options: ["Constant", "Wisselend", "In aanvallen", "Seizoensgebonden"] },
    { id: "lifestyle_changes", label: "Zijn er leefstijlveranderingen die de klachten beïnvloeden?", type: "textarea" },
    { id: "vitamin_d", label: "Is je vitamine D niveau ooit gemeten?", type: "select", options: ["Ja, was laag", "Ja, was normaal", "Nee, nooit gemeten"] },
  ],
};

const QUESTIONNAIRE_SECTIONS = [
  {
    id: "basic_info",
    title: "Basisinformatie",
    questions: [
      { id: "age", label: "Wat is je leeftijd?", type: "number" },
      { id: "gender", label: "Geslacht", type: "select", options: ["Man", "Vrouw", "Anders"] },
      { id: "main_complaint", label: "Wat is je voornaamste klacht?", type: "textarea" },
      { id: "duration", label: "Hoe lang heb je deze klacht al?", type: "text" },
    ],
  },
  {
    id: "sleep",
    title: "Slaap & Rust",
    questions: [
      { id: "sleep_hours", label: "Hoeveel uur slaap je gemiddeld per nacht?", type: "number" },
      { id: "sleep_quality", label: "Hoe zou je je slaapkwaliteit beoordelen? (1-10)", type: "number" },
      { id: "sleep_direction", label: "Welke kant ligt je hoofd als je slaapt?", type: "select", options: ["Oost", "West", "Noord", "Zuid", "Weet niet"] },
      { id: "sleep_issues", label: "Heb je slaapproblemen? Beschrijf deze.", type: "textarea" },
    ],
  },
  {
    id: "nutrition",
    title: "Voeding & Darmgezondheid",
    questions: [
      { id: "diet_type", label: "Wat is je voedingspatroon?", type: "select", options: ["Omnivoor", "Vegetarisch", "Veganistisch", "Keto", "Ander"] },
      { id: "water_intake", label: "Hoeveel water drink je per dag (in liters)?", type: "number" },
      { id: "water_quality", label: "Wat is de kwaliteit van je drinkwater?", type: "select", options: ["Kraanwater", "Gefilterd water", "Gedistilleerd water", "Mineraalwater", "Weet niet"] },
      { id: "digestion", label: "Hoe is je spijsvertering? (1-10)", type: "number" },
      { id: "gut_issues", label: "Heb je darmklachten? Beschrijf deze.", type: "textarea" },
      { id: "fermented_foods", label: "Eet je gefermenteerde voedingsmiddelen?", type: "select", options: ["Ja, regelmatig", "Soms", "Zelden", "Nooit"] },
    ],
  },
  {
    id: "lifestyle",
    title: "Leefstijl & Beweging",
    questions: [
      { id: "exercise", label: "Hoeveel uur sport/beweeg je per week?", type: "number" },
      { id: "exercise_type", label: "Wat voor beweging doe je?", type: "textarea" },
      { id: "stress_level", label: "Hoe zou je je stressniveau beoordelen? (1-10)", type: "number" },
      { id: "stress_sources", label: "Wat zijn je voornaamste stressbronnen?", type: "textarea" },
      { id: "grounding", label: "Hoe vaak ben je blootsgesteld aan aarde (blote voeten)?", type: "select", options: ["Dagelijks", "Meerdere keren per week", "Wekelijks", "Zelden", "Nooit"] },
    ],
  },
  {
    id: "environment",
    title: "Omgeving & Blootstelling",
    questions: [
      { id: "screen_time", label: "Hoeveel uur per dag ben je aan schermen blootgesteld?", type: "number" },
      { id: "blue_light_protection", label: "Gebruik je bescherming tegen blauw licht?", type: "select", options: ["Ja, altijd", "Soms", "Zelden", "Nooit"] },
      { id: "sunlight_exposure", label: "Hoeveel daglicht krijg je per dag?", type: "select", options: ["0-1 uur", "1-2 uur", "2-4 uur", "4+ uur"] },
      { id: "emf_exposure", label: "Hoe is je blootstelling aan EMF (WiFi, mobiel)?", type: "select", options: ["Hoog", "Gemiddeld", "Laag", "Weet niet"] },
    ],
  },
  {
    id: "emotional",
    title: "Emotioneel & Mentaal",
    questions: [
      { id: "mental_clarity", label: "Hoe is je mentale helderheid? (1-10)", type: "number" },
      { id: "emotional_balance", label: "Hoe is je emotionele balans? (1-10)", type: "number" },
      { id: "anxiety", label: "Heb je last van angst of onrust?", type: "select", options: ["Ja, veel", "Soms", "Zelden", "Nooit"] },
      { id: "depression", label: "Heb je last van depressie of lage stemming?", type: "select", options: ["Ja, veel", "Soms", "Zelden", "Nooit"] },
      { id: "spiritual_connection", label: "Hoe is je verbinding met jezelf/spiritualiteit?", type: "textarea" },
    ],
  },
  {
    id: "medical",
    title: "Medische Geschiedenis",
    questions: [
      { id: "medications", label: "Welke medicijnen neem je?", type: "textarea" },
      { id: "supplements", label: "Welke supplementen neem je?", type: "textarea" },
      { id: "allergies", label: "Heb je allergiën of intoleranties?", type: "textarea" },
      { id: "past_treatments", label: "Wat heb je al geprobeerd om beter te worden?", type: "textarea" },
    ],
  },
  {
    id: "goals",
    title: "Doelen & Verwachtingen",
    questions: [
      { id: "primary_goal", label: "Wat is je voornaamste doel?", type: "textarea" },
      { id: "expectations", label: "Wat verwacht je van dit programma?", type: "textarea" },
      { id: "commitment", label: "Hoe gemotiveerd ben je om veranderingen door te voeren? (1-10)", type: "number" },
    ],
  },
];

// Returns the IDs of unanswered questions in a section
function getMissingQuestions(
  section: typeof QUESTIONNAIRE_SECTIONS[0],
  responses: Record<string, any>
): string[] {
  return section.questions
    .filter((q) => {
      const val = responses[q.id];
      if (val === undefined || val === null) return true;
      if (typeof val === "string" && val.trim() === "") return true;
      return false;
    })
    .map((q) => q.label);
}

export default function AnamnesisQuestionnaire() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [currentSection, setCurrentSection] = useState(0);
  const [conditionType, setConditionType] = useState<string>("");
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Load saved draft from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.conditionType) setConditionType(draft.conditionType);
        if (draft.responses) setResponses(draft.responses);
        if (draft.currentSection !== undefined) setCurrentSection(draft.currentSection);
        toast.info("Je vorige antwoorden zijn hersteld.", { duration: 3000 });
      }
    } catch {}
    setDraftLoaded(true);
  }, []);

  // Save draft to localStorage whenever answers change
  useEffect(() => {
    if (!draftLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ conditionType, responses, currentSection }));
    } catch {}
  }, [conditionType, responses, currentSection, draftLoaded]);

  const submitAnamnesisMutation = trpc.anamnesis.submit.useMutation();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Laden...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Je moet ingelogd zijn</div>;
  }

  // Build dynamic sections: add condition-specific section after medical section
  const conditionExtraQuestions = conditionType ? (CONDITION_SPECIFIC_QUESTIONS[conditionType] || []) : [];
  const dynamicSections = conditionExtraQuestions.length > 0
    ? [
        ...QUESTIONNAIRE_SECTIONS.slice(0, -1), // all except last (goals)
        {
          id: "condition_specific",
          title: `Specifieke Vragen: ${CONDITION_TYPES.find(c => c.id === conditionType)?.label || conditionType}`,
          questions: conditionExtraQuestions,
        },
        QUESTIONNAIRE_SECTIONS[QUESTIONNAIRE_SECTIONS.length - 1], // goals last
      ]
    : QUESTIONNAIRE_SECTIONS;

  const progress = ((currentSection + 1) / dynamicSections.length) * 100;
  const currentSectionData = dynamicSections[currentSection];
  const missingInCurrentSection = getMissingQuestions(currentSectionData, responses);
  const isFirstSectionValid = conditionType !== "" && getMissingQuestions(QUESTIONNAIRE_SECTIONS[0], responses).length === 0;

  const handleResponseChange = (questionId: string, value: any) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleNext = () => {
    setShowErrors(true);

    // On step 1, also require a condition type
    if (currentSection === 0 && !conditionType) {
      toast.error("Selecteer alstublieft een ziektebeeld voordat je verder gaat");
      return;
    }

    if (missingInCurrentSection.length > 0) {
      toast.error(`Vul alle vragen in voordat je verder gaat`);
      return;
    }

    setShowErrors(false);
    if (currentSection < dynamicSections.length - 1) {
      setCurrentSection(currentSection + 1);
      window.scrollTo(0, 0);
    }
  };

  const handlePrevious = () => {
    setShowErrors(false);
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async () => {
    setShowErrors(true);

    if (!conditionType) {
      toast.error("Selecteer alstublieft een ziektebeeld op stap 1");
      setCurrentSection(0);
      window.scrollTo(0, 0);
      return;
    }

    if (missingInCurrentSection.length > 0) {
      toast.error("Vul alle vragen in voordat je het formulier verstuurt");
      return;
    }

    setIsSubmitting(true);
    try {
      // Clean responses: remove undefined/null values, convert numbers
      const cleanedResponses: Record<string, string | number | boolean> = {};
      for (const [key, value] of Object.entries(responses)) {
        if (value !== undefined && value !== null && value !== "") {
          cleanedResponses[key] = value;
        }
      }
      await submitAnamnesisMutation.mutateAsync({
        conditionType,
        responses: cleanedResponses,
      });
      // Clear the saved draft after successful submission
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      toast.success("Anamnese ingediend! Je rapport wordt gegenereerd...");
      // Redirect to preview page which will show the report
      setLocation("/rapport?preview=true");
    } catch (error: any) {
      console.error("Submit error:", error);
      const msg = error?.message || "";
      if (msg.includes("UNAUTHORIZED") || msg.includes("Please login") || msg.includes("10001")) {
        toast.error("Je sessie is verlopen. Log opnieuw in.");
        setTimeout(() => {
          window.location.href = "/";
        }, 2000);
      } else {
        toast.error(`Er is een fout opgetreden: ${msg || "Probeer het opnieuw"}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isQuestionMissing = (questionId: string) => {
    if (!showErrors) return false;
    const val = responses[questionId];
    if (val === undefined || val === null) return true;
    if (typeof val === "string" && val.trim() === "") return true;
    return false;
  };

  // Show loading overlay while report is being generated
  if (isSubmitting) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full mx-4 text-center">
          <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-6">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Je rapport wordt gegenereerd</h2>
          <p className="text-gray-600 mb-6">Onze AI analyseert je antwoorden en stelt een persoonlijk holistische rapport op. Dit duurt 15-30 seconden.</p>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span>Antwoorden worden geanalyseerd...</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <div className="w-2 h-2 rounded-full bg-indigo-300 animate-pulse" style={{animationDelay: '0.5s'}} />
              <span>Holistische patronen worden herkend...</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <div className="w-2 h-2 rounded-full bg-indigo-200 animate-pulse" style={{animationDelay: '1s'}} />
              <span>Persoonlijk rapport wordt opgesteld...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Holistische Anamnese</h1>
          <p className="text-gray-600">Stap {currentSection + 1} van {dynamicSections.length}</p>
          <Progress value={progress} className="mt-4" />
        </div>

        {/* Condition Selection */}
        {currentSection === 0 && (
          <Card className={`p-6 mb-6 ${showErrors && !conditionType ? "border-2 border-red-400" : ""}`}>
            <h2 className="text-xl font-semibold mb-1">Selecteer je ziektebeeld <span className="text-red-500">*</span></h2>
            {showErrors && !conditionType && (
              <p className="text-red-500 text-sm mb-3">Selecteer een ziektebeeld om verder te gaan</p>
            )}
            <div className="grid gap-3 mt-3">
              {CONDITION_TYPES.map((condition) => (
                <button
                  key={condition.id}
                  onClick={() => setConditionType(condition.id)}
                  className={`p-4 border-2 rounded-lg text-left transition ${
                    conditionType === condition.id
                      ? "border-indigo-600 bg-indigo-50"
                      : "border-gray-200 hover:border-indigo-300"
                  }`}
                >
                  <div className="font-semibold">{condition.label}</div>
                  <div className="text-sm text-gray-600">{condition.description}</div>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Questions */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-6">{currentSectionData.title}</h2>
          <div className="space-y-6">
            {currentSectionData.questions.map((question) => {
              const missing = isQuestionMissing(question.id);
              return (
                <div key={question.id}>
                  <label className={`block text-sm font-medium mb-2 ${missing ? "text-red-600" : "text-gray-700"}`}>
                    {question.label} <span className="text-red-500">*</span>
                  </label>
                  {question.type === "number" && (
                    <input
                      type="number"
                      value={responses[question.id] || ""}
                      onChange={(e) => handleResponseChange(question.id, e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        missing ? "border-red-400 bg-red-50" : "border-gray-300"
                      }`}
                    />
                  )}
                  {question.type === "text" && (
                    <input
                      type="text"
                      value={responses[question.id] || ""}
                      onChange={(e) => handleResponseChange(question.id, e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        missing ? "border-red-400 bg-red-50" : "border-gray-300"
                      }`}
                    />
                  )}
                  {question.type === "textarea" && (
                    <textarea
                      value={responses[question.id] || ""}
                      onChange={(e) => handleResponseChange(question.id, e.target.value)}
                      rows={3}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        missing ? "border-red-400 bg-red-50" : "border-gray-300"
                      }`}
                    />
                  )}
                  {question.type === "select" && (
                    <select
                      value={responses[question.id] || ""}
                      onChange={(e) => handleResponseChange(question.id, e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        missing ? "border-red-400 bg-red-50" : "border-gray-300"
                      }`}
                    >
                      <option value="">Selecteer...</option>
                      {question.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}
                  {missing && (
                    <p className="text-red-500 text-xs mt-1">Dit veld is verplicht</p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Navigation */}
        <div className="flex gap-4">
          <Button
            onClick={handlePrevious}
            disabled={currentSection === 0}
            variant="outline"
            className="flex-1"
          >
            Vorige
          </Button>
          {currentSection === dynamicSections.length - 1 ? (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            >
              {isSubmitting ? "Verzenden..." : "Verzenden & Rapport Genereren"}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            >
              Volgende
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
