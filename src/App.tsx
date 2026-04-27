import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import DataExplorerPage from "./pages/DataExplorerPage";
import DatabaseAdminPage from "./pages/DatabaseAdminPage";
import NotFound from "./pages/NotFound";

import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ThemeProvider } from "@/components/theme-provider";
import { NotificationBanner } from "@/components/ui/NotificationBanner";
import { EditorSettingsProvider } from "@/components/settings/EditorSettingsContext";
import { useEffect } from "react";
import { initCsrfToken } from "./lib/api/client";

const App = () => {
  useEffect(() => {
    initCsrfToken();
  }, []);

return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="system" enableSystem attribute="class" themes={["light", "dark", "dark-black", "blue-gray"]}>
          <AuthProvider>
            <EditorSettingsProvider>
              <TooltipProvider>
                <NotificationBanner />
                <Toaster />
                <Sonner />
                <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/data" element={<DataExplorerPage />} />
                    <Route path="/databases" element={<DatabaseAdminPage />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </TooltipProvider>
            </EditorSettingsProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;
