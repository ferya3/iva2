import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  safeStorage,
  session as electronSession,
} from 'electron';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ENGINE_VERSION } from '@cognitest/assessment-engine';
import type { SessionEvent } from '@cognitest/shared-types';
import { ApiFailure, PlayerApiClient } from './api-client';
import { createVerifyProc, parsePins } from './certificate-pin';
import { collectDeviceInfo } from './device-info';
import {
  IPC,
  type CalibrationPayload,
  type PlayerSession,
  type RendererDeviceInfo,
  type Result,
  type UploadState,
} from './ipc-contract';
import { PayloadCipher } from './payload-cipher';
import { SecureStore } from './secure-store';
import { hardenApp, tuneChromiumForTiming } from './security';
import { SqliteOutboxStore } from './sqlite-outbox-store';
import { StateStore } from './state-store';
import { UploadService } from './upload-service';

const API_URL =
  process.env.COGNITEST_API_URL ??
  import.meta.env.MAIN_VITE_API_URL ??
  'https://api.cognitest.ir/api/v1';
// Self-signed server (IP mode): pin its certificate instead of trusting any.
const API_CERT_PINS = parsePins(
  process.env.COGNITEST_API_CERT_SHA256 ?? import.meta.env.MAIN_VITE_API_CERT_SHA256,
);
const PROTOCOL = 'cognitest';
const isDev = !app.isPackaged;

tuneChromiumForTiming();
hardenApp(
  (url) =>
    url.startsWith('file://') ||
    (isDev &&
      !!process.env.ELECTRON_RENDERER_URL &&
      url.startsWith(process.env.ELECTRON_RENDERER_URL)),
);

if (!app.requestSingleInstanceLock()) {
  app.quit();
}
if (process.defaultApp && process.argv[1]) {
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [process.argv[1]]);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

let win: BrowserWindow | null = null;
let testMode = false;
let pendingDeepLink: string | null = null;
let session: PlayerSession | null = null;

const codeFromUrl = (url: string | undefined): string | null => {
  if (!url?.startsWith(`${PROTOCOL}://`)) return null;
  const code = new URL(url).searchParams.get('code');
  return code && /^[0-9A-Za-z-]{9,16}$/.test(code) ? code : null;
};

function deliverDeepLink(url: string | undefined): void {
  const code = codeFromUrl(url);
  if (!code) return;
  if (win && !testMode) {
    win.webContents.send(IPC.deepLink, code);
    if (win.isMinimized()) win.restore();
    win.focus();
  } else {
    pendingDeepLink = code;
  }
}

app.on('second-instance', (_e, argv) =>
  deliverDeepLink(argv.find((a) => a.startsWith(`${PROTOCOL}://`))),
);
app.on('open-url', (event, url) => {
  event.preventDefault();
  deliverDeepLink(url);
});

function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}
function fail(error: unknown): Result<never> {
  if (error instanceof ApiFailure) {
    return {
      ok: false,
      code: error.kind === 'network' ? 'network' : (error.code ?? `http_${error.status}`),
      message: error.message,
    };
  }
  return {
    ok: false,
    code: 'internal',
    message: error instanceof Error ? error.message : String(error),
  };
}

async function createWindow(): Promise<void> {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    title: 'Cognitest',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: isDev,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });
  win.setMenu(null);
  win.once('ready-to-show', () => win?.show());

  // Closing during a run would lose the participant's progress: confirm.
  win.on('close', (event) => {
    if (!testMode || !win) return;
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['ادامه آزمون', 'خروج'],
      defaultId: 0,
      cancelId: 0,
      title: 'آزمون در حال اجراست',
      message: 'آزمون در حال اجراست. با خروج، این اجرا ناتمام و نامعتبر ثبت می‌شود.',
    });
    if (choice === 0) event.preventDefault();
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL)
    await win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else await win.loadFile(join(import.meta.dirname, '../renderer/index.html'));
}

app.whenReady().then(async () => {
  const userData = app.getPath('userData');
  let secure: SecureStore;
  try {
    secure = new SecureStore(join(userData, 'secure'), safeStorage);
  } catch (error) {
    dialog.showErrorBox('Cognitest', error instanceof Error ? error.message : String(error));
    app.quit();
    return;
  }
  const state = new StateStore(join(userData, 'state.json'), () => randomUUID());
  const store = new SqliteOutboxStore(
    new DatabaseSync(join(userData, 'outbox.sqlite')),
    new PayloadCipher(secure.outboxKey()),
  );
  if (API_CERT_PINS.length > 0) {
    electronSession.defaultSession.setCertificateVerifyProc(
      createVerifyProc(new URL(API_URL).hostname, API_CERT_PINS),
    );
  }
  // Chromium's network stack: honours system proxy settings and the Windows
  // certificate store (clinic networks), and the pinning above.
  const api = new PlayerApiClient(
    API_URL,
    net.fetch.bind(net) as typeof fetch,
    20_000,
    `CognitestPlayer/${app.getVersion()}`,
  );
  api.setToken(secure.getToken());

  const emit = (s: UploadState) => win?.webContents.send(IPC.uploadState, s);
  const uploads = new UploadService({
    store,
    api,
    state,
    engineVersion: ENGINE_VERSION,
    emit,
    onCompleted: () => {
      secure.setToken(null);
      api.setToken(null);
    },
  });

  // Resume an interrupted upload from a previous run of the application.
  const s0 = state.get();
  if (s0.sessionId && s0.finalSequence !== null && !s0.completed) uploads.start();

  ipcMain.handle(IPC.appInfo, () => ({
    appVersion: app.getVersion(),
    engineVersion: ENGINE_VERSION,
    platform: process.platform,
    apiUrl: API_URL,
  }));

  ipcMain.handle(IPC.resume, async () => {
    const s = state.get();
    if (s.sessionId && s.finalSequence !== null && !s.completed) {
      return {
        session: null,
        pendingUpload: { sessionId: s.sessionId, pending: store.stats(s.sessionId).pendingEvents },
      };
    }
    if (s.sessionId && !s.completed && secure.getToken()) {
      try {
        session = await api.session();
        return { session, pendingUpload: null };
      } catch {
        return { session: null, pendingUpload: null };
      }
    }
    return { session: null, pendingUpload: null };
  });

  ipcMain.handle(IPC.join, async (_e, code: string) => {
    const s = state.get();
    if (s.sessionId && s.finalSequence !== null && !s.completed) {
      return {
        ok: false,
        code: 'upload_pending',
        message: 'ارسال داده‌های آزمون قبلی هنوز کامل نشده است.',
      };
    }
    try {
      const res = await api.join(String(code).slice(0, 16), s.deviceId);
      secure.setToken(res.token);
      api.setToken(res.token);
      state.resetSession();
      state.update({ sessionId: res.session.id });
      session = res.session;
      return ok(res.session);
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPC.deviceCheck, async (_e, info: RendererDeviceInfo) => {
    try {
      return ok(
        await api.deviceCheck(
          state.get().sessionId!,
          await collectDeviceInfo(info, ENGINE_VERSION),
        ),
      );
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPC.calibration, async (_e, result: CalibrationPayload) => {
    try {
      return ok(await api.calibration(state.get().sessionId!, result));
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPC.start, async () => {
    const sessionId = state.get().sessionId!;
    try {
      const { seed } = await api.start(sessionId);
      uploads.start();
      return ok({ seed, offline: false });
    } catch (error) {
      if (error instanceof ApiFailure && error.kind === 'network') {
        // No connection: run anyway with a local seed; it is reported on reconnect.
        const seed = new Uint32Array(globalThis.crypto.getRandomValues(new Uint32Array(1)))[0]!;
        state.update({
          offlineStart: { seed, startedAt: new Date().toISOString(), confirmed: false },
        });
        uploads.start();
        return ok({ seed, offline: true });
      }
      return fail(error);
    }
  });

  ipcMain.on(IPC.record, (_e, events: SessionEvent[]) => {
    const sessionId = state.get().sessionId;
    if (sessionId && Array.isArray(events)) store.appendMany(sessionId, events);
  });

  ipcMain.handle(IPC.finishRun, (_e, finalSequence: number) => {
    state.update({ finalSequence });
    uploads.start(2_000);
  });

  ipcMain.handle(IPC.testMode, (_e, on: boolean) => {
    testMode = on;
    win?.setKiosk(on);
    win?.setAlwaysOnTop(on, 'screen-saver');
  });

  ipcMain.handle(IPC.reset, () => {
    const s = state.get();
    if (s.sessionId && s.finalSequence !== null && !s.completed) return; // never discard unsent data
    uploads.stop();
    secure.setToken(null);
    api.setToken(null);
    state.resetSession();
    session = null;
  });

  await createWindow();
  const initial = codeFromUrl(process.argv.find((a) => a.startsWith(`${PROTOCOL}://`)));
  if (initial) pendingDeepLink = initial;
  win?.webContents.on('did-finish-load', () => {
    if (pendingDeepLink) {
      win?.webContents.send(IPC.deepLink, pendingDeepLink);
      pendingDeepLink = null;
    }
  });
});

app.on('window-all-closed', () => app.quit());
