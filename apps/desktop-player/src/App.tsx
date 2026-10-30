import { useCallback, useEffect, useState } from 'react';
import { Spinner } from '@cognitest/ui';
import type { PlayerSession } from '../electron/ipc-contract';
import { JoinScreen } from './screens/JoinScreen';
import { DeviceCheckScreen } from './screens/DeviceCheckScreen';
import { CalibrationScreen } from './screens/CalibrationScreen';
import { ReadyScreen } from './screens/ReadyScreen';
import { RunScreen } from './screens/RunScreen';
import { UploadScreen } from './screens/UploadScreen';
import { bridge } from './services/bridge';

type Screen =
  | { name: 'loading' }
  | { name: 'join'; code?: string | null }
  | { name: 'device'; session: PlayerSession }
  | { name: 'calibration'; session: PlayerSession }
  | { name: 'ready'; session: PlayerSession; refreshRateHz: number }
  | { name: 'run'; session: PlayerSession; refreshRateHz: number; seed: number }
  | { name: 'upload'; aborted: boolean };

/** Where to continue after a restart, from the server-side session status. */
function screenFor(session: PlayerSession): Screen {
  switch (session.status) {
    case 'DEVICE_CHECK':
    case 'CALIBRATION':
      return { name: 'calibration', session };
    case 'READY':
      // Calibration results are per run of the app: measure again.
      return { name: 'calibration', session };
    default:
      return { name: 'device', session };
  }
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'loading' });

  useEffect(() => {
    void bridge()
      .resume()
      .then((r) => {
        if (r.pendingUpload) setScreen({ name: 'upload', aborted: false });
        else if (
          r.session &&
          ['INVITED', 'DEVICE_CHECK', 'CALIBRATION', 'READY'].includes(r.session.status)
        )
          setScreen(screenFor(r.session));
        else setScreen({ name: 'join' });
      });
    return bridge().onDeepLink((code) =>
      setScreen((s) => (s.name === 'join' || s.name === 'loading' ? { name: 'join', code } : s)),
    );
  }, []);

  const finished = useCallback((lastSequence: number, aborted: boolean) => {
    void bridge().finishRun(lastSequence);
    setScreen({ name: 'upload', aborted });
  }, []);

  switch (screen.name) {
    case 'loading':
      return (
        <div className="grid h-full place-items-center">
          <Spinner className="h-8 w-8 text-brand-600" />
        </div>
      );
    case 'join':
      return (
        <JoinScreen
          initialCode={screen.code}
          onJoined={(session) => setScreen({ name: 'device', session })}
        />
      );
    case 'device':
      return (
        <DeviceCheckScreen
          session={screen.session}
          onPassed={() => setScreen({ name: 'calibration', session: screen.session })}
        />
      );
    case 'calibration':
      return (
        <CalibrationScreen
          session={screen.session}
          onReady={(hz) => setScreen({ name: 'ready', session: screen.session, refreshRateHz: hz })}
        />
      );
    case 'ready':
      return (
        <ReadyScreen
          session={screen.session}
          onStart={(seed) =>
            setScreen({
              name: 'run',
              session: screen.session,
              refreshRateHz: screen.refreshRateHz,
              seed,
            })
          }
        />
      );
    case 'run':
      return (
        <RunScreen
          session={screen.session}
          seed={screen.seed}
          refreshRateHz={screen.refreshRateHz}
          onFinished={finished}
        />
      );
    case 'upload':
      return (
        <UploadScreen
          aborted={screen.aborted}
          onDone={() => {
            void bridge().reset();
            setScreen({ name: 'join' });
          }}
        />
      );
  }
}
