import { useEffect, useState } from 'react';
import { subscribeLiveEvents, type LiveConnectionState } from '../services/liveEventBus.ts';
import type { LiveEvent } from '../services/liveEvents.ts';

export function useBackendLiveEvents(onEvent: (event: LiveEvent) => void): LiveConnectionState {
  const [connectionState, setConnectionState] = useState<LiveConnectionState>('connecting');

  useEffect(
    () => subscribeLiveEvents(onEvent, setConnectionState),
    [onEvent],
  );

  return connectionState;
}
