/**
 * Recorded stimuli bundled into the renderer (no network or file access is
 * needed at test time). Files under src/assets/stimuli/<path>.wav are
 * addressed by protocols as assetKey "<path>", e.g. "fa/digit-1".
 */
const files = import.meta.glob('../assets/stimuli/**/*.wav', {
  query: '?inline',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const byKey = new Map(
  Object.entries(files).map(([path, dataUrl]) => [
    path.replace('../assets/stimuli/', '').replace(/\.wav$/, ''),
    dataUrl,
  ]),
);

export function bundledAssetKeys(): string[] {
  return [...byKey.keys()].sort();
}

/** Decodes the inlined data URL without fetch (CSP connect-src stays 'self'). */
export async function loadBundledAsset(key: string): Promise<ArrayBuffer> {
  const dataUrl = byKey.get(key);
  if (!dataUrl) throw new Error(`stimulus asset "${key}" is not bundled with this player version`);
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
