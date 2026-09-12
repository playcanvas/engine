import { fire, getQueryParams } from './runtime.mjs';

/** @import { AppBase, Inspector as PcInspector } from 'playcanvas' */

const params = getQueryParams(window.location.href);

// keeps the docked panel clear of the toolbar buttons the app floats over the top-left corner
const TOOLBAR_INSET = 52;

export default class Inspector {
    /**
     * The instance driven by the UI toggle. Either created here on demand, or handed over by an
     * example which needs custom options, see {@link Inspector.adopt}.
     *
     * @type {PcInspector | null}
     */
    static instance = null;

    /**
     * Starts driving an instance: the UI learns about every change of its visibility, whether from
     * the toolbar button, the panel's close button or its hotkey.
     *
     * @param {PcInspector} instance - The instance.
     */
    static _bind(instance) {
        Inspector.instance = instance;
        instance.on('visible', state => fire('inspector', { state }));
    }

    /**
     * Takes over an instance created by the example itself, so the UI toggle drives that one
     * instead of adding a second panel on top of it.
     *
     * @param {PcInspector | null | undefined} instance - The instance exported by the example.
     */
    static adopt(instance) {
        if (instance) {
            Inspector._bind(instance);
            // thumbnail capture loads the example without the surrounding UI, so there is no toggle
            // to fold this into - suppress the panel here instead
            if (params.inspector === 'false') {
                instance.visible = false;
            }
        }
    }

    /**
     * @param {AppBase} app - The app instance.
     * @param {any} state - The requested visibility.
     * @returns {boolean} The resolved visibility.
     */
    static enable(app, state) {
        if (typeof window.pc === 'undefined' || !window.pc.Inspector) {
            return false;
        }
        if (!app) {
            return false;
        }

        // thumbnail capture suppresses the panel
        const suppressed = params.inspector === 'false';
        const visible = !suppressed && !!state;

        if (visible && !Inspector.instance) {
            Inspector._bind(new window.pc.Inspector(app, {
                dock: 'left',
                top: TOOLBAR_INSET,
                visible: false
            }));
        }
        if (!Inspector.instance) {
            return false;
        }

        Inspector.instance.visible = visible;
        return Inspector.instance.visible;
    }

    static destroy() {
        Inspector.instance?.destroy();
        Inspector.instance = null;
    }
}
