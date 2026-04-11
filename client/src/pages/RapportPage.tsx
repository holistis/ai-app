import PreviewRapport from "@/components/PreviewRapport";
// FILE: client/src/pages/RapportPage.tsx
// VERBETERD: visuele hiërarchie, gezondheidsscores, premium preview lock,
// insight-cards, 6-maanden tijdlijn preview, strak design

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  Loader2, ArrowLeft, Lightbulb, CheckCircle,
  BookOpen, FlaskConical, RefreshCw, Download,
  Utensils, Pill, Activity, Brain, Lock, Sparkles,
  TrendingUp, Heart, Moon, Wind, Sun, Zap
} from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

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

function isCorruptedContent(content: string): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  return (
    trimmed.startsWith('{') ||
    trimmed.includes('"],["') ||
    trimmed.includes('"keyInsights"')
  );
}

function normalizeReport(report: any) {
  if (!report) return null;
  let content = typeof report.content === "string" ? report.content : "";
  let summary = typeof report.summary === "string" ? report.summary : "";
  let keyInsights = parseJsonField(report.keyInsights);
  let recommendations = parseJsonField(report.recommendations);
  let protocols = parseProtocolsField(report.protocols);
  let scientificReferences = parseJsonField(report.scientificReferences);

  if (content.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(content);
      content = parsed.content || "";
      if (!summary) summary = parsed.summary || "";
      if (!keyInsights.length) keyInsights = parseJsonField(parsed.keyInsights);
    } catch { /* use original */ }
  }

  return {
    ...report,
    content,
    summary,
    keyInsights,
    recommendations,
    protocols,
    scientificReferences,
    isCorrupted: isCorruptedContent(content),
  };
}

// Bereken gezondheidsscores op basis van anamnese-antwoorden
function deriveScores(report: any): Record<string, number> {
  // Probeer responses uit rapport te halen als die beschikbaar zijn
  // Anders gebruik placeholders op basis van wat de AI heeft geanalyseerd
  const defaults: Record<string, number> = {
    slaap: 5,
    voeding: 5,
    stress: 5,
    beweging: 5,
    mentaal: 5,
    energie: 5,
  };

  // Als responses beschikbaar zijn via het rapport, gebruik ze
  const r = report?.anamnesisResponses || {};
  return {
    slaap: parseInt(r.sleep_quality) || defaults.slaap,
    voeding: parseInt(r.digestion) || defaults.voeding,
    stress: Math.max(1, 10 - (parseInt(r.stress_level) || 5)),
    beweging: Math.min(10, (parseInt(r.exercise) || 2) * 1.5),
    mentaal: parseInt(r.mental_clarity) || defaults.mentaal,
    energie: parseInt(r.emotional_balance) || defaults.energie,
  };
}

const CONDITION_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  chronic_fatigue: { label: "Chronische Vermoeidheid", color: "text-amber-700", bg: "bg-amber-100" },
  digestive_issues: { label: "Spijsverteringsproblemen", color: "text-emerald-700", bg: "bg-emerald-100" },
  solk: { label: "SOLK", color: "text-violet-700", bg: "bg-violet-100" },
  auto_immuun: { label: "Auto-Immuun Klachten", color: "text-rose-700", bg: "bg-rose-100" },
  alk: { label: "ALK — Aspecifieke Klachten", color: "text-blue-700", bg: "bg-blue-100" },
};

const PROTOCOL_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  nutrition: { label: "Voedingsprotocol", icon: Utensils, color: "text-emerald-600", bg: "bg-emerald-50" },
  supplements: { label: "Supplementen", icon: Pill, color: "text-blue-600", bg: "bg-blue-50" },
  lifestyle: { label: "Leefstijl", icon: Activity, color: "text-orange-600", bg: "bg-orange-50" },
  mentalPractices: { label: "Mentale Praktijken", icon: Brain, color: "text-violet-600", bg: "bg-violet-50" },
};

const SCORE_CONFIG = [
  { key: "slaap", label: "Slaap", icon: Moon, color: "bg-indigo-500" },
  { key: "voeding", label: "Voeding", icon: Utensils, color: "bg-emerald-500" },
  { key: "stress", label: "Stressbalans", icon: Wind, color: "bg-sky-500" },
  { key: "beweging", label: "Beweging", icon: Activity, color: "bg-orange-500" },
  { key: "mentaal", label: "Mentaal", icon: Brain, color: "bg-violet-500" },
  { key: "energie", label: "Energie", icon: Zap, color: "bg-amber-500" },
];

const MAANDEN_PREVIEW = [
  { n: 1, focus: "Fundament leggen", items: ["Eliminatiedieet starten", "Slaap optimaliseren", "Basis supplementen"], unlocked: true },
  { n: 2, focus: "Darmherstel", items: ["Microbioom opbouwen", "Voedingstriggers identificeren", "Beweging opbouwen"], unlocked: true },
  { n: 3, focus: "Energie & Herstel", items: ["Protocol aanpassen op resultaten", "Adaptogenen introduceren", "Stressprotocol"], unlocked: false },
  { n: 4, focus: "Diepgaand herstel", items: ["Gevorderde protocollen", "Leefstijloptimalisatie", "Mentale technieken"], unlocked: false },
  { n: 5, focus: "Stabilisatie", items: ["Consolidatie van winst", "Onderhoudsfase", "Preventie"], unlocked: false },
  { n: 6, focus: "Langetermijn plan", items: ["Volledig herstelplan", "Follow-up protocollen", "Zelfmanagement"], unlocked: false },
];

// ─── SCORE BAR ────────────────────────────────────────────────────────────────

function ScoreBar({ label, score, icon: Icon, color }: { label: string; score: number; icon: any; color: string }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth((score / 10) * 100), 200);
    return () => clearTimeout(timer);
  }, [score]);

  const getScoreColor = (s: number) => s >= 7 ? "text-emerald-600" : s >= 4 ? "text-amber-600" : "text-red-500";

  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className={`text-sm font-bold ${getScoreColor(score)}`}>{score}/10</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${color} transition-all duration-1000 ease-out`}
            style={{ width: `${width}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── INSIGHT CARD ─────────────────────────────────────────────────────────────

function InsightCard({ insight, index }: { insight: string; index: number }) {
  const icons = [Lightbulb, TrendingUp, Heart, Sparkles];
  const colors = [
    "border-l-amber-400 bg-amber-50",
    "border-l-indigo-400 bg-indigo-50",
    "border-l-rose-400 bg-rose-50",
    "border-l-emerald-400 bg-emerald-50",
  ];
  const iconColors = ["text-amber-500", "text-indigo-500", "text-rose-500", "text-emerald-500"];
  const Icon = icons[index % icons.length];

  return (
    <div className={`border-l-4 rounded-r-xl p-5 ${colors[index % colors.length]}`}>
      <div className="flex gap-3">
        <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconColors[index % iconColors.length]}`} />
        <p className="text-gray-700 leading-relaxed text-sm">{insight}</p>
      </div>
    </div>
  );
}

// ─── MAANDEN TIJDLIJN PREVIEW ─────────────────────────────────────────────────

function MaandenPreview({ isFullReport, onBuy }: { isFullReport: boolean; onBuy: () => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {MAANDEN_PREVIEW.map((m) => {
          const isLocked = !isFullReport && !m.unlocked;
          return (
            <div
              key={m.n}
              className={`relative rounded-2xl border-2 p-4 transition-all ${
                isLocked
                  ? "border-gray-100 bg-gray-50 opacity-70"
                  : "border-indigo-100 bg-white shadow-sm"
              }`}
            >
              {isLocked && (
                <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
                  <Lock className="w-5 h-5 text-gray-400" />
                </div>
              )}
              <div className={`text-xs font-bold mb-1 ${isLocked ? "text-gray-400" : "text-indigo-600"}`}>
                MAAND {m.n}
              </div>
              <div className={`text-sm font-semibold mb-2 ${isLocked ? "text-gray-400" : "text-gray-800"}`}>
                {m.focus}
              </div>
              <ul className="space-y-1">
                {m.items.map((item, i) => (
                  <li key={i} className={`text-xs ${isLocked ? "text-gray-300" : "text-gray-500"}`}>
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {!isFullReport && (
        <div className="mt-6 relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 p-8 text-center text-white shadow-xl">
          {/* Decoratief */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-8 -translate-x-8" />

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
              Koop Volledig Rapport — €34,95
            </button>
            <p className="text-indigo-300 text-xs mt-3">
              Eenmalige betaling · Direct toegang · PDF inbegrepen
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FULL RAPPORT DETAILS ─────────────────────────────────────────────────────

function FullReportDetails({ report }: { report: any }) {
  return (
    <div className="space-y-10 border-t border-gray-100 pt-10">
      {report.protocols && (
        <section>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <FlaskConical className="text-violet-500 w-5 h-5" /> Jouw Protocollen
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries(report.protocols).map(([key, items]: any) => {
              const cfg = PROTOCOL_CONFIG[key];
              if (!cfg || !Array.isArray(items)) return null;
              const Icon = cfg.icon;
              return (
                <div key={key} className={`p-5 rounded-2xl border border-gray-100 ${cfg.bg}`}>
                  <h4 className={`font-bold flex items-center gap-2 mb-4 ${cfg.color}`}>
                    <Icon className="w-4 h-4" /> {cfg.label}
                  </h4>
                  <ul className="space-y-3">
                    {items.map((item: string, idx: number) => (
                      <li key={idx} className="flex gap-3 text-sm text-gray-700">
                        <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.color.replace("text-", "bg-")}`} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {report.scientificReferences?.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <BookOpen className="text-blue-500 w-5 h-5" /> Wetenschappelijke Referenties
          </h2>
          <div className="bg-blue-50 rounded-2xl p-5 space-y-2">
            {report.scientificReferences.map((ref: string, i: number) => (
              <p key={i} className="text-xs text-gray-500 leading-relaxed">
                <span className="font-bold text-blue-600 mr-2">[{i + 1}]</span>{ref}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── LOADING / ERROR SCHERMEN ─────────────────────────────────────────────────

function StatusStep({ label, delay }: { label: string; delay: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-gray-500">
      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" style={{ animationDelay: delay }} />
      <span>{label}</span>
    </div>
  );
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="text-center">
        <Loader2 className="animate-spin w-8 h-8 text-indigo-600 mx-auto mb-4" />
        <p className="text-gray-500">{message}</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message, onAction, actionLabel }: { message: string; onAction: () => void; actionLabel: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <Card className="p-8 text-center max-w-sm w-full">
        <p className="text-gray-600 mb-6">{message}</p>
        <Button onClick={onAction} className="w-full">{actionLabel}</Button>
      </Card>
    </div>
  );
}

// ─── HOOFD COMPONENT ──────────────────────────────────────────────────────────

export default function RapportPage() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const utils = trpc.useUtils();

  const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const reportIdFromUrl = urlParams.get("id") ? parseInt(urlParams.get("id")!) : null;
  const isAdminView = !!reportIdFromUrl && user?.role === "admin";

  const reportsQuery = trpc.anamnesis.getReports.useQuery(undefined, {
    enabled: !!user && !isAdminView,
    refetchInterval: (query) => {
      const data = query.state.data as any[];
      const report = data?.[0];
      const needsData = !report || isCorruptedContent(report.content);
      return isRegenerating || needsData ? 3000 : false;
    },
  });

  const adminReportQuery = trpc.reports.getReportAdmin.useQuery(
    { reportId: reportIdFromUrl! },
    { enabled: isAdminView }
  );

  const createCheckoutMutation = trpc.payments.createCheckout.useMutation();
  const regenerateMutation = trpc.anamnesis.regenerateLatestReport.useMutation({
    onSuccess: () => {
      toast.success("Generatie gestart...");
      utils.anamnesis.getReports.invalidate();
    },
    onError: (err) => {
      setIsRegenerating(false);
      toast.error(err.message || "Fout bij genereren");
    },
  });

  useEffect(() => {
    const report = reportsQuery.data?.[0];
    if (report && !isCorruptedContent(report.content) && isRegenerating) {
      setIsRegenerating(false);
    }
  }, [reportsQuery.data, isRegenerating]);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try { await regenerateMutation.mutateAsync(); } catch (e) { console.error(e); }
  };

  const handleDownloadPdf = () => {
    const id = isAdminView ? adminReportQuery.data?.id : reportsQuery.data?.[0]?.id;
    if (!id) return toast.error("Geen rapport ID gevonden");
    window.open(`/api/pdf/${id}`, "_blank");
  };

  const handleBuyFullReport = async () => {
    const report = reportsQuery.data?.[0];
    if (!report) return;
    try {
      const result = await createCheckoutMutation.mutateAsync({
        reportId: report.id,
        paymentType: "full_report",
      });
      if (result.checkoutUrl) window.open(result.checkoutUrl, "_blank");
    } catch {
      toast.error("Betaalfout");
    }
  };

  // ── RENDER GUARDS ──
  if (authLoading) return <LoadingScreen message="Laden..." />;
  if (!user) return <ErrorScreen message="Log in om je rapport te zien." onAction={() => setLocation("/")} actionLabel="Terug naar Home" />;

  const currentData = isAdminView ? adminReportQuery.data : reportsQuery.data?.[0];
  const report = normalizeReport(currentData);
  const isLoading = isAdminView ? adminReportQuery.isLoading : reportsQuery.isLoading && !report;

  if (isLoading || isRegenerating || (report?.isCorrupted && !isAdminView)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="p-10 max-w-md w-full text-center shadow-xl">
          <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-6">
            <Loader2 className="animate-spin w-8 h-8 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Rapport wordt voorbereid</h2>
          <p className="text-gray-500 mb-6 text-sm leading-relaxed">
            Onze AI analyseert je data. Dit duurt 15–45 seconden. Blijf op deze pagina.
          </p>
          <div className="space-y-3 text-left">
            <StatusStep label="Antwoorden analyseren..." delay="0s" />
            <StatusStep label="Patronen herkennen..." delay="0.5s" />
            <StatusStep label="Protocollen samenstellen..." delay="1s" />
          </div>
        </Card>
      </div>
    );
  }

  if (!report) return <ErrorScreen message="Geen rapport gevonden." onAction={handleRegenerate} actionLabel="Genereer rapport" />;

  const isFullReport = report.isPaid || isAdminView;
  const scores = deriveScores(report);
  const conditionInfo = CONDITION_LABELS[report.conditionType] || { label: report.conditionType, color: "text-indigo-700", bg: "bg-indigo-100" };
  const firstName = user.name?.split(" ")[0] || "jou";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-6 px-4">
      <div className="max-w-3xl mx-auto space-y-5">

        {/* ── NAVIGATIE ── */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setLocation(isAdminView ? "/admin" : "/")}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Terug
          </button>
          {isAdminView && (
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
              ADMIN VIEW #{report.id}
            </span>
          )}
        </div>

        {/* ── HERO CARD ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 text-white shadow-2xl">
          {/* Decoratieve cirkels */}
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/5 rounded-full" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-white/5 rounded-full" />
          <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-white/5 rounded-full" />

          <div className="relative p-8 md:p-10">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div>
                <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full mb-3 ${conditionInfo.bg} ${conditionInfo.color}`}>
                  {conditionInfo.label}
                </div>
                <h1 className="text-2xl md:text-3xl font-bold leading-tight">
                  Holistische Analyse<br />voor {firstName}
                </h1>
                <p className="text-indigo-200 text-sm mt-2">
                  Gegenereerd op {new Date(report.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>

              {/* Status badge */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${isFullReport ? "bg-emerald-500/30 text-emerald-100" : "bg-white/15 text-white"}`}>
                {isFullReport ? <CheckCircle className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                {isFullReport ? "Volledig rapport" : "Preview rapport"}
              </div>
            </div>

            {/* Acties */}
            <div className="flex flex-wrap gap-3">
              {!isAdminView && (
                <button
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-semibold transition"
                >
                  <RefreshCw className={`w-4 h-4 ${isRegenerating ? "animate-spin" : ""}`} />
                  Opnieuw genereren
                </button>
              )}
              <button
                onClick={handleDownloadPdf}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-semibold transition"
              >
                <Download className="w-4 h-4" /> PDF Downloaden
              </button>
            </div>
          </div>
        </div>

        {/* ── GEZONDHEIDSSCORES ── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
            <Sun className="w-5 h-5 text-amber-500" />
            Jouw Gezondheidsprofiel
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {SCORE_CONFIG.map((s) => (
              <ScoreBar
                key={s.key}
                label={s.label}
                score={Math.round(scores[s.key] || 5)}
                icon={s.icon}
                color={s.color}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Scores zijn gebaseerd op jouw anamnese-antwoorden.
          </p>
        </div>

        {/* ── SAMENVATTING ── */}
        {report.summary && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              Samenvatting
            </h2>
            <div className="bg-slate-50 rounded-2xl p-5 text-gray-700 leading-relaxed italic border border-slate-100">
              <Streamdown>{report.summary}</Streamdown>
            </div>
          </div>
        )}

        {/* ── ANALYSE ── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-indigo-500" />
            Persoonlijke Analyse
          </h2>
          <div className="prose prose-indigo max-w-none text-gray-700 text-sm leading-relaxed">
            <Streamdown>{report.content}</Streamdown>
          </div>
        </div>

        {/* ── INZICHTEN ── */}
        {report.keyInsights.length > 0 && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-500" />
              Jouw Sleutelinzichten
            </h2>
            <div className="space-y-3">
              {report.keyInsights
                .slice(0, isFullReport ? undefined : 2)
                .map((insight: string, i: number) => (
                  <InsightCard key={i} insight={insight} index={i} />
                ))}

              {!isFullReport && report.keyInsights.length > 2 && (
                <div className="relative">
                  <div className="blur-sm pointer-events-none">
                    <InsightCard insight={report.keyInsights[2]} index={2} />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center gap-2 bg-white border border-indigo-200 rounded-xl px-4 py-2 shadow text-sm font-semibold text-indigo-600">
                      <Lock className="w-3.5 h-3.5" /> Ontgrendelen in volledig rapport
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 6-MAANDEN PLAN ── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            Jouw 6-Maanden Herstelplan
          </h2>
          <p className="text-sm text-gray-500 mb-5">
            {isFullReport
              ? "Je hebt toegang tot het volledige plan."
              : "Maand 1 en 2 zijn direct beschikbaar. Ontgrendel de rest met het volledige rapport."}
          </p>
          <MaandenPreview isFullReport={isFullReport} onBuy={handleBuyFullReport} />
        </div>

        {/* ── VOLLEDIG RAPPORT DETAILS (PAID) ── */}
        {isFullReport && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
            <FullReportDetails report={report} />
          </div>
        )}

        {/* ── DISCLAIMER ── */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-xs text-amber-700 leading-relaxed">
          <strong>Disclaimer:</strong> Dit rapport is geen medisch advies en vervangt geen medische diagnose of behandeling. Raadpleeg altijd een gekwalificeerde medische professional.
        </div>

      </div>
    </div>
  );
}
