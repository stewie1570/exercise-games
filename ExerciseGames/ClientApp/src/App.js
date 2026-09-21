import React from "react";
import { Routes, Route } from "react-router-dom";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";

export const App = () => (
  <Routes>
    <Route path="/" element={<DiagnosticsPage />} />
  </Routes>
);
