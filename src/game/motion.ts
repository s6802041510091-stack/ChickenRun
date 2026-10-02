export type Vector = { x: number; y: number; z: number };
export const magnitude = (v: Vector) => Math.hypot(v.x, v.y, v.z);
export const roll = (v: Vector) => Math.atan2(v.x, Math.max(0.15, Math.abs(v.y)));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export class MotionDetector {
  private angle = 0;
  private accelAngle = 0;
  private gyroRate = 0;
  private gyroAt = 0;
  private armed = true;
  private neutralSince = -1;
  private lastLaneAt = -10000;
  private impulseAt = -10000;
  private lastJump = -10000;
  private jumpArmed = true;
  private stableSince = -1;
  public neutral: number;
  public threshold: number;
  public invert: boolean;
  public tiltThreshold: number;
  constructor(neutral: number, threshold = 1.3, invert = false, tiltThreshold = 0.21) {
    this.neutral = neutral;
    this.threshold = threshold;
    this.invert = invert;
    this.tiltThreshold = tiltThreshold;
  }
  gyro(v: Vector, now: number) {
    const dt = this.gyroAt ? Math.min((now - this.gyroAt) / 1000, 0.05) : 0;
    this.gyroAt = now;
    // In portrait, leaning left/right rotates around the screen-normal (z) axis.
    // Keep only a small amount of the previous sample so quick wrist intent is not delayed.
    this.gyroRate = this.gyroRate * 0.25 + (-v.z) * 0.75;
    this.angle = clamp(this.angle + this.gyroRate * dt, -1.2, 1.2);
  }
  sample(v: Vector, now: number): { lane: number; jump: boolean; angle: number; force: number; armed: boolean } {
    const force = magnitude(v);
    const rawAngle = roll(v) - this.neutral;
    const forceDelta = Math.abs(force - 1);
    // Gravity keeps the gyro from drifting. A stronger blend while the phone is steady also
    // makes slow, deliberate leans register instead of requiring a fast wrist rotation.
    if (forceDelta < 0.30) {
      this.accelAngle = this.accelAngle * 0.35 + rawAngle * 0.65;
      const correction = Math.abs(this.gyroRate) > 0.35 ? 0.12 : 0.32;
      this.angle = clamp(this.angle * (1 - correction) + this.accelAngle * correction, -1.2, 1.2);
    }
    let lane = 0;
    // Rearm from the phone's current gravity angle. The integrated gyro angle can lag behind
    // after a quick lean, so waiting for both values to reach zero made controls feel sticky.
    const neutral = Math.abs(rawAngle) < 0.075 && Math.abs(this.accelAngle) < 0.09 && Math.abs(this.gyroRate) < 0.65 && forceDelta < 0.25;
    if (neutral) {
      if (this.neutralSince < 0) this.neutralSince = now;
      if (now - this.neutralSince >= 40) {
        this.armed = true;
        this.angle = this.accelAngle;
      }
      // Follow small changes in the player's natural holding angle, but never learn a held lean.
      if (this.armed) this.neutral += rawAngle * 0.01;
    } else this.neutralSince = -1;
    const intentAngle = Math.abs(this.accelAngle) >= 0.04 ? this.accelAngle : this.angle;
    const direction = intentAngle >= 0 ? 1 : -1;
    const crossedAngle = Math.abs(this.accelAngle) >= this.tiltThreshold || Math.abs(this.angle) >= this.tiltThreshold;
    const gyroAssist = now - this.gyroAt < 120
      && Math.abs(intentAngle) >= this.tiltThreshold * 0.45
      && direction * this.gyroRate > 0.28;
    if (this.armed && now - this.lastLaneAt >= 90 && forceDelta < 0.35 && (crossedAngle || gyroAssist)) {
      // Accelerometer +x is produced by a physical lean to the player's left
      // in the portrait holding position used by the game. Game lanes use -1
      // for left and +1 for right, so the sensor sign must be reversed here.
      lane = -direction * (this.invert ? -1 : 1);
      this.armed = false;
      this.neutralSince = -1;
      this.lastLaneAt = now;
    }
    let jump = false;
    if (!this.jumpArmed) {
      if (Math.abs(force - 1) < 0.13) {
        if (this.stableSince < 0) this.stableSince = now;
        if (now - this.stableSince > 250 && now - this.lastJump > 1200) this.jumpArmed = true;
      } else this.stableSince = -1;
    }
    if (this.jumpArmed && now - this.lastJump > 1200) {
      if (force > this.threshold && now - this.impulseAt > 400) this.impulseAt = now;
      if (force < 0.88 && now - this.impulseAt > 15 && now - this.impulseAt < 350) {
        jump = true; this.lastJump = now; this.jumpArmed = false; this.stableSince = -1;
      }
    }
    return { lane, jump, angle: this.angle, force, armed: this.armed };
  }
}
