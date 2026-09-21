import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "./HomePage";

test("home page links to the ultralight game and diagnostics", () => {
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );

  expect(screen.getByRole("heading", { name: "Exercise Games" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Ultralight flight/i })).toHaveAttribute("href", "/fly");
  expect(screen.getByRole("link", { name: /Pose diagnostics/i })).toHaveAttribute("href", "/diagnostics");
});
