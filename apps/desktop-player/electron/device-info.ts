import { app, screen } from 'electron';
import os from 'node:os';
import type { RendererDeviceInfo } from './ipc-contract';

/** Device profile sent with the device check (no personal data). */
export async function collectDeviceInfo(renderer: RendererDeviceInfo, engineVersion: string) {
  const display = screen.getPrimaryDisplay();
  let gpu: string | null = null;
  try {
    const info = (await app.getGPUInfo('basic')) as {
      gpuDevice?: Array<{ vendorId: number; deviceId: number; active?: boolean }>;
    };
    const active = info.gpuDevice?.find((g) => g.active) ?? info.gpuDevice?.[0];
    gpu = active
      ? `vendor 0x${active.vendorId.toString(16)} device 0x${active.deviceId.toString(16)}`
      : null;
  } catch {
    gpu = null;
  }
  return {
    os: os.type(),
    os_version: os.release(),
    app_version: app.getVersion(),
    engine_version: engineVersion,
    cpu_model: os.cpus()[0]?.model ?? null,
    cpu_cores: os.cpus().length || null,
    memory_gb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    screen: {
      width: display.size.width,
      height: display.size.height,
      scale_factor: display.scaleFactor,
      color_depth: display.colorDepth,
    },
    gpu,
    audio_output: renderer.audio_output,
  };
}
