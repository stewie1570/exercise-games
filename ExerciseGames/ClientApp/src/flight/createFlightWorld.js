import * as THREE from "three";
import { CHUNK_SIZE, DRAW_DISTANCE, chunkCenter, chunkIndex, isChunkInRange } from "./chunkCull";
import { createBowling, pointInAlley } from "./bowling/createBowling";
import { PLANE_WINGSPAN, WING_CHORD, WING_SHEAR, WING_Y, WING_Z } from "./bowling/dimensions";
import { FLIGHT } from "./physics";

const GROUND_Y = 0;

const colors = {
  grass: 0x4d7c3f,
  grassDark: 0x3d6a32,
  runway: 0x3f4450,
  road: 0x3f3f46,
  roadEdge: 0x27272a,
  marking: 0xf4f4f5,
  hangar: 0xb45309,
  hangarRoof: 0x7c2d12,
  tower: 0xe2e8f0,
  towerTop: 0x0ea5e9,
  trunk: 0x9a6b3f,
  palm: 0x2f9e44,
  palmDark: 0x1f7a34,
  water: 0x2b6cb0,
  waterDeep: 0x1e4e8c,
  bank: 0x92400e,
  rock: 0x6b7280,
  rockWarm: 0x78716c,
  snow: 0xf8fafc,
  planeBody: 0xf59e0b,
  planeWing: 0xf8fafc,
  planeAccent: 0x1f2937,
  planeStripe: 0x0369a1,
  prop: 0x111827,
};

export const createFlightWorld = (container, { localTint } = {}) => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b7e0);
  scene.fog = new THREE.Fog(0x87b7e0, 240, 1600);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, DRAW_DISTANCE + 80);
  const dpr = window.devicePixelRatio || 1;
  const renderer = new THREE.WebGLRenderer({
    antialias: dpr < 1.5,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(dpr, 1.5));
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xdbeafe, 0x4d7c3f, 1.05));
  const sun = new THREE.DirectionalLight(0xfff7ed, 1.15);
  sun.position.set(80, 140, 40);
  scene.add(sun);

  const { chunks, add } = createChunkIndex();
  scene.add(createGround());
  createLakes(add);
  createMountains(add);
  createRivers(add);
  createRoads(add);
  add(createAirport());
  createTrees(add);
  chunks.forEach((chunk) => {
    chunk.updateMatrixWorld(true);
    scene.add(chunk);
  });

  const aircraft = createUltralight(localTint);
  scene.add(aircraft);
  const remoteCraft = new Map();
  const retiredCraft = [];

  const bowling = createBowling();
  scene.add(bowling.group);

  const lookAt = new THREE.Vector3();
  const chaseLocal = new THREE.Vector3(0, 2.15, 9.2);
  const focusLocal = new THREE.Vector3(0, 0.7, -0.4);
  const cameraUp = new THREE.Vector3();
  const frustum = new THREE.Frustum();
  const projScreen = new THREE.Matrix4();
  const chunkSphere = new THREE.Sphere();

  const setSize = () => {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  const syncRemotes = (remotes, dt) => {
    const seen = new Set();
    remotes.forEach((remote) => {
      if (!remote?.state) {
        return;
      }
      seen.add(remote.id);
      let craft = remoteCraft.get(remote.id);
      if (!craft) {
        craft = createUltralight(remote.tint);
        scene.add(craft);
        remoteCraft.set(remote.id, craft);
      }
      poseCraft(craft, remote.state, dt);
    });
    for (const [id, craft] of remoteCraft) {
      if (seen.has(id)) {
        continue;
      }
      scene.remove(craft);
      remoteCraft.delete(id);
      retiredCraft.push(craft);
    }
  };

  const update = (state, dt, frame = {}) => {
    poseCraft(aircraft, state, dt);
    syncRemotes(frame.remotes ?? [], dt);

    aircraft.updateMatrixWorld();
    camera.position.copy(chaseLocal);
    aircraft.localToWorld(camera.position);
    lookAt.copy(focusLocal);
    aircraft.localToWorld(lookAt);
    cameraUp.set(0, 1, 0).transformDirection(aircraft.matrixWorld);
    camera.up.copy(cameraUp);
    camera.lookAt(lookAt);
    camera.updateMatrixWorld();
    let bowlingHud;
    if (frame.simulateBowling === false) {
      bowling.syncMeshes();
      bowlingHud = frame.bowlingHud ?? bowling.hud();
    } else {
      bowlingHud = bowling.update(state, dt);
    }
    projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreen);
    for (const chunk of chunks) {
      const bounds = chunk.userData.cull;
      if (!isChunkInRange(camera.position, bounds)) {
        chunk.visible = false;
        continue;
      }
      chunkSphere.center.set(bounds.x, bounds.y, bounds.z);
      chunkSphere.radius = bounds.radius;
      chunk.visible = frustum.intersectsSphere(chunkSphere);
    }
    renderer.render(scene, camera);
    return bowlingHud;
  };

  const dispose = () => {
    retiredCraft.forEach((craft) => scene.add(craft));
    const disposed = new Set();
    scene.traverse((object) => {
      if (object.geometry && !disposed.has(object.geometry)) {
        disposed.add(object.geometry);
        object.geometry.dispose();
      }
      const materials = object.material ? [].concat(object.material) : [];
      materials.forEach((material) => {
        if (disposed.has(material)) {
          return;
        }
        disposed.add(material);
        material.map?.dispose?.();
        material.dispose?.();
      });
    });
    renderer.dispose();
    renderer.domElement.remove();
  };

  setSize();
  return { setSize, update, dispose, bowling };
};

const createGround = () => {
  const group = new THREE.Group();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(3200, 3200),
    new THREE.MeshLambertMaterial({ color: colors.grass })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND_Y;
  group.add(ground);

  const patch = new THREE.Mesh(
    new THREE.CircleGeometry(90, 32),
    new THREE.MeshLambertMaterial({ color: colors.grassDark })
  );
  patch.rotation.x = -Math.PI / 2;
  patch.position.set(0, 0.02, 0);
  group.add(patch);
  return group;
};

const createChunkIndex = () => {
  const chunks = [];
  const byKey = new Map();
  const get = (x, z) => {
    const [ix, iz] = chunkIndex(x, z);
    const key = `${ix},${iz}`;
    let chunk = byKey.get(key);
    if (!chunk) {
      const center = chunkCenter(ix, iz);
      chunk = new THREE.Group();
      chunk.name = `chunk:${key}`;
      chunk.matrixWorldAutoUpdate = false;
      chunk.userData.cull = {
        x: center.x,
        y: 40,
        z: center.z,
        radius: CHUNK_SIZE * 0.75 + 140,
      };
      byKey.set(key, chunk);
      chunks.push(chunk);
    }
    return chunk;
  };
  const add = (object) => {
    get(object.position.x, object.position.z).add(object);
  };
  return { chunks, add, get };
};

const addPolyline = (add, points, { width, y, color, depth = 0.1 }) => {
  const material = new THREE.MeshLambertMaterial({ color });
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const length = Math.hypot(dx, dz);
    if (length < 0.2) {
      continue;
    }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, depth, length + 0.6), material);
    mesh.position.set((ax + bx) / 2, y, (az + bz) / 2);
    mesh.rotation.y = Math.atan2(dx, dz);
    add(mesh);
  }
};

const addDashes = (add, points, { width, length, gap, y, color }) => {
  const material = new THREE.MeshLambertMaterial({ color });
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const span = Math.hypot(dx, dz);
    if (span < 1) {
      continue;
    }
    const ux = dx / span;
    const uz = dz / span;
    const step = length + gap;
    for (let along = length * 0.5; along < span - length * 0.5; along += step) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, length), material);
      dash.position.set(ax + ux * along, y, az + uz * along);
      dash.rotation.y = Math.atan2(dx, dz);
      add(dash);
    }
  }
};

const lakeShape = (radiusX, radiusZ, seed) => {
  const lobes = 9;
  const points = [];
  for (let i = 0; i < lobes; i += 1) {
    const angle = (i / lobes) * Math.PI * 2;
    const wobble =
      0.76 +
      0.16 * Math.sin(seed + i * 1.7) +
      0.1 * Math.sin(seed * 2.2 + i * 3.1);
    points.push([Math.cos(angle) * radiusX * wobble, Math.sin(angle) * radiusZ * wobble]);
  }
  const shape = new THREE.Shape();
  const mid = (index) => {
    const [ax, ay] = points[index % lobes];
    const [bx, by] = points[(index + 1) % lobes];
    return [(ax + bx) / 2, (ay + by) / 2];
  };
  const [startX, startY] = mid(lobes - 1);
  shape.moveTo(startX, startY);
  points.forEach(([x, y], index) => {
    const [mx, my] = mid(index);
    shape.quadraticCurveTo(x, y, mx, my);
  });
  return shape;
};

const createLakes = (add) => {
  const plots = [
    [180, 260, 36, 28, colors.water, 1.2],
    [280, 250, 32, 24, colors.waterDeep, 2.4],
    [210, 360, 40, 26, colors.water, 3.7],
    [-360, 250, 46, 30, colors.waterDeep, 4.1],
    [-470, 280, 34, 24, colors.water, 5.5],
    [160, -320, 30, 24, colors.water, 6.2],
    [-300, -280, 34, 22, colors.waterDeep, 7.8],
  ];
  const materialFor = new Map();
  plots.forEach(([x, z, radiusX, radiusZ, color, seed]) => {
    let material = materialFor.get(color);
    if (!material) {
      material = new THREE.MeshLambertMaterial({
        color,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      materialFor.set(color, material);
    }
    const lake = new THREE.Mesh(
      new THREE.ExtrudeGeometry(lakeShape(radiusX, radiusZ, seed), {
        depth: 0.08,
        bevelEnabled: false,
        curveSegments: 8,
      }),
      material
    );
    lake.geometry.rotateX(-Math.PI / 2);
    lake.rotation.y = seed * 0.35;
    // Sit just above the grass so the surface does not z-fight the ground plane.
    lake.position.set(x, 0.1, z);
    add(lake);
  });
};

const addMountain = (add, x, z, height, radius, rockColor) => {
  const rock = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, 8),
    new THREE.MeshLambertMaterial({ color: rockColor })
  );
  rock.position.set(x, height / 2, z);
  add(rock);
  if (height > 72) {
    const snowHeight = height * 0.34;
    const snow = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.42, snowHeight, 8),
      new THREE.MeshLambertMaterial({ color: colors.snow })
    );
    snow.position.set(x, height - snowHeight * 0.45, z);
    add(snow);
  }
};

const createMountains = (add) => {
  const peaks = [
    [-420, -80, 95, 70, colors.rock],
    [-510, 40, 128, 88, colors.rockWarm],
    [-480, -220, 82, 62, colors.rock],
    [-620, -100, 168, 104, colors.rockWarm],
    [-390, 180, 74, 56, colors.rock],
    [-700, 200, 146, 92, colors.rock],
    [-560, 320, 90, 66, colors.rockWarm],
    [-640, -360, 118, 80, colors.rock],
    [-780, 40, 154, 96, colors.rockWarm],
    [480, -120, 112, 78, colors.rock],
    [580, 60, 158, 98, colors.rockWarm],
    [430, 240, 78, 58, colors.rock],
    [650, -280, 132, 84, colors.rock],
    [720, 180, 104, 72, colors.rockWarm],
    [540, 400, 92, 66, colors.rock],
    [800, -40, 140, 90, colors.rockWarm],
    [360, 520, 70, 52, colors.rock],
    [-180, -620, 134, 90, colors.rock],
    [90, -710, 176, 112, colors.rockWarm],
    [230, -580, 98, 74, colors.rock],
    [-40, -800, 150, 98, colors.rock],
    [360, -730, 86, 62, colors.rockWarm],
    [-280, -740, 120, 82, colors.rock],
    [160, 560, 68, 50, colors.rock],
    [-90, 660, 88, 64, colors.rockWarm],
    [310, 720, 76, 56, colors.rock],
    [-220, 780, 102, 70, colors.rock],
    [20, 860, 94, 68, colors.rockWarm],
  ];
  peaks.forEach(([x, z, height, radius, color]) => {
    addMountain(add, x, z, height, radius, color);
  });

  const foothills = [
    [-300, -40, 28, 36], [-340, 90, 24, 30], [-280, 260, 22, 28],
    [320, -40, 26, 32], [340, 140, 22, 28], [300, 320, 20, 26],
    [-120, -480, 30, 34], [160, -500, 26, 30], [40, 460, 18, 24],
  ];
  foothills.forEach(([x, z, height, radius]) => {
    addMountain(add, x, z, height, radius, colors.rock);
  });
};

const RIVER = [
  [-520, -820], [-360, -560], [-280, -360], [-230, -180],
  [-200, 20], [-240, 180], [-210, 320], [-150, 470],
  [20, 610], [180, 720], [340, 840],
];

const TRIBUTARY = [
  [420, -640], [340, -400], [280, -220], [240, -40],
  [210, 120], [90, 250], [-80, 300], [-210, 320],
];

const createRivers = (add) => {
  addPolyline(add, RIVER, { width: 18, y: 0.04, color: colors.bank, depth: 0.08 });
  addPolyline(add, RIVER, { width: 11, y: 0.08, color: colors.water, depth: 0.1 });
  addPolyline(add, TRIBUTARY, { width: 12, y: 0.04, color: colors.bank, depth: 0.08 });
  addPolyline(add, TRIBUTARY, { width: 7, y: 0.08, color: colors.waterDeep, depth: 0.1 });

  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(38, 24),
    new THREE.MeshLambertMaterial({ color: colors.water })
  );
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(-210, 0.09, 320);
  add(lake);
};

const HIGHWAY = [
  [-780, 310], [-480, 310], [-210, 310], [80, 310], [360, 310], [820, 310],
];
const ACCESS = [
  [40, 92], [92, 92], [92, 210], [92, 310],
];
const NORTH_ROAD = [
  [78, 118], [86, -40], [120, -220], [210, -380], [310, -520],
];
const RIVER_ROAD = [
  [-120, 40], [-90, 180], [-70, 320], [-20, 470], [80, 580], [220, 690],
];

const createRoads = (add) => {
  const routes = [HIGHWAY, ACCESS, NORTH_ROAD, RIVER_ROAD];
  routes.forEach((points, index) => {
    const width = index === 0 ? 13 : 8;
    addPolyline(add, points, { width: width + 1.6, y: 0.05, color: colors.roadEdge, depth: 0.08 });
    addPolyline(add, points, { width, y: 0.09, color: colors.road, depth: 0.1 });
  });
  addDashes(add, HIGHWAY, { width: 0.45, length: 8, gap: 10, y: 0.16, color: colors.marking });
  addDashes(add, ACCESS, { width: 0.28, length: 5, gap: 7, y: 0.16, color: colors.marking });

  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(16, 1.4, 36),
    new THREE.MeshLambertMaterial({ color: 0x57534e })
  );
  bridge.position.set(-210, 1.1, 310);
  add(bridge);
};

const createAirport = () => {
  const group = new THREE.Group();
  group.name = "Meadow Airport";

  const runway = new THREE.Mesh(
    new THREE.BoxGeometry(28, 0.12, 420),
    new THREE.MeshLambertMaterial({ color: colors.runway })
  );
  runway.position.set(0, 0.06, -80);
  group.add(runway);

  for (let i = -9; i <= 8; i += 1) {
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.13, 12),
      new THREE.MeshLambertMaterial({ color: colors.marking })
    );
    dash.position.set(0, 0.13, 40 - i * 22);
    group.add(dash);
  }

  const threshold = new THREE.Mesh(
    new THREE.BoxGeometry(22, 0.13, 4),
    new THREE.MeshLambertMaterial({ color: colors.marking })
  );
  threshold.position.set(0, 0.13, 118);
  group.add(threshold);

  const taxiway = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.1, 48),
    new THREE.MeshLambertMaterial({ color: 0x52525b })
  );
  taxiway.position.set(22, 0.05, 70);
  taxiway.rotation.y = Math.PI / 5;
  group.add(taxiway);

  const hangar = new THREE.Mesh(
    new THREE.BoxGeometry(28, 10, 22),
    new THREE.MeshLambertMaterial({ color: colors.hangar })
  );
  hangar.position.set(48, 5, 70);
  group.add(hangar);
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(30, 1.2, 24),
    new THREE.MeshLambertMaterial({ color: colors.hangarRoof })
  );
  roof.position.set(48, 10.4, 70);
  group.add(roof);

  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(8, 18, 8),
    new THREE.MeshLambertMaterial({ color: colors.tower })
  );
  tower.position.set(-42, 9, 78);
  group.add(tower);
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(10, 4, 10),
    new THREE.MeshLambertMaterial({ color: colors.towerTop })
  );
  cab.position.set(-42, 20, 78);
  group.add(cab);

  const windsockPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0xd4d4d8 })
  );
  windsockPole.position.set(-18, 4, 108);
  group.add(windsockPole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 4.5, 8),
    new THREE.MeshLambertMaterial({ color: 0xf97316 })
  );
  sock.rotation.z = -Math.PI / 2;
  sock.position.set(-15.2, 7.2, 108);
  group.add(sock);

  group.add(createAirportSign());
  return group;
};

const createAirportSign = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1e3a5f";
  ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 72px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("MEADOW AIRPORT", 512, 110);
  ctx.font = "500 36px Inter, sans-serif";
  ctx.fillText("UL 18  •  FIELD ELEV 12", 512, 175);
  const texture = new THREE.CanvasTexture(canvas);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 11.5),
    new THREE.MeshBasicMaterial({ map: texture })
  );
  sign.position.set(0, 9, 132);
  sign.rotation.y = Math.PI;
  return sign;
};

const createPalm = (x, z, index) => {
  const palm = new THREE.Group();
  const height = 10 + (index % 4) * 1.6;
  const segments = 4;
  const segmentHeight = height / segments;
  const bend = ((index % 7) - 3) * 0.045;
  const trunkMat = sharedPalmMaterials.trunk;
  for (let segment = 0; segment < segments; segment += 1) {
    const trunk = new THREE.Mesh(sharedPalmGeometries.trunk, trunkMat);
    const taper = 1 - segment * 0.12;
    trunk.scale.set(taper, segmentHeight, taper);
    const base = segment * segmentHeight;
    trunk.position.set(bend * base, base + segmentHeight / 2, bend * base * 0.35);
    palm.add(trunk);
  }

  const crown = new THREE.Group();
  crown.position.y = height;
  const frondCount = 8;
  for (let i = 0; i < frondCount; i += 1) {
    const frond = new THREE.Mesh(
      sharedPalmGeometries.frond,
      i % 2 === 0 ? sharedPalmMaterials.frond : sharedPalmMaterials.frondDark
    );
    const length = 4.2 + (index % 3) * 0.45;
    frond.scale.set(1, 1, length);
    frond.position.set(0, -0.25, length * 0.42);
    frond.rotation.x = 0.72 + (i % 3) * 0.08;
    const arm = new THREE.Group();
    arm.rotation.y = (i / frondCount) * Math.PI * 2;
    arm.add(frond);
    crown.add(arm);
  }
  palm.add(crown);
  palm.position.set(x, 0, z);
  palm.rotation.y = index * 0.9;
  return palm;
};

const sharedPalmGeometries = {
  trunk: new THREE.CylinderGeometry(0.34, 0.48, 1, 6),
  frond: new THREE.BoxGeometry(0.55, 0.08, 1),
};

const sharedPalmMaterials = {
  trunk: new THREE.MeshLambertMaterial({ color: colors.trunk }),
  frond: new THREE.MeshLambertMaterial({ color: colors.palm }),
  frondDark: new THREE.MeshLambertMaterial({ color: colors.palmDark }),
};

const createTrees = (add) => {
  const spots = [
    [90, 40], [120, -30], [80, -160], [-90, -40], [-130, 20],
    [-70, -180], [140, 90], [-150, -90], [60, 200], [-40, -260],
    [200, -40], [-210, 60], [250, 140], [190, 200], [-260, 80],
    [-180, 240], [40, 400], [-40, 480], [140, -240], [-140, -320],
    [260, -200], [-320, -140], [320, 80], [380, 200], [-380, 140],
    [100, 500], [-160, 560], [220, 440], [-240, -420], [40, -420],
    [280, -360], [-80, 360], [160, 320], [-300, 360], [400, -80],
    [20, 240], [-60, 160], [70, -300],
  ];
  spots.forEach(([x, z], index) => {
    if (pointInAlley(x, z, 12)) {
      return;
    }
    add(createPalm(x, z, index));
  });
};

const poseCraft = (craft, state, dt) => {
  craft.position.set(state.x, state.altitude, state.z);
  craft.rotation.order = "YXZ";
  craft.rotation.y = -state.heading;
  const airborne = state.altitude > FLIGHT.minAltitude + 0.05;
  craft.rotation.z = airborne ? -(state.turn || 0) * 0.45 : 0;
  craft.rotation.x = airborne
    ? THREE.MathUtils.clamp(-(state.climbRate || 0) * 0.012, -0.18, 0.22)
    : 0;
  const spinning = state.moving || (state.throttle || 0) > 0.02;
  const propSpeed = spinning ? 10 + (state.speed || 0) * 0.4 + (state.throttle || 0) * 32 : 0;
  craft.userData.prop.rotation.z += propSpeed * dt;
};

const addSweptPanel = (group, material, { span, thickness, chord, y, z, zOffset = 0 }) => {
  const half = span / 2;
  for (const side of [1, -1]) {
    const geo = new THREE.BoxGeometry(half + 0.02, thickness, chord);
    geo.translate(side * half / 2, 0, zOffset);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      pos.setZ(i, pos.getZ(i) + Math.abs(pos.getX(i)) * WING_SHEAR);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(0, y, z);
    group.add(mesh);
  }
};

const sweptZ = (x, z) => z + Math.abs(x) * WING_SHEAR;

const createUltralight = (tint) => {
  const group = new THREE.Group();
  group.frustumCulled = false;
  const bodyMat = new THREE.MeshLambertMaterial({ color: tint?.body ?? colors.planeBody });
  const wingMat = new THREE.MeshLambertMaterial({ color: colors.planeWing });
  const darkMat = new THREE.MeshLambertMaterial({ color: colors.planeAccent });
  const stripeMat = new THREE.MeshLambertMaterial({ color: tint?.stripe ?? colors.planeStripe });
  const propMat = new THREE.MeshLambertMaterial({ color: colors.prop });
  const glassMat = new THREE.MeshLambertMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.45,
  });

  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 2.2, 6, 12), bodyMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.set(0, 0.55, -0.15);
  group.add(fuselage);

  const cowling = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.55, 10), darkMat);
  cowling.rotation.x = Math.PI / 2;
  cowling.position.set(0, 0.55, -1.42);
  group.add(cowling);

  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    glassMat
  );
  canopy.position.set(0, 0.78, -0.35);
  group.add(canopy);

  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 3.4, 8), darkMat);
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, 0.58, 2.05);
  group.add(boom);

  addSweptPanel(group, wingMat, {
    span: PLANE_WINGSPAN,
    thickness: 0.12,
    chord: WING_CHORD,
    y: WING_Y,
    z: WING_Z,
  });
  addSweptPanel(group, stripeMat, {
    span: PLANE_WINGSPAN + 0.05,
    thickness: 0.04,
    chord: 0.28,
    y: WING_Y + 0.07,
    z: WING_Z,
    zOffset: 0.5,
  });

  addStrut(group, darkMat, new THREE.Vector3(0.38, 0.62, 0.15), new THREE.Vector3(2.9, 1.56, sweptZ(2.9, 0.2)));
  addStrut(group, darkMat, new THREE.Vector3(-0.38, 0.62, 0.15), new THREE.Vector3(-2.9, 1.56, sweptZ(2.9, 0.2)));
  addStrut(group, darkMat, new THREE.Vector3(0.38, 0.62, -0.35), new THREE.Vector3(2.6, 1.56, sweptZ(2.6, -0.45)));
  addStrut(group, darkMat, new THREE.Vector3(-0.38, 0.62, -0.35), new THREE.Vector3(-2.6, 1.56, sweptZ(2.6, -0.45)));

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.15, 0.85), wingMat);
  fin.position.set(0, 1.15, 3.62);
  group.add(fin);
  const finStripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.85), stripeMat);
  finStripe.position.set(0, 1.55, 3.62);
  group.add(finStripe);

  const stabilizer = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.7), wingMat);
  stabilizer.position.set(0, 0.58, 3.55);
  group.add(stabilizer);

  const prop = new THREE.Group();
  prop.position.set(0, 0.55, -1.78);
  const spinner = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), darkMat);
  spinner.scale.set(1, 1, 1.3);
  prop.add(spinner);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.12, 0.1), propMat);
  const blade2 = blade.clone();
  blade2.rotation.z = Math.PI / 2;
  prop.add(blade, blade2);
  group.add(prop);

  addWheel(group, darkMat, 0, -0.42, -1.15, 0.16);
  addWheel(group, darkMat, 0.78, -0.48, 0.35, 0.2);
  addWheel(group, darkMat, -0.78, -0.48, 0.35, 0.2);
  addStrut(group, darkMat, new THREE.Vector3(0.2, 0.2, -0.9), new THREE.Vector3(0, -0.28, -1.12));
  addStrut(group, darkMat, new THREE.Vector3(0.28, 0.22, 0.15), new THREE.Vector3(0.78, -0.32, 0.32));
  addStrut(group, darkMat, new THREE.Vector3(-0.28, 0.22, 0.15), new THREE.Vector3(-0.78, -0.32, 0.32));

  group.userData.prop = prop;
  return group;
};

const addStrut = (group, material, from, to) => {
  const dir = new THREE.Vector3().subVectors(to, from);
  const length = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, length, 6), material);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  group.add(mesh);
};

const addWheel = (group, material, x, y, z, radius) => {
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.12, 10), material);
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(x, y, z);
  group.add(wheel);
};
