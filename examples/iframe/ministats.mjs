import { getQueryParams } from './runtime.mjs';

/** @import { AppBase, MiniStats as PcMiniStats } from 'playcanvas' */

const params = getQueryParams(window.location.href);

export default class MiniStats {
    /** @type {PcMiniStats | null} */
    static instance = null;

    /**
     * @param {AppBase} app - The app instance.
     * @param {any} state - The enabled state.
     * @returns {boolean} The resolved MiniStats enabled state.
     */
    static enable(app, state) {
        if (params.miniStats === 'false') {
            return false;
        }
        if (typeof window.pc === 'undefined') {
            return false;
        }
        if (!app) {
            return false;
        }
        const deviceType = app?.graphicsDevice?.deviceType;
        if (deviceType === 'null') {
            return false;
        }
        if (state) {
            if (!MiniStats.instance) {
                MiniStats.instance = new window.pc.MiniStats(app);
            }
        }
        if (!MiniStats.instance) {
            return false;
        }
        MiniStats.instance.enabled = state;
        return MiniStats.instance.enabled;
    }

    static destroy() {
        MiniStats.instance?.destroy();
        MiniStats.instance = null;
    }
}
