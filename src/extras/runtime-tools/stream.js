import { buildSnapshot } from './snapshot.js';

const PROTOCOL = 'playcanvas.runtime-tools';
const PROTOCOL_VERSION = 1;
// eslint-disable-next-line no-unused-vars -- used by follow-up streaming tasks
const FRAME_MAX_EDGE = 512;
const RECONNECT_MS = 1000;

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

    const settleFrames = opts.settleFrames ?? 3;
    const event = (kind, payload) => send({ t: 'event', kind, payload, frame: app.frame, ts: now() });

    const onAssetError = (err, asset) => {
        const a = asset ?? ((err && typeof err === 'object' && 'id' in err) ? err : null);
        event('asset-error', {
            message: a === err ? 'asset load error' : String(err),
            assetId: a?.id ?? null,
            name: a?.name ?? null,
            url: a?.file?.url ?? null
        });
    };
    const onStart = () => event('lifecycle', { phase: 'start' });

    let settledCount = 0;
    let settledEmitted = false;
    const onFrameEnd = () => {
        const loading = app.assets.list().some(a => a.loading);
        settledCount = (entry.started && !loading) ? settledCount + 1 : 0;
        if (settledCount >= settleFrames && !settledEmitted) {
            settledEmitted = true;
            event('settled', { frame: app.frame });
        }
        if (loading) {
            settledEmitted = false;
        }
    };

    const canvas = app.graphicsDevice.canvas;
    const onLost = () => event('device-lost', { restored: false });
    const onRestored = () => event('device-lost', { restored: true });

    app.assets.on('error', onAssetError);
    app.on('start', onStart);
    app.on('frameend', onFrameEnd);
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    const stop = () => {
        stopped = true;
        clearTimeout(reconnectTimer);
        send({ t: 'bye', appId: entry.id });
        app.assets?.off('error', onAssetError);
        app.off('start', onStart);
        app.off('frameend', onFrameEnd);
        canvas.removeEventListener('webglcontextlost', onLost);
        canvas.removeEventListener('webglcontextrestored', onRestored);
        socket?.close();
    };

    return stop;
};

export { startStream };
