import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Loader2, Lock, ArrowLeft, Lightbulb, CheckCircle, BookOpen, FlaskConical, RefreshCw, Download, Utensils, Pill, Activity, Brain } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

// Helper to safely parse JSON array fields from MySQL
function parseJsonField(field: any): string[] {
  if (Array.isArray(field)) return field;
  if (typeof field === "string") {
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // not valid JSON
    }
  }
  return [];
}

// Helper to safely parse protocols object from MySQL
function parseProtocolsField(field: any): Record<string, string[]> | null {
  if (field && typeof field === "object" && !Array.isArray(field)) return field;
  if (typeof field === "string" && field.length > 2) {
    try {
      const parsed = JSON.parse(field);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      // not valid JSON
    }
  }
  return null;
}

// Detect if a string looks like raw JSON data (corrupted content)
function isCorruptedContent(content: string): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  // Starts with JSON object or array
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return true;
  // Contains JSON array syntax like ],[  or ],generated
  if (trimmed.includes('"],["') || trimmed.includes('],generated') || trimmed.includes('"],[')) return true;
  // Contains raw JSON field patterns
  if (trimmed.includes('"keyInsights"') || trimmed.includes('"recommendations"') || trimmed.includes('"protocols"')) return true;
  return false;
}

// Normalize a report: extract content/fields if content is a full JSON string
function normalizeReport(report: any) {
  if (!report) return report;

  let content = typeof report.content === "string" ? report.content : "";
  let summary = typeof report.summary === "string" ? report.summary : "";
  let keyInsights = parseJsonField(report.keyInsights);
  let recommendations = parseJsonField(report.recommendations);
  let protocols = parseProtocolsField(report.protocols);
  let scientificReferences = parseJsonField(report.scientificReferences);
  let isCorrupted = false;

  // If content looks like a full JSON object, extract fields from it
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        // Extract the real content text
        if (typeof parsed.content === "string") {
          content = parsed.content;
        }
        if (!summary && typeof parsed.summary === "string") {
          summary = parsed.summary;
        }
        if (!keyInsights.length) keyInsights = parseJsonField(parsed.keyInsights);
        if (!recommendations.length) recommendations = parseJsonField(parsed.recommendations);
        if (!protocols) protocols = parseProtocolsField(parsed.protocols);
        if (!scientificReferences.length) scientificReferences = parseJsonField(parsed.scientificReferences);
      }
    } catch {
      // content is not valid JSON, use as-is
    }
  }

  // After extraction, check if the content is still corrupted
  if (isCorruptedContent(content)) {
    isCorrupted = true;
    content = ""; // Clear corrupted content so we show the regenerate prompt
  }

  return {
    ...report,
    content,
    summary,
    keyInsights,
    recommendations,
    protocols,
    scientificReferences,
    isCorrupted,
  };
}

const PROTOCOL_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  nutrition: { label: "Voedingsprotocol", icon: Utensils, color: "text-green-600" },
  supplements: { label: "Supplementen", icon: Pill, color: "text-blue-600" },
  lifestyle: { label: "Leefstijl", icon: Activity, color: "text-orange-600" },
  mentalPractices: { label: "Mentale Praktijken", icon: Brain, color: "text-purple-600" },
};

export default function RapportPage() {
  // IMPORTANT: All hooks must be declared BEFORE any conditional returns
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const utils = trpc.useUtils();

  // Extract reportId from URL query params (for admin viewing)
  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const reportIdFromUrl = urlParams.get('id') ? parseInt(urlParams.get('id')!) : null;
  const isAdminView = !!reportIdFromUrl && user?.role === 'admin';

  console.log(`[RapportPage] Admin view: ${isAdminView}, reportId: ${reportIdFromUrl}, userRole: ${user?.role}`);

  // Admin view: fetch specific report by ID
  const adminReportQuery = trpc.reports.getReportAdmin.useQuery(
    { reportId: reportIdFromUrl! },
    {
      enabled: !!user && user.role === 'admin' && !!reportIdFromUrl,
    }
  );

  // User view: fetch all reports
  const reportsQuery = trpc.anamnesis.getReports.useQuery(undefined, {
    enabled: !!user && !reportIdFromUrl,
    // Default: poll every 3 seconds when no data
    refetchInterval: 5000,
  });

  const createCheckoutMutation = trpc.payments.createCheckout.useMutation();

  // Determine which report to display - MUST be before any conditional returns
  const rawReports = isAdminView ? (adminReportQuery.data ? [adminReportQuery.data] : []) : (reportsQuery.data || []);
  const latestReport = rawReports.length > 0 ? normalizeReport(rawReports[0]) : null;
  
  const handleDownloadPdf = () => {
    if (!latestReport?.id) {
      console.error("[PDF-Download] latestReport is null or has no id");
      toast.error("Rapport ID niet beschikbaar");
      return;
    }
    console.log("[PDF-Download] Opening PDF for report:", latestReport.id);
    window.open(`/api/pdf/${latestReport.id}`, "_blank");
    toast.success("PDF wordt geopend in een nieuw tabblad!");
  };
  
  const regenerateMutation = trpc.anamnesis.regenerateLatestReport.useMutation({
    onSuccess: () => {
      console.log("[Frontend] Mutation succeeded, invalidating cache and refetching...");
      toast.success("Rapport wordt opnieuw gegenereerd...");
      setRegenerateError(null);
      // DON'T set isRegenerating to false yet - keep it true until refetch completes
      // Invalidate cache to force fresh data from server
      utils.anamnesis.getReports.invalidate();
      // Force immediate refetch with aggressive polling
      reportsQuery.refetch().then(() => {
        console.log("[Frontend] Refetch completed, setting isRegenerating to false");
        setIsRegenerating(false);
      }).catch((err) => {
        console.error("[Frontend] Refetch failed:", err);
        setIsRegenerating(false);
      });
    },
    onError: (err) => {
      const msg = err.message || "Fout bij opnieuw genereren";
      console.error("[Frontend] Mutation error:", msg);
      setRegenerateError(msg);
      setIsRegenerating(false);
      toast.error(msg);
    },
  });

  // Adjust refetch interval based on regeneration state
  useEffect(() => {
    if (isRegenerating) {
      // While regenerating, poll more aggressively
      reportsQuery.refetch();
    }
  }, [isRegenerating, reportsQuery]);

  const handleRegenerate = async () => {
    console.log("[Frontend] Starting regenerate...");
    setIsRegenerating(true);
    setRegenerateError(null);
    // Start aggressive polling immediately
    const pollInterval = setInterval(() => {
      reportsQuery.refetch();
    }, 2000);
    try {
      await regenerateMutation.mutateAsync();
      console.log("[Frontend] Regenerate completed");
    } catch (err: any) {
      console.error("[Frontend] Regenerate failed:", err);
      setRegenerateError(err?.message || "Onbekende fout");
      setIsRegenerating(false);
    } finally {
      clearInterval(pollInterval);
    }
  };

  // Now conditional returns are safe because all hooks are already declared
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="animate-spin w-8 h-8 text-indigo-600 mx-auto mb-3" />
          <p className="text-gray-600">Laden...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="p-8 text-center max-w-md">
          <p className="text-gray-600 mb-4">Je moet ingelogd zijn om je rapport te bekijken</p>
          <Button onClick={() => setLocation("/")}>Terug naar Home</Button>
        </Card>
      </div>
    );
  }

  const handleBuyFullReport = async () => {
    const report = (isAdminView ? [adminReportQuery.data] : reportsQuery.data)?.[0];
    if (!report) return;

    try {
      const result = await createCheckoutMutation.mutateAsync({
        reportId: report.id,
        paymentType: "full_report",
      });

      if (result.checkoutUrl) {
        toast.success("Je wordt doorgestuurd naar de betaalpagina...");
        window.open(result.checkoutUrl, "_blank");
      }
    } catch (error) {
      toast.error("Fout bij betaling. Probeer het opnieuw.");
      console.error(error);
    }
  };

  // Determine which report to display
  const isLoading = isAdminView ? adminReportQuery.isLoading : reportsQuery.isLoading;
  const isError = isAdminView ? !!adminReportQuery.error : false;

  // If admin view is loading
  if (isAdminView && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="animate-spin w-8 h-8 text-indigo-600 mx-auto mb-3" />
          <p className="text-gray-600">Rapport wordt geladen...</p>
        </div>
      </div>
    );
  }

  // If admin view has error
  if (isAdminView && isError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="p-8 text-center max-w-md">
          <p className="text-gray-600 mb-4">Rapport niet gevonden of geen toegang</p>
          <Button onClick={() => setLocation("/admin")}>Terug naar Admin Dashboard</Button>
        </Card>
      </div>
    );
  }

  if (reportsQuery.isLoading && !isAdminView) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="animate-spin w-8 h-8 text-indigo-600 mx-auto mb-3" />
          <p className="text-gray-600">Je rapport wordt geladen...</p>
        </div>
      </div>
    );
  }

  // If no reports yet, show a waiting screen (poll will auto-refresh)
  if (!latestReport || rawReports.length === 0) {
    if (regenerateError) {
      // Error — show error with retry
      return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full mx-4 text-center">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Rapport generatie mislukt</h2>
            <p className="text-gray-600 mb-4">
              {regenerateError?.includes("anamnese") 
                ? "Er is geen anamnese gevonden in de database. Je moet een nieuwe anamnese invullen om een rapport te genereren."
                : `Fout: ${regenerateError}`}
            </p>
            {regenerateError?.includes("anamnese") && (
              <p className="text-amber-600 text-sm mb-4 bg-amber-50 p-3 rounded-lg">
                Je vorige anamnese data is niet meer beschikbaar. Vul een nieuwe anamnese in — dit duurt slechts 5 minuten.
              </p>
            )}
            {!regenerateError?.includes("anamnese") && (
              <Button
                onClick={async () => {
                  setRegenerateError(null);
                  setIsRegenerating(true);
                  try {
                    await regenerateMutation.mutateAsync();
                  } catch (e: any) {
                    setRegenerateError(e?.message || "Onbekende fout");
                  } finally {
                    setIsRegenerating(false);
                  }
                }}
                disabled={isRegenerating || regenerateMutation.isPending}
                className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2 mb-3"
              >
                {isRegenerating || regenerateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Opnieuw proberen
              </Button>
            )}
            <Button
              className={`w-full gap-2 ${regenerateError?.includes("anamnese") ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
              variant={regenerateError?.includes("anamnese") ? "default" : "outline"}
              onClick={() => setLocation("/anamnesis")}
            >
              Nieuwe anamnese invullen
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full mx-4 text-center">
          <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-6">
            <Loader2 className="animate-spin w-12 h-12 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Je rapport wordt gegenereerd</h2>
          <p className="text-gray-600 mb-6">
            Onze AI analyseert je antwoorden. Dit duurt 15-60 seconden. De pagina ververst automatisch.
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span>Antwoorden worden geanalyseerd...</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <div className="w-2 h-2 rounded-full bg-indigo-300 animate-pulse" style={{ animationDelay: "0.5s" }} />
              <span>Holistische patronen worden herkend...</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <div className="w-2 h-2 rounded-full bg-indigo-200 animate-pulse" style={{ animationDelay: "1s" }} />
              <span>Persoonlijk rapport wordt opgesteld...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // latestReport is already defined above (moved before conditional returns)

  const reportContent = latestReport?.content || "";
  const reportSummary = latestReport?.summary || "";
  const keyInsights: string[] = latestReport?.keyInsights || [];
  const recommendations: string[] = latestReport?.recommendations || [];
  const protocols: Record<string, string[]> | null = latestReport?.protocols || null;
  const scientificReferences: string[] = latestReport?.scientificReferences || [];
  // Show full content if: user paid for it (isPaid=true) OR it's admin view
  const isFullReport = (latestReport?.isPaid === true) || isAdminView;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header with back button */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation(isAdminView ? "/admin" : "/")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Terug
          </Button>
          {isAdminView && (
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
              Admin View - Rapport #{latestReport.id}
            </span>
          )}
        </div>

        {/* Main Report Card */}
        <Card className="bg-white shadow-lg border-0 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-6 text-white">
            <h1 className="text-3xl font-bold mb-2">Je Holistische Gezondheidsrapport</h1>
            <p className="text-indigo-100">
              Gegenereerd op {new Date(latestReport.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          <div className="p-8">
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 mb-8">
              {!isAdminView && (
                <Button
                  onClick={handleRegenerate}
                  disabled={isRegenerating || regenerateMutation.isPending}
                  className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                  title="Rapport opnieuw genereren op basis van je bestaande anamnese"
                >
                  {isRegenerating || regenerateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Opnieuw genereren
                </Button>
              )}
              <Button
                onClick={() => {
                  if (!latestReport) {
                    console.error("[PDF-Download] latestReport is null");
                    return;
                  }
                  console.log("[PDF-Download] Clicking download button for report:", latestReport.id);
                  handleDownloadPdf();
                }}
                disabled={!latestReport?.id || !latestReport}
                variant="outline"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </Button>
            </div>

            {/* Report Type Badge */}
            <div className={`mb-6 p-4 border rounded-lg ${
              isFullReport 
                ? "bg-green-50 border-green-200" 
                : "bg-amber-50 border-amber-200"
            }`}>
              <div className="flex items-start gap-3">
                <BookOpen className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                  isFullReport 
                    ? "text-green-600" 
                    : "text-amber-600"
                }`} />
                <div>
                  <p className={`font-semibold ${
                    isFullReport 
                      ? "text-green-900" 
                      : "text-amber-900"
                  }`}>
                    {isFullReport 
                      ? "Dit is je VOLLEDIGE Gezondheidsrapport (100% inhoud)" 
                      : "Dit is je GRATIS Inzichtrapport (preview - 20% inhoud)"}
                  </p>
                  {!isFullReport && (
                    <p className="text-sm text-amber-800 mt-1">
                      Het volledige rapport bevat: gedetailleerde oorzaak-analyse, voedingsprotocollen, supplement-schema's, leefstijl-aanbevelingen en wetenschappelijke referenties.
                    </p>
                  )}
                  {isFullReport && (
                    <p className="text-sm text-green-800 mt-1">
                      Je hebt toegang tot het volledige rapport met alle details, protocollen en aanbevelingen.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Medical Disclaimer */}
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 font-medium">
                <strong>Disclaimer:</strong> Dit rapport is geen medisch advies en kan geen medische diagnose vervangen. Dit is een holistische analyse ter ondersteuning van je gezondheidsreis. Raadpleeg altijd een gekwalificeerde medische professional voor diagnose en behandeling.
              </p>
            </div>

            {/* Report Content */}
            {reportContent && !latestReport.isCorrupted ? (
              <div className="space-y-8">
                {reportSummary && (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-amber-500" />
                      Samenvatting
                    </h2>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <Streamdown>{reportSummary}</Streamdown>
                    </div>
                  </div>
                )}

                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-indigo-600" />
                    Holistische Gezondheidsanalyse
                  </h2>
                  <div className="prose prose-sm max-w-none text-gray-700">
                    <Streamdown>{reportContent}</Streamdown>
                  </div>
                </div>

                {keyInsights.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-amber-500" />
                      Belangrijkste Inzichten {!isFullReport && `(${Math.min(2, keyInsights.length)} van ${keyInsights.length})`}
                    </h3>
                    <ul className="space-y-2">
                      {keyInsights.slice(0, isFullReport ? undefined : 2).map((insight, idx) => (
                        <li key={idx} className="flex gap-3 text-gray-700">
                          <span className="font-bold text-indigo-600 flex-shrink-0">{idx + 1}</span>
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                    {!isFullReport && keyInsights.length > 2 && (
                      <p className="text-xs text-gray-500 mt-3 p-3 bg-gray-50 rounded">📖 {keyInsights.length - 2} meer inzichten beschikbaar in het volledige rapport</p>
                    )}
                  </div>
                )}

                {recommendations.length > 0 && isFullReport && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      Aanbevelingen
                    </h3>
                    <ul className="space-y-2">
                      {recommendations.map((rec, idx) => (
                        <li key={idx} className="flex gap-3 text-gray-700">
                          <span className="text-green-600 font-bold">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {protocols && Object.keys(protocols).length > 0 && isFullReport && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <FlaskConical className="w-5 h-5 text-purple-600" />
                      Persoonlijke Protocollen
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(protocols).map(([key, items]) => {
                        const label = PROTOCOL_LABELS[key];
                        if (!label) return null;
                        const Icon = label.icon;
                        return (
                          <div key={key} className="border border-gray-200 rounded-lg p-4">
                            <h4 className={`font-bold mb-2 flex items-center gap-2 ${label.color}`}>
                              <Icon className="w-4 h-4" />
                              {label.label}
                            </h4>
                            <ul className="space-y-1 text-sm text-gray-700">
                              {items.map((item, idx) => (
                                <li key={idx} className="flex gap-2">
                                  <span className="text-gray-400">•</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {scientificReferences.length > 0 && isFullReport && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                      Wetenschappelijke Referenties
                    </h3>
                    <ul className="space-y-2">
                      {scientificReferences.map((ref, idx) => (
                        <li key={idx} className="text-sm text-gray-700 flex gap-2">
                          <span className="text-blue-600 font-bold flex-shrink-0">•</span>
                          <span>{ref}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600 mb-4">Rapport inhoud is niet beschikbaar</p>
                {!isAdminView && (
                  <Button onClick={handleRegenerate} className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Opnieuw genereren
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Full Report CTA */}
        {!isFullReport && !isAdminView && (
          <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200 shadow-md">
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Volledig Rapport</h3>
                  <p className="text-gray-700 mb-4">
                    Ontdek je complete holistische gezondheidsplan met:
                  </p>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      Gedetailleerde oorzaak-analyse
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      Persoonlijke voedingsprotocollen
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      Supplement-schema's
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      Leefstijl-aanbevelingen
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      Wetenschappelijke referenties
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      1 jaar toegang
                    </li>
                  </ul>
                </div>
                <div className="flex flex-col justify-center">
                  <div className="text-4xl font-bold text-indigo-600 mb-2">€34,95</div>
                  <p className="text-gray-600 mb-6">Eenmalige aankoop, 1 jaar toegang</p>
                  <Button
                    onClick={handleBuyFullReport}
                    disabled={createCheckoutMutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 mb-3"
                  >
                    {createCheckoutMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Koop Volledig Rapport
                  </Button>
                  <p className="text-xs text-gray-500 text-center">Veilige betaling via Stripe</p>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
