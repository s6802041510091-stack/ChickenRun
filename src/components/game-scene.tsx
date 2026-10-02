import React, { useEffect, useRef, useState } from 'react';
import { Image, PixelRatio, View } from 'react-native';
import { Canvas, type CanvasRef } from 'react-native-wgpu';
import type { SharedValue } from 'react-native-reanimated';
import * as THREE from 'three/webgpu';
import { makeWebGPURenderer } from '../lib/make-webgpu-renderer';
import { JUMP_SECONDS, LOOKAHEAD, STAGES, stageIndex, type Item, type Run } from '../game/engine';

const LANE_WIDTH = 2.35;
const PLAYER_Z = 2.1;
const WORLD_SPEED = 3.25;
type Vec3 = [number, number, number];

type SceneProps = {
  run: Run;
  clock: SharedValue<number>;
  lane: SharedValue<number>;
  jumpAt: SharedValue<number>;
  preview?: boolean;
};

type ChickenRig = {
  root: THREE.Group;
  bird: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
};

type ColonelRig = {
  root: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
};

type SceneryRig = { root: THREE.Group; movers: THREE.Group[] };

function standard(color: THREE.ColorRepresentation, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...extra });
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: Vec3 = [0, 0, 0],
  scale: Vec3 = [1, 1, 1],
  rotation: Vec3 = [0, 0, 0],
) {
  const result = new THREE.Mesh(geometry, material);
  result.position.set(...position);
  result.scale.set(...scale);
  result.rotation.set(...rotation);
  parent.add(result);
  return result;
}

function addShadow(parent: THREE.Object3D, scale = 1) {
  return addMesh(
    parent,
    new THREE.CircleGeometry(0.72, 20),
    new THREE.MeshBasicMaterial({ color: '#30241c', transparent: true, opacity: 0.18, depthWrite: false }),
    [0, 0.015, 0],
    [scale, scale * 0.58, 1],
    [-Math.PI / 2, 0, 0],
  );
}

function makeChicken() : ChickenRig {
  const root = new THREE.Group();
  root.position.z = PLAYER_Z;
  root.rotation.y = Math.PI;
  addShadow(root, 0.85);
  const bird = new THREE.Group();
  bird.scale.setScalar(0.83);
  root.add(bird);

  addMesh(bird, new THREE.SphereGeometry(1, 18, 14), standard('#ffd843'), [0, 1.18, 0], [0.82, 0.96, 0.7]);
  addMesh(bird, new THREE.SphereGeometry(1, 18, 14), standard('#ffe05a'), [0, 2.08, 0.05], [0.73, 0.72, 0.67]);
  const leftWing = addMesh(bird, new THREE.SphereGeometry(1, 14, 10), standard('#ffcf35'), [-0.76, 1.2, 0.02], [0.63, 0.25, 0.36], [0, 0.18, -0.58]);
  const rightWing = addMesh(bird, new THREE.SphereGeometry(1, 14, 10), standard('#ffcf35'), [0.76, 1.2, 0.02], [0.63, 0.25, 0.36], [0, -0.18, 0.58]);

  for (const x of [-0.27, 0.27]) {
    const eye = new THREE.Group();
    eye.position.set(x, 2.2, 0.58);
    addMesh(eye, new THREE.SphereGeometry(1, 16, 12), standard('#fffdf5', { roughness: 0.35 }), [0, 0, 0], [0.27, 0.34, 0.14]);
    addMesh(eye, new THREE.SphereGeometry(1, 12, 9), standard('#42271c', { roughness: 0.3 }), [x < 0 ? 0.055 : -0.055, -0.015, 0.14], [0.1, 0.14, 0.065]);
    addMesh(eye, new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), [x < 0 ? 0.075 : -0.035, 0.04, 0.205], [0.025, 0.025, 0.025]);
    bird.add(eye);
  }

  addMesh(bird, new THREE.ConeGeometry(1, 1, 4), standard('#f28c28'), [0, 1.93, 0.8], [0.34, 0.5, 0.3], [Math.PI / 2, 0, 0]);
  addMesh(bird, new THREE.SphereGeometry(1, 14, 10), standard('#6e271f'), [0, 1.72, 0.62], [0.28, 0.22, 0.12]);
  addMesh(bird, new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: '#ff8e72' }), [0, 1.72, 0.74], [0.18, 0.11, 0.06]);
  [-0.27, 0, 0.27].forEach((x, index) => addMesh(bird, new THREE.SphereGeometry(1, 12, 8), standard('#e94937'), [x, 2.77 + (index === 1 ? 0.1 : 0), 0], [0.22, 0.34, 0.24]));

  const legs: THREE.Group[] = [];
  for (const x of [-0.31, 0.31]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.54, 0);
    addMesh(leg, new THREE.CylinderGeometry(1, 1, 1, 10), standard('#dd7427'), [0, -0.3, 0], [0.08, 0.34, 0.08]);
    addMesh(leg, new THREE.SphereGeometry(1, 12, 8), standard('#ef872b'), [0, -0.59, 0.16], [0.18, 0.08, 0.38]);
    bird.add(leg);
    legs.push(leg);
  }
  return { root, bird, leftWing, rightWing, leftLeg: legs[0], rightLeg: legs[1] };
}

function makeColonel(): ColonelRig {
  const root = new THREE.Group();
  root.position.set(-3, 0, -5.2);
  root.rotation.y = Math.PI;
  root.scale.setScalar(0.58);
  addShadow(root, 1.25);
  addMesh(root, new THREE.SphereGeometry(1, 18, 12), standard('#bd3d2e'), [0, 1.55, 0], [1.15, 1.15, 0.68]);
  addMesh(root, new THREE.SphereGeometry(1, 16, 10), standard('#f3e7cb'), [0, 1.45, 0.58], [0.74, 0.88, 0.18]);
  addMesh(root, new THREE.SphereGeometry(1, 18, 14), standard('#e8a97d'), [0, 2.65, 0.05], [0.61, 0.64, 0.56]);
  [-0.47, -0.22, 0.06, 0.34].forEach((x, index) => addMesh(root, new THREE.SphereGeometry(1, 12, 9), standard('#fff5df'), [x, 3.13 + (index % 2) * 0.1, -0.02], [0.32, 0.34, 0.3]));

  for (const x of [-0.23, 0.23]) {
    addMesh(root, new THREE.SphereGeometry(1, 12, 8), standard('#fffdf4'), [x, 2.72, 0.54], [0.12, 0.14, 0.07]);
    addMesh(root, new THREE.SphereGeometry(1, 10, 8), standard('#281b17'), [x + (x < 0 ? 0.03 : -0.03), 2.72, 0.61], [0.055, 0.055, 0.055]);
  }
  addMesh(root, new THREE.SphereGeometry(1, 12, 8), standard('#fff4db'), [-0.22, 2.48, 0.56], [0.33, 0.13, 0.1], [0, 0, -0.22]);
  addMesh(root, new THREE.SphereGeometry(1, 12, 8), standard('#fff4db'), [0.22, 2.48, 0.56], [0.33, 0.13, 0.1], [0, 0, 0.22]);

  const arms: THREE.Group[] = [];
  [-1.08, 1.08].forEach(x => addMesh(root, new THREE.SphereGeometry(1, 14, 10), standard('#d98f68'), [x, 2.05, 0], [0.5, 0.52, 0.46]));
  [-1.12, 1.12].forEach((x, index) => {
    const arm = new THREE.Group();
    arm.position.set(x, 2.05, 0);
    arm.rotation.set(index === 0 ? 0.4 : -0.7, 0, index === 0 ? -0.45 : 0.45);
    addMesh(arm, new THREE.CylinderGeometry(1, 1.15, 1, 12), standard('#d88e68'), [0, -0.44, 0], [0.42, 0.56, 0.42]);
    addMesh(arm, new THREE.SphereGeometry(1, 14, 10), standard('#df9971'), [0, -0.7, 0.1], [0.48, 0.44, 0.46]);
    addMesh(arm, new THREE.CylinderGeometry(1, 1.02, 1, 12), standard('#e3a17b'), [0, -1.08, 0.1], [0.35, 0.5, 0.35]);
    addMesh(arm, new THREE.SphereGeometry(1, 12, 9), standard('#e7a47d'), [0, -1.5, 0.16], [0.34, 0.34, 0.34]);
    root.add(arm);
    arms.push(arm);
  });

  const legs: THREE.Group[] = [];
  [-0.5, 0.5].forEach(x => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.82, 0);
    addMesh(leg, new THREE.CylinderGeometry(1, 1.12, 1, 12), standard('#9f3028'), [0, -0.45, 0], [0.31, 0.55, 0.34]);
    addMesh(leg, new THREE.SphereGeometry(1, 12, 8), standard('#3b2b24'), [0, -0.95, 0.2], [0.34, 0.18, 0.62]);
    root.add(leg);
    legs.push(leg);
  });
  return { root, leftArm: arms[0], rightArm: arms[1], leftLeg: legs[0], rightLeg: legs[1] };
}

function makeBarrel() {
  const group = new THREE.Group();
  addShadow(group, 0.82);
  addMesh(group, new THREE.CylinderGeometry(0.62, 0.72, 1.55, 14), standard('#8d4d29'), [0, 0.83, 0]);
  for (const y of [-0.58, 0, 0.58]) addMesh(group, new THREE.TorusGeometry(0.67, 0.065, 8, 18), standard('#44342d', { metalness: 0.25, roughness: 0.55 }), [0, 0.83 + y, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
  addMesh(group, new THREE.CircleGeometry(0.61, 14), standard('#a8693c'), [0, 1.62, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  return group;
}

function makeCampfire() {
  const group = new THREE.Group();
  addShadow(group, 0.8);
  addMesh(group, new THREE.CylinderGeometry(1, 1, 1, 10), standard('#70412a'), [0, 0.23, 0], [0.17, 0.82, 0.17], [0, 0, Math.PI / 2]);
  addMesh(group, new THREE.CylinderGeometry(1, 1, 1, 10), standard('#8b5632'), [0, 0.23, 0], [0.17, 0.82, 0.17], [Math.PI / 2, 0, Math.PI / 2]);
  const outer = addMesh(group, new THREE.ConeGeometry(1, 1.35, 10), standard('#f05b2d', { emissive: '#8a170c', emissiveIntensity: 0.45 }), [0, 0.72, 0], [0.38, 0.78, 0.38]);
  const inner = addMesh(group, new THREE.ConeGeometry(1, 1.2, 9), standard('#ffc43d', { emissive: '#ff791f', emissiveIntensity: 0.65 }), [0.02, 0.72, 0.18], [0.2, 0.52, 0.2]);
  group.userData.flames = [outer, inner];
  return group;
}

function makeForkCook() {
  const group = new THREE.Group();
  addShadow(group, 1);
  addMesh(group, new THREE.SphereGeometry(1, 16, 12), standard('#d75a3b'), [0, 1.05, 0], [0.92, 1.05, 0.68]);
  addMesh(group, new THREE.SphereGeometry(1, 14, 10), standard('#f3ead3'), [0, 1.04, 0.62], [0.68, 0.78, 0.15]);
  addMesh(group, new THREE.SphereGeometry(1, 14, 10), standard('#d99b70'), [0, 2.04, 0.04], [0.48, 0.5, 0.45]);
  addMesh(group, new THREE.SphereGeometry(1, 12, 8), standard('#f8f0dc'), [0, 2.5, -0.02], [0.56, 0.2, 0.48]);
  [-0.18, 0.18].forEach(x => addMesh(group, new THREE.SphereGeometry(1, 10, 8), standard('#2f211b'), [x, 2.1, 0.43], [0.055, 0.075, 0.04]));
  [-0.72, 0.72].forEach(x => addMesh(group, new THREE.CylinderGeometry(1, 1.1, 1, 10), standard('#d99b70'), [x, 1.33, 0.05], [0.2, 0.64, 0.2], [0, 0, x < 0 ? -0.5 : 0.5]));
  [-0.42, 0.42].forEach(x => addMesh(group, new THREE.CylinderGeometry(1, 1, 1, 10), standard('#47382e'), [x, 0.18, 0.02], [0.22, 0.42, 0.25]));
  const metal = standard('#c4cccc', { metalness: 0.78, roughness: 0.25 });
  const fork = new THREE.Group();
  fork.position.set(0.95, 1.25, 0.15);
  fork.rotation.z = -0.18;
  addMesh(fork, new THREE.CylinderGeometry(1, 1, 1, 8), metal, [0, 0, 0], [0.055, 0.75, 0.055]);
  addMesh(fork, new THREE.BoxGeometry(), metal, [0, 0.79, 0], [0.35, 0.055, 0.055]);
  [-0.25, -0.08, 0.08, 0.25].forEach(x => addMesh(fork, new THREE.BoxGeometry(), metal, [x, 1.02, 0], [0.025, 0.26, 0.025]));
  group.add(fork);
  return group;
}

function makeCoin() {
  const group = new THREE.Group();
  addShadow(group, 0.42);
  const coin = addMesh(group, new THREE.TorusGeometry(0.35, 0.12, 10, 20), standard('#ffc928', { metalness: 0.55, roughness: 0.3, emissive: '#7a3c00', emissiveIntensity: 0.12 }), [0, 1.05, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
  group.userData.coin = coin;
  return group;
}

function makeItem(item: Item) {
  const group = item.kind === 'coin' ? makeCoin() : item.kind === 'barrel' ? makeBarrel() : item.kind === 'campfire' ? makeCampfire() : makeForkCook();
  group.userData.kind = item.kind;
  return group;
}

function movingZ(index: number, time: number) {
  const start = -30 + index * 4;
  return ((start + time * WORLD_SPEED + 30) % 44) - 30;
}

function makeRoad(scene: THREE.Scene, color: string) {
  addMesh(scene, new THREE.PlaneGeometry(60, 50), standard('#8ea66c', { roughness: 1 }), [0, -0.05, -10], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  const slabs: THREE.Mesh[] = [];
  const dashes: THREE.Mesh[] = [];
  for (let index = 0; index < 11; index++) {
    const material = standard(color, { roughness: 0.97 });
    if (index % 2 === 0) material.color.offsetHSL(0, 0, -0.035);
    slabs.push(addMesh(scene, new THREE.PlaneGeometry(8.45, 3.94), material, [0, 0, -20], [1, 1, 1], [-Math.PI / 2, 0, 0]));
    for (const x of [-1.42, 1.42]) dashes.push(addMesh(scene, new THREE.PlaneGeometry(0.1, 1.7), new THREE.MeshBasicMaterial({ color: '#fff1c8', transparent: true, opacity: 0.78 }), [x, 0.025, -20], [1, 1, 1], [-Math.PI / 2, 0, 0]));
  }
  addMesh(scene, new THREE.BoxGeometry(), standard('#f2d59f'), [-4.32, 0.03, -10], [0.13, 0.06, 20]);
  addMesh(scene, new THREE.BoxGeometry(), standard('#f2d59f'), [4.32, 0.03, -10], [0.13, 0.06, 20]);
  return { slabs, dashes };
}

function makeScenery(kind: string, accent: string): SceneryRig {
  const root = new THREE.Group();
  const movers: THREE.Group[] = [];
  for (let index = 0; index < 11; index++) {
    for (const side of [-1, 1]) {
      const group = new THREE.Group();
      group.position.x = side * (6.4 + index % 3 * 0.7);
      group.userData.index = index;
      if (kind === 'mountain') {
        addMesh(group, new THREE.ConeGeometry(1, 1.5, 6), standard(index % 2 ? '#75869a' : '#8d91a5'), [0, 2.1, 0], [2.1, 3.6, 1.5]);
        addMesh(group, new THREE.ConeGeometry(1, 1, 6), standard('#fff4df'), [0, 4.35, 0], [0.7, 0.78, 0.6]);
      } else if (kind === 'farm' || kind === 'road') {
        addMesh(group, new THREE.CylinderGeometry(1, 1.15, 1, 8), standard('#6e5232'), [0, 0.75, 0], [0.18, 0.75, 0.18]);
        addMesh(group, new THREE.SphereGeometry(1, 12, 9), standard(kind === 'farm' ? '#6d9c50' : '#668b5b'), [0, 1.8, 0], [0.82, 1.12, 0.78]);
      } else {
        addMesh(group, new THREE.BoxGeometry(), standard(index % 2 ? accent : '#d3aa78'), [0, 1.1, 0], [1.25, 1.1 + index % 3 * 0.4, 1.05]);
        if (kind === 'factory' || kind === 'shop') addMesh(group, new THREE.CylinderGeometry(1, 1, 1, 8), standard('#68776f'), [0.58, 2.8 + index % 3 * 0.55, 0], [0.2, 1.25, 0.2]);
      }
      root.add(group);
      movers.push(group);
    }
  }
  return { root, movers };
}

function disposeObject(root: THREE.Object3D) {
  root.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach(material => material.dispose());
  });
}

function WebGPUScene({ props }: { props: SceneProps }) {
  const canvasRef = useRef<CanvasRef>(null);
  const latest = useRef(props);
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  useEffect(() => { latest.current = props; }, [props]);

  useEffect(() => {
    if (layout.width < 1 || layout.height < 1) return;
    const context = canvasRef.current?.getContext('webgpu');
    if (!context) return;
    const canvas = context.canvas as unknown as { width: number; height: number };
    canvas.width = Math.max(1, Math.round(layout.width * PixelRatio.get()));
    canvas.height = Math.max(1, Math.round(layout.height * PixelRatio.get()));
    const renderer = makeWebGPURenderer(context);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, layout.width / layout.height, 0.1, 80);
    camera.position.set(0, 5.4, 10);
    camera.lookAt(0, 1.25, -4.2);
    scene.add(new THREE.HemisphereLight('#fff1cf', '#5b4937', 2));
    scene.add(new THREE.AmbientLight('#ffffff', 0.65));
    const sun = new THREE.DirectionalLight('#fff1ca', 2.8);
    sun.position.set(5, 10, 8);
    scene.add(sun);

    const firstStage = STAGES[stageIndex(latest.current.run.time)];
    scene.background = new THREE.Color(firstStage.sky);
    scene.fog = new THREE.Fog(firstStage.sky, 15, 38);
    const road = makeRoad(scene, firstStage.road);
    let currentStage = stageIndex(latest.current.run.time);
    let scenery = makeScenery(firstStage.prop, firstStage.accent);
    scene.add(scenery.root);
    const chicken = makeChicken();
    const colonel = makeColonel();
    scene.add(chicken.root, colonel.root);

    const feathers = Array.from({ length: 8 }, (_, index) => {
      const feather = addMesh(scene, new THREE.SphereGeometry(1, 10, 7), standard(index % 2 ? '#ffd33d' : '#fff1a5'), [0, 0, 0], [0.12, 0.035, 0.28]);
      feather.userData.index = index;
      return feather;
    });
    const itemsRoot = new THREE.Group();
    const itemNodes = new Map<number, THREE.Group>();
    scene.add(itemsRoot);

    let stopped = false;
    let frameId = 0;
    let lastAt = performance.now();
    let drawing = false;
    const start = async () => {
      await renderer.init();
      if (stopped) return;

      const frame = (at: number) => {
        frameId = requestAnimationFrame(frame);
        const delta = Math.min((at - lastAt) / 1000, 0.05);
        lastAt = at;
        const game = latest.current;
        const time = game.clock.get();
        const stageNumber = stageIndex(game.run.time);
        if (stageNumber !== currentStage) {
          currentStage = stageNumber;
          const stage = STAGES[currentStage];
          scene.background = new THREE.Color(stage.sky);
          scene.fog = new THREE.Fog(stage.sky, 15, 38);
          road.slabs.forEach((slab, index) => {
            const material = slab.material as THREE.MeshStandardMaterial;
            material.color.set(stage.road);
            if (index % 2 === 0) material.color.offsetHSL(0, 0, -0.035);
          });
          scene.remove(scenery.root);
          disposeObject(scenery.root);
          scenery = makeScenery(stage.prop, stage.accent);
          scene.add(scenery.root);
        }

        road.slabs.forEach((slab, index) => { slab.position.z = movingZ(index, time); });
        road.dashes.forEach((dash, index) => { dash.position.z = movingZ(index % 11, time) + 0.3; });
        scenery.movers.forEach(group => { group.position.z = movingZ(group.userData.index as number, time); });

        const targetX = game.lane.get() * LANE_WIDTH;
        chicken.root.position.x = THREE.MathUtils.damp(chicken.root.position.x, targetX, 12, delta);
        const jumpAge = time - game.jumpAt.get();
        const jumpHeight = jumpAge >= 0 && jumpAge <= JUMP_SECONDS ? Math.sin(jumpAge / JUMP_SECONDS * Math.PI) * 2.15 : 0;
        const stride = Math.sin(time * 12);
        chicken.bird.position.y = jumpHeight + Math.abs(stride) * 0.04;
        chicken.bird.rotation.z = -chicken.root.position.x * 0.025 + stride * 0.018;
        chicken.bird.rotation.x = jumpHeight > 0 ? -0.14 : 0;
        chicken.leftWing.rotation.z = -0.52 - stride * 0.32;
        chicken.rightWing.rotation.z = 0.52 + stride * 0.32;
        chicken.leftLeg.rotation.x = stride * 0.55;
        chicken.rightLeg.rotation.x = -stride * 0.55;

        const colonelStride = Math.sin(time * 8.5);
        const chasing = game.run.pursuit === 1;
        colonel.root.visible = chasing;
        const colonelTargetX = chasing ? THREE.MathUtils.clamp(chicken.root.position.x * 0.55 - 0.65, -2.2, 2.2) : -3;
        const colonelTargetZ = chasing ? 3.45 : -5.2;
        const colonelTargetScale = chasing ? 0.68 : 0.58;
        colonel.root.position.x = THREE.MathUtils.damp(colonel.root.position.x, colonelTargetX, chasing ? 5.5 : 2.5, delta);
        colonel.root.position.z = THREE.MathUtils.damp(colonel.root.position.z, colonelTargetZ, chasing ? 4.5 : 2.5, delta);
        const colonelScale = THREE.MathUtils.damp(colonel.root.scale.x, colonelTargetScale, chasing ? 4.5 : 2.5, delta);
        colonel.root.scale.setScalar(colonelScale);
        colonel.root.position.y = Math.abs(colonelStride) * 0.065;
        colonel.root.rotation.z = -0.04 + Math.sin(time * 4.25) * 0.018;
        colonel.leftArm.rotation.x = 0.35 + colonelStride * 0.7;
        colonel.rightArm.rotation.x = -0.6 - colonelStride * 0.7;
        colonel.leftLeg.rotation.x = -colonelStride * 0.5;
        colonel.rightLeg.rotation.x = colonelStride * 0.5;

        feathers.forEach((feather, index) => {
          const trail = (time * 1.55 + index * 0.43) % 3.5;
          feather.position.set(
            chicken.root.position.x + Math.sin(time * 3 + index * 1.7) * (0.23 + trail * 0.12),
            0.55 + index % 3 * 0.19 + Math.sin(time * 5 + index) * 0.12,
            PLAYER_Z + 0.55 + trail,
          );
          feather.rotation.set(time * 1.8 + index, time * 2.4, Math.sin(time * 2 + index));
          const size = 1 - trail / 4.5;
          feather.scale.set(0.12 * size, 0.035 * size, 0.28 * size);
        });

        itemNodes.forEach(group => { group.visible = false; });
        for (const item of game.run.items) {
          const secondsAway = item.at - game.run.time;
          if (item.done || secondsAway > LOOKAHEAD + 0.8 || secondsAway < -0.35) continue;
          let group = itemNodes.get(item.id);
          if (!group) {
            group = makeItem(item);
            itemNodes.set(item.id, group);
            itemsRoot.add(group);
          }
          group.visible = true;
          group.position.set(item.lane * LANE_WIDTH, item.kind === 'coin' ? Math.sin(time * 5 + item.id) * 0.08 : 0, PLAYER_Z - (item.at - time) * WORLD_SPEED);
          if (item.kind === 'coin') (group.userData.coin as THREE.Mesh).rotation.y += delta * 4;
          if (item.kind === 'campfire') (group.userData.flames as THREE.Mesh[]).forEach((flame, index) => flame.scale.y = (index ? 0.52 : 0.78) * (0.9 + Math.sin(time * 13 + index) * 0.1));
        }

        if (!drawing) {
          drawing = true;
          void renderer.renderAsync(scene, camera).then(() => {
            if (!stopped) context.present();
          }).finally(() => { drawing = false; });
        }
      };
      frameId = requestAnimationFrame(frame);
    };
    void start();

    return () => {
      stopped = true;
      cancelAnimationFrame(frameId);
      disposeObject(scene);
      renderer.dispose();
    };
  }, [layout.height, layout.width]);

  return <Canvas
    ref={canvasRef}
    style={{ flex: 1 }}
    onLayout={event => {
      const { width, height } = event.nativeEvent.layout;
      setLayout(current => current.width === width && current.height === height ? current : { width, height });
    }}
  />;
}

export function GameScene(props: SceneProps) {
  const stage = STAGES[stageIndex(props.run.time)];
  if (props.preview) {
    return <Image
      source={require('../../assets/app-icon-chase-v3.png')}
      resizeMode="cover"
      style={{ width: '100%', height: '100%' }}
      accessible
      accessibilityLabel="น้องไก่ตกใจวิ่งหนีผู้พันผมขาวกล้ามใหญ่"
    />;
  }
  return <View
    style={{ flex: 1, overflow: 'hidden', backgroundColor: stage.sky }}
    accessibilityLabel={`ฉากสามมิติ ${stage.name} ไก่อยู่ช่อง${props.run.lane === -1 ? 'ซ้าย' : props.run.lane === 1 ? 'ขวา' : 'กลาง'}`}
  >
    <WebGPUScene props={props} />
  </View>;
}
