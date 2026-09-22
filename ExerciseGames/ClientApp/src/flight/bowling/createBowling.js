import * as THREE from "three";
import {
  PIN_BASE,
  PIN_BELLY,
  PIN_HEAD,
  PIN_HEIGHT,
  PIN_RESET_DELAY,
  PIN_SPACING,
  pinSlots,
} from "./dimensions";
import { createBowlingGame, stepBowlingGame } from "./game";
import { createPinBody } from "./physics";
import { currentFrameIndex, frameTotals, gameTotal, isGameOver, rollMarks } from "./score";

export const ALLEY = {
  x: 72,
  headZ: -210,
  laneWidth: PIN_SPACING * 3 + PIN_BELLY * 2.4,
  laneLength: 118,
};

const PIN_COLOR = 0xf8f4ea;
const STRIPE_COLOR = 0xb91c1c;

export const createBowling = () => {
  const originX = ALLEY.x;
  const originZ = ALLEY.headZ;
  const group = new THREE.Group();
  group.name = "Bowling alley";
  group.add(createAlleyMeshes(originX, originZ));

  const pinsGroup = new THREE.Group();
  group.add(pinsGroup);

  const bodies = pinSlots().map((slot) => createPinBody(originX + slot.x, originZ + slot.z));
  const meshes = bodies.map((body) => {
    const mesh = createPinMesh();
    mesh.matrixAutoUpdate = false;
    pinsGroup.add(mesh);
    syncPinMesh(mesh, body);
    return mesh;
  });

  const game = createBowlingGame(bodies);

  const update = (state, dt) => {
    stepBowlingGame(game, { state, dt });
    bodies.forEach((body, index) => {
      meshes[index].visible = !body.inactive;
      if (!body.inactive && (!body.sleeping || body.dirty)) {
        syncPinMesh(meshes[index], body);
        body.dirty = false;
      }
    });
    return snapshot(game);
  };

  return { group, update, alley: ALLEY };
};

export const alleyBounds = () => ({
  minX: ALLEY.x - ALLEY.laneWidth * 0.5 - 8,
  maxX: ALLEY.x + ALLEY.laneWidth * 0.5 + 8,
  minZ: ALLEY.headZ - PIN_SPACING * 4 - 18,
  maxZ: ALLEY.headZ + ALLEY.laneLength + 8,
});

export const pointInAlley = (x, z, pad = 6) => {
  const bounds = alleyBounds();
  return (
    x > bounds.minX - pad &&
    x < bounds.maxX + pad &&
    z > bounds.minZ - pad &&
    z < bounds.maxZ + pad
  );
};

const snapshot = (game) => ({
  frames: game.card.frames,
  marks: rollMarks(game.card.frames),
  totals: frameTotals(game.card.frames),
  total: gameTotal(game.card.frames),
  frame: currentFrameIndex(game.card.frames) + 1,
  settling: game.phase === "settling",
  resetIn: game.settleIn,
  gameOver: isGameOver(game.card.frames) || Boolean(game.startNext),
  delay: PIN_RESET_DELAY,
});

const syncPinMesh = (mesh, body) => {
  mesh.position.set(body.p[0], body.p[1], body.p[2]);
  mesh.quaternion.set(body.q[0], body.q[1], body.q[2], body.q[3]);
  mesh.updateMatrix();
};

const createPinMesh = () => {
  const points = pinProfile().map(([radius, y]) => new THREE.Vector2(radius, y));
  const geometry = new THREE.LatheGeometry(points, 10);
  geometry.translate(0, -PIN_HEIGHT * 0.38, 0);
  const pin = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ color: PIN_COLOR })
  );
  const stripe = new THREE.Mesh(
    new THREE.TorusGeometry(PIN_HEAD * 0.52, PIN_HEIGHT * 0.012, 6, 16),
    new THREE.MeshLambertMaterial({ color: STRIPE_COLOR })
  );
  stripe.rotation.x = Math.PI / 2;
  stripe.position.y = PIN_HEIGHT * 0.62 - PIN_HEIGHT * 0.38;
  pin.add(stripe);
  return pin;
};

const pinProfile = () => {
  const belly = PIN_BELLY * 0.5;
  const base = PIN_BASE * 0.5;
  const head = PIN_HEAD * 0.5;
  const h = PIN_HEIGHT;
  return [
    [0.02, 0],
    [base * 0.7, h * 0.02],
    [base, h * 0.05],
    [belly * 0.72, h * 0.16],
    [belly, h * 0.32],
    [belly * 0.88, h * 0.44],
    [belly * 0.42, h * 0.58],
    [head * 0.85, h * 0.7],
    [head, h * 0.84],
    [head * 0.72, h * 0.94],
    [0.05, h],
  ];
};

const createAlleyMeshes = (x, z) => {
  const group = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0xc4a574 });
  const gutterMat = new THREE.MeshLambertMaterial({ color: 0x1f2937 });
  const pitMat = new THREE.MeshLambertMaterial({ color: 0x292524 });
  const paint = new THREE.MeshLambertMaterial({ color: 0xf8fafc });

  const lane = new THREE.Mesh(
    new THREE.BoxGeometry(ALLEY.laneWidth, 0.18, ALLEY.laneLength),
    wood
  );
  lane.position.set(x, 0.09, z + ALLEY.laneLength * 0.5 - PIN_SPACING * 0.4);
  group.add(lane);

  [-1, 1].forEach((side) => {
    const gutter = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.5, ALLEY.laneLength),
      gutterMat
    );
    gutter.position.set(
      x + side * (ALLEY.laneWidth * 0.5 + 2.1),
      -0.08,
      z + ALLEY.laneLength * 0.5 - PIN_SPACING * 0.4
    );
    group.add(gutter);
  });

  const pit = new THREE.Mesh(
    new THREE.BoxGeometry(ALLEY.laneWidth + 10, 3.2, 16),
    pitMat
  );
  pit.position.set(x, 1.4, z - PIN_SPACING * 3.2 - 10);
  group.add(pit);

  const back = new THREE.Mesh(
    new THREE.BoxGeometry(ALLEY.laneWidth + 10, 8, 1.2),
    pitMat
  );
  back.position.set(x, 4, z - PIN_SPACING * 3.2 - 18);
  group.add(back);

  const foul = new THREE.Mesh(
    new THREE.BoxGeometry(ALLEY.laneWidth, 0.2, 0.45),
    paint
  );
  foul.position.set(x, 0.2, z + ALLEY.laneLength - 8);
  group.add(foul);

  const sign = bowlingSign();
  sign.position.set(x, 9.5, z - PIN_SPACING * 3.2 - 18.2);
  group.add(sign);
  return group;
};

const bowlingSign = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, 512, 160);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 64px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("BOWLING", 256, 70);
  ctx.font = "500 28px Inter, sans-serif";
  ctx.fillText("MEADOW LANES", 256, 118);
  const texture = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 6.8),
    new THREE.MeshBasicMaterial({ map: texture })
  );
  mesh.rotation.y = Math.PI;
  return mesh;
};
