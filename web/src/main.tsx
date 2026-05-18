import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrandProvider } from "@/lib/brandConfig";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrandProvider>
      <App />
    </BrandProvider>
  </React.StrictMode>
);
