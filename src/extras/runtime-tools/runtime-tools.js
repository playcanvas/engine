import { RingBuffer } from './ring-buffer.js';
import { buildSnapshot } from './snapshot.js';

const PROTOCOL = 'playcanvas.runtime-tools';
const PROTOCOL_VERSION = 1;
const CAPABILITIES = ['apps', 'snapshot', 'diagnostics', 'waitForFrame', 'waitForSettled'];
const MAX_DIAGNOSTICS = 100;
const WAIT_FRAME_CANCELLED = 'app detached or destroyed while waiting for frame';
const WAIT_SETTLED_CANCELLED = 'app detached or destroyed while waiting to settle';

let idCounter = 0;
const registry = new Map();

const resolve = (appId) => {
    if (appId === undefined) {
        if (registry.size === 1) {
            return registry.values().next().value;
        }
        throw new Error(`appId required, attached apps: [${[...registry.keys()].join(', ')}]`);
    }
    const entry = registry.get(appId);
    if (!entry) {
        throw new Error(`unknown appId '${appId}', attached apps: [${[...registry.keys()].join(', ')}]`);
    }
    return entry;
};

const createGlobal = () => {
    globalThis.__PLAYCANVAS_TOOLS__ = {
        protocol: PROTOCOL,
        version: PROTOCOL_VERSION,
        capabilities: CAPABILITIES.slice(),
        apps() {
            return [...registry.values()].map(e => ({
                id: e.id,
                frame: e.app.frame,
                running: e.started && !e.destroyed
            }));
        },
        snapshot(appId) {
            return buildSnapshot(resolve(appId));
        },
        diagnostics(appId) {
            const errors = resolve(appId).errors.toArray();
            return {
                errors,
                warnings: [],
                failedRequests: [],
                missingAssets: errors.filter(e => e.kind === 'asset' && e.url).map(e => e.url)
            };
        },
        waitForFrame(appId) {
            const entry = resolve(appId);
            return new Promise((res, rej) => {
                const frameend = { handle: null };
                const cancel = () => {
                    frameend.handle.off();
                    rej(new Error(WAIT_FRAME_CANCELLED));
                };
                frameend.handle = entry.app.once('frameend', () => {
                    entry.waits.delete(cancel);
                    res({ frame: entry.app.frame });
                });
                entry.waits.add(cancel);
            });
        },
        waitForSettled(appId, { frames = 3, timeout = 30000 } = {}) {
            const entry = resolve(appId);
            return new Promise((res, rej) => {
                let settled = 0;
                const timer = { id: null };
                const frameend = { handle: null };
                const done = (settle, value, cancel) => {
                    entry.waits.delete(cancel);
                    clearTimeout(timer.id);
                    frameend.handle.off();
                    settle(value);
                };
                const cancel = () => {
                    done(rej, new Error(WAIT_SETTLED_CANCELLED), cancel);
                };
                const onFrame = () => {
                    const loading = entry.app.assets.list().some(a => a.loading);
                    settled = (entry.started && !loading) ? settled + 1 : 0;
                    if (settled >= frames) {
                        done(res, { frame: entry.app.frame, settledFrames: settled }, cancel);
                    }
                };
                timer.id = setTimeout(() => {
                    const pending = entry.app.assets.list().filter(a => a.loading).length;
                    done(rej, new Error(`waitForSettled timed out after ${timeout}ms: ` +
                        `started=${entry.started}, pending assets=${pending}`), cancel);
                }, timeout);
                frameend.handle = entry.app.on('frameend', onFrame);
                entry.waits.add(cancel);
            });
        }
    };
};

/**
 * Attaches runtime introspection tools to an application, exposing the
 * `globalThis.__PLAYCANVAS_TOOLS__` protocol global for test harnesses and agents. Opt-in:
 * the global only exists while at least one app is attached. Read-only: all returned data
 * is JSON-serializable; no live engine objects escape.
 *
 * @param {import('../../framework/app-base.js').AppBase} app - The application to expose.
 * @returns {() => void} A function that detaches the app again. Detaching the last app
 * removes the global. Apps also detach automatically on destroy.
 * @example
 * import { Application, attachRuntimeTools } from 'playcanvas';
 *
 * const app = new Application(canvas);
 * attachRuntimeTools(app);
 */
const attachRuntimeTools = (app) => {
    for (const e of registry.values()) {
        if (e.app === app) {
            return e.detach;
        }
    }

    const canvasId = app.graphicsDevice.canvas.id;
    let id = canvasId || `pc-app-${idCounter++}`;
    while (registry.has(id)) {
        id = `${id}-${idCounter++}`;
    }

    const entry = {
        app,
        id,
        started: app.frame > 0,
        destroyed: false,
        detached: false,
        timeMs: 0,
        waits: new Set(),
        errors: new RingBuffer(MAX_DIAGNOSTICS)
    };
    const destroy = { handle: null };

    const onStart = () => {
        entry.started = true;
    };
    const onFrameUpdate = (ms) => {
        entry.started = true;
        entry.timeMs += ms;
    };
    const onAssetError = (err, asset) => {
        // some handlers (e.g. cubemap) fire 'error' with only the asset
        const a = asset ?? ((err && typeof err === 'object' && 'id' in err) ? err : null);
        entry.errors.push({
            kind: 'asset',
            message: a === err ? 'asset load error' : String(err),
            assetId: a?.id ?? null,
            name: a?.name ?? null,
            url: a?.file?.url ?? null,
            frame: app.frame
        });
    };

    app.on('start', onStart);
    app.on('frameupdate', onFrameUpdate);
    app.assets.on('error', onAssetError);

    const detach = () => {
        if (entry.detached) {
            return;
        }
        entry.detached = true;
        app.off('start', onStart);
        app.off('frameupdate', onFrameUpdate);
        app.assets?.off('error', onAssetError);
        destroy.handle.off();
        for (const cancel of [...entry.waits]) {
            cancel();
        }
        entry.waits.clear();
        if (registry.get(id) === entry) {
            registry.delete(id);
        }
        if (registry.size === 0) {
            delete globalThis.__PLAYCANVAS_TOOLS__;
        }
    };
    entry.detach = detach;

    destroy.handle = app.once('destroy', () => {
        entry.destroyed = true;
        detach();
    });

    registry.set(id, entry);

    if (!globalThis.__PLAYCANVAS_TOOLS__) {
        createGlobal();
    }

    if (typeof globalThis.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        globalThis.dispatchEvent(new CustomEvent('playcanvas:tools-ready', {
            detail: { protocol: PROTOCOL, version: PROTOCOL_VERSION }
        }));
    }

    return detach;
};

export { attachRuntimeTools };
