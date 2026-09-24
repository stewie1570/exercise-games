import React from "react";
import { createRoot } from "react-dom/client";
import "bootstrap-css-only";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { loadArrowControls } from "./flight/arrowControls";
import "./App.css";

loadArrowControls().finally(() => {
  createRoot(document.getElementById("root")).render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
});
