import { render, screen } from "@testing-library/react";
import { BowlingScoreboard } from "./BowlingScoreboard";

test("the scoreboard sits beside throttle and shows frame marks", () => {
  render(
    <BowlingScoreboard
      bowling={{
        marks: [
          ["", "X"],
          ["7", "/"],
          ["9", "-"],
          ["", ""],
          ["", ""],
          ["", ""],
          ["", ""],
          ["", ""],
          ["", ""],
          ["", "", ""],
        ],
        totals: [20, 39, 48, null, null, null, null, null, null, null],
        total: 48,
        frame: 4,
        settling: false,
        resetIn: 0,
      }}
    />
  );

  expect(screen.getByLabelText("Bowling scoreboard")).toBeInTheDocument();
  expect(screen.getByText("X")).toBeInTheDocument();
  expect(screen.getByText("/")).toBeInTheDocument();
  expect(screen.getAllByText("48").length).toBeGreaterThan(0);
  expect(screen.getByText("F4")).toBeInTheDocument();
});
