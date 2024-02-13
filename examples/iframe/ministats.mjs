import config from 'config';
import { getQueryParams } from 'utils';

const params = getQueryParams(window.top?.location.href ?? '');

export default class MiniStats {
    static instance = null;

    static enable(app, state) {
        // examples/misc/mini-stats.mjs creates its own instance of ministats, prevent two mini-stats here
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
        } else {
            if (!MiniStats.instance) {
                return;
            }
        }
        MiniStats.instance.enabled = state;
    }

    static destroy() {
        MiniStats.instance?.destroy();
        MiniStats.instance = null;
    }
}
