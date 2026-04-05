import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import AnamnesisQuestionnaire from "./pages/AnamnesisQuestionnaire";
import RapportPage from "./pages/RapportPage";
import { AdminDashboard } from "./pages/AdminDashboard";
import { MyReports } from "./pages/MyReports";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/sign-in"} component={SignInPage} />
      <Route path={"/sign-up"} component={SignUpPage} />
      <Route path={"/anamnesis"} component={AnamnesisQuestionnaire} />
      <Route path={"/rapport"} component={RapportPage} />
      <Route path={"/admin"} component={AdminDashboard} />
      <Route path={"/my-reports"} component={MyReports} />
      <Route path={"/mijn-rapporten"} component={MyReports} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
