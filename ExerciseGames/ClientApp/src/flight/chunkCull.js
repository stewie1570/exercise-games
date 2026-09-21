export const CHUNK_SIZE = 400;
export const DRAW_DISTANCE = 1550;

export const chunkIndex = (x, z, size = CHUNK_SIZE) => [
  Math.floor(x / size),
  Math.floor(z / size),
];

export const chunkCenter = (ix, iz, size = CHUNK_SIZE) => ({
  x: (ix + 0.5) * size,
  z: (iz + 0.5) * size,
});

export const isChunkInRange = (camera, chunk, maxDist = DRAW_DISTANCE) => {
  const dx = camera.x - chunk.x;
  const dy = (camera.y || 0) - (chunk.y || 0);
  const dz = camera.z - chunk.z;
  return Math.hypot(dx, dy, dz) - chunk.radius <= maxDist;
};
