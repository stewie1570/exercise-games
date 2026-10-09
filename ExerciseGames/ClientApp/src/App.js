import React, { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { FlightPage } from "./pages/FlightPage";
import { HomePage } from "./pages/HomePage";
import { TogetherPage } from "./pages/TogetherPage";

export const App = () => {
  const location = useLocation();
  useEffect(() => {
    console.log(`Page ${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/diagnostics" element={<DiagnosticsPage />} />
      <Route path="/fly" element={<FlightPage />} />
      <Route path="/together" element={<TogetherPage />} />
    </Routes>
  );
};
