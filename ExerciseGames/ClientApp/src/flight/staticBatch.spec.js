import * as THREE from "three";
import { freezeStaticMeshes, releaseRetiredGeometries } from "./staticBatch";

test("freezeStaticMeshes bakes transforms and keeps separate materials apart", () => {
  const root = new THREE.Group();
  const shared = new THREE.MeshLambertMaterial({ color: 0x226622 });
  const other = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const nested = new THREE.Group();
  nested.position.set(0, 10, 0);

  const left = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), shared);
  left.position.set(-5, 0, 0);
  const right = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), shared);
  right.position.set(5, 0, 0);
  const marked = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), other);
  marked.position.set(0, 0, 4);
  nested.add(left, right);
  root.add(nested, marked);

  const retired = freezeStaticMeshes(root);
  const meshes = [];
  root.traverse((obj) => {
    if (obj.isMesh) meshes.push(obj);
  });
  expect(meshes).toHaveLength(2);

  const merged = meshes.find((mesh) => mesh.material === shared);
  merged.geometry.computeBoundingBox();
  expect(merged.geometry.boundingBox.min.x).toBeCloseTo(-6);
  expect(merged.geometry.boundingBox.max.x).toBeCloseTo(6);
  expect(merged.geometry.boundingBox.min.y).toBeCloseTo(9);
  expect(merged.geometry.boundingBox.max.y).toBeCloseTo(11);
  expect(marked.position.z).toBe(4);
  expect(retired.size).toBeGreaterThan(0);

  releaseRetiredGeometries(root, retired);
  expect(retired.size).toBe(0);
  expect(merged.geometry.getAttribute("position").count).toBeGreaterThan(0);
});

test("textured meshes stay where they were placed", () => {
  const root = new THREE.Group();
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 1),
    new THREE.MeshBasicMaterial({ map: new THREE.Texture() })
  );
  sign.position.set(4, 8, -2);
  sign.rotation.y = Math.PI;
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
  root.add(
    sign,
    new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material),
    new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
  );

  freezeStaticMeshes(root);

  expect(sign.position.x).toBe(4);
  expect(sign.matrixWorld.elements[12]).toBeCloseTo(4);
  expect(sign.matrixWorld.elements[13]).toBeCloseTo(8);
  expect(sign.matrixWorld.elements[14]).toBeCloseTo(-2);
  expect(sign.matrixWorldAutoUpdate).toBe(false);
});

test("shared geometry is released only after every chunk has been frozen", () => {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshLambertMaterial({ color: 0x334455 });
  const first = new THREE.Group();
  const second = new THREE.Group();
  first.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
  second.add(
    new THREE.Mesh(geometry, material).translateX(3),
    new THREE.Mesh(geometry, material).translateX(-3)
  );
  const retired = new Set();
  freezeStaticMeshes(first, retired);
  freezeStaticMeshes(second, retired);
  const scene = new THREE.Group();
  scene.add(first, second);
  releaseRetiredGeometries(scene, retired);

  const counts = [];
  scene.traverse((obj) => {
    if (obj.isMesh) {
      counts.push(obj.geometry.getAttribute("position").count);
    }
  });
  expect(counts).toHaveLength(2);
  expect(counts.every((count) => count > 8)).toBe(true);
});
