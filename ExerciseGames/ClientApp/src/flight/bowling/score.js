export const createScorecard = () => ({
  frames: Array.from({ length: 10 }, () => []),
});

export const currentFrameIndex = (frames) => {
  for (let i = 0; i < 10; i += 1) {
    if (!isFrameClosed(frames, i)) {
      return i;
    }
  }
  return 9;
};

export const isGameOver = (frames) => isFrameClosed(frames, 9);

export const isFrameClosed = (frames, index) => {
  const rolls = frames[index] ?? [];
  if (index < 9) {
    return rolls[0] === 10 || rolls.length >= 2;
  }
  if (rolls.length < 2) {
    return false;
  }
  if (rolls[0] === 10 || rolls[0] + rolls[1] === 10) {
    return rolls.length >= 3;
  }
  return rolls.length >= 2;
};

export const recordRoll = (card, pinsKnocked) => {
  const pins = Math.max(0, Math.min(10, Math.round(pinsKnocked)));
  if (isGameOver(card.frames)) {
    return card;
  }
  const frames = card.frames.map((rolls) => [...rolls]);
  const index = currentFrameIndex(frames);
  const rolls = frames[index];
  const remaining = pinsRemainingForRoll(frames, index);
  frames[index] = [...rolls, Math.min(pins, remaining)];
  return { frames };
};

const pinsRemainingForRoll = (frames, index) => {
  const rolls = frames[index];
  if (index < 9) {
    if (rolls.length === 0) {
      return 10;
    }
    return Math.max(0, 10 - rolls[0]);
  }
  if (rolls.length === 0) {
    return 10;
  }
  if (rolls[0] === 10) {
    return rolls.length === 1 || rolls[1] === 10 ? 10 : Math.max(0, 10 - rolls[1]);
  }
  if (rolls.length === 1) {
    return Math.max(0, 10 - rolls[0]);
  }
  return 10;
};

export const frameTotals = (frames) => {
  const flat = [];
  frames.forEach((rolls) => {
    rolls.forEach((pins) => flat.push(pins));
  });

  const totals = Array.from({ length: 10 }, () => null);
  let roll = 0;
  let total = 0;
  for (let frame = 0; frame < 10; frame += 1) {
    if (frame === 9) {
      const tenth = frames[9];
      if (!isFrameClosed(frames, 9)) {
        break;
      }
      total += tenth.reduce((sum, pins) => sum + pins, 0);
      totals[frame] = total;
      break;
    }
    const first = flat[roll];
    if (first == null) {
      break;
    }
    if (first === 10) {
      const b = flat[roll + 1];
      const c = flat[roll + 2];
      if (b == null || c == null) {
        break;
      }
      total += 10 + b + c;
      totals[frame] = total;
      roll += 1;
      continue;
    }
    const second = flat[roll + 1];
    if (second == null) {
      break;
    }
    if (first + second === 10) {
      const bonus = flat[roll + 2];
      if (bonus == null) {
        break;
      }
      total += 10 + bonus;
      totals[frame] = total;
      roll += 2;
      continue;
    }
    total += first + second;
    totals[frame] = total;
    roll += 2;
  }
  return totals;
};

export const rollMarks = (frames) =>
  frames.map((rolls, index) => {
    if (index < 9) {
      if (rolls[0] === 10) {
        return ["", "X"];
      }
      if (rolls.length === 0) {
        return ["", ""];
      }
      const first = String(rolls[0]);
      if (rolls.length === 1) {
        return [first, ""];
      }
      if (rolls[0] + rolls[1] === 10) {
        return [first, "/"];
      }
      return [first, rolls[1] === 0 ? "-" : String(rolls[1])];
    }
    return tenthMarks(rolls);
  });

const tenthMarks = (rolls) => {
  const marks = ["", "", ""];
  rolls.forEach((pins, i) => {
    if (pins === 10) {
      marks[i] = "X";
      return;
    }
    if (i > 0 && rolls[i - 1] !== 10 && rolls[i - 1] + pins === 10) {
      marks[i] = "/";
      return;
    }
    marks[i] = pins === 0 ? "-" : String(pins);
  });
  return marks;
};

export const gameTotal = (frames) => {
  const totals = frameTotals(frames);
  return totals[9];
};
