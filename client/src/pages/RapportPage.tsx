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

// --- HELPERS (Buiten de component voor stabiliteit) ---

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
    isCorrupted: isCorruptedContent(content) || (!content && !report.isPaid)
  };
}

const PROTOCOL_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  nutrition: { label: "Voedingsprotocol", icon: Utensils, color: "text-green-600" },
  supplements: { label: "Supplementen", icon: Pill, color: "text-blue-600" },
  lifestyle: { label: "Leefstijl", icon: Activity, color: "text-orange-600" },
  mentalPractices: { label: "Mentale Praktijken", icon: Brain, color: "text-purple-600" },
};

// --- COMPONENT ---

export default function RapportPage() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const utils = trpc.useUtils();

  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const reportIdFromUrl = urlParams.get('id') ? parseInt(urlParams.get('id')!) : null;
  const isAdminView = !!reportIdFromUrl && user?.role === 'admin';

  // 1. Data Fetching met Smart Polling
  const reportsQuery = trpc.anamnesis.getReports.useQuery(undefined, {
    enabled: !!user && !isAdminView,
    // Poll alleen als we aan het regenereren zijn OF als de data corrupt/leeg is
    refetchInterval: (query) => {
      const data = query.state.data as any[];
      const report = data?.[0];
      const needsData = !report || isCorruptedContent(report.content);
      return (isRegenerating || needsData) ? 3000 : false;
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
    }
  });

  // Effect om isRegenerating uit te zetten als er weer valide data is
  useEffect(() => {
    const report = reportsQuery.data?.[0];
    if (report && !isCorruptedContent(report.content) && isRegenerating) {
      setIsRegenerating(false);
    }
  }, [reportsQuery.data, isRegenerating]);

  // Handlers
  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      await regenerateMutation.mutateAsync();
    } catch (e) {
      console.error(e);
    }
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
    } catch (error) {
      toast.error("Betaalfout");
    }
  };

  // --- RENDERING LOGICA ---

  if (authLoading) return <LoadingScreen message="Laden..." />;
  if (!user) return <ErrorScreen message="Log in om je rapport te zien." onAction={() => setLocation("/")} actionLabel="Terug naar Home" />;

  const currentData = isAdminView ? adminReportQuery.data : reportsQuery.data?.[0];
  const report = normalizeReport(currentData);
  const isLoading = isAdminView ? adminReportQuery.isLoading : (reportsQuery.isLoading && !report);

  // Status: Wachten op eerste generatie of corruptie herstel
  if (isLoading || isRegenerating || (report?.isCorrupted && !isAdminView)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="p-10 max-w-md w-full text-center shadow-xl">
          <Loader2 className="animate-spin w-12 h-12 text-indigo-600 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-3">Rapport wordt voorbereid</h2>
          <p className="text-gray-600 mb-6">Onze AI analyseert je data. Dit duurt meestal 15-45 seconden. Blijf op deze pagina.</p>
          <div className="space-y-3 text-left">
            <StatusStep label="Analyse van antwoorden..." delay="0s" />
            <StatusStep label="Patronen herkennen..." delay="0.5s" />
            <StatusStep label="Protocollen samenstellen..." delay="1s" />
          </div>
        </Card>
      </div>
    );
  }

  if (!report) return <ErrorScreen message="Geen rapport gevonden." onAction={handleRegenerate} actionLabel="Genereer rapport" />;

  const isFullReport = report.isPaid || isAdminView;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" size="sm" onClick={() => setLocation(isAdminView ? "/admin" : "/")} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Terug
          </Button>
          {isAdminView && <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">ADMIN VIEW #{report.id}</span>}
        </div>

        {/* Main Card */}
        <Card className="bg-white shadow-xl border-0 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-8 text-white">
            <h1 className="text-3xl font-bold mb-2">Holistisch Gezondheidsrapport</h1>
            <p className="text-indigo-100 opacity-90">Gezet op {new Date(report.createdAt).toLocaleDateString("nl-NL", { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>

          <div className="p-8">
            {/* Toolbar */}
            <div className="flex flex-wrap gap-3 mb-8">
              {!isAdminView && (
                <Button onClick={handleRegenerate} disabled={isRegenerating} className="bg-indigo-600 hover:bg-indigo-700">
                  <RefreshCw className={`w-4 h-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
                  Opnieuw genereren
                </Button>
              )}
              <Button onClick={handleDownloadPdf} variant="outline">
                <Download className="w-4 h-4 mr-2" /> PDF Downloaden
              </Button>
            </div>

            {/* Badge & Disclaimer */}
            <div className={`mb-6 p-4 rounded-lg border ${isFullReport ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
              <div className="flex gap-3">
                <BookOpen className={`w-5 h-5 ${isFullReport ? 'text-green-600' : 'text-amber-600'}`} />
                <div>
                  <p className="font-bold">{isFullReport ? "Volledig Rapport Toegang" : "Inzicht Rapport (Preview)"}</p>
                  <p className="text-sm opacity-80">{isFullReport ? "Je hebt volledige toegang tot alle protocollen." : "Koop het volledige rapport voor alle details en schema's."}</p>
                </div>
              </div>
            </div>

            {/* Content Sections */}
            <div className="space-y-10">
              {report.summary && (
                <section>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Lightbulb className="text-amber-500" /> Samenvatting</h2>
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 italic text-slate-700 leading-relaxed">
                    <Streamdown>{report.summary}</Streamdown>
                  </div>
                </section>
              )}

              <section>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><CheckCircle className="text-indigo-600" /> Analyse</h2>
                <div className="prose prose-indigo max-w-none text-gray-700">
                  <Streamdown>{report.content}</Streamdown>
                </div>
              </section>

              {/* Insights Grid */}
              {report.keyInsights.length > 0 && (
                <section>
                  <h2 className="text-xl font-bold mb-4">Belangrijkste Inzichten</h2>
                  <div className="grid gap-3">
                    {report.keyInsights.slice(0, isFullReport ? undefined : 2).map((insight, i) => (
                      <div key={i} className="flex gap-4 p-4 bg-white border border-gray-100 rounded-lg shadow-sm">
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">{i+1}</span>
                        <p className="text-gray-700">{insight}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Locked Content / Full View */}
              {isFullReport ? (
                <FullReportDetails report={report} />
              ) : (
                <div className="mt-12 bg-gradient-to-br from-indigo-50 to-white p-8 rounded-2xl border-2 border-dashed border-indigo-200 text-center">
                  <h3 className="text-2xl font-bold mb-4 text-indigo-900">Ontgrendel je volledige plan</h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">Krijg direct toegang tot persoonlijke voedingsschema's, supplementen-protocollen en wetenschappelijke onderbouwing.</p>
                  <Button onClick={handleBuyFullReport} size="lg" className="bg-indigo-600 hover:bg-indigo-700 px-8">
                    Koop Volledig Rapport — €34,95
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTS ---

function FullReportDetails({ report }: { report: any }) {
  return (
    <div className="space-y-10 border-t pt-10">
      {report.protocols && (
        <section>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><FlaskConical className="text-purple-600" /> Jouw Protocollen</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries(report.protocols).map(([key, items]: any) => {
              const cfg = PROTOCOL_LABELS[key];
              if (!cfg) return null;
              const Icon = cfg.icon;
              return (
                <div key={key} className="p-5 border border-gray-100 rounded-xl bg-gray-50/50">
                  <h4 className={`font-bold flex items-center gap-2 mb-3 ${cfg.color}`}>
                    <Icon className="w-5 h-5" /> {cfg.label}
                  </h4>
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

      {report.scientificReferences?.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><BookOpen className="text-blue-600" /> Referenties</h2>
          <div className="text-sm text-gray-500 space-y-2 bg-blue-50/30 p-4 rounded-lg">
            {report.scientificReferences.map((ref: string, i: number) => (
              <p key={i}>[{i+1}] {ref}</p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

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

function ErrorScreen({ message, onAction, actionLabel }: { message: string, onAction: () => void, actionLabel: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <Card className="p-8 text-center max-w-sm w-full">
        <p className="text-gray-600 mb-6">{message}</p>
        <Button onClick={onAction} className="w-full">{actionLabel}</Button>
      </Card>
    </div>
  );
}
