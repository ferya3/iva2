# Recorded stimuli

Protocols refer to these files by `assetKey` = path without `.wav`
(`fa/digit-1` → `fa/digit-1.wav`). They are inlined into the player at
build time, so changing them requires a new player build.

The current `fa/digit-1.wav` («یک») and `fa/digit-2.wav` («دو») were
synthesised with the MBROLA `ir1` Persian voice (espeak-ng, `mbrola-ir1`)
as placeholders. **For real use, replace them with studio recordings of a
clear adult voice**, prepared like this:

- mono, 44.1 or 48 kHz, 16-bit WAV;
- leading silence removed — the first sample is the acoustic onset that
  reaction times are measured from;
- both words of similar length (≤ 450 ms) and loudness (peak ≈ −3 dBFS);
- short fade-out to avoid clicks.

```bash
sox input.wav -r 44100 -b 16 -c 1 trimmed.wav silence 1 0.005 0.5% reverse silence 1 0.005 0.5% reverse
sox trimmed.wav digit-1.wav norm -3 fade t 0.003 0 0.015
```

After replacing a file, re-check onset timing with an audio loopback test
(see docs/validation/README.md).
