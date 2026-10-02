import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Easing, ReduceMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { Chicken, Colonel } from '../components/art';
import { GameScene } from '../components/game-scene';
import { advance, changeLane, createRun, isRest, jump, SPEED, stageIndex, STAGES, TOTAL_SECONDS } from '../game/engine';
import { useMotion } from '../hooks/use-motion';
import { colors as c } from '../theme';
import { s } from './game-styles';

type Phase = 'home' | 'setup' | 'countdown' | 'playing' | 'paused' | 'result';
function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, { opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }]}><Text style={[s.buttonText, secondary && { color: c.green }]}>{title}</Text></Pressable>;
}
function Label({ children }: { children: React.ReactNode }) { return <Text style={s.eyebrow}>{children}</Text>; }
export function Game() {
  const [phase, setPhase] = useState<Phase>('home');
  const [mode, setMode] = useState<'motion' | 'touch'>('motion');
  const [foreground, setForeground] = useState(true);
  const [threshold, setThreshold] = useState(1.18);
  const [tiltThreshold, setTiltThreshold] = useState(0.14);
  const [invert, setInvert] = useState(false);
  const [count, setCount] = useState(3);
  const [practice, setPractice] = useState({ lane: 0, jumps: 0, last: 'ลองขยับดู น้องไก่รออยู่' });
  const [resuming, setResuming] = useState(false);
  const run = useRef(createRun());
  const [snapshot, setSnapshot] = useState(createRun);
  const phaseRef = useRef(phase);
  const clock = useSharedValue(0), lane = useSharedValue(0), jumpAt = useSharedValue(-10);
  const setScreen = useCallback((next: Phase) => { phaseRef.current = next; setPhase(next); }, []);
  const startCountdown = useCallback(() => { setCount(3); setScreen('countdown'); }, [setScreen]);
  const move = useCallback((direction: number) => {
    if (phaseRef.current === 'setup') setPractice(p => ({ ...p, lane: Math.max(-1, Math.min(1, p.lane + direction)), last: direction < 0 ? 'เอียงซ้ายแล้ว! กลับมาตรงก่อนเอียงอีกครั้ง' : 'เอียงขวาแล้ว! กลับมาตรงก่อนเอียงอีกครั้ง' }));
    if (phaseRef.current !== 'playing') return;
    changeLane(run.current, direction);
    lane.set(withTiming(run.current.lane, { duration: 140, easing: Easing.out(Easing.quad) }));
    setSnapshot({ ...run.current });
  }, [lane]);
  const doJump = useCallback(() => {
    if (phaseRef.current === 'setup') setPractice(p => ({ ...p, jumps: p.jumps + 1, last: 'ตรวจพบการกระโดดแล้ว!' }));
    if (phaseRef.current !== 'playing') return;
    jump(run.current); jumpAt.set(run.current.jumpAt);
  }, [jumpAt]);
  const motion = useMotion(mode === 'motion' && foreground && ['setup', 'countdown', 'playing'].includes(phase), move, doJump, threshold, tiltThreshold, invert);
  const pause = useCallback(() => {
    if (['playing', 'countdown'].includes(phaseRef.current)) { clock.set(run.current.time); setSnapshot({ ...run.current }); setScreen('paused'); }
  }, [clock, setScreen]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { setForeground(state === 'active'); if (state !== 'active') pause(); });
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phaseRef.current === 'playing' || phaseRef.current === 'countdown') { pause(); return true; }
      if (phaseRef.current === 'setup') { setScreen(resuming ? 'paused' : 'home'); return true; }
      return phaseRef.current === 'paused';
    });
    return () => { subscription.remove(); back.remove(); };
  }, [pause, resuming, setScreen]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const key = (event: KeyboardEvent) => {
      if (event.repeat || !['playing', 'setup'].includes(phaseRef.current)) return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' '].includes(event.key)) event.preventDefault();
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
      if (event.key === 'ArrowUp' || event.key === ' ') doJump();
      if (event.key === 'Escape') pause();
    };
    const hide = () => { if (document.hidden) pause(); };
    window.addEventListener('keydown', key); document.addEventListener('visibilitychange', hide);
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', hide); };
  }, [move, doJump, pause]);
  useEffect(() => { if (motion.status === 'error' && (phase === 'playing' || phase === 'countdown')) pause(); }, [motion.status, phase, pause]);
  useEffect(() => {
    if (phase !== 'countdown') return;
    const start = Date.now();
    const timer = setInterval(() => { const remaining = 3 - Math.floor((Date.now() - start) / 1000); setCount(remaining); if (remaining <= 0) setScreen('playing'); }, 100);
    return () => clearInterval(timer);
  }, [phase, setScreen]);
  useEffect(() => {
    if (phase !== 'playing') return;
    let previous = performance.now();
    // Simulation is 10 Hz; Reanimated interpolates the scene on the UI thread.
    const timer = setInterval(() => {
      const now = performance.now(); const dt = (now - previous) / 1000; previous = now;
      if (dt > 0.5) { pause(); return; }
      advance(run.current, dt);
      clock.set(withTiming(run.current.time, { duration: 100, easing: Easing.linear, reduceMotion: ReduceMotion.Never }));
      setSnapshot({ ...run.current });
      if (run.current.finished) { clock.set(run.current.time); setScreen('result'); }
    }, 100);
    return () => clearInterval(timer);
  }, [phase, clock, pause, setScreen]);
  function prepare() {
    run.current = createRun(); setSnapshot({ ...run.current }); clock.set(0); lane.set(0); jumpAt.set(-10);
    setPractice({ lane: 0, jumps: 0, last: 'ลองขยับดู น้องไก่รออยู่' }); setResuming(false); setScreen('setup');
  }
  function finish() { run.current.finished = true; setSnapshot({ ...run.current }); setScreen('result'); }
  function home() { clock.set(0); lane.set(0); jumpAt.set(-10); run.current = createRun(); setSnapshot({ ...run.current }); setScreen('home'); }
  const stage = STAGES[stageIndex(snapshot.time)];
  const nextObstacle = snapshot.items.filter(item => !item.done && item.kind !== 'coin' && item.at > snapshot.time).sort((a, b) => a.at - b.at)[0];
  const dangerSoon = nextObstacle && nextObstacle.at - snapshot.time < 3.5;
  return <SafeAreaView style={s.safe}><StatusBar style="dark" /><View style={s.app}>
    {phase === 'home' && <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <View style={s.header}><View style={s.brand}><Text style={s.brandIcon}>↗</Text><Text style={s.brandText}>CHICKEN RUN</Text></View><View style={s.pill}><Text style={s.pillText}>MOVE TO PLAY</Text></View></View>
      <View style={{ marginTop: 24, gap: 4 }}><Label>A LITTLE CHICKEN. A BIG ESCAPE.</Label><Text style={s.heroTitle}>เกิดมาเป็นไก่{'\n'}ไม่ได้เกิดมาเป็นไก่ทอด.</Text><Text style={s.body}>กระโดดจริง เอียงจริง แล้วพาน้องไก่{'\n'}วิ่งหนีผู้พัน KFC ไปสู่อิสรภาพ</Text></View>
      <View style={s.heroScene}><GameScene run={snapshot} clock={clock} lane={lane} jumpAt={jumpAt} preview /></View>
      <View style={s.threeStats}>{[['06', 'ฉากผจญภัย'], ['03', 'นาทีต่อรอบ'], ['∞', 'ความอยากรอด']].map(([value, text]) => <View key={text} style={s.miniStat}><Text style={s.statValue}>{value}</Text><Text style={s.small}>{text}</Text></View>)}</View>
      <Button title="เริ่มหนีผู้พัน  →" onPress={prepare} /><Text style={s.footer}>ไม่ต้องสมัคร · ไม่มีฐานข้อมูล · เริ่มใหม่ได้ทุกรอบ</Text>
      <View style={s.divider} /><Label>THE ESCAPE ROUTE</Label><View style={s.routeWrap}>{STAGES.map((item, i) => <View key={item.name} style={s.routeItem}><Text style={s.routeNumber}>0{i + 1}</Text><Text style={s.routeText}>{item.name}</Text></View>)}</View>
    </ScrollView>}
    {phase === 'setup' && <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <View style={s.header}><Pressable accessibilityRole="button" onPress={() => setScreen(resuming ? 'paused' : 'home')} style={s.back}><Text style={s.link}>← กลับ</Text></Pressable><Label>READY, SET, CHICKEN!</Label></View>
      <Text style={s.title}>{resuming ? 'ตั้งหลัก แล้วไปต่อ' : 'วอร์มอัปก่อนออกวิ่ง'}</Text><Text style={s.body}>ยืนอยู่กับที่ในพื้นที่โล่ง ถือโทรศัพท์สองมือ{'\n'}ใกล้ลำตัว แล้วกระโดดเบา ๆ ก็พอ</Text>
      <View style={s.segment}><Button title="ขยับตัวจริง" secondary={mode !== 'motion'} onPress={() => setMode('motion')} /><Button title="เล่นด้วยปุ่ม" secondary={mode !== 'touch'} onPress={() => setMode('touch')} /></View>
      <View style={s.card}><View style={s.header}><Label>{mode === 'motion' ? 'MOTION CHECK' : 'PRACTICE MODE'}</Label><Text style={[s.badgeText, { color: motion.status === 'error' ? c.orange : c.green }]}>{mode === 'touch' ? 'พร้อมเล่น' : motion.status === 'ready' ? '● เชื่อมต่อแล้ว' : '○ กำลังเตรียม'}</Text></View>
        <View style={s.practiceTrack}>{[-1, 0, 1].map(index => <View key={index} style={[s.practiceLane, practice.lane === index && { backgroundColor: '#f4e5bc' }]}>{practice.lane === index ? <Chicken size={70} /> : <Text style={s.small}>·</Text>}</View>)}</View>
        <Text style={[s.body, { textAlign: 'center' }]} accessibilityLiveRegion="polite">{mode === 'motion' && motion.status !== 'ready' ? motion.message : practice.last}</Text>
        {mode === 'motion' && <><View style={s.progress}><View style={[s.progressFill, { width: `${motion.reading.progress * 100}%` }]} /></View><Text style={s.telemetry}>{motion.reading.force.toFixed(2)} g   /   เอียง {Math.round(motion.reading.angle)}°   /   {motion.reading.armed ? 'พร้อมเปลี่ยนช่อง' : 'กลับมาตรงเพื่อพร้อมอีกครั้ง'}   /   กระโดด {practice.jumps} ครั้ง</Text><Pressable accessibilityRole="button" onPress={motion.recalibrate} style={s.back}><Text style={[s.link, { textAlign: 'center' }]}>ตั้งท่าถือใหม่ ↻</Text></Pressable></>}
        {mode === 'touch' && <View style={s.segment}><Button title="←" secondary onPress={() => move(-1)} /><Button title="กระโดด" secondary onPress={doJump} /><Button title="→" secondary onPress={() => move(1)} /></View>}
      </View>
      <View style={s.instruction}><Text style={s.instructionIcon}>↔</Text><View style={{ flex: 1 }}><Text style={s.instructionTitle}>เอียงหนึ่งครั้ง เปลี่ยนหนึ่งช่อง</Text><Text style={s.small}>กลับมาตรงก่อนเอียงครั้งต่อไป เอียงค้างจะไม่ไหลหลายช่อง</Text></View></View>
      <View style={s.instruction}><Text style={s.instructionIcon}>↑</Text><View style={{ flex: 1 }}><Text style={s.instructionTitle}>แคมป์ไฟกระโดด • ถังไม้และคนถือส้อมหลบ</Text><Text style={s.small}>ดูจังหวะเมื่อเข้าใกล้น้องไก่ มีช่องว่างให้หลบทุกครั้ง</Text></View></View>
      {mode === 'motion' && <View style={{ gap: 9 }}><Label>ความไวการเอียง</Label><View style={s.segment}>{[{ label: 'ไวสุด 6°', value: 0.105 }, { label: 'ไว 8°', value: 0.14 }, { label: 'นิ่ง 11°', value: 0.19 }].map(option => <Button key={option.value} title={option.label} secondary={tiltThreshold !== option.value} onPress={() => setTiltThreshold(option.value)} />)}</View><Label>ความไวการกระโดด</Label><View style={s.segment}>{[{ label: 'ไวสุด', value: 1.1 }, { label: 'ไว', value: 1.18 }, { label: 'ลดการสั่น', value: 1.35 }].map(option => <Button key={option.value} title={option.label} secondary={threshold !== option.value} onPress={() => setThreshold(option.value)} />)}</View><Pressable accessibilityRole="button" onPress={() => setInvert(v => !v)} style={s.back}><Text style={s.link}>ทิศทางเอียง: {invert ? 'สลับซ้าย–ขวา' : 'ปกติ'} ⇄</Text></Pressable><Text style={s.small}>ค่า “ไว 8°” ตอบสนองทันทีเมื่อเริ่มเอียง และพร้อมรับครั้งต่อไปประมาณ 40 มิลลิวินาทีหลังกลับมาตรง เลือก “นิ่ง 11°” หากมือสั่นง่าย</Text></View>}
      <View style={s.note}><Text style={s.small}>วิ่งอัตโนมัติ ไม่ต้องวิ่งไปข้างหน้า • พักได้ทุกเมื่อ{'\n'}ความเร็วคงที่ มีช่วงทางโล่งท้ายทุกฉาก</Text></View>
      <Button title={resuming ? 'พร้อมแล้ว ไปต่อ  →' : 'พร้อมแล้ว ออกวิ่ง  →'} onPress={startCountdown} disabled={mode === 'motion' && motion.status !== 'ready'} /><Text style={s.footer}>{Platform.OS === 'web' ? 'คีย์บอร์ด: ← → เปลี่ยนช่อง · Space กระโดด · Esc พัก' : 'ถือแนวตั้ง • กระโดดเบา ๆ • เหนื่อยเมื่อไหร่กดพัก'}</Text>
    </ScrollView>}
    {['playing', 'countdown', 'paused'].includes(phase) && <View style={{ flex: 1 }}>
      <View style={s.gameHeader}><View><Label>CHICKEN RUN / 0{stageIndex(snapshot.time) + 1}</Label><Text style={s.stageTitle}>{stage.name}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="พักเกม" onPress={pause} disabled={phase === 'paused'} style={s.pause}><Text style={s.link}>Ⅱ พัก</Text></Pressable></View>
      <View style={s.hud}><Text style={s.hudText}>↗ {Math.floor(snapshot.time * SPEED)} <Text style={s.hudUnit}>ม.</Text></Text><Text style={s.hudText}>● {snapshot.coins} <Text style={s.hudUnit}>เหรียญ</Text></Text><Text accessibilityLabel={snapshot.pursuit ? 'ผู้พันกำลังไล่ประชิด ชนอีกครั้งจะแพ้' : 'ผู้พันยังอยู่ห่าง'} style={{ color: snapshot.pursuit ? c.orange : c.green, fontSize: 14, fontWeight: '900' }}>{snapshot.pursuit ? '⚠ ผู้พันประชิด!' : '✓ ผู้พันอยู่ไกล'}</Text></View>
      <View style={s.progress}><View style={[s.progressFill, { width: `${snapshot.time / TOTAL_SECONDS * 100}%` }]} /></View>
      <View style={{ flex: 1, minHeight: 200 }}><GameScene run={snapshot} clock={clock} lane={lane} jumpAt={jumpAt} /><View pointerEvents="none" style={s.sceneCaption}><Text style={s.captionText}>{isRest(snapshot.time) ? 'หายใจสบาย ๆ ช่วงนี้ไม่มีสิ่งกีดขวาง' : snapshot.time < snapshot.invincibleUntil ? 'ชนแล้ว! ผู้พันตามมาประชิด—ชนอีกครั้งจะแพ้' : dangerSoon ? `${nextObstacle.kind === 'campfire' ? '↑ แคมป์ไฟ • กระโดดหรือเปลี่ยนช่อง' : nextObstacle.kind === 'barrel' ? '↔ ถังไม้ • เปลี่ยนช่องหลบ' : '↔ คนถือส้อม • เปลี่ยนช่องหลบ'} (${nextObstacle.lane === -1 ? 'ซ้าย' : nextObstacle.lane === 1 ? 'ขวา' : 'กลาง'})` : snapshot.pursuit ? 'ระวัง! ผู้พันกำลังจี้มาแล้ว' : 'เก็บเหรียญ ผู้พันยังตามมาไม่ทัน'}</Text></View></View>
      <View style={s.gameControls}><Text style={s.footer}>{mode === 'motion' ? 'เอียง → กลับตรง → เอียงใหม่  ·  กระโดดเบา ๆ' : 'แตะปุ่ม หรือใช้ ← → และ Space'}</Text><View style={s.segment}><Button title="← ซ้าย" secondary onPress={() => move(-1)} disabled={phase !== 'playing'} /><Button title="↑ กระโดด" onPress={doJump} disabled={phase !== 'playing'} /><Button title="ขวา →" secondary onPress={() => move(1)} disabled={phase !== 'playing'} /></View></View>
      {phase === 'countdown' && <View style={s.overlay}><View style={s.modal}><Chicken size={108} /><Label>TAKE A LITTLE BREATH</Label><Text style={s.countdown}>{count}</Text><Text style={s.body}>จับโทรศัพท์ให้มั่น แล้วไปกันเลย!</Text><Button title="พักก่อน" secondary onPress={pause} /></View></View>}
      {phase === 'paused' && <View style={s.overlay}><View style={s.modal}><Text style={s.title}>พักหายใจสักนิด</Text><Text style={[s.body, { textAlign: 'center' }]}>น้องไก่รอได้ ผู้พันก็ต้องรอเหมือนกัน</Text><Text style={s.statValue}>{Math.floor(snapshot.time * SPEED)} ม.</Text><Button title="พร้อมแล้ว ไปต่อ →" onPress={() => { setResuming(true); setScreen('setup'); }} /><Button title="จบรอบนี้" secondary onPress={finish} /></View></View>}
    </View>}
    {phase === 'result' && <ScrollView contentContainerStyle={[s.scroll, { flexGrow: 1, justifyContent: 'center' }]}>
      <Label>{snapshot.won ? 'FREEDOM TASTES BETTER' : snapshot.hits >= 2 ? 'THE COLONEL CAUGHT UP' : 'A GOOD LITTLE RUN'}</Label><View style={s.resultArt}>{snapshot.hits >= 2 ? <Colonel size={140} /> : <Chicken size={150} />}</View><Text style={[s.title, { textAlign: 'center' }]}>{snapshot.won ? 'อิสระแล้ว เจ้าลูกไก่!' : snapshot.hits >= 2 ? 'ผู้พันตามทันแล้ว!' : 'พักปีกก่อนนะ'}</Text><Text style={[s.body, { textAlign: 'center' }]}>{snapshot.won ? 'จากร้านขายไก่ สู่ยอดเขาแห่งอิสรภาพ' : 'ทุกก้าวของน้องไก่ มีคุณอยู่เบื้องหลัง'}</Text>
      <View style={[s.card, { alignItems: 'center', marginVertical: 15 }]}><Label>ระยะทางในเกม</Label><Text style={s.resultDistance}>{Math.floor(snapshot.time * SPEED)}<Text style={s.body}> เมตร</Text></Text><View style={s.threeStats}><View style={s.miniStat}><Text style={s.statValue}>{snapshot.coins}</Text><Text style={s.small}>เหรียญที่เก็บได้</Text></View><View style={s.miniStat}><Text style={s.statValue}>{Math.floor(snapshot.time)} วิ</Text><Text style={s.small}>เวลาที่เล่น</Text></View></View><Text style={s.small}>ไปถึง{stage.name} · ฉาก {stageIndex(snapshot.time) + 1}/6</Text></View>
      <Button title="พักพอแล้ว วิ่งอีกรอบ ↻" onPress={prepare} /><Button title="กลับหน้าแรก" secondary onPress={home} /><Text style={s.footer}>ข้อมูลรอบนี้จะหายไปเมื่อเริ่มใหม่หรือปิดแอป{'\n'}ระยะทางเป็นระยะจำลองในเกม ไม่ใช่ระยะจาก GPS</Text>
    </ScrollView>}
  </View></SafeAreaView>;
}
