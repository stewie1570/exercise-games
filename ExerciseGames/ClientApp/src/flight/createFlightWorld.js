import * as THREE from "three";
import { FLIGHT } from "./physics";

const GROUND_Y = 0;

const colors = {
  grass: 0x4d7c3f,
  grassDark: 0x3d6a32,
  runway: 0x3f4450,
  marking: 0xf4f4f5,
  hangar: 0xb45309,
  hangarRoof: 0x7c2d12,
  tower: 0xe2e8f0,
  towerTop: 0x0ea5e9,
  tree: 0x166534,
  trunk: 0x7c4a1e,
  gyroBody: 0xf59e0b,
  gyroAccent: 0x1f2937,
  rotor: 0x111827,
};

export const createFlightWorld = (container) => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b7e0);
  scene.fog = new THREE.Fog(0x87b7e0, 180, 900);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xdbeafe, 0x4d7c3f, 1.05));
  const sun = new THREE.DirectionalLight(0xfff7ed, 1.15);
  sun.position.set(80, 140, 40);
  scene.add(sun);

  scene.add(createGround());
  scene.add(createAirport());
  scene.add(createTrees());

  const aircraft = createGyrocopter();
  scene.add(aircraft);

  const lookAt = new THREE.Vector3();
  const chaseLocal = new THREE.Vector3(0, 1.55, 7.2);
  const focusLocal = new THREE.Vector3(0, 0.4, -0.15);
  const cameraUp = new THREE.Vector3();

  const setSize = () => {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  const update = (state, dt) => {
    aircraft.position.set(state.x, state.altitude, state.z);
    aircraft.rotation.order = "YXZ";
    aircraft.rotation.y = -state.heading;
    const airborne = state.altitude > FLIGHT.minAltitude + 0.05;
    aircraft.rotation.z = airborne ? -(state.turn || 0) * 0.45 : 0;
    aircraft.rotation.x = airborne
      ? THREE.MathUtils.clamp(-(state.climbRate || 0) * 0.012, -0.18, 0.22)
      : 0;
    const rotorSpeed = state.moving ? 8 + (state.speed || 0) * 0.35 + state.throttle * 18 : 2.4;
    const propSpeed = state.moving ? 6 + (state.speed || 0) * 0.5 + state.throttle * 28 : 0;
    aircraft.userData.rotor.rotation.y += rotorSpeed * dt;
    aircraft.userData.prop.rotation.x += propSpeed * dt;

    aircraft.updateMatrixWorld();
    camera.position.copy(chaseLocal);
    aircraft.localToWorld(camera.position);
    lookAt.copy(focusLocal);
    aircraft.localToWorld(lookAt);
    cameraUp.set(0, 1, 0).transformDirection(aircraft.matrixWorld);
    camera.up.copy(cameraUp);
    camera.lookAt(lookAt);
    renderer.render(scene, camera);
  };

  const dispose = () => {
    renderer.dispose();
    renderer.domElement.remove();
  };

  setSize();
  return { setSize, update, dispose };
};

const createGround = () => {
  const group = new THREE.Group();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
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
  ctx.fillText("GYRO 18  •  FIELD ELEV 12", 512, 175);
  const texture = new THREE.CanvasTexture(canvas);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 11.5),
    new THREE.MeshBasicMaterial({ map: texture })
  );
  sign.position.set(0, 9, 132);
  sign.rotation.y = Math.PI;
  return sign;
};

const createTrees = () => {
  const group = new THREE.Group();
  const spots = [
    [90, 40], [120, -30], [80, -160], [-90, -40], [-130, 20],
    [-70, -180], [140, 90], [-150, -90], [60, 200], [-40, -260],
    [200, -40], [-210, 60],
  ];
  spots.forEach(([x, z], index) => {
    const height = 8 + (index % 4) * 1.4;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.7, 3, 6),
      new THREE.MeshLambertMaterial({ color: colors.trunk })
    );
    trunk.position.set(x, 1.5, z);
    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(3.4, height, 7),
      new THREE.MeshLambertMaterial({ color: colors.tree })
    );
    leaves.position.set(x, 3 + height / 2, z);
    group.add(trunk, leaves);
  });
  return group;
};

const createGyrocopter = () => {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colors.gyroBody });
  const darkMat = new THREE.MeshLambertMaterial({ color: colors.gyroAccent });
  const rotorMat = new THREE.MeshLambertMaterial({ color: colors.rotor });

  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 2.4, 6, 12), bodyMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.set(0, 0.2, 0.15);
  group.add(fuselage);

  const cabin = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.45 })
  );
  cabin.position.set(0, 0.55, -0.55);
  group.add(cabin);

  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.2, 8), darkMat);
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, 0.35, 2.2);
  group.add(boom);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.8), darkMat);
  tail.position.set(0, 0.85, 3.7);
  group.add(tail);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.8, 8), darkMat);
  mast.position.set(0, 1.5, 0);
  group.add(mast);

  const rotor = new THREE.Group();
  rotor.position.set(0, 2.4, 0);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.16, 10), rotorMat);
  rotor.add(hub);
  [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].forEach((angle) => {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 5.4), rotorMat);
    blade.rotation.y = angle;
    rotor.add(blade);
  });
  group.add(rotor);

  const prop = new THREE.Group();
  prop.position.set(0, 0.35, 1.55);
  const propHub = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), darkMat);
  prop.add(propHub);
  const bladeA = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.18), darkMat);
  const bladeB = bladeA.clone();
  bladeB.rotation.x = Math.PI / 2;
  prop.add(bladeA, bladeB);
  group.add(prop);

  const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.6, 10), darkMat);
  gear.rotation.z = Math.PI / 2;
  gear.position.set(0, -0.55, 0.4);
  group.add(gear);

  group.userData.rotor = rotor;
  group.userData.prop = prop;
  return group;
};
