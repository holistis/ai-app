import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Heart, Brain, Leaf, Zap, CheckCircle } from "lucide-react";
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
      <section className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
          Eindelijk begrijpen waarom je je niet goed voelt —<br />
          <span className="text-indigo-600">en wat je eraan kunt doen.</span>
        </h2>
        <p className="text-xl text-gray-600 mb-6 max-w-3xl mx-auto leading-relaxed">
          Duizenden mensen lopen rond met klachten die artsen niet kunnen verklaren. Chronische vermoeidheid, spijsverteringsproblemen, aanhoudende pijn, stress die maar niet weggaat. Ze gaan van specialist naar specialist, zonder antwoorden.
        </p>
        <p className="text-xl text-gray-700 font-medium mb-10 max-w-3xl mx-auto">
          Onze AI-adviseur analyseert jouw klachten vanuit een holistisch perspectief — en geeft je binnen minuten inzicht in de mogelijke oorzaken én een concreet 6-maanden herstelplan.
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
            Start Je Gratis Analyse
          </Button>
        )}
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h3 className="text-3xl font-bold text-center mb-4">Hoe Het Werkt</h3>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
          Geen standaard lijstjes. Geen generiek advies. Jouw verhaal, jouw lichaam, jouw plan.
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="p-8 text-center border-0 shadow-md">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Brain className="w-8 h-8 text-indigo-600" />
            </div>
            <h4 className="font-bold text-lg mb-3">Stap 1 — Vertel ons jouw verhaal</h4>
            <p className="text-gray-600">
              Beantwoord een uitgebreide vragenlijst over jouw klachten, leefstijl, voeding, slaap en geschiedenis. Hoe eerlijker, hoe beter het advies.
            </p>
          </Card>

          <Card className="p-8 text-center border-0 shadow-md">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-yellow-600" />
            </div>
            <h4 className="font-bold text-lg mb-3">Stap 2 — De AI analyseert</h4>
            <p className="text-gray-600">
              Onze AI verbindt de verbanden tussen jouw klachten die anderen missen. Geen losse symptomen, maar een compleet beeld van wat er speelt in jouw lichaam.
            </p>
          </Card>

          <Card className="p-8 text-center border-0 shadow-md">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Leaf className="w-8 h-8 text-green-600" />
            </div>
            <h4 className="font-bold text-lg mb-3">Stap 3 — Jouw persoonlijk rapport</h4>
            <p className="text-gray-600">
              Je ontvangt een gedetailleerd rapport met de mogelijke oorzaken, een 6-maanden herstelplan, voedings- en supplementadviezen en concrete volgende stappen.
            </p>
          </Card>
        </div>
      </section>

      {/* Trust section */}
      <section className="bg-indigo-50 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-2xl font-semibold text-gray-800 italic mb-4">
            "Geen diagnose, maar wel eindelijk begrip."
          </p>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Wij stellen geen medische diagnoses. Wij helpen je begrijpen wat er mogelijk speelt in jouw lichaam — en bij wie je kunt aankloppen voor verdere hulp.
          </p>
        </div>
      </section>

      {/* Conditions Section */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-4">We Helpen Bij</h3>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Klachten die vaak worden onderschat, maar jouw dagelijks leven enorm beïnvloeden.
          </p>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-6 border-l-4 border-indigo-600">
              <h4 className="font-bold text-lg mb-2">Chronische Vermoeidheid</h4>
              <p className="text-gray-600 text-sm">
                Je bent uitgeput, ook na een nacht slapen. Je energieniveau is onverklaarbaar laag en niemand geeft je een antwoord. Wij zoeken naar de onderliggende oorzaken en geven je een stap-voor-stap plan om je energie terug te krijgen.
              </p>
            </Card>

            <Card className="p-6 border-l-4 border-green-600">
              <h4 className="font-bold text-lg mb-2">Spijsverterings­problemen</h4>
              <p className="text-gray-600 text-sm">
                Opgeblazen gevoel, darmklachten, voedselintoleranties of een gevoel dat je darmen nooit echt goed werken. Wij helpen je begrijpen hoe je darmgezondheid herstelt en je voeding optimaliseert.
              </p>
            </Card>

            <Card className="p-6 border-l-4 border-purple-600">
              <h4 className="font-bold text-lg mb-2">SOLK — Onverklaarbare Lichamelijke Klachten</h4>
              <p className="text-gray-600 text-sm">
                Artsen vinden niets, maar jij voelt duidelijk dat er iets niet klopt. Wij verbinden de verbanden tussen jouw symptomen en helpen je begrijpen wat er werkelijk speelt.
              </p>
            </Card>

            <Card className="p-6 border-l-4 border-pink-600">
              <h4 className="font-bold text-lg mb-2">Auto-Immuun Gerelateerde Klachten</h4>
              <p className="text-gray-600 text-sm">
                Je immuunsysteem werkt tegen je. Wij helpen je begrijpen hoe je je lichaam kunt ondersteunen met holistische strategieën die werken naast de reguliere behandeling.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h3 className="text-3xl font-bold text-center mb-4">Transparante Prijzen</h3>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
          Begin gratis. Betaal alleen als je meer wilt weten.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 border-2 border-green-500 bg-green-50">
            <h4 className="font-bold text-lg mb-2">Gratis Inzicht Rapport</h4>
            <p className="text-3xl font-bold text-green-600 mb-4">GRATIS</p>
            <p className="text-sm text-gray-600 mb-4">
              Jouw persoonlijke preview — eerste inzichten in wat er mogelijk speelt, zodat je eindelijk voelt dat iemand je begrijpt.
            </p>
            <ul className="text-sm text-gray-600 space-y-2 mb-6">
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Persoonlijke herkenning</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Eerste inzichten</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> De logica achter jouw klachten</li>
            </ul>
            <Button onClick={handleStartAnamnesis} variant="outline" className="w-full">
              Start Gratis
            </Button>
          </Card>

          <Card className="p-6 border-2 border-indigo-600 bg-indigo-50 relative">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-indigo-600 text-white text-xs px-3 py-1 rounded-full">
              Meest Gekozen
            </div>
            <h4 className="font-bold text-lg mb-2">Volledig 6-Maanden Herstelplan</h4>
            <p className="text-3xl font-bold text-indigo-600 mb-4">€34,95</p>
            <p className="text-sm text-gray-600 mb-4">
              Jouw complete herstelplan — maand voor maand uitgewerkt met voeding, supplementen, leefstijl en concrete acties.
            </p>
            <ul className="text-sm text-gray-600 space-y-2 mb-6">
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-indigo-500" /> Volledige oorzaak analyse</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-indigo-500" /> 6-maanden herstelplan</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-indigo-500" /> Voeding & supplementen</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-indigo-500" /> Leefstijl protocol</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-indigo-500" /> PDF download</li>
            </ul>
            <Button onClick={handleStartAnamnesis} className="w-full bg-indigo-600 hover:bg-indigo-700">
              Start Nu
            </Button>
          </Card>

          <Card className="p-6 border-2 border-purple-200 bg-purple-50">
            <h4 className="font-bold text-lg mb-2">Persoonlijke Begeleiding</h4>
            <p className="text-3xl font-bold text-purple-600 mb-4">Op aanvraag</p>
            <p className="text-sm text-gray-600 mb-4">
              Wil je persoonlijk begeleid worden bij het uitvoeren van jouw plan? Neem contact op voor een gesprek.
            </p>
            <ul className="text-sm text-gray-600 space-y-2 mb-6">
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-purple-500" /> Persoonlijk gesprek</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-purple-500" /> Begeleiding op maat</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-purple-500" /> Follow-up en bijsturing</li>
            </ul>
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
          <h3 className="text-3xl font-bold mb-4">Klaar om eindelijk antwoorden te krijgen?</h3>
          <p className="text-lg mb-8 opacity-90">
            Start vandaag nog gratis. Binnen minuten weet je meer over jouw lichaam dan na jaren van zoeken.
          </p>
          <Button
            onClick={handleStartAnamnesis}
            size="lg"
            className="bg-white text-indigo-600 hover:bg-gray-100 px-8 py-6 text-lg font-semibold"
          >
            Start Mijn Gratis Analyse
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
