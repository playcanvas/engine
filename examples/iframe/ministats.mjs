import { getQueryParams } from './runtime.mjs';

/** @import { AppBase, MiniStats as PcMiniStats } from 'playcanvas' */

const params = getQueryParams(window.location.href);

export default class MiniStats {
    /**
     * The instance driven by the UI toggle. Either created here on demand, or handed over by an
     * example which needs custom options, see {@link MiniStats.adopt}.
     *
     * @type {PcMiniStats | null}
     */
    static instance = null;

    /**
     * Takes over an instance created by the example itself, so the UI toggle drives that one
     * instead of adding a second overlay on top of it.
     *
     * @param {PcMiniStats | null | undefined} instance - The instance exported by the example.
     */
    static adopt(instance) {
        if (instance) {
            MiniStats.instance = instance;

            // thumbnail capture loads the example without the surrounding UI, so there is no toggle
            // to fold this into - suppress the overlay here instead
            if (params.miniStats === 'false') {
                instance.enabled = false;
            }
        }
    }

    /**
     * @param {AppBase} app - The app instance.
     * @param {any} state - The enabled state.
     * @returns {boolean} The resolved MiniStats enabled state.
     */
    static enable(app, state) {
        if (typeof window.pc === 'undefined') {
            return false;
        }
        if (!app) {
            return false;
        }

        // the overlay is unusable on the null device, and thumbnail capture suppresses it
        const suppressed = app.graphicsDevice?.deviceType === 'null' || params.miniStats === 'false';
        const enabled = !suppressed && !!state;

        if (enabled && !MiniStats.instance) {
            MiniStats.instance = new window.pc.MiniStats(app);
        }
        if (!MiniStats.instance) {
            return false;
        }
        MiniStats.instance.enabled = enabled;
        return MiniStats.instance.enabled;
    }

    static destroy() {
        MiniStats.instance?.destroy();
        MiniStats.instance = null;
    }
}
