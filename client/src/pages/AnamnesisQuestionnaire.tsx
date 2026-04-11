// FILE: client/src/pages/AnamnesisQuestionnaire.tsx

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
  { id: "digestive_issues", label: "Spijsverterings­problemen", description: "Maag- en darmklachten" },
  { id: "solk", label: "SOLK", description: "Somatisch Onverklaarbare Lichamelijke Klachten" },
  { id: "auto_immuun", label: "Auto-Immuun Klachten", description: "Immuunsysteem gerelateerde klachten" },
  { id: "alk", label: "ALK", description: "Aspecifieke Lichamelijke Klachten" },
];

const CONDITION_SPECIFIC_QUESTIONS: Record<string, Array<{id: string; label: string; type: string; options?: string[]}>> = {
  chronic_fatigue: [
    { id: "fatigue_onset", label: "Wanneer begon de vermoeidheid? Was er een aanleiding zoals een infectie, stress of trauma?", type: "textarea" },
    { id: "post_exertional_malaise", label: "Wordt je vermoeidheid erger na lichamelijke of mentale inspanning (Post-Exertional Malaise)?", type: "select", options: ["Ja, altijd", "Soms", "Zelden", "Nee"] },
    { id: "brain_fog", label: "Heb je last van hersenmist — moeite met concentreren of geheugen?", type: "select", options: ["Ja, ernstig", "Ja, matig", "Soms", "Nee"] },
    { id: "sleep_restful", label: "Voel je je uitgerust na 8 of meer uur slaap?", type: "select", options: ["Nooit", "Zelden", "Soms", "Meestal wel"] },
    { id: "temperature_regulation", label: "Heb je problemen met temperatuurregulatie (koude handen/voeten of overmatig zweten)?", type: "select", options: ["Ja, altijd", "Soms", "Zelden", "Nee"] },
    { id: "orthostatic_intolerance", label: "Word je duizelig als je snel opstaat (orthostatische intolerantie)?", type: "select", options: ["Ja, altijd", "Soms", "Zelden", "Nee"] },
    { id: "viral_history", label: "Heb je een geschiedenis van virale infecties zoals EBV, CMV, COVID of de ziekte van Lyme?", type: "select", options: ["Ja, bevestigd", "Mogelijk", "Nee", "Weet niet"] },
    { id: "mold_exposure", label: "Ben je ooit blootgesteld geweest aan schimmel in huis of op het werk?", type: "select", options: ["Ja, zeker", "Mogelijk", "Nee", "Weet niet"] },
  ],
  digestive_issues: [
    { id: "main_symptoms", label: "Wat zijn je voornaamste spijsverteringsklachten?", type: "textarea" },
    { id: "bowel_pattern", label: "Hoe is je ontlasting?", type: "select", options: ["Hard en moeilijk", "Normaal", "Zacht en los", "Diarree", "Wisselend tussen diarree en verstopping"] },
    { id: "bloating", label: "Heb je last van een opgeblazen gevoel?", type: "select", options: ["Ja, altijd", "Na maaltijden", "Soms", "Nee"] },
    { id: "food_triggers", label: "Welke voedingsmiddelen veroorzaken klachten bij jou?", type: "textarea" },
    { id: "antibiotic_history", label: "Heb je in het verleden meerdere kuren antibiotica gebruikt?", type: "select", options: ["Ja, meerdere kuren", "Ja, één keer", "Nee", "Weet niet"] },
    { id: "fermented_intake", label: "Eet of drink je gefermenteerde producten zoals kefir, zuurkool of kimchi?", type: "select", options: ["Ja, dagelijks", "Soms", "Zelden", "Nooit"] },
    { id: "stress_gut_relation", label: "Merk je dat stress je darmklachten verergert?", type: "select", options: ["Ja, duidelijk verband", "Soms", "Geen verband", "Weet niet"] },
    { id: "abdominal_pain", label: "Heb je buikpijn? Beschrijf waar en wanneer.", type: "textarea" },
  ],
  solk: [
    { id: "symptom_locations", label: "Waar in je lichaam voel je klachten? Beschrijf alle locaties.", type: "textarea" },
    { id: "symptom_intensity", label: "Hoe ernstig zijn de klachten gemiddeld? (1 = licht, 10 = ondraaglijk)", type: "number" },
    { id: "medical_tests_done", label: "Welke medische onderzoeken heb je al gehad?", type: "textarea" },
    { id: "stress_symptoms_relation", label: "Worden je klachten erger bij stress of angst?", type: "select", options: ["Ja, duidelijk", "Soms", "Nee", "Weet niet"] },
    { id: "anxiety_panic", label: "Heb je last van angst of paniekaanvallen?", type: "select", options: ["Ja, regelmatig", "Soms", "Zelden", "Nooit"] },
    { id: "sleep_disturbances", label: "Heb je slaapproblemen gerelateerd aan je klachten?", type: "select", options: ["Ja, ernstig", "Matig", "Licht", "Nee"] },
    { id: "trauma_history", label: "Heb je ingrijpende ervaringen meegemaakt die mogelijk verband houden met je klachten?", type: "select", options: ["Ja, wil ik toelichten", "Mogelijk", "Nee"] },
    { id: "trauma_details", label: "Als je wilt, beschrijf dan kort wat er is gebeurd (optioneel)", type: "textarea" },
    { id: "relaxation_improves", label: "Verbeteren je klachten bij ontspanning of vermindering van stress?", type: "select", options: ["Ja, duidelijk", "Soms", "Geen effect", "Weet niet"] },
  ],
  auto_immuun: [
    { id: "autoimmune_condition", label: "Welke auto-immuunaandoening heb je of vermoed je?", type: "textarea" },
    { id: "histamine_symptoms", label: "Heb je last van hoofdpijn, huiduitslag, hartkloppingen of angst na bepaalde voeding?", type: "select", options: ["Ja, regelmatig", "Soms", "Zelden", "Nee"] },
    { id: "joint_muscle_pain", label: "Heb je gewrichts- of spierpijn?", type: "select", options: ["Ja, ernstig", "Matig", "Licht", "Nee"] },
    { id: "skin_problems", label: "Heb je huidproblemen zoals eczeem, psoriasis of uitslag?", type: "select", options: ["Ja, ernstig", "Matig", "Licht", "Nee"] },
    { id: "food_triggers_autoimmune", label: "Welke voedingsmiddelen triggeren je klachten?", type: "textarea" },
    { id: "vitamin_d_tested", label: "Is je vitamine D niveau ooit gemeten?", type: "select", options: ["Ja, was te laag", "Ja, was normaal", "Ja, was te hoog", "Nooit gemeten"] },
    { id: "inflammation_markers", label: "Zijn er ontstekingswaarden gemeten in je bloed (CRP, BSE)?", type: "select", options: ["Ja, verhoogd", "Ja, normaal", "Nooit gemeten"] },
    { id: "mold_chemical_exposure", label: "Ben je blootgesteld aan schimmel of chemicaliën?", type: "select", options: ["Ja, zeker", "Mogelijk", "Nee", "Weet niet"] },
  ],
  alk: [
    { id: "main_symptoms_alk", label: "Beschrijf al je klachten zo volledig mogelijk", type: "textarea" },
    { id: "symptom_duration_alk", label: "Hoe lang heb je deze klachten al?", type: "text" },
    { id: "symptom_pattern_alk", label: "Zijn de klachten constant of wisselend?", type: "select", options: ["Constant", "Wisselend", "In aanvallen", "Seizoensgebonden"] },
    { id: "lifestyle_impact", label: "Hoe beïnvloeden de klachten je dagelijks leven?", type: "textarea" },
    { id: "vitamin_d_alk", label: "Is je vitamine D niveau ooit gemeten?", type: "select", options: ["Ja, was laag", "Ja, was normaal", "Nooit gemeten"] },
    { id: "previous_treatments_alk", label: "Wat heb je al geprobeerd om beter te worden?", type: "textarea" },
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

  const conditionExtraQuestions = conditionType ? (CONDITION_SPECIFIC_QUESTIONS[conditionType] || []) : [];
  const dynamicSections = conditionExtraQuestions.length > 0
    ? [
        ...QUESTIONNAIRE_SECTIONS.slice(0, -1),
        {
          id: "condition_specific",
          title: `Specifieke Vragen: ${CONDITION_TYPES.find(c => c.id === conditionType)?.label || conditionType}`,
          questions: conditionExtraQuestions,
        },
        QUESTIONNAIRE_SECTIONS[QUESTIONNAIRE_SECTIONS.length - 1],
      ]
    : QUESTIONNAIRE_SECTIONS;

  const progress = ((currentSection + 1) / dynamicSections.length) * 100;
  const currentSectionData = dynamicSections[currentSection];
  const missingInCurrentSection = getMissingQuestions(currentSectionData, responses);

  const handleResponseChange = (questionId: string, value: any) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    setShowErrors(true);

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
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      toast.success("Anamnese ingediend! Je rapport wordt gegenereerd...");
      setLocation("/rapport");
    } catch (error: any) {
      console.error("Submit error:", error);
      const msg = error?.message || "";
      if (msg.includes("UNAUTHORIZED") || msg.includes("Please login") || msg.includes("10001")) {
        toast.error("Je sessie is verlopen. Log opnieuw in.");
        setTimeout(() => { window.location.href = "/"; }, 2000);
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Holistische Anamnese</h1>
          <p className="text-gray-600">Stap {currentSection + 1} van {dynamicSections.length}</p>
          <Progress value={progress} className="mt-4" />
        </div>

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
                        <option key={opt} value={opt}>{opt}</option>
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
