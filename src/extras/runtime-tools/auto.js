import { AppBase } from '../../framework/app-base.js';
import { attachRuntimeTools } from './runtime-tools.js';

/**
 * Dev-only auto-wiring for runtime tools. Imported by the extras entry in debug builds only,
 * it installs lightweight hooks that activate when the runtime-tools dev server has set the
 * config global on the page (`globalThis.__PLAYCANVAS_RUNTIME_TOOLS__ = { stream }`). With no
 * config present every hook is a no-op, so a normal app is untouched and authors write a plain
 * PlayCanvas app — the streaming wiring stays out of their code.
 *
 * @ignore
 */

const config = () => globalThis.__PLAYCANVAS_RUNTIME_TOOLS__;

// preserve the WebGL drawing buffer so the runtime server can read frames via toDataURL (the
// buffer reads back blank otherwise). patched before any graphics device is created.
if (typeof HTMLCanvasElement !== 'undefined') {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, attrs) {
        if (config() && typeof type === 'string' && type.includes('webgl')) {
            attrs = { ...attrs, preserveDrawingBuffer: true };
        }
        return getContext.call(this, type, attrs);
    };
}

// attach runtime tools to any app as it starts; the config carries the stream URL. attaching
// before the original start() means the 'start' lifecycle event is captured.
const start = AppBase.prototype.start;
AppBase.prototype.start = function (...args) {
    const cfg = config();
    if (cfg?.stream) {
        attachRuntimeTools(this, { stream: cfg.stream });
    }
    return start.apply(this, args);
};
