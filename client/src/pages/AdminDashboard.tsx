import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { Loader2, Users, FileText, CreditCard, TrendingUp, Eye, RefreshCw, ClipboardList } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";


type TabType = "overview" | "reports" | "payments" | "anamnesis" | "users";

export function AdminDashboard() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const statsQuery = trpc.admin.getStats.useQuery(undefined, { enabled: user?.role === "admin" });
  const reportsQuery = trpc.admin.getAllReports.useQuery(undefined, { enabled: activeTab === "reports" && user?.role === "admin" });
  const paymentsQuery = trpc.admin.getAllPayments.useQuery(undefined, { enabled: activeTab === "payments" && user?.role === "admin" });
  const anamnesisQuery = trpc.admin.getAllAnamnesis.useQuery(undefined, { enabled: activeTab === "anamnesis" && user?.role === "admin" });
  const usersQuery = trpc.admin.getAllUsers.useQuery(undefined, { enabled: user?.role === "admin" });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!user) {
    console.log('[AdminDashboard] Not authenticated - redirecting to login');
    navigate('/sign-in');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Authenticated but not admin
  if (user.role !== "admin") {
    console.log(`[AdminDashboard] Access denied - User: ${user.id}, Role: ${user.role}, Expected: admin`);
    return (
      <div className="container py-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">Geen toegang</h1>
          <p className="text-gray-600 mb-6">Je hebt geen beheerdersrechten voor deze pagina. (Role: {user.role || 'undefined'})</p>
          <Button onClick={() => navigate("/")} variant="outline">Terug naar home</Button>
        </div>
      </div>
    );
  }

  const stats = statsQuery.data;

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: "overview", label: "Overzicht", icon: TrendingUp },
    { id: "reports", label: "Rapporten", icon: FileText },
    { id: "payments", label: "Betalingen", icon: CreditCard },
    { id: "anamnesis", label: "Anamneses", icon: ClipboardList },
    { id: "users", label: "Gebruikers", icon: Users },
  ];

  const conditionLabels: Record<string, string> = {
    chronic_fatigue: "Chronische Vermoeidheid",
    digestive_issues: "Spijsverteringsproblemen",
    solk: "SOLK",
    alk: "ALK",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">Holistisch AI Kliniek — Beheer</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/")} className="text-sm">
              ← Website
            </Button>
            <Button variant="outline" size="sm" onClick={() => statsQuery.refetch()} className="text-sm">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Vernieuwen
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div>
            {statsQuery.isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-500">Gebruikers</span>
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <Users className="w-4 h-4 text-blue-600" />
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-gray-900">{stats?.totalUsers || 0}</div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-500">Rapporten</span>
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                          <FileText className="w-4 h-4 text-indigo-600" />
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-gray-900">{stats?.totalReports || 0}</div>
                      <div className="text-xs text-gray-400 mt-1">{stats?.fullReports || 0} volledig · {stats?.inzichtRapporten || 0} inzicht</div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-500">Omzet</span>
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-gray-900">€{stats?.totalRevenue || "0.00"}</div>
                      <div className="text-xs text-gray-400 mt-1">{stats?.pendingPayments || 0} openstaand</div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-500">Anamneses</span>
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                          <ClipboardList className="w-4 h-4 text-amber-600" />
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-gray-900">{stats?.totalAnamnesis || 0}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Actions */}
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">Snelle acties</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {tabs.slice(1).map((tab) => {
                        const Icon = tab.icon;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                          >
                            <Icon className="w-5 h-5 text-indigo-600" />
                            <span className="text-sm font-medium text-gray-700">{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === "reports" && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">Alle Rapporten ({reportsQuery.data?.length || 0})</CardTitle>
              <Button variant="outline" size="sm" onClick={() => reportsQuery.refetch()}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              {reportsQuery.isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Gebruiker</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Datum</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportsQuery.data?.map((report: any) => (
                        <tr key={report.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-3 text-gray-400 text-xs">#{report.id}</td>
                          <td className="py-3 px-3 text-gray-700">Gebruiker #{report.userId}</td>
                          <td className="py-3 px-3">
                            <Badge variant={report.reportType === "full_report" ? "default" : "secondary"} className="text-xs">
                              {report.reportType === "full_report" ? "Volledig" : "Inzicht"}
                            </Badge>
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant={report.status === "generated" ? "default" : "outline"} className={`text-xs ${report.status === "generated" ? "bg-green-100 text-green-800 border-green-200" : ""}`}>
                              {report.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-gray-500 text-xs">
                            {new Date(report.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                          <td className="py-3 px-3">
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate(`/rapport?id=${report.id}`)}>
                              <Eye className="w-3 h-3 mr-1" /> Bekijk
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!reportsQuery.data?.length && (
                    <div className="text-center py-12 text-gray-400">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Nog geen rapporten</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payments Tab */}
        {activeTab === "payments" && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">Alle Betalingen ({paymentsQuery.data?.length || 0})</CardTitle>
              <Button variant="outline" size="sm" onClick={() => paymentsQuery.refetch()}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              {paymentsQuery.isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Gebruiker</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Bedrag</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Datum</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stripe ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentsQuery.data?.map((payment: any) => (
                        <tr key={payment.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-3 text-gray-400 text-xs">#{payment.id}</td>
                          <td className="py-3 px-3 text-gray-700">#{payment.userId}</td>
                          <td className="py-3 px-3 font-semibold text-gray-900">€{parseFloat(payment.amount || 0).toFixed(2)}</td>
                          <td className="py-3 px-3">
                            <Badge variant="secondary" className="text-xs">
                              {payment.paymentType === "full_report" ? "Volledig Rapport" : payment.paymentType}
                            </Badge>
                          </td>
                          <td className="py-3 px-3">
                            <Badge className={`text-xs ${
                              payment.status === "completed" || payment.status === "paid"
                                ? "bg-green-100 text-green-800 border-green-200"
                                : payment.status === "pending"
                                ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                                : "bg-red-100 text-red-800 border-red-200"
                            }`} variant="outline">
                              {payment.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-gray-500 text-xs">
                            {new Date(payment.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                          <td className="py-3 px-3 text-gray-400 text-xs font-mono truncate max-w-[120px]">
                            {payment.stripePaymentIntentId?.substring(0, 16)}...
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!paymentsQuery.data?.length && (
                    <div className="text-center py-12 text-gray-400">
                      <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Nog geen betalingen</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Anamnesis Tab */}
        {activeTab === "anamnesis" && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">Alle Anamneses ({anamnesisQuery.data?.length || 0})</CardTitle>
              <Button variant="outline" size="sm" onClick={() => anamnesisQuery.refetch()}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              {anamnesisQuery.isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Gebruiker</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Klacht</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Datum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {anamnesisQuery.data?.map((item: any) => (
                        <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-3 text-gray-400 text-xs">#{item.id}</td>
                          <td className="py-3 px-3 text-gray-700">#{item.userId}</td>
                          <td className="py-3 px-3">
                            <Badge variant="outline" className="text-xs">
                              {conditionLabels[item.conditionType] || item.conditionType}
                            </Badge>
                          </td>
                          <td className="py-3 px-3">
                            <Badge className="text-xs bg-green-100 text-green-800 border-green-200" variant="outline">
                              {item.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-gray-500 text-xs">
                            {new Date(item.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!anamnesisQuery.data?.length && (
                    <div className="text-center py-12 text-gray-400">
                      <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Nog geen anamneses</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">Alle Gebruikers ({usersQuery.data?.length || 0})</CardTitle>
              <Button variant="outline" size="sm" onClick={() => usersQuery.refetch()}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              {usersQuery.isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Naam</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rol</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Laatste login</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersQuery.data?.map((u: any) => (
                        <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-3 text-gray-400 text-xs">#{u.id}</td>
                          <td className="py-3 px-3 text-gray-700 font-medium">{u.name || "—"}</td>
                          <td className="py-3 px-3 text-gray-500">{u.email || "—"}</td>
                          <td className="py-3 px-3">
                            <Badge className={`text-xs ${u.role === "admin" ? "bg-indigo-100 text-indigo-800 border-indigo-200" : "bg-gray-100 text-gray-600 border-gray-200"}`} variant="outline">
                              {u.role || "user"}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-gray-500 text-xs">
                            {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!usersQuery.data?.length && (
                    <div className="text-center py-12 text-gray-400">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Nog geen gebruikers</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
