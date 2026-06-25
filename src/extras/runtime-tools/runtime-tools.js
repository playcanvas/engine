import { RingBuffer } from './ring-buffer.js';
import { buildSnapshot } from './snapshot.js';
import { injectInput } from './input.js';

const PROTOCOL = 'playcanvas.runtime-tools';
const PROTOCOL_VERSION = 1;
const CAPABILITIES = ['help', 'apps', 'snapshot', 'diagnostics', 'waitForFrame', 'waitForSettled', 'input'];
const MAX_DIAGNOSTICS = 100;
const MAX_INPUT = 100;
const WAIT_FRAME_CANCELLED = 'app detached or destroyed while waiting for frame';
const WAIT_SETTLED_CANCELLED = 'app detached or destroyed while waiting to settle';
const INJECTED = '__playcanvasRuntimeToolsInjected';
const INPUT_EVENTS = ['keydown', 'keyup', 'mousedown', 'mouseup', 'mousemove', 'wheel', 'touchstart', 'touchmove', 'touchend', 'touchcancel'];
const GLOBAL = '__PLAYCANVAS_TOOLS__';
const ALIAS = 'playcanvasTools';
const HINT = 'PlayCanvas debug tools: window.playcanvasTools.help() or window.playcanvasTools.snapshot()';

let idCounter = 0;
let hintLogged = false;
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

const inputKind = (action, kind) => kind ?? (action.startsWith('key') ? 'key' : action.startsWith('mouse') || action === 'wheel' ? 'mouse' : action.startsWith('touch') ? 'touch' : 'unknown');

const touches = list => [...(list ?? [])].slice(0, 5).map(t => ({
    id: t.identifier ?? 0,
    x: Math.round(t.clientX ?? 0),
    y: Math.round(t.clientY ?? 0)
}));

const recordInput = (entry, source, e) => {
    const action = e.action ?? e.type;
    const kind = inputKind(action, e.kind);
    const item = { source, kind, action, frame: entry.app.frame, ts: Date.now() };
    if (kind === 'key') {
        item.code = e.code ?? null;
        item.key = e.key ?? null;
    } else if (kind === 'mouse') {
        item.x = Math.round(e.x ?? e.clientX ?? 0);
        item.y = Math.round(e.y ?? e.clientY ?? 0);
        item.button = e.button ?? null;
    } else if (kind === 'touch') {
        item.touches = e.touches ? touches(e.touches) : (e.changedTouches ? touches(e.changedTouches) : e.touches ?? null);
    }
    entry.input.push(item);
};

const createGlobal = () => {
    /** @type {RuntimeToolsGlobal} */
    const tools = {
        protocol: PROTOCOL,
        version: PROTOCOL_VERSION,
        capabilities: CAPABILITIES.slice(),
        help() {
            return {
                global: `window.${ALIAS}`,
                protocolGlobal: `window.${GLOBAL}`,
                examples: [
                    'window.playcanvasTools.snapshot()',
                    'await window.playcanvasTools.waitForSettled()',
                    'window.playcanvasTools.diagnostics()',
                    'window.playcanvasTools.input({ kind: "key", action: "keydown", code: "Space" })'
                ]
            };
        },
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
                missingAssets: errors.filter(e => e.kind === 'asset' && e.url).map(e => e.url)
            };
        },
        // drive a synthetic input event into the app through a browser eval bridge.
        input(msg, appId) {
            const entry = resolve(appId);
            injectInput(entry.app.graphicsDevice.canvas, msg, m => entry.recordInput('injected', m));
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

    globalThis[GLOBAL] = tools;
    if (globalThis[ALIAS] === undefined) {
        globalThis[ALIAS] = tools;
    }

    // #if _DEBUG
    if (!hintLogged) {
        hintLogged = true;
        console.info(HINT);
    }
    // #endif
};

/**
 * Attaches runtime introspection tools to an application, exposing the
 * `globalThis.__PLAYCANVAS_TOOLS__` protocol global and `globalThis.playcanvasTools` alias for
 * test harnesses and agents. Call `playcanvasTools.help()` in the browser console for examples.
 * Opt-in: the global only exists while at least one app is attached. Snapshot and diagnostic data
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
        errors: new RingBuffer(MAX_DIAGNOSTICS),
        input: new RingBuffer(MAX_INPUT)
    };
    entry.recordInput = (source, e) => recordInput(entry, source, e);
    const destroy = { handle: null };
    const inputTargets = [
        app.graphicsDevice.canvas,
        app.graphicsDevice.canvas.ownerDocument?.defaultView ?? globalThis
    ].filter((t, i, all) => t && all.indexOf(t) === i);
    const seenInput = new WeakSet();

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
    const onInput = (e) => {
        if (!e[INJECTED] && !seenInput.has(e)) {
            seenInput.add(e);
            entry.recordInput('real', e);
        }
    };
    inputTargets.forEach(target => INPUT_EVENTS.forEach(t => target.addEventListener?.(t, onInput, true)));

    const detach = () => {
        if (entry.detached) {
            return;
        }
        entry.detached = true;
        app.off('start', onStart);
        app.off('frameupdate', onFrameUpdate);
        app.assets?.off('error', onAssetError);
        inputTargets.forEach(target => INPUT_EVENTS.forEach(t => target.removeEventListener?.(t, onInput, true)));
        destroy.handle.off();
        for (const cancel of [...entry.waits]) {
            cancel();
        }
        entry.waits.clear();
        if (registry.get(id) === entry) {
            registry.delete(id);
        }
        if (registry.size === 0) {
            const tools = globalThis[GLOBAL];
            if (globalThis[ALIAS] === tools) {
                delete globalThis[ALIAS];
            }
            delete globalThis[GLOBAL];
        }
    };
    entry.detach = detach;

    destroy.handle = app.once('destroy', () => {
        entry.destroyed = true;
        detach();
    });

    registry.set(id, entry);

    if (!globalThis[GLOBAL]) {
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

/**
 * @typedef {object} RuntimeToolsGlobal - Debug runtime tools exposed on the browser global.
 * @property {string} protocol - Protocol name.
 * @property {number} version - Protocol version.
 * @property {string[]} capabilities - Supported tool methods.
 * @property {() => object} help - Returns method names and copyable examples.
 * @property {() => object[]} apps - Lists attached apps.
 * @property {(appId?: string) => object} snapshot - Returns a serializable app snapshot.
 * @property {(appId?: string) => { errors: object[], missingAssets: string[] }} diagnostics - Returns recent runtime diagnostics.
 * @property {(msg: object, appId?: string) => void} input - Injects a synthetic DOM input event.
 * @property {(appId?: string) => Promise<{ frame: number }>} waitForFrame - Resolves after the next frame.
 * @property {(appId?: string, options?: { frames?: number, timeout?: number }) => Promise<{ frame: number, settledFrames: number }>} waitForSettled - Resolves after the app has started and asset loading settles.
 */
