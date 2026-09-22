import React from "react";
import styled from "styled-components";

const Board = styled.div`
  display: flex;
  align-items: stretch;
  gap: 0;
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid rgba(248, 250, 252, 0.28);
  border-radius: 8px;
  overflow: hidden;
  font-variant-numeric: tabular-nums;
  text-shadow: none;
`;

const Frame = styled.div`
  min-width: ${(props) => (props.$tenth ? "3.15rem" : "2.15rem")};
  border-right: 1px solid rgba(248, 250, 252, 0.22);
  padding: 0.15rem 0.2rem 0.2rem;
  background: ${(props) => (props.$active ? "rgba(56, 189, 248, 0.22)" : "transparent")};

  &:last-child {
    border-right: none;
  }
`;

const Rolls = styled.div`
  display: grid;
  grid-template-columns: ${(props) => (props.$tenth ? "1fr 1fr 1fr" : "1fr 1fr")};
  height: 1.05rem;
  font-size: 0.72rem;
  line-height: 1.05rem;
  text-align: center;
`;

const Roll = styled.span`
  border-left: 1px solid rgba(248, 250, 252, 0.18);
  &:first-child {
    border-left: none;
  }
`;

const Total = styled.div`
  font-size: 0.78rem;
  font-weight: 700;
  text-align: center;
  min-height: 1.05rem;
`;

const Sum = styled.div`
  min-width: 2.6rem;
  padding: 0.2rem 0.4rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: rgba(15, 23, 42, 0.45);
  font-weight: 700;
`;

export const BowlingScoreboard = ({ bowling }) => {
  const marks = bowling?.marks ?? Array.from({ length: 10 }, () => ["", "", ""]);
  const totals = bowling?.totals ?? Array.from({ length: 10 }, () => null);
  const frame = bowling?.frame ?? 1;
  const total = bowling?.total;
  const settling = bowling?.settling;
  const resetIn = bowling?.resetIn ?? 0;

  return (
    <Board aria-label="Bowling scoreboard">
      {marks.map((rolls, index) => {
        const cells = index === 9 ? [rolls[0], rolls[1], rolls[2]] : [rolls[0], rolls[1]];
        return (
          <Frame key={index} $tenth={index === 9} $active={frame === index + 1 && !bowling?.gameOver}>
            <Rolls $tenth={index === 9}>
              {cells.map((mark, roll) => (
                <Roll key={roll}>{mark || ""}</Roll>
              ))}
            </Rolls>
            <Total>{totals[index] ?? ""}</Total>
          </Frame>
        );
      })}
      <Sum>
        <span>{total ?? 0}</span>
        <span style={{ fontSize: "0.65rem", fontWeight: 500 }}>
          {settling ? `${Math.ceil(resetIn)}s` : bowling?.gameOver ? "Game" : `F${frame}`}
        </span>
      </Sum>
    </Board>
  );
};
