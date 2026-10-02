export type Lane = -1 | 0 | 1;
export type ObstacleKind = 'barrel' | 'campfire' | 'forkCook';
export type Item = { id: number; lane: Lane; at: number; kind: 'coin' | ObstacleKind; done: boolean };
export const STAGE_SECONDS = 30;
export const TOTAL_SECONDS = STAGE_SECONDS * 6;
export const SPEED = 6;
export const LOOKAHEAD = 5;
export const JUMP_SECONDS = 1.25;
export const STAGES = [
  { name: 'ร้านขายไก่', en: 'THE GREAT ESCAPE', sky: '#ffe8af', ground: '#efbf79', road: '#c27f49', accent: '#cb4932', prop: 'shop' },
  { name: 'หลังร้าน', en: 'OUT THE BACK DOOR', sky: '#f8d8ad', ground: '#cbb193', road: '#928879', accent: '#9c633e', prop: 'alley' },
  { name: 'โรงงาน', en: 'NO MORE NUGGETS', sky: '#d7e4df', ground: '#a5b9ad', road: '#7f938c', accent: '#57776b', prop: 'factory' },
  { name: 'ฟาร์มไก่', en: 'BACK TO THE ROOTS', sky: '#d9efbd', ground: '#94b967', road: '#c9a16a', accent: '#ce6850', prop: 'farm' },
  { name: 'ถนน', en: 'FREE RANGE, FULL SPEED', sky: '#cfe8eb', ground: '#a2bd80', road: '#758485', accent: '#dba84b', prop: 'road' },
  { name: 'ภูเขา', en: 'A LITTLE TASTE OF FREEDOM', sky: '#e2def4', ground: '#a5bca1', road: '#a79990', accent: '#737d9c', prop: 'mountain' },
] as const;
export type Run = { time: number; lane: Lane; jumpAt: number; coins: number; pursuit: 0 | 1; hits: number; invincibleUntil: number; items: Item[]; finished: boolean; won: boolean };
// A deterministic, readable course: one obstacle at a time, always a free lane.
export function createRun(): Run {
  const items: Item[] = [];
  let id = 0;
  for (let stage = 0; stage < 6; stage++) {
    for (let row = 0; row < 5; row++) {
      const at = stage * STAGE_SECONDS + 7 + row * 4;
      const lane = ((row + stage) % 3 - 1) as Lane;
      const obstacleKinds: ObstacleKind[] = ['campfire', 'barrel', 'forkCook'];
      items.push({ id: id++, lane, at, kind: obstacleKinds[(row + stage) % obstacleKinds.length], done: false });
      const coinLane = (row % 2 === 0 ? lane : lane === 1 ? 0 : lane + 1) as Lane;
      for (const offset of [-1.4, -0.7, 0]) items.push({ id: id++, lane: coinLane, at: at + offset, kind: 'coin', done: false });
    }
  }
  return { time: 0, lane: 0, jumpAt: -10, coins: 0, pursuit: 0, hits: 0, invincibleUntil: 0, items, finished: false, won: false };
}
export function changeLane(run: Run, direction: number) {
  if (!run.finished) run.lane = Math.max(-1, Math.min(1, run.lane + direction)) as Lane;
}
export function jump(run: Run) {
  if (!run.finished && run.time - run.jumpAt >= JUMP_SECONDS) run.jumpAt = run.time;
}
export function isAirborne(run: Run, time = run.time) {
  const elapsed = time - run.jumpAt;
  return elapsed >= 0 && elapsed <= JUMP_SECONDS && Math.sin(elapsed / JUMP_SECONDS * Math.PI) > 0.22;
}
export function advance(run: Run, dt: number) {
  if (run.finished || dt <= 0) return;
  const end = Math.min(TOTAL_SECONDS, run.time + dt);
  // Resolve in chronological order, even if a device frame is late.
  const crossed = run.items.filter(item => !item.done && item.at <= end).sort((a, b) => a.at - b.at || (a.kind === 'coin' ? -1 : 1));
  for (const item of crossed) {
    item.done = true;
    if (item.lane !== run.lane) continue;
    if (item.kind === 'coin') run.coins++;
    else if (item.at >= run.invincibleUntil && !(item.kind === 'campfire' && isAirborne(run, item.at))) {
      run.hits++;
      run.invincibleUntil = item.at + 2;
      if (run.pursuit === 0) run.pursuit = 1;
      else { run.time = item.at; run.finished = true; return; }
    }
  }
  run.time = end;
  if (end >= TOTAL_SECONDS) { run.finished = true; run.won = true; }
}
export function stageIndex(time: number) { return Math.min(5, Math.floor(time / STAGE_SECONDS)); }
export function isRest(time: number) { return time % STAGE_SECONDS >= 24; }
