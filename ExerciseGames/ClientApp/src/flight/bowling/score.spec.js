import {
  createScorecard,
  currentFrameIndex,
  frameTotals,
  gameTotal,
  isGameOver,
  recordRoll,
  rollMarks,
} from "./score";

test("a strike is worth ten plus the next two rolls", () => {
  let card = createScorecard();
  card = recordRoll(card, 10);
  card = recordRoll(card, 3);
  card = recordRoll(card, 6);
  expect(frameTotals(card.frames)[0]).toBe(19);
  expect(frameTotals(card.frames)[1]).toBe(28);
});

test("a spare is worth ten plus the next roll", () => {
  let card = createScorecard();
  card = recordRoll(card, 7);
  card = recordRoll(card, 3);
  card = recordRoll(card, 4);
  card = recordRoll(card, 2);
  expect(frameTotals(card.frames)[0]).toBe(14);
  expect(frameTotals(card.frames)[1]).toBe(20);
});

test("twelve strikes score 300", () => {
  let card = createScorecard();
  for (let i = 0; i < 12; i += 1) {
    card = recordRoll(card, 10);
  }
  expect(isGameOver(card.frames)).toBe(true);
  expect(gameTotal(card.frames)).toBe(300);
  expect(rollMarks(card.frames)[0]).toEqual(["", "X"]);
  expect(rollMarks(card.frames)[9]).toEqual(["X", "X", "X"]);
});

test("a gutter game stays at zero", () => {
  let card = createScorecard();
  for (let i = 0; i < 20; i += 1) {
    card = recordRoll(card, 0);
  }
  expect(gameTotal(card.frames)).toBe(0);
  expect(currentFrameIndex(card.frames)).toBe(9);
});

test("the second ball cannot knock down more than the pins still standing", () => {
  let card = createScorecard();
  card = recordRoll(card, 7);
  card = recordRoll(card, 9);
  expect(card.frames[0]).toEqual([7, 3]);
});
