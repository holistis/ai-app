import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Download, Share2, Trash2, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";

export function MyReports() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: reports, isLoading } = trpc.reports.listReports.useQuery(
    undefined,
    { enabled: !!user }
  );

  const deleteReportMutation = trpc.reports.deleteReport.useMutation({
    onSuccess: () => {
      toast.success("Rapport verwijderd");
      utils.reports.listReports.invalidate();
    },
    onError: () => {
      toast.error("Fout bij verwijderen van rapport");
    },
  });

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <h2 className="text-2xl font-bold mb-4">Inloggen vereist</h2>
          <p className="text-gray-600 mb-6">
            Je moet ingelogd zijn om je rapporten te zien.
          </p>
          <Button onClick={() => navigate("/")} className="w-full">
            Terug naar start
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Mijn Rapporten</h1>
          <p className="text-gray-600">
            Bekijk en beheer je gezondheidsrapporten
          </p>
        </div>

        {/* Reports List */}
        {!reports || reports.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="mb-4">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Eye className="w-8 h-8 text-indigo-600" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Geen rapporten gevonden
            </h3>
            <p className="text-gray-600 mb-6">
              Je hebt nog geen gezondheidsrapporten gegenereerd.
            </p>
            <Button onClick={() => navigate("/")} className="mx-auto">
              Start een Anamnese
            </Button>
          </Card>
        ) : (
          <div className="grid gap-6">
            {reports?.map((report: any) => (
              <Card key={report.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-1">
                      {report.conditionType === "chronic_fatigue"
                        ? "Chronische Vermoeidheid"
                        : report.conditionType === "digestive_issues"
                        ? "Spijsverterings-Problemen"
                        : report.conditionType === "solk"
                        ? "SOLK"
                        : "ALK"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Gegenereerd{" "}
                      {formatDistanceToNow(new Date(report.createdAt), {
                        addSuffix: true,
                        locale: nl,
                      })}
                    </p>
                  </div>
                  <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    Voltooid
                  </div>
                </div>

                {/* Report Preview */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-32 overflow-hidden">
                  <p className="text-sm text-gray-700 line-clamp-4">
                    {report.fullReport?.substring(0, 200)}...
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/reports/${report.id}`)}
                    className="flex-1"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Bekijk
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // TODO: Implement share functionality
                      toast.info("Delen functie komt binnenkort");
                    }}
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // TODO: Implement PDF download
                      toast.info("Download functie komt binnenkort");
                    }}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (
                        confirm(
                          "Weet je zeker dat je dit rapport wilt verwijderen?"
                        )
                      ) {
                        deleteReportMutation.mutate({ id: report.id });
                      }
                    }}
                    disabled={deleteReportMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
