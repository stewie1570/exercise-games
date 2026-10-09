import { createRoomCode, HOST_CODE_KEY, rememberedHostCode, rememberHostCode, ROOM_CODE_ALPHABET } from "./roomCode";

test("a hosted code is four letters this browser can remember", () => {
  const code = createRoomCode();
  expect(code).toHaveLength(4);
  for (const character of code) {
    expect(ROOM_CODE_ALPHABET.includes(character)).toBe(true);
  }

  rememberHostCode(code);
  expect(rememberedHostCode()).toBe(code);
  expect(localStorage.getItem(HOST_CODE_KEY)).toBe(code);
  localStorage.removeItem(HOST_CODE_KEY);
});
