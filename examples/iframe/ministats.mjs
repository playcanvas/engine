import config from '@examples/config';
import { getQueryParams } from '@examples/utils';

const params = getQueryParams(window.top?.location.href ?? '');

export default class MiniStats {
    /** @type {import('playcanvas-extras').MiniStats | null} */
    static instance = null;

    /**
     * @param {import('playcanvas').AppBase} app - The app instance.
     * @param {any} state - The enabled state.
     */
    static enable(app, state) {
        if (config.NO_MINISTATS) {
            return;
        }
        if (params.miniStats === 'false') {
            return;
        }
        if (typeof pc === 'undefined' || typeof pcx === 'undefined') {
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
                MiniStats.instance = new pcx.MiniStats(app);
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
