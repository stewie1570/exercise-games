import * as THREE from "three";

const scratch = new THREE.Matrix4();

const canMerge = (mesh) => {
  const material = mesh.material;
  if (!material || Array.isArray(material) || !mesh.geometry) {
    return false;
  }
  if (material.map || material.alphaMap) {
    return false;
  }
  if (material.transparent && material.opacity < 1) {
    return false;
  }
  return true;
};

const materialKey = (material) => [
  material.type,
  material.color?.getHexString?.() ?? "",
  material.opacity ?? 1,
  material.side ?? 0,
  material.polygonOffset ? material.polygonOffsetFactor : 0,
  material.polygonOffset ? material.polygonOffsetUnits : 0,
  material.depthWrite === false ? 0 : 1,
].join(":");

const appendTriangles = (geometry, positions, normals) => {
  const pos = geometry.getAttribute("position");
  const nor = geometry.getAttribute("normal");
  if (!pos || !nor) {
    return false;
  }
  const index = geometry.getIndex();
  const drawStart = geometry.drawRange?.start || 0;
  const drawCount = geometry.drawRange?.count;
  const available = index ? index.count : pos.count;
  const count = drawCount == null || drawCount === Infinity
    ? available - drawStart
    : Math.min(drawCount, available - drawStart);
  const push = (vertex) => {
    positions.push(pos.getX(vertex), pos.getY(vertex), pos.getZ(vertex));
    if (vertex < nor.count) {
      normals.push(nor.getX(vertex), nor.getY(vertex), nor.getZ(vertex));
    } else {
      normals.push(0, 1, 0);
    }
  };
  if (index) {
    for (let i = 0; i < count; i += 1) {
      push(index.getX(drawStart + i));
    }
  } else {
    for (let i = 0; i < count; i += 1) {
      push(drawStart + i);
    }
  }
  return count > 0;
};

const mergeBucket = (bucket, rootInverse, rootWorld) => {
  const positions = [];
  const normals = [];
  for (let i = 0; i < bucket.length; i += 1) {
    const baked = bucket[i].geometry.clone();
    scratch.multiplyMatrices(rootInverse, bucket[i].matrixWorld);
    baked.applyMatrix4(scratch);
    const copied = appendTriangles(baked, positions, normals);
    baked.dispose();
    if (!copied) {
      return null;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  const merged = new THREE.Mesh(geometry, bucket[0].material);
  merged.matrix.identity();
  merged.matrixWorld.copy(rootWorld);
  merged.matrixAutoUpdate = false;
  merged.matrixWorldAutoUpdate = false;
  merged.matrixWorldNeedsUpdate = false;
  return merged;
};

const pruneEmptyGroups = (root) => {
  const groups = [];
  root.traverse((obj) => {
    if (obj !== root && obj.isGroup) {
      groups.push(obj);
    }
  });
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const group = groups[i];
    if (group.parent && group.children.length === 0) {
      group.parent.remove(group);
    }
  }
};

export const freezeStaticMeshes = (root, retired = new Set()) => {
  if (!root) {
    return retired;
  }
  root.traverse((obj) => {
    obj.matrixWorldAutoUpdate = true;
  });
  root.updateMatrixWorld(true);

  const buckets = new Map();
  const meshes = [];
  root.traverse((obj) => {
    if (!obj.isMesh) {
      return;
    }
    meshes.push(obj);
    if (!canMerge(obj)) {
      return;
    }
    const key = materialKey(obj.material);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(obj);
    } else {
      buckets.set(key, [obj]);
    }
  });

  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  buckets.forEach((bucket) => {
    if (bucket.length < 2) {
      return;
    }
    const merged = mergeBucket(bucket, rootInverse, root.matrixWorld);
    if (!merged) {
      return;
    }
    bucket.forEach((mesh) => {
      retired.add(mesh.geometry);
      mesh.parent?.remove(mesh);
    });
    root.add(merged);
  });

  pruneEmptyGroups(root);
  root.traverse((obj) => {
    obj.matrixAutoUpdate = false;
    obj.matrixWorldAutoUpdate = false;
    obj.matrixWorldNeedsUpdate = false;
  });
  return retired;
};

export const releaseRetiredGeometries = (root, retired) => {
  if (!retired?.size) {
    return;
  }
  const live = new Set();
  root?.traverse((obj) => {
    if (obj.geometry) {
      live.add(obj.geometry);
    }
  });
  retired.forEach((geometry) => {
    if (geometry && !live.has(geometry)) {
      geometry.dispose();
    }
  });
  retired.clear();
};
