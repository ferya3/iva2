import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type CognitestBridge } from './ipc-contract';

/**
 * The only bridge into the sandboxed renderer: a fixed set of functions,
 * no generic `invoke(channel)` that a compromised page could abuse.
 */
const subscribe = <T>(channel: string, listener: (payload: T) => void) => {
  const handler = (_: unknown, payload: T) => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
};

const bridge: CognitestBridge = {
  appInfo: () => ipcRenderer.invoke(IPC.appInfo),
  resume: () => ipcRenderer.invoke(IPC.resume),
  join: (code) => ipcRenderer.invoke(IPC.join, code),
  deviceCheck: (info) => ipcRenderer.invoke(IPC.deviceCheck, info),
  calibration: (result) => ipcRenderer.invoke(IPC.calibration, result),
  start: () => ipcRenderer.invoke(IPC.start),
  record: (events) => ipcRenderer.send(IPC.record, events),
  finishRun: (finalSequence) => ipcRenderer.invoke(IPC.finishRun, finalSequence),
  onUploadState: (listener) => subscribe(IPC.uploadState, listener),
  onDeepLink: (listener) => subscribe(IPC.deepLink, listener),
  setTestMode: (on) => ipcRenderer.invoke(IPC.testMode, on),
  reset: () => ipcRenderer.invoke(IPC.reset),
};

contextBridge.exposeInMainWorld('cognitest', bridge);
