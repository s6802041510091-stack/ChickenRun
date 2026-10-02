import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, changeLane, createRun, jump, stageIndex, TOTAL_SECONDS } from '../src/game/engine.ts';
import { MotionDetector } from '../src/game/motion.ts';
test('course has six scenes, four seconds between obstacles, and rest periods', () => {
  const obstacles = createRun().items.filter(i => i.kind !== 'coin');
  assert.equal(obstacles.length, 30);
  for (let i = 1; i < obstacles.length; i++) assert.ok(obstacles[i].at - obstacles[i - 1].at >= 4);
  for (const item of obstacles) assert.ok(item.at % 30 < 24);
  assert.equal(stageIndex(0), 0); assert.equal(stageIndex(30), 1); assert.equal(stageIndex(180), 5);
});
test('lane limits and fresh run have no retained data', () => {
  const run = createRun(); changeLane(run, 1); changeLane(run, 1); assert.equal(run.lane, 1);
  changeLane(run, -1); changeLane(run, -1); changeLane(run, -1); assert.equal(run.lane, -1);
  run.coins = 99; assert.equal(createRun().coins, 0);
});
test('coins count once and only in the player lane', () => {
  const run = createRun(); run.lane = -1; advance(run, 6.5); assert.equal(run.coins, 2);
  advance(run, 0.1); assert.equal(run.coins, 2);
  run.lane = 1; advance(run, 0.5); assert.equal(run.coins, 2);
});
test('jump clears a campfire; landing does not clear a barrel', () => {
  const run = createRun(); run.lane = -1; advance(run, 6.4); jump(run); advance(run, 0.7); assert.equal(run.pursuit, 0);
  run.lane = 0; advance(run, 3.4); jump(run); advance(run, 0.6); assert.equal(run.pursuit, 1);
});
test('first collision starts close pursuit and the second collision ends the run', () => {
  const run = createRun(); run.lane = -1; advance(run, 7.1); assert.equal(run.pursuit, 1); assert.equal(run.hits, 1);
  advance(run, 0.3); assert.equal(run.hits, 1);
  run.lane = 0; advance(run, 3.7);
  assert.equal(run.hits, 2); assert.equal(run.finished, true); assert.equal(run.time, 11);
  advance(run, 9); assert.equal(run.time, 11);
});
test('full course can be completed without a mandatory jump', () => {
  const run = createRun();
  for (const obstacle of run.items.filter(i => i.kind !== 'coin')) { run.lane = obstacle.lane === 0 ? 1 : 0; advance(run, obstacle.at - run.time + 0.01); }
  advance(run, TOTAL_SECONDS - run.time);
  assert.equal(run.pursuit, 0); assert.equal(run.won, true); assert.equal(run.time, 180);
});
test('course rotates through all three 3D obstacle designs', () => {
  const kinds = new Set(createRun().items.filter(i => i.kind !== 'coin').map(i => i.kind));
  assert.deepEqual([...kinds].sort(), ['barrel', 'campfire', 'forkCook']);
});
function feed(detector, angle, start, count, moving = true) {
  const events = [];
  for (let i = 0; i < count; i++) { const now = start + i * 20; detector.gyro({ x: 0, y: 0, z: moving ? -0.12 : 0 }, now); const result = detector.sample({ x: Math.sin(angle), y: Math.cos(angle), z: 0 }, now); if (result.lane) events.push(result.lane); }
  return events;
}
test('held tilt fires once; returning to neutral rearms it', () => {
  const d = new MotionDetector(0);
  assert.deepEqual(feed(d, 0.55, 1000, 100), [-1]);
  assert.deepEqual(feed(d, 0.55, 3000, 100), []);
  assert.deepEqual(feed(d, 0, 5000, 80, false), []);
  assert.deepEqual(feed(d, 0.55, 6600, 60), [-1]);
});
test('returning to center rearms within 100 ms without waiting for integrated gyro drift', () => {
  const d = new MotionDetector(0, 1.18, false, 0.14);
  assert.deepEqual(feed(d, 0.35, 1000, 10), [-1]);
  assert.deepEqual(feed(d, 0, 1200, 5, false), []);
  assert.deepEqual(feed(d, -0.35, 1300, 10), [1]);
});
test('neutral noise does not change lanes, and direction can be inverted', () => {
  assert.deepEqual(feed(new MotionDetector(0), 0.05, 1000, 100), []);
  assert.deepEqual(feed(new MotionDetector(0, 1.3, true), 0.55, 1000, 60), [1]);
});
test('physical left and right leans move to their matching lanes', () => {
  assert.deepEqual(feed(new MotionDetector(0), 0.55, 1000, 60), [-1]);
  assert.deepEqual(feed(new MotionDetector(0), -0.55, 1000, 60), [1]);
});
test('a slow lean works without crossing the old gyro-speed gate', () => {
  const d = new MotionDetector(0);
  const events = [];
  for (let i = 0; i < 80; i++) {
    const now = 1000 + i * 20;
    const angle = Math.min(0.27, i * 0.004);
    d.gyro({ x: 0, y: 0, z: -0.04 }, now);
    const result = d.sample({ x: Math.sin(angle), y: Math.cos(angle), z: 0 }, now);
    if (result.lane) events.push(result.lane);
  }
  assert.deepEqual(events, [-1]);
});
test('gyro assists a quick lean before the full angle threshold', () => {
  const d = new MotionDetector(0);
  const events = [];
  for (let i = 0; i < 20; i++) {
    const now = 1000 + i * 20;
    const angle = Math.min(0.17, i * 0.012);
    d.gyro({ x: 0, y: 0, z: -1.1 }, now);
    const result = d.sample({ x: Math.sin(angle), y: Math.cos(angle), z: 0 }, now);
    if (result.lane) events.push(result.lane);
  }
  assert.deepEqual(events, [-1]);
});
test('jump requires push-off then unloading; landing and shaking spikes do not double count', () => {
  const d = new MotionDetector(0); const sample = (g, t) => d.sample({ x: 0, y: g, z: 0 }, t).jump;
  assert.equal(sample(1, 1000), false); assert.equal(sample(1.5, 1020), false); assert.equal(sample(0.7, 1080), true);
  assert.equal(sample(2.2, 1300), false); assert.equal(sample(0.7, 1340), false);
  for (let t = 1400; t < 2600; t += 20) assert.equal(sample(1, t), false);
  assert.equal(sample(1.5, 2700), false); assert.equal(sample(0.7, 2780), true);
});
test('steady gravity through a tilt does not trigger a jump', () => {
  const d = new MotionDetector(0);
  for (let i = 0; i < 200; i++) { const angle = i / 200; assert.equal(d.sample({ x: Math.sin(angle), y: Math.cos(angle), z: 0 }, i * 20).jump, false); }
});
