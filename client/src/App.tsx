// client/src/App.tsx
import React from "react";
import { Route, Switch } from "wouter";
import { ClerkProvider } from "@clerk/clerk-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import AnamnesisQuestionnaire from "./pages/AnamnesisQuestionnaire";
import RapportPage from "./pages/RapportPage";
import { AdminDashboard } from "./pages/AdminDashboard";
import { MyReports } from "./pages/MyReports";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import NotFound from "./pages/NotFound";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function RouterComponent() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/sign-in"} component={SignInPage} />
      <Route path={"/sign-in/sso-callback"} component={SignInPage} />
      <Route path={"/sign-up"} component={SignUpPage} />
      <Route path={"/sign-up/sso-callback"} component={SignUpPage} />
      <Route path={"/anamnesis"} component={AnamnesisQuestionnaire} />
      <Route path={"/rapport"} component={RapportPage} />
      <Route path={"/admin"} component={AdminDashboard} />
      <Route path={"/my-reports"} component={MyReports} />
      <Route path={"/mijn-rapporten"} component={MyReports} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      navigate={(to) => window.history.pushState(null, "", to)}
    >
      <ErrorBoundary>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <RouterComponent />
          </TooltipProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </ClerkProvider>
  );
}

export default App;
