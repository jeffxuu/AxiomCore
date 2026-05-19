import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrandProvider } from "@/lib/brandConfig";
import { ThemeProvider } from "@/lib/themeConfig";
import { I18nProvider } from "@/lib/i18nConfig";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <BrandProvider>
          <App />
        </BrandProvider>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>
);
