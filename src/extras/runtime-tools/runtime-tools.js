import { RingBuffer } from './ring-buffer.js';
import { buildSnapshot } from './snapshot.js';

const PROTOCOL = 'playcanvas.runtime-tools';
const PROTOCOL_VERSION = 1;
const CAPABILITIES = ['apps', 'snapshot', 'diagnostics', 'waitForFrame', 'waitForSettled'];
const MAX_DIAGNOSTICS = 100;

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
            return new Promise((res) => {
                entry.app.once('frameend', () => res({ frame: entry.app.frame }));
            });
        },
        waitForSettled(appId, { frames = 3, timeout = 30000 } = {}) {
            const entry = resolve(appId);
            return new Promise((res, rej) => {
                let settled = 0;
                const timer = { id: null };
                const onFrame = () => {
                    const loading = entry.app.assets.list().some(a => a.loading);
                    settled = (entry.started && !loading) ? settled + 1 : 0;
                    if (settled >= frames) {
                        clearTimeout(timer.id);
                        entry.app.off('frameend', onFrame);
                        res({ frame: entry.app.frame, settledFrames: settled });
                    }
                };
                timer.id = setTimeout(() => {
                    entry.app.off('frameend', onFrame);
                    const pending = entry.app.assets.list().filter(a => a.loading).length;
                    rej(new Error(`waitForSettled timed out after ${timeout}ms: ` +
                        `started=${entry.started}, pending assets=${pending}`));
                }, timeout);
                entry.app.on('frameend', onFrame);
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
 * import { attachRuntimeTools } from 'playcanvas';
 * const app = new pc.Application(canvas);
 * attachRuntimeTools(app);
 */
const attachRuntimeTools = (app) => {
    const canvasId = app.graphicsDevice.canvas.id;
    const id = canvasId || `pc-app-${idCounter++}`;

    const entry = {
        app,
        id,
        started: app.frame > 0,
        destroyed: false,
        timeMs: 0,
        errors: new RingBuffer(MAX_DIAGNOSTICS)
    };

    const onStart = () => {
        entry.started = true;
    };
    const onFrameUpdate = (ms) => {
        entry.timeMs += ms;
    };
    const onAssetError = (err, asset) => {
        entry.errors.push({
            kind: 'asset',
            message: String(err),
            assetId: asset.id,
            name: asset.name,
            url: asset.file?.url ?? null,
            frame: app.frame
        });
    };

    app.on('start', onStart);
    app.on('frameupdate', onFrameUpdate);
    app.assets.on('error', onAssetError);

    const detach = () => {
        if (!registry.has(id)) {
            return;
        }
        registry.delete(id);
        app.off('start', onStart);
        app.off('frameupdate', onFrameUpdate);
        app.assets?.off('error', onAssetError);
        if (registry.size === 0) {
            delete globalThis.__PLAYCANVAS_TOOLS__;
        }
    };

    app.once('destroy', () => {
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
