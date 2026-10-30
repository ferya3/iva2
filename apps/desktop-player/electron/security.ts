import { app, session, shell, type WebContents } from 'electron';

/**
 * Hardening applied before any window exists:
 *  - renderer processes are sandboxed (no Node.js);
 *  - all permission requests (camera, mic, notifications, …) are denied;
 *  - navigation away from the bundled UI and new windows are blocked;
 *  - remote content is never loaded.
 */
export function hardenApp(isAllowedUrl: (url: string) => boolean): void {
  app.enableSandbox();

  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) =>
      callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
  });

  app.on('web-contents-created', (_event, contents: WebContents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) void shell.openExternal(url);
      return { action: 'deny' };
    });
    contents.on('will-navigate', (event, url) => {
      if (!isAllowedUrl(url)) event.preventDefault();
    });
    contents.on('will-attach-webview', (event) => event.preventDefault());
  });
}

/** Keeps timers and rAF at full rate even if the window is briefly occluded. */
export function tuneChromiumForTiming(): void {
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
  // Smooth scrolling and pinch zoom change frame pacing; neither is needed.
  app.commandLine.appendSwitch('disable-smooth-scrolling');
  app.commandLine.appendSwitch('disable-pinch');
}
