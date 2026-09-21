import React from "react";
import { createRoot } from "react-dom/client";
import "bootstrap-css-only";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./App.css";

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
