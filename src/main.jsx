import { UnsavedChangesProvider } from "./context/UnsavedChangesContext";
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import "./i18n";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import ErrorBoundary from "./components/ErrorBoundary";
import App from "./App";
import { initializeTheme } from "./utils/theme";
import "./styles/theme.css";
import "./styles/index.css";

initializeTheme();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <LanguageProvider>
            <UnsavedChangesProvider>
              <App />
              <Toaster position="top-right" />
            </UnsavedChangesProvider>
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);

