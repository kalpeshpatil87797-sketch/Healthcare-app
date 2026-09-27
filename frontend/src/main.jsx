import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./design-system.css";
import "./index.css";
import { applySavedTheme } from "./utils/theme";
import App from "./App.jsx";
import "./dark-theme.css";

applySavedTheme();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);