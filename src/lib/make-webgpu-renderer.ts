import type { NativeCanvas } from 'react-native-wgpu';
import * as THREE from 'three/webgpu';

export class ReactNativeCanvas {
  constructor(private readonly canvas: NativeCanvas) {}

  get width() { return this.canvas.width; }
  get height() { return this.canvas.height; }
  set width(value: number) { this.canvas.width = value; }
  set height(value: number) { this.canvas.height = value; }
  get clientWidth() { return this.canvas.clientWidth; }
  get clientHeight() { return this.canvas.clientHeight; }
  set clientWidth(value: number) { this.canvas.clientWidth = value; }
  set clientHeight(value: number) { this.canvas.clientHeight = value; }

  addEventListener(_type: string, _listener: EventListener) {}
  removeEventListener(_type: string, _listener: EventListener) {}
  dispatchEvent(_event: Event) { return false; }
  setPointerCapture() {}
  releasePointerCapture() {}
}

export function makeWebGPURenderer(context: GPUCanvasContext) {
  return new THREE.WebGPURenderer({
    antialias: true,
    // React Native exposes the canvas dimensions without a DOM canvas.
    canvas: new ReactNativeCanvas(context.canvas as unknown as NativeCanvas) as unknown as HTMLCanvasElement,
    context,
  });
}
