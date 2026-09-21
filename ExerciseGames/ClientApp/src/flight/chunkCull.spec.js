import { CHUNK_SIZE, chunkCenter, chunkIndex, isChunkInRange } from "./chunkCull";

test("chunkIndex maps world positions onto a grid", () => {
  expect(chunkIndex(10, 10)).toEqual([0, 0]);
  expect(chunkIndex(-1, -1)).toEqual([-1, -1]);
  expect(chunkIndex(CHUNK_SIZE, 0)).toEqual([1, 0]);
});

test("nearby chunks stay in draw distance and far ones do not", () => {
  const camera = { x: 0, y: 20, z: 0 };
  const nearby = { ...chunkCenter(0, 0), y: 40, radius: 300 };
  const distant = { x: 5000, y: 40, z: 0, radius: 300 };
  expect(isChunkInRange(camera, nearby)).toBe(true);
  expect(isChunkInRange(camera, distant)).toBe(false);
});
