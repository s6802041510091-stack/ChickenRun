import { useEffect, useRef, useState } from 'react';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { MotionDetector, magnitude, roll, type Vector } from '../game/motion';

export type MotionStatus = 'off' | 'checking' | 'calibrating' | 'ready' | 'error';
const SENSOR_INTERVAL_MS = 8;
const CALIBRATION_SAMPLES = 48;
export function useMotion(active: boolean, onLane: (direction: number) => void, onJump: () => void, threshold: number, tiltThreshold: number, invert: boolean) {
  const [status, setStatus] = useState<MotionStatus>('off');
  const [message, setMessage] = useState('');
  const [reading, setReading] = useState({ force: 1, angle: 0, progress: 0, armed: true });
  const [revision, setRevision] = useState(0);
  const callbacks = useRef({ onLane, onJump });
  useEffect(() => { callbacks.current = { onLane, onJump }; }, [onLane, onJump]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const subscriptions: { remove(): void }[] = [];
    let detector: MotionDetector | null = null;
    let samples: number[] = [];
    let lastUI = 0;
    let lastAccel = 0;
    let lastGyro = 0;
    const started = Date.now();
    const fail = (text: string) => {
      if (cancelled) return;
      cancelled = true;
      clearInterval(watchdog);
      subscriptions.forEach(s => s.remove());
      setMessage(text); setStatus('error');
    };
    const stateTimer = setTimeout(() => {
      if (cancelled) return;
      setStatus('checking'); setMessage('กำลังตรวจสอบเซ็นเซอร์');
      setReading({ force: 1, angle: 0, progress: 0, armed: true });
    }, 0);
    const watchdog = setInterval(() => {
      if (Date.now() - started > 5000 && (Date.now() - lastAccel > 2500 || Date.now() - lastGyro > 2500)) {
        fail('ไม่ได้รับข้อมูลเซ็นเซอร์ ลองตั้งค่าใหม่ หรือเล่นด้วยปุ่ม');
        clearInterval(watchdog);
      }
    }, 1000);
    async function setup() {
      try {
        const permissions = await Promise.all([Accelerometer.requestPermissionsAsync(), Gyroscope.requestPermissionsAsync()]);
        if (cancelled) return;
        if (permissions.some(p => !p.granted)) { fail('ยังไม่ได้อนุญาต Motion กรุณาอนุญาตในการตั้งค่าเครื่อง หรือใช้ปุ่ม'); return; }
        const available = await Promise.all([Accelerometer.isAvailableAsync(), Gyroscope.isAvailableAsync()]);
        if (cancelled) return;
        if (available.some(value => !value)) { fail('เครื่องนี้ไม่มีเซ็นเซอร์ที่เกมต้องใช้ เล่นด้วยปุ่มได้เลย'); return; }
        // Request the fastest practical stream. Hardware may cap this rate, which is safe.
        Accelerometer.setUpdateInterval(SENSOR_INTERVAL_MS); Gyroscope.setUpdateInterval(SENSOR_INTERVAL_MS);
        setStatus('calibrating'); setMessage('ถือโทรศัพท์แนวตั้งนิ่ง ๆ ในท่าที่จะเล่น');
        subscriptions.push(Gyroscope.addListener(v => { lastGyro = Date.now(); detector?.gyro(v, lastGyro); }));
        subscriptions.push(Accelerometer.addListener((v: Vector) => {
          const now = Date.now(); lastAccel = now;
          if (!detector) {
            const angle = roll(v);
            if (Math.abs(magnitude(v) - 1) > 0.12 || Math.abs(v.y) < 0.55 || (samples.length > 0 && Math.abs(angle - samples[0]) > 0.08)) samples = [];
            else samples.push(angle);
            if (samples.length >= CALIBRATION_SAMPLES) {
              detector = new MotionDetector(samples.reduce((a, b) => a + b, 0) / samples.length, threshold, invert, tiltThreshold);
              setStatus('ready'); setMessage('พร้อมแล้ว! ลองเอียงและกระโดดเบา ๆ');
            }
            if (now - lastUI > 50) { setReading({ force: magnitude(v), angle: 0, progress: Math.min(1, samples.length / CALIBRATION_SAMPLES), armed: true }); lastUI = now; }
            return;
          }
          const result = detector.sample(v, now);
          if (result.lane) callbacks.current.onLane(result.lane);
          if (result.jump) callbacks.current.onJump();
          if (now - lastUI > 50) { setReading({ force: result.force, angle: result.angle * 180 / Math.PI, progress: 1, armed: result.armed }); lastUI = now; }
        }));
      } catch { fail('เปิดเซ็นเซอร์ไม่สำเร็จ ลองอีกครั้งหรือเลือกเล่นด้วยปุ่ม'); }
    }
    void setup();
    return () => { cancelled = true; clearTimeout(stateTimer); clearInterval(watchdog); subscriptions.forEach(s => s.remove()); };
  }, [active, revision, threshold, tiltThreshold, invert]);
  return { status: active ? status : 'off' as MotionStatus, message, reading, recalibrate: () => setRevision(value => value + 1) };
}
