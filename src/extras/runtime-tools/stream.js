import { buildSnapshot } from './snapshot.js';

const PROTOCOL = 'playcanvas.runtime-tools';
const PROTOCOL_VERSION = 1;
// eslint-disable-next-line no-unused-vars -- used by follow-up streaming tasks
const FRAME_MAX_EDGE = 512;
const RECONNECT_MS = 1000;

// eslint-disable-next-line no-unused-vars -- used by follow-up streaming tasks
const now = () => Date.now();

/**
 * Opens a dev-only WebSocket and pushes live state/events/frames to a runtime-tools server.
 * Opt-in: only called when `attachRuntimeTools(app, { stream })` is used.
 *
 * @param {import('../../framework/app-base.js').AppBase} app - The application.
 * @param {object} entry - The registry entry from attachRuntimeTools.
 * @param {string} url - ws:// URL of the local dev server.
 * @param {object} [opts] - { WebSocketImpl, summaryMs, frameMs } (test/tuning hooks).
 * @returns {() => void} stop() — closes the socket and removes all listeners/timers.
 * @ignore
 */
const startStream = (app, entry, url, opts = {}) => {
    const WS = opts.WebSocketImpl ?? globalThis.WebSocket;
    // eslint-disable-next-line no-unused-vars -- used by follow-up streaming tasks
    const summaryMs = opts.summaryMs ?? 1000;
    // eslint-disable-next-line no-unused-vars -- used by follow-up streaming tasks
    const frameMs = opts.frameMs ?? 500;

    let socket = null;
    let stopped = false;
    let reconnectTimer = null;

    const send = (msg) => {
        if (socket && socket.readyState === 1) {
            socket.send(JSON.stringify(msg));
        }
    };

    const connect = () => {
        socket = new WS(url);
        socket.onopen = () => {
            send({ t: 'hello', appId: entry.id, protocol: PROTOCOL, version: PROTOCOL_VERSION });
            send({ t: 'snapshot', snapshot: buildSnapshot(entry) });
        };
        socket.onmessage = (e) => {
            const msg = typeof e.data === 'string' ? JSON.parse(e.data) : null;
            if (msg?.t === 'request-snapshot') {
                send({ t: 'snapshot', snapshot: buildSnapshot(entry) });
            }
        };
        socket.onclose = () => {
            if (!stopped) {
                reconnectTimer = setTimeout(connect, RECONNECT_MS);
            }
        };
        socket.onerror = () => {
            socket?.close();
        };
    };

    connect();

    const stop = () => {
        stopped = true;
        clearTimeout(reconnectTimer);
        send({ t: 'bye', appId: entry.id });
        socket?.close();
    };

    return stop;
};

export { startStream };
