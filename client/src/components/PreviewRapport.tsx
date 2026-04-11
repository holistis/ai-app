// FILE: client/src/components/PreviewRapport.tsx
// Gebouwd door Manus AI, verbeterd door Claude:
// - Premium donkere hero (ipv pastel)
// - Conditionele maand-inhoud op basis van conditionType
// - Betere mobile layout insight cards
// - Sterkere CTA sectie

import React, { useEffect, useState } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Legend,
} from "recharts";
import { Lightbulb, TrendingUp, Heart, Lock, Sparkles } from "lucide-react";

interface PreviewRapportProps {
  userName: string;
  conditionType: string;
  summary: string;
  keyInsights: string[];
  responses: Record<string, any>;
  onBuy: () => void;
}

const CONDITION_LABELS: Record<string, string> = {
  chronic_fatigue: "Chronische Vermoeidheid",
  digestive_issues: "Spijsverteringsproblemen",
  solk: "SOLK",
  auto_immuun: "Auto-Immuun Klachten",
  alk: "ALK — Aspecifieke Klachten",
};

// Conditionele maand-inhoud op basis van ziektebeeld
const MAAND_CONTENT: Record<string, { m1: string[]; m2: string[] }> = {
  chronic_fatigue: {
    m1: ["Eliminatiedieet starten (suiker, gluten)", "Slaap-waakritme instellen", "Magnesium + B-complex starten"],
    m2: ["Darmgezondheid herstellen", "Beweging opbouwen (15 min/dag)", "Circadiaans ritme optimaliseren"],
  },
  digestive_issues: {
    m1: ["4R Remove: gluten & zuivel elimineren", "Probiotica multi-strain starten", "Bewust eten (20x kauwen)"],
    m2: ["4R Reinoculate: kefir & zuurkool", "L-glutamine darmwandherstel", "Spijsverteringsenzymen toevoegen"],
  },
  solk: {
    m1: ["Lichaam-geest verbinding verkennen", "Graded activity starten (10 min)", "Ademhalingsoefeningen 4-7-8"],
    m2: ["Body scan meditatie dagelijks", "Journaling over lichaamssignalen", "Stress-trigger identificatie"],
  },
  auto_immuun: {
    m1: ["AIP eliminatiedieet starten", "Vitamine D3 + K2 suppletie", "Ontstekingsbronnen identificeren"],
    m2: ["Darmpermeabiliteit herstellen", "Omega-3 protocol opbouwen", "Histamine-triggers vermijden"],
  },
  alk: {
    m1: ["Pro-inflammatoire voeding elimineren", "Dagelijks 15 min wandelen", "Ergonomie werkplek aanpassen"],
    m2: ["Mediterraan dieet als basis", "Beweging uitbreiden naar 30 min", "Magnesium malaat starten"],
  },
};

const FALLBACK_MAAND = {
  m1: ["Voedingsaanpassingen invoeren", "Slaapschema optimaliseren", "Basis supplementen starten"],
  m2: ["Protocol verfijnen", "Bewegingsplan opbouwen", "Stressreductie verdiepen"],
};

export default function PreviewRapport({
  userName,
  conditionType,
  summary,
  keyInsights,
  responses,
  onBuy,
}: PreviewRapportProps) {
  const [radarAnimated, setRadarAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRadarAnimated(true), 300);
    return () => clearTimeout(t);
  }, []);

  // Bereken radarscores
  const radarData = [
    { name: "Slaap", value: Math.min(10, Math.max(1, parseFloat(responses.sleep_quality) || 5)) },
    { name: "Voeding", value: Math.min(10, Math.max(1, parseFloat(responses.digestion) || 5)) },
    { name: "Stressbalans", value: Math.min(10, Math.max(1, 10 - (parseFloat(responses.stress_level) || 5))) },
    { name: "Beweging", value: Math.min(10, Math.max(1, (parseFloat(responses.exercise) || 2) * 1.5)) },
    { name: "Mentaal", value: Math.min(10, Math.max(1, parseFloat(responses.mental_clarity) || 5)) },
    { name: "Energie", value: Math.min(10, Math.max(1, parseFloat(responses.emotional_balance) || 5)) },
  ];

  const conditionLabel = CONDITION_LABELS[conditionType] || "Gezondheidsanalyse";
  const maandContent = MAAND_CONTENT[conditionType] || FALLBACK_MAAND;
  const firstName = userName?.split(" ")[0] || userName || "jou";
  const today = new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });

  const insightConfig = [
    { Icon: Lightbulb, iconColor: "text-amber-500", borderColor: "border-l-amber-400", bg: "bg-amber-50" },
    { Icon: TrendingUp, iconColor: "text-indigo-500", borderColor: "border-l-indigo-400", bg: "bg-indigo-50" },
    { Icon: Heart, iconColor: "text-rose-500", borderColor: "border-l-rose-400", bg: "bg-rose-50" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── HERO ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 text-white shadow-2xl">
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/5 rounded-full" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-white/5 rounded-full" />
          <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-white/5 rounded-full" />

          <div className="relative px-8 py-10 md:px-12 md:py-14">
            <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5 text-xs font-bold mb-5">
              <Sparkles className="w-3 h-3" />
              {conditionLabel}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-2">
              Holistische Analyse<br />voor{" "}
              <span className="text-indigo-200">{firstName}</span>
            </h1>
            <p className="text-indigo-300 text-sm">Gegenereerd op {today}</p>
          </div>
        </div>

        {/* ── RADARDIAGRAM ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-10">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Jouw Gezondheidsprofiel</h2>
          <p className="text-sm text-gray-500 mb-6">Gebaseerd op jouw anamnese-antwoorden · Schaal 1–10</p>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis
                dataKey="name"
                tick={{ fill: "#555", fontSize: 12, fontWeight: 600 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 10]}
                tick={{ fill: "#aaa", fontSize: 10 }}
                tickCount={6}
              />
              <Radar
                name="Jouw score"
                dataKey="value"
                stroke="#4f46e5"
                fill="#4f46e5"
                fillOpacity={0.55}
                strokeWidth={2}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", color: "#666", paddingTop: "12px" }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* ── INZICHTEN ── */}
        {keyInsights.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-10">
            <h2 className="text-xl font-bold text-gray-900 mb-5">Eerste Inzichten</h2>
            <div className="space-y-3">
              {keyInsights.slice(0, 3).map((insight, idx) => {
                const { Icon, iconColor, borderColor, bg } = insightConfig[idx] || insightConfig[0];
                return (
                  <div
                    key={idx}
                    className={`border-l-4 ${borderColor} ${bg} rounded-r-2xl p-5`}
                  >
                    <div className="flex gap-3">
                      <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconColor}`} />
                      <p className="text-gray-700 text-sm leading-relaxed">{insight}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SAMENVATTING ── */}
        {summary && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Samenvatting</h2>
            <p className="text-gray-600 leading-relaxed italic text-sm bg-slate-50 rounded-2xl p-5 border border-slate-100">
              {summary}
            </p>
          </div>
        )}

        {/* ── 6-MAANDEN PLAN (gedeeltelijk geblokkeerd) ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 md:p-10">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Jouw 6-Maanden Herstelplan</h2>
            <p className="text-sm text-gray-500 mb-6">
              Maand 1 en 2 zijn direct beschikbaar. Ontgrendel de rest met het volledige rapport.
            </p>

            {/* Zichtbare maanden */}
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100">
                <div className="text-xs font-bold text-indigo-600 mb-1">MAAND 1</div>
                <div className="font-semibold text-gray-800 text-sm mb-3">Fundament leggen</div>
                <ul className="space-y-1.5">
                  {maandContent.m1.map((item, i) => (
                    <li key={i} className="text-xs text-gray-600 flex gap-2">
                      <span className="text-indigo-400 mt-0.5">•</span> {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
                <div className="text-xs font-bold text-emerald-600 mb-1">MAAND 2</div>
                <div className="font-semibold text-gray-800 text-sm mb-3">Darmherstel & Opbouw</div>
                <ul className="space-y-1.5">
                  {maandContent.m2.map((item, i) => (
                    <li key={i} className="text-xs text-gray-600 flex gap-2">
                      <span className="text-emerald-400 mt-0.5">•</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Geblokkeerde maanden */}
            <div className="relative">
              <div className="grid sm:grid-cols-2 gap-4 blur-sm pointer-events-none select-none opacity-50">
                {[
                  { label: "MAAND 3", color: "violet", title: "Diepgaand herstel" },
                  { label: "MAAND 4", color: "orange", title: "Energie optimalisatie" },
                  { label: "MAAND 5", color: "rose", title: "Stabilisatie" },
                  { label: "MAAND 6", color: "blue", title: "Langetermijn plan" },
                ].map((m) => (
                  <div key={m.label} className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                    <div className="text-xs font-bold text-gray-400 mb-1">{m.label}</div>
                    <div className="font-semibold text-gray-500 text-sm mb-3">{m.title}</div>
                    <ul className="space-y-1.5">
                      {["Protocol", "Aanpak", "Resultaat"].map((x, i) => (
                        <li key={i} className="text-xs text-gray-400">• {x}...</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-md text-sm font-semibold text-gray-600">
                  <Lock className="w-4 h-4 text-gray-400" />
                  Ontgrendelen in volledig rapport
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 px-8 py-10 text-center text-white">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-3 py-1 text-xs font-semibold mb-4">
                <Sparkles className="w-3 h-3" /> Volledig herstelplan
              </div>
              <h3 className="text-2xl font-bold mb-2">Ontgrendel maand 3 t/m 6</h3>
              <p className="text-indigo-200 text-sm mb-6 max-w-sm mx-auto leading-relaxed">
                Week-voor-week instructies, persoonlijke supplementen-protocollen,
                voedingsschema's en wetenschappelijke onderbouwing.
              </p>
              <button
                onClick={onBuy}
                className="inline-flex items-center gap-2 bg-white text-indigo-700 font-bold px-8 py-3.5 rounded-xl hover:bg-indigo-50 transition-all shadow-lg text-sm"
              >
                <Sparkles className="w-4 h-4" />
                Ontgrendel Volledig Rapport — €34,95
              </button>
              <p className="text-indigo-300 text-xs mt-3">
                Eenmalige betaling · Direct toegang · PDF inbegrepen
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
