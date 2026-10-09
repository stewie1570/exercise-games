export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const HOST_CODE_KEY = "together.hostCode";

export const createRoomCode = () => {
  const bytes = new Uint32Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => ROOM_CODE_ALPHABET[value % ROOM_CODE_ALPHABET.length]).join("");
};

export const rememberedHostCode = () => {
  try {
    return localStorage.getItem(HOST_CODE_KEY);
  } catch {
    return null;
  }
};

export const rememberHostCode = (code) => {
  localStorage.setItem(HOST_CODE_KEY, code);
};
