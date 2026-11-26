import { Debug } from '../core/debug.js';
import { AppBase } from './app-base.js';

/**
 * Application is removed. Its constructor throws, in release builds too, so that old code fails
 * where the application is created rather than later on a method the stub does not have. Its
 * static getApplication still forwards to {@link AppBase.getApplication}.
 *
 * @deprecated Use AppBase instead.
 * @ignore
 */
class Application {
    constructor() {
        throw new Error('Application is removed. Use AppBase instead: create the graphics device with createGraphicsDevice, list the component systems and resource handlers the app uses in AppOptions, and pass them to AppBase#init.');
    }

    /**
     * @deprecated Use AppBase.getApplication instead.
     * @param {string} [id] - The id of the canvas of the application to get.
     * @returns {AppBase|undefined} The running application, if any.
     */
    static getApplication(id) {
        Debug.deprecated('Application.getApplication is deprecated. Use AppBase.getApplication instead.');
        return AppBase.getApplication(id);
    }
}

export { Application };
