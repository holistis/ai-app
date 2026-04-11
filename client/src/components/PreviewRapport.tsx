import React from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend } from "recharts";
import { Lock, Zap, Heart, Brain, Leaf, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface PreviewRapportProps {
  userName: string;
  conditionType: string;
  summary: string;
  keyInsights: string[];
  responses: Record<string, any>;
  onViewFullReport: () => void;
}

const CONDITION_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  chronic_fatigue: { bg: "from-amber-50 to-orange-50", text: "text-amber-700", badge: "bg-amber-100 text-amber-800" },
  digestive_issues: { bg: "from-green-50 to-emerald-50", text: "text-green-700", badge: "bg-green-100 text-green-800" },
  solk: { bg: "from-purple-50 to-pink-50", text: "text-purple-700", badge: "bg-purple-100 text-purple-800" },
  auto_immuun: { bg: "from-red-50 to-rose-50", text: "text-red-700", badge: "bg-red-100 text-red-800" },
  alk: { bg: "from-blue-50 to-cyan-50", text: "text-blue-700", badge: "bg-blue-100 text-blue-800" },
};

const CONDITION_LABELS: Record<string, string> = {
  chronic_fatigue: "Chronische Vermoeidheid",
  digestive_issues: "Spijsverterings­problemen",
  solk: "SOLK",
  auto_immuun: "Auto-Immuun Klachten",
  alk: "ALK — Aspecifieke Klachten",
};

const INSIGHT_ICONS = [
  { icon: Zap, color: "text-amber-500" },
  { icon: Heart, color: "text-rose-500" },
  { icon: Brain, color: "text-indigo-500" },
];

export default function PreviewRapport({
  userName,
  conditionType,
  summary,
  keyInsights,
  responses,
  onViewFullReport,
}: PreviewRapportProps) {
  // Prepare radar data
  const radarData = [
    { name: "Slaap", value: responses.sleep_quality || 5 },
    { name: "Voeding", value: responses.digestion || 5 },
    { name: "Stress", value: Math.max(0, 10 - (responses.stress_level || 5)) }, // Inverted
    { name: "Beweging", value: Math.min(10, (responses.exercise || 0) * 2) },
    { name: "Mentaal", value: responses.mental_clarity || 5 },
    { name: "Emotioneel", value: responses.emotional_balance || 5 },
  ];

  const colors = CONDITION_COLORS[conditionType] || CONDITION_COLORS.chronic_fatigue;
  const conditionLabel = CONDITION_LABELS[conditionType] || "Gezondheidsanalyse";

  return (
    <div className={`min-h-screen bg-gradient-to-br ${colors.bg} py-8 px-4`}>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* HERO SECTION */}
        <div className="text-center space-y-4">
          <div className={`inline-block px-4 py-2 rounded-full font-semibold text-sm ${colors.badge}`}>
            {conditionLabel}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
            Jouw Holistische Gezondheidsanalyse,{" "}
            <span className="text-indigo-600">{userName}</span>
          </h1>
          <p className="text-gray-600 text-lg">
            Gegenereerd op {new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        {/* RADAR CHART SECTION */}
        <Card className="bg-white shadow-xl border-0 p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">Jouw Gezondheidsprofiel</h2>
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={radarData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="name" tick={{ fill: "#666", fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: "#999", fontSize: 11 }} />
              <Radar
                name="Gezondheid"
                dataKey="value"
                stroke="#4f46e5"
                fill="#4f46e5"
                fillOpacity={0.6}
              />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
          <p className="text-center text-sm text-gray-600 mt-4">
            Schaal 1-10: Hoe hoger, hoe beter. Stress is omgekeerd: laag is beter.
          </p>
        </Card>

        {/* INSIGHTS CARDS */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Eerste Inzichten</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {keyInsights.slice(0, 3).map((insight, idx) => {
              const IconComponent = INSIGHT_ICONS[idx]?.icon || Zap;
              const iconColor = INSIGHT_ICONS[idx]?.color || "text-indigo-500";
              return (
                <Card
                  key={idx}
                  className="bg-white border-l-4 border-indigo-500 shadow-md hover:shadow-lg transition-shadow p-6"
                >
                  <div className="flex gap-4">
                    <IconComponent className={`w-6 h-6 flex-shrink-0 ${iconColor}`} />
                    <div>
                      <h3 className="font-bold text-gray-900 mb-2">Inzicht {idx + 1}</h3>
                      <p className="text-sm text-gray-700 leading-relaxed">{insight}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* SUMMARY SECTION */}
        {summary && (
          <Card className="bg-white shadow-lg border-0 p-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Samenvatting</h2>
            <div className="prose prose-indigo max-w-none">
              <p className="text-gray-700 leading-relaxed italic">{summary}</p>
            </div>
          </Card>
        )}

        {/* LOCKED SECTION */}
        <div className="relative">
          <Card className="bg-gradient-to-br from-gray-100 to-gray-50 shadow-xl border-0 p-8 overflow-hidden">
            {/* Blurred background content */}
            <div className="blur-sm opacity-40 pointer-events-none">
              <h3 className="text-xl font-bold mb-4 text-gray-900">Jouw 6-Maanden Herstelplan</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg">
                  <p className="font-semibold text-gray-900">Maand 1-2: Stabilisatie</p>
                  <p className="text-sm text-gray-600 mt-2">Fundamenten leggen...</p>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <p className="font-semibold text-gray-900">Maand 3-4: Herstel</p>
                  <p className="text-sm text-gray-600 mt-2">Dieper genezen...</p>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <p className="font-semibold text-gray-900">Maand 5-6: Optimalisatie</p>
                  <p className="text-sm text-gray-600 mt-2">Piek bereiken...</p>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <p className="font-semibold text-gray-900">Protocollen</p>
                  <p className="text-sm text-gray-600 mt-2">Week-voor-week instructies...</p>
                </div>
              </div>
            </div>

            {/* Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-lg">
              <Lock className="w-12 h-12 text-indigo-600 mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2 text-center">
                Jouw volledige 6-maanden herstelplan
              </h3>
              <p className="text-gray-600 text-center mb-6 max-w-sm">
                Inclusief week-voor-week instructies, supplementen en protocollen speciaal voor jouw situatie
              </p>
              <Button
                onClick={onViewFullReport}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg"
              >
                Bekijk Volledig Rapport
              </Button>
            </div>
          </Card>
        </div>

        {/* Footer CTA */}
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            Dit is slechts het begin. Het volledige rapport bevat alles wat je nodig hebt om te genezen.
          </p>
          <Button
            onClick={onViewFullReport}
            size="lg"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
          >
            Ontgrendel Volledig Rapport
          </Button>
        </div>
      </div>
    </div>
  );
}
