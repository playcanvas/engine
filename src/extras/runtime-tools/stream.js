import { buildSnapshot } from './snapshot.js';
import { injectInput } from './input.js';

const PROTOCOL = 'playcanvas.runtime-tools';
const PROTOCOL_VERSION = 1;
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
 * @param {object} [opts] - { WebSocketImpl, summaryMs, frameMs, log } (test/tuning hooks).
 * @returns {() => void} stop() — closes the socket and removes all listeners/timers.
 * @ignore
 */
const startStream = (app, entry, url, opts = {}) => {
    const WS = opts.WebSocketImpl ?? globalThis.WebSocket;
    const summaryMs = opts.summaryMs ?? 1000;
    const frameMs = opts.frameMs ?? 500;
    const log = opts.log ?? (msg => console.log(`[playcanvas-runtime-tools] ${msg}`));

    let socket = null;
    let stopped = false;
    let reconnectTimer = null;
    let opened = false;

    const send = (msg) => {
        if (socket && socket.readyState === 1) {
            socket.send(JSON.stringify(msg));
        }
    };

    const connect = () => {
        socket = new WS(url);
        socket.onopen = () => {
            opened = true;
            log('connected.');
            send({ t: 'hello', appId: entry.id, protocol: PROTOCOL, version: PROTOCOL_VERSION });
            send({ t: 'snapshot', snapshot: buildSnapshot(entry) });
        };
        socket.onmessage = (e) => {
            const msg = typeof e.data === 'string' ? JSON.parse(e.data) : null;
            if (msg?.t === 'request-snapshot') {
                send({ t: 'snapshot', snapshot: buildSnapshot(entry) });
            } else if (msg?.t === 'input') {
                injectInput(app.graphicsDevice.canvas, msg);
            }
        };
        socket.onclose = () => {
            if (!stopped) {
                if (opened) {
                    log('connection lost, reconnecting...');
                }
                opened = false;
                reconnectTimer = setTimeout(connect, RECONNECT_MS);
            }
        };
        socket.onerror = () => {
            socket?.close();
        };
    };

    log('connecting...');
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
    let prevLoading = false;
    const onFrameEnd = () => {
        const loading = app.assets.list().some(a => a.loading);
        if (loading && !prevLoading) {
            settledEmitted = false; // new loading burst -> allow another settled
        }
        prevLoading = loading;
        settledCount = (entry.started && !loading) ? settledCount + 1 : 0;
        if (settledCount >= settleFrames && !settledEmitted) {
            settledEmitted = true;
            event('settled', { frame: app.frame });
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

    let summaryTimer = null;
    if (summaryMs > 0) {
        summaryTimer = setInterval(() => {
            const f = app.stats.frame;
            send({ t: 'summary', fps: f.fps, frameMs: f.ms, drawCalls: app.stats.drawCalls.total, ts: now() });
        }, summaryMs);
        summaryTimer.unref?.();
    }

    // frame capture: requires the device created with preserveDrawingBuffer (WebGL reads back
    // blank otherwise). disabled when frameMs<=0 (jsdom unit tests). browser-tested in Part C.
    let lastFrame = 0;
    const onFrameCapture = () => {
        if (frameMs <= 0 || now() - lastFrame < frameMs) {
            return;
        }
        if (canvas.width === 0 || canvas.height === 0) {
            return;
        }
        const scale = Math.min(1, FRAME_MAX_EDGE / Math.max(canvas.width, canvas.height));
        const w = Math.max(1, Math.round(canvas.width * scale));
        const h = Math.max(1, Math.round(canvas.height * scale));
        const off = document.createElement('canvas');
        off.width = w;
        off.height = h;
        const ctx = off.getContext('2d');
        if (!ctx) {
            return;
        }
        ctx.drawImage(canvas, 0, 0, w, h);
        lastFrame = now();
        send({ t: 'frame', dataUrl: off.toDataURL('image/jpeg', 0.6), w, h, ts: now() });
    };
    if (frameMs > 0) {
        app.on('frameend', onFrameCapture);
    }

    const stop = () => {
        stopped = true;
        clearTimeout(reconnectTimer);
        send({ t: 'bye', appId: entry.id });
        app.assets?.off('error', onAssetError);
        app.off('start', onStart);
        app.off('frameend', onFrameEnd);
        canvas.removeEventListener('webglcontextlost', onLost);
        canvas.removeEventListener('webglcontextrestored', onRestored);
        clearInterval(summaryTimer);
        if (frameMs > 0) {
            app.off('frameend', onFrameCapture);
        }
        socket?.close();
    };

    return stop;
};

export { startStream };
