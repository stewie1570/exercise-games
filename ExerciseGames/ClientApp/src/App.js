import React from "react";
import { Routes, Route } from "react-router-dom";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { FlightPage } from "./pages/FlightPage";
import { HomePage } from "./pages/HomePage";

export const App = () => (
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/diagnostics" element={<DiagnosticsPage />} />
    <Route path="/fly" element={<FlightPage />} />
  </Routes>
);
