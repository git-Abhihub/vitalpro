"""Single-process WebSocket fan-out for synthetic demo events."""
from __future__ import annotations

from fastapi import WebSocket


class DemoEventHub:
    """Broadcast demo events to connected browser sessions.

    This in-memory hub is intentionally single-instance only. It is not a
    durable queue and must not be treated as a clinical alarm transport.
    """

    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._clients.add(websocket)
        await websocket.send_json({"type": "connected", "demo_only": True})

    def disconnect(self, websocket: WebSocket) -> None:
        self._clients.discard(websocket)

    async def broadcast(self, event: dict) -> None:
        stale: list[WebSocket] = []
        for client in tuple(self._clients):
            try:
                await client.send_json(event)
            except Exception:
                stale.append(client)
        for client in stale:
            self.disconnect(client)


event_hub = DemoEventHub()
