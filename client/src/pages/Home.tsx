import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";

import { Heart, Brain, Leaf, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  const reportsQuery = trpc.anamnesis.getReports.useQuery(undefined, {
    enabled: !!user,
  });
  const hasReports = (reportsQuery.data?.length ?? 0) > 0;

  const handleStartAnamnesis = () => {
    if (isAuthenticated) {
      setLocation("/anamnesis");
    } else {
      setLocation('/sign-in');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600">Holistisch AI Kliniek</h1>
          <div className="flex gap-4">
            {isAuthenticated ? (
              <>
                <Button variant="outline" onClick={() => setLocation("/rapport")}>
                  Mijn Rapporten
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                >
                  Uitloggen
                </Button>
              </>
            ) : (
              <Button onClick={() => setLocation('/sign-in')}>
                Inloggen
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h2 className="text-5xl font-bold text-gray-900 mb-4">
          Je Persoonlijke AI Gezondheidsadviseur
        </h2>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Ontdek de onderliggende oorzaken van je klachten en krijg een gepersonaliseerd herstelplan gebaseerd op holistische principes en wetenschap.
        </p>
        {isAuthenticated && hasReports ? (
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => setLocation("/rapport")}
              size="lg"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-6 text-lg"
            >
              Bekijk Mijn Rapport
            </Button>
            <Button
              onClick={handleStartAnamnesis}
              size="lg"
              variant="outline"
              className="px-8 py-6 text-lg bg-white"
            >
              Nieuwe Anamnese
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleStartAnamnesis}
            size="lg"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-6 text-lg"
          >
            Start Je Anamnese (Gratis)
          </Button>
        )}
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h3 className="text-3xl font-bold text-center mb-12">Hoe Het Werkt</h3>
        <div className="grid md:grid-cols-4 gap-6">
          <Card className="p-6 text-center">
            <Brain className="w-12 h-12 mx-auto mb-4 text-indigo-600" />
            <h4 className="font-bold mb-2">Diepgaande Anamnese</h4>
            <p className="text-sm text-gray-600">
              Beantwoord vragen over je gezondheid, leefstijl en symptomen
            </p>
          </Card>

          <Card className="p-6 text-center">
            <Zap className="w-12 h-12 mx-auto mb-4 text-yellow-600" />
            <h4 className="font-bold mb-2">AI-Analyse</h4>
            <p className="text-sm text-gray-600">
              Ontvang een "Inzicht Rapport" met eerste inzichten
            </p>
          </Card>

          <Card className="p-6 text-center">
            <Leaf className="w-12 h-12 mx-auto mb-4 text-green-600" />
            <h4 className="font-bold mb-2">Volledige Protocollen</h4>
            <p className="text-sm text-gray-600">
              Koop het volledige rapport met gedetailleerde adviezen
            </p>
          </Card>

          <Card className="p-6 text-center">
            <Heart className="w-12 h-12 mx-auto mb-4 text-red-600" />
            <h4 className="font-bold mb-2">Persoonlijk Advies</h4>
            <p className="text-sm text-gray-600">
              Neem contact op voor een persoonlijk follow-up gesprek en begeleiding
            </p>
          </Card>
        </div>
      </section>

      {/* Conditions Section */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">We Helpen Bij</h3>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-6 border-l-4 border-indigo-600">
              <h4 className="font-bold text-lg mb-2">Chronische Vermoeidheid</h4>
              <p className="text-gray-600 text-sm">
                Ontdek de onderliggende oorzaken van je uitputting en krijg een stap-voor-stap plan om je energie terug te krijgen.
              </p>
            </Card>

            <Card className="p-6 border-l-4 border-green-600">
              <h4 className="font-bold text-lg mb-2">Spijsverterings-Problemen</h4>
              <p className="text-gray-600 text-sm">
                Leer hoe je darmgezondheid herstelt en je voeding optimaliseert voor betere absorptie.
              </p>
            </Card>

            <Card className="p-6 border-l-4 border-purple-600">
              <h4 className="font-bold text-lg mb-2">SOLK (Onverklaarbare Lichamelijke Klachten)</h4>
              <p className="text-gray-600 text-sm">
                Vind de verbanden tussen je symptomen en leer hoe je lichaam in balans brengt.
              </p>
            </Card>

            <Card className="p-6 border-l-4 border-pink-600">
              <h4 className="font-bold text-lg mb-2">ALK (Auto-Immuun Gerelateerde Klachten)</h4>
              <p className="text-gray-600 text-sm">
                Begrijp je immuunsysteem en ontdek hoe je het kunt ondersteunen met holistische strategieën.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h3 className="text-3xl font-bold text-center mb-12">Transparante Prijzen</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 border-2 border-green-600 bg-green-50">
            <h4 className="font-bold text-lg mb-2">Inzicht Rapport</h4>
            <p className="text-3xl font-bold text-green-600 mb-4">GRATIS</p>
            <p className="text-sm text-gray-600 mb-6">
              20% preview rapport met eerste inzichten en aanbevelingen
            </p>
            <Button variant="outline" className="w-full">
              Gratis Anamnese
            </Button>
          </Card>

          <Card className="p-6 border-2 border-indigo-600 bg-indigo-50">
            <h4 className="font-bold text-lg mb-2">Volledig Rapport</h4>
            <p className="text-3xl font-bold text-indigo-600 mb-4">€34,95</p>
            <p className="text-sm text-gray-600 mb-6">
              Volledige analyse, protocollen, voeding, supplementen & 1 jaar advies
            </p>
            <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
              Koop Rapport
            </Button>
          </Card>

          <Card className="p-6 border-2 border-purple-200 bg-purple-50">
            <h4 className="font-bold text-lg mb-2">Follow-up Begeleiding</h4>
            <p className="text-3xl font-bold text-purple-600 mb-4">Op aanvraag</p>
            <p className="text-sm text-gray-600 mb-6">
              Persoonlijk contact voor begeleiding bij het uitvoeren van je plan
            </p>
            <Button
              onClick={() => window.location.href = 'mailto:info@holistischadviseur.nl'}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              Neem Contact Op
            </Button>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-indigo-600 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h3 className="text-3xl font-bold mb-4">Klaar Om Te Beginnen?</h3>
          <p className="text-lg mb-8 opacity-90">
            Start vandaag nog met je gratis anamnese en ontvang direct je eerste inzichten.
          </p>
          <Button
            onClick={handleStartAnamnesis}
            size="lg"
            className="bg-white text-indigo-600 hover:bg-gray-100 px-8 py-6 text-lg"
          >
            Start Anamnese (Gratis)
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-gray-400 font-medium mb-1">
            © {new Date().getFullYear()} Holistisch AI Kliniek. Alle rechten voorbehouden.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            info@holistischadviseur.nl
          </p>
          <div className="border-t border-gray-700 pt-6">
            <p className="text-gray-500 text-xs leading-relaxed max-w-3xl mx-auto">
              <span className="font-semibold text-gray-400">⚠️ Disclaimer:</span>{" "}
              De informatie en adviezen die via deze website en de AI-tool worden verstrekt, zijn uitsluitend bedoeld ter ondersteuning en ter informatie. Wij stellen geen medische diagnoses en geven geen medisch advies. De inhoud is gebaseerd op onze kennis, ervaring en een holistische benadering van gezondheid, maar vervangt nooit professioneel medisch advies, diagnose of behandeling door een arts, specialist of andere gekwalificeerde zorgverlener. Raadpleeg altijd een arts of gekwalificeerde zorgverlener bij klachten, twijfel of vóór het starten met nieuwe behandelingen, voeding of supplementen. Wij zijn niet aansprakelijk voor eventuele gevolgen van het gebruik van de verstrekte informatie. Het gebruik van deze website en AI-tool is volledig op eigen verantwoordelijkheid.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
