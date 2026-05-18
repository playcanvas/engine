import { getQueryParams } from 'examples/utils';

/** @import { AppBase, MiniStats as PcMiniStats } from 'playcanvas' */

const params = getQueryParams(window.location.href);

export default class MiniStats {
    /** @type {PcMiniStats | null} */
    static instance = null;

    /**
     * @param {AppBase} app - The app instance.
     * @param {any} state - The enabled state.
     */
    static enable(app, state) {
        if (params.miniStats === 'false') {
            return;
        }
        if (typeof window.pc === 'undefined') {
            return;
        }
        if (!app) {
            return;
        }
        const deviceType = app?.graphicsDevice?.deviceType;
        if (deviceType === 'null') {
            return;
        }
        if (state) {
            if (!MiniStats.instance) {
                MiniStats.instance = new window.pc.MiniStats(app);
            }
        }
        if (!MiniStats.instance) {
            return;
        }
        MiniStats.instance.enabled = state;
    }

    static destroy() {
        MiniStats.instance?.destroy();
        MiniStats.instance = null;
    }
}
