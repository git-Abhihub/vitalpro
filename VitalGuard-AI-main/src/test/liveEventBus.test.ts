import { afterEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  sessions: [] as Array<{
    onEvent: (event: { type: string; [key: string]: unknown }) => void;
    onStatus: (status: 'connecting' | 'connected' | 'reconnecting' | 'offline') => void;
    stop: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('../services/liveEvents.ts', () => ({
  createLiveSocket: (
    onEvent: (event: { type: string; [key: string]: unknown }) => void,
    onStatus: (status: 'connecting' | 'connected' | 'reconnecting' | 'offline') => void,
  ) => {
    const stop = vi.fn();
    harness.sessions.push({ onEvent, onStatus, stop });
    return stop;
  },
}));

import { subscribeLiveEvents } from '../services/liveEventBus.ts';

afterEach(() => {
  harness.sessions.length = 0;
  vi.clearAllMocks();
});

describe('live event bus', () => {
  it('shares one socket, fans events out, and stops after the last subscriber leaves', () => {
    const firstEvent = vi.fn();
    const firstStatus = vi.fn();
    const secondEvent = vi.fn();
    const secondStatus = vi.fn();

    const unsubscribeFirst = subscribeLiveEvents(firstEvent, firstStatus);
    const unsubscribeSecond = subscribeLiveEvents(secondEvent, secondStatus);

    expect(harness.sessions).toHaveLength(1);
    const event = { type: 'observation.created', event_id: 42, patient_id: 'DEMO-001', demo_only: true };
    harness.sessions[0].onEvent(event);
    expect(firstEvent).toHaveBeenCalledWith(event);
    expect(secondEvent).toHaveBeenCalledWith(event);

    harness.sessions[0].onStatus('connected');
    expect(firstStatus).toHaveBeenLastCalledWith('connected');
    expect(secondStatus).toHaveBeenLastCalledWith('connected');

    unsubscribeFirst();
    expect(harness.sessions[0].stop).not.toHaveBeenCalled();
    unsubscribeSecond();
    expect(harness.sessions[0].stop).toHaveBeenCalledOnce();
  });

  it('opens a fresh shared socket when a new subscriber arrives after cleanup', () => {
    const unsubscribe = subscribeLiveEvents(vi.fn(), vi.fn());
    expect(harness.sessions).toHaveLength(1);
    unsubscribe();

    const unsubscribeAgain = subscribeLiveEvents(vi.fn(), vi.fn());
    expect(harness.sessions).toHaveLength(2);
    unsubscribeAgain();
  });
});
