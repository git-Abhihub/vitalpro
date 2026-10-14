import { createLiveSocket, type LiveEvent } from './liveEvents.ts';

export type LiveConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'offline';
type EventListener = (event: LiveEvent) => void;
type StateListener = (state: LiveConnectionState) => void;

const eventListeners = new Set<EventListener>();
const stateListeners = new Set<StateListener>();
let stopConnection: (() => void) | null = null;
let currentState: LiveConnectionState = 'offline';

function publishState(state: LiveConnectionState) {
  currentState = state;
  for (const listener of stateListeners) listener(state);
}

/** Share one WebSocket across all dashboard panels that subscribe to live demo events. */
export function subscribeLiveEvents(
  onEvent: EventListener,
  onStateChange: StateListener,
): () => void {
  eventListeners.add(onEvent);
  stateListeners.add(onStateChange);
  onStateChange(currentState);

  if (!stopConnection) {
    stopConnection = createLiveSocket(
      (event) => {
        for (const listener of eventListeners) listener(event);
      },
      publishState,
    );
  }

  return () => {
    eventListeners.delete(onEvent);
    stateListeners.delete(onStateChange);
    if (eventListeners.size || stateListeners.size || !stopConnection) return;

    const stop = stopConnection;
    stopConnection = null;
    stop();
    publishState('offline');
  };
}
