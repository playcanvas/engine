import { revision, version } from '../../core/core.js';
import { RingBuffer } from './ring-buffer.js';
import { injectInput } from './input.js';
import { serialize, tryCatch } from './serialize.js';

// resolved by the jscc preprocessor per build variant; unprocessed source (dev/tests)
// executes every block and resolves to 'debug'
let buildVariant = 'release';
// #if _PROFILER
buildVariant = 'profiler';
// #endif
// #if _DEBUG
buildVariant = 'debug';
// #endif

const PROTOCOL = 'playcanvas.runtime-tools';
const PROTOCOL_VERSION = 1;
const CAPABILITIES = ['help', 'apps', 'query', 'diagnostics', 'waitForFrame', 'waitForSettled', 'waitFor', 'record', 'input'];
const MAX_DIAGNOSTICS = 100;
const MAX_INPUT = 100;
const MAX_FRAME_TIMES = 60;
const MAX_ERROR_MESSAGE = 500;
const ERROR_STACK_LINES = 3;
const RECORD_MAX = 600;
const WAIT_FRAME_CANCELLED = 'app detached or destroyed while waiting for frame';
const WAIT_SETTLED_CANCELLED = 'app detached or destroyed while waiting to settle';
const WAIT_FOR_CANCELLED = 'app detached or destroyed while waiting for condition';
const RECORD_CANCELLED = 'app detached or destroyed while recording';
const INJECTED = '__playcanvasRuntimeToolsInjected';
const INPUT_EVENTS = ['keydown', 'keyup', 'mousedown', 'mouseup', 'mousemove', 'wheel', 'touchstart', 'touchmove', 'touchend', 'touchcancel'];
const GLOBAL = '__PLAYCANVAS_TOOLS__';
const ALIAS = 'playcanvasTools';
const HINT = 'PlayCanvas debug tools (query app state, inject input / mouse-look without pointer lock, await asset load, read runtime errors): window.playcanvasTools.help()';
const POINTERLOCK_HINT = 'PlayCanvas: pointer lock unavailable (common under automation) — window.playcanvasTools.input({ kind: "mouse", action: "mousemove", dx, dy }) injects look input without lock, or input({ kind: "pointerlock", action: "enter" }) shims lock';
const ERROR_HINT = 'PlayCanvas: runtime errors recorded — window.playcanvasTools.diagnostics()';

let idCounter = 0;
let hintLogged = false;
let pointerLockHinted = false;
let pcSetByUs = null;
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

const capMessage = (m) => {
    const s = String(m ?? '');
    return s.length > MAX_ERROR_MESSAGE ? `${s.slice(0, MAX_ERROR_MESSAGE)}…` : s;
};

const capStack = s => (s ? String(s).split('\n').slice(0, ERROR_STACK_LINES).join('\n') : null);

// single funnel for every error kind so the first one per app can nudge agents to diagnostics()
const pushError = (entry, item) => {
    entry.errors.push(item);
    // #if _DEBUG
    if (!entry.errorHinted) {
        entry.errorHinted = true;
        console.warn(ERROR_HINT);
    }
    // #endif
};

const createGlobal = () => {
    /** @type {RuntimeToolsGlobal} */
    const tools = {
        protocol: PROTOCOL,
        version: PROTOCOL_VERSION,
        capabilities: CAPABILITIES.slice(),
        engine: { version, revision, buildVariant },
        help() {
            return {
                global: `window.${ALIAS}`,
                protocolGlobal: `window.${GLOBAL}`,
                methods: {
                    query: { sig: 'query(fn, appId?, opts?)', use: 'run fn(app) against the live app; returns bounded JSON. opts {depth, maxKeys, maxItems, maxString} raise limits — "…" / "+N more" truncation markers mean re-query with bigger opts' },
                    input: { sig: 'input(msg, appId?)', use: 'inject a synthetic input event, returns { frame } after dispatch. msg shapes in inputSchema below' },
                    diagnostics: { sig: 'diagnostics(appId?)', use: 'recent errors (asset/exception/rejection), missing assets, recent input, plus { fps, frame }' },
                    waitForFrame: { sig: 'waitForFrame(appId?)', use: 'resolve { frame } after the next rendered frame' },
                    waitForSettled: { sig: 'waitForSettled(appId?, { frames = 3, timeout = 30000 })', use: 'resolve once started and asset loading settles — use instead of sleeps' },
                    waitFor: { sig: 'waitFor(fn, appId?, { timeout = 30000 })', use: 'resolve { frame, value } when fn(app) is truthy; a throwing predicate counts as not-yet and keeps waiting' },
                    record: { sig: 'record(fn, appId?, { frames = 60 })', use: 'sample fn(app) each frame for N frames (1..600); resolves [{ frame, value | error }]' },
                    apps: { sig: 'apps()', use: 'list attached apps: { id, frame, running }' },
                    pc: { sig: 'pc', use: 'the PlayCanvas module namespace (also globalThis.pc in debug builds), e.g. new pc.Vec3(0, 1, 0)' }
                },
                inputSchema: {
                    key: '{ kind: "key", action: "keydown" | "keyup", code: "KeyW" | "Space" | … }',
                    mouse: '{ kind: "mouse", action: "mousedown" | "mouseup" | "mousemove" | "wheel", x, y, dx, dy, button }',
                    touch: '{ kind: "touch", action: "touchstart" | "touchmove" | "touchend" | "touchcancel", touches: [{ id, x, y }] }',
                    pointerlock: '{ kind: "pointerlock", action: "enter" | "exit" }'
                },
                examples: [
                    'window.playcanvasTools.query(app => app.root.findByName("player")?.forward)',
                    'window.playcanvasTools.query(app => app.stats.drawCalls.total)',
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
        query(fn, appId, opts) {
            if (typeof fn !== 'function') {
                throw new Error('query(fn) needs a function, e.g. window.playcanvasTools.query(app => app.root.findByName("player").forward)');
            }
            const { app } = resolve(appId);
            const [err, val] = tryCatch(() => fn(app));
            return err ? { error: err.message } : serialize(val, opts);
        },
        diagnostics(appId) {
            const entry = resolve(appId);
            const errors = entry.errors.toArray();
            const times = entry.frameTimes.toArray();
            const fps = times.length ? Math.round((1000 / (times.reduce((a, b) => a + b, 0) / times.length)) * 10) / 10 : null;
            return {
                errors,
                missingAssets: errors.filter(e => e.kind === 'asset' && e.url).map(e => e.url),
                recentInput: entry.input.toArray().slice(-50),
                fps,
                frame: entry.app.frame
            };
        },
        // drive a synthetic input event into the app through a browser eval bridge.
        input(msg, appId) {
            const entry = resolve(appId);
            injectInput(entry.app.graphicsDevice.canvas, msg, m => entry.recordInput('injected', m));
            return { frame: entry.app.frame };
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
        },
        waitFor(fn, appId, { timeout = 30000 } = {}) {
            if (typeof fn !== 'function') {
                throw new Error('waitFor(fn) needs a predicate function, e.g. window.playcanvasTools.waitFor(app => app.root.findByName("enemy"))');
            }
            const entry = resolve(appId);
            return new Promise((res, rej) => {
                let lastErr = null;
                const timer = { id: null };
                const frameend = { handle: null };
                const done = (settle, value, cancel) => {
                    entry.waits.delete(cancel);
                    clearTimeout(timer.id);
                    frameend.handle.off();
                    settle(value);
                };
                const cancel = () => done(rej, new Error(WAIT_FOR_CANCELLED), cancel);
                const onFrame = () => {
                    // a predicate that throws (e.g. reads a not-yet-spawned entity) counts as falsy
                    const [err, val] = tryCatch(() => fn(entry.app));
                    if (err) {
                        lastErr = err;
                    } else if (val) {
                        done(res, { frame: entry.app.frame, value: serialize(val) }, cancel);
                    }
                };
                timer.id = setTimeout(() => {
                    const detail = lastErr ? `; last predicate error: ${lastErr.message}` : '';
                    done(rej, new Error(`waitFor timed out after ${timeout}ms${detail}`), cancel);
                }, timeout);
                frameend.handle = entry.app.on('frameend', onFrame);
                entry.waits.add(cancel);
            });
        },
        record(fn, appId, { frames = 60 } = {}) {
            if (typeof fn !== 'function') {
                throw new Error('record(fn) needs a function, e.g. window.playcanvasTools.record(app => app.root.findByName("player").getPosition())');
            }
            const entry = resolve(appId);
            const n = Math.max(1, Math.min(RECORD_MAX, Math.floor(frames)));
            return new Promise((res, rej) => {
                const samples = [];
                const frameend = { handle: null };
                const done = (settle, value, cancel) => {
                    entry.waits.delete(cancel);
                    frameend.handle.off();
                    settle(value);
                };
                const cancel = () => done(rej, new Error(RECORD_CANCELLED), cancel);
                const onFrame = () => {
                    const frame = entry.app.frame;
                    const [err, val] = tryCatch(() => fn(entry.app));
                    samples.push(err ? { frame, error: err.message } : { frame, value: serialize(val) });
                    if (samples.length >= n) {
                        done(res, samples, cancel);
                    }
                };
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
 * Opt-in: the global only exists while at least one app is attached. Query and diagnostic results
 * are JSON-serializable; no live engine objects escape.
 *
 * @param {import('../../framework/app-base.js').AppBase} app - The application to expose.
 * @param {object} [namespace] - The PlayCanvas module namespace. When passed (as the debug
 * entrypoint does), it is published as `tools.pc` and, if `globalThis.pc` is unset, as
 * `globalThis.pc` — cleaned up on detach of the last app only if we set it.
 * @returns {() => void} A function that detaches the app again. Detaching the last app
 * removes the global. Apps also detach automatically on destroy.
 * @example
 * import { Application, attachRuntimeTools } from 'playcanvas';
 *
 * const app = new Application(canvas);
 * attachRuntimeTools(app);
 */
const attachRuntimeTools = (app, namespace) => {
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
        errorHinted: false,
        waits: new Set(),
        errors: new RingBuffer(MAX_DIAGNOSTICS),
        input: new RingBuffer(MAX_INPUT),
        frameTimes: new RingBuffer(MAX_FRAME_TIMES)
    };
    entry.recordInput = (source, e) => recordInput(entry, source, e);
    const destroy = { handle: null };
    const canvas = app.graphicsDevice.canvas;
    const doc = canvas.ownerDocument;
    const win = doc?.defaultView ?? globalThis;
    const inputTargets = [canvas, win].filter((t, i, all) => t && all.indexOf(t) === i);
    const seenInput = new WeakSet();

    const onStart = () => {
        entry.started = true;
    };
    const onFrameUpdate = (ms) => {
        entry.started = true;
        entry.frameTimes.push(ms);
    };
    const onAssetError = (err, asset) => {
        // some handlers (e.g. cubemap) fire 'error' with only the asset
        const a = asset ?? ((err && typeof err === 'object' && 'id' in err) ? err : null);
        pushError(entry, {
            kind: 'asset',
            message: a === err ? 'asset load error' : String(err),
            assetId: a?.id ?? null,
            name: a?.name ?? null,
            url: a?.file?.url ?? null,
            frame: app.frame
        });
    };
    const onError = (e) => {
        pushError(entry, {
            kind: 'exception',
            message: capMessage(e?.message ?? e?.error?.message ?? e?.error),
            stack: capStack(e?.error?.stack),
            frame: app.frame
        });
    };
    const onRejection = (e) => {
        const reason = e?.reason;
        pushError(entry, {
            kind: 'rejection',
            message: capMessage(reason?.message ?? reason),
            stack: capStack(reason?.stack),
            frame: app.frame
        });
    };
    const onPointerLockError = () => {
        // #if _DEBUG
        if (!pointerLockHinted) {
            pointerLockHinted = true;
            console.warn(POINTERLOCK_HINT);
        }
        // #endif
    };

    app.on('start', onStart);
    app.on('frameupdate', onFrameUpdate);
    app.assets.on('error', onAssetError);
    win.addEventListener?.('error', onError);
    win.addEventListener?.('unhandledrejection', onRejection);
    doc?.addEventListener?.('pointerlockerror', onPointerLockError);
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
        win.removeEventListener?.('error', onError);
        win.removeEventListener?.('unhandledrejection', onRejection);
        doc?.removeEventListener?.('pointerlockerror', onPointerLockError);
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
            // only remove the pc alias if we set it and nothing else has since replaced it
            if (pcSetByUs !== null && globalThis.pc === pcSetByUs) {
                delete globalThis.pc;
            }
            pcSetByUs = null;
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

    if (namespace) {
        const tools = globalThis[GLOBAL];
        if (tools.pc === undefined) {
            tools.pc = namespace;
        }
        // ESM builds have no `pc` global; publish one so agents' `pc.*` guesses work
        if (globalThis.pc === undefined) {
            globalThis.pc = namespace;
            pcSetByUs = namespace;
        }
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
 * @property {{ version: string, revision: string, buildVariant: string }} engine - Engine identity and build variant.
 * @property {object} [pc] - The PlayCanvas module namespace in debug builds, for constructing engine types.
 * @property {() => object} help - Returns per-method signatures, the input() message schema, and copyable examples.
 * @property {() => object[]} apps - Lists attached apps.
 * @property {(fn: (app: import('../../framework/app-base.js').AppBase) => any, appId?: string, opts?: object) => object} query - Runs fn against the live app and returns bounded, cycle-safe JSON.
 * @property {(appId?: string) => { errors: object[], missingAssets: string[], recentInput: object[], fps: number|null, frame: number }} diagnostics - Returns recent runtime diagnostics.
 * @property {(msg: object, appId?: string) => { frame: number }} input - Injects a synthetic DOM input event and returns the frame it was dispatched on.
 * @property {(appId?: string) => Promise<{ frame: number }>} waitForFrame - Resolves after the next frame.
 * @property {(appId?: string, options?: { frames?: number, timeout?: number }) => Promise<{ frame: number, settledFrames: number }>} waitForSettled - Resolves after the app has started and asset loading settles.
 * @property {(fn: (app: import('../../framework/app-base.js').AppBase) => any, appId?: string, options?: { timeout?: number }) => Promise<{ frame: number, value: any }>} waitFor - Resolves when fn(app) is truthy; a throwing predicate counts as falsy and keeps waiting.
 * @property {(fn: (app: import('../../framework/app-base.js').AppBase) => any, appId?: string, options?: { frames?: number }) => Promise<Array<{ frame: number, value?: any, error?: string }>>} record - Samples fn(app) each frame for N frames.
 */
