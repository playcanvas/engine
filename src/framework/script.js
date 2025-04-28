import { getApplication } from './globals.js';

/**
 * @import { AppBase } from './app-base.js'
 */

/**
 * @callback CreateScreenCallback
 * Callback used by {@link script.createLoadingScreen}.
 * @param {AppBase} app - The application.
 * @returns {void}
 */

// flag to avoid creating multiple loading screens e.g. when
// loading screen scripts are reloaded
let _createdLoadingScreen = false;

/**
 * The script namespace holds the createLoadingScreen function that is used to override the default
 * PlayCanvas loading screen.
 *
 * @namespace
 * @category Script
 */
const script = {
    // set during script load to be used for initializing script
    app: null,

    /**
     * Handles the creation of the loading screen of the application. A script can subscribe to the
     * events of a {@link AppBase} to show a loading screen, progress bar etc. In order for
     * this to work you need to set the project's loading screen script to the script that calls
     * this method.
     *
     * @param {CreateScreenCallback} callback - A function which can set up and tear down a
     * customized loading screen.
     * @example
     * pc.script.createLoadingScreen((app) => {
     *     const showSplashScreen = () => {};
     *     const hideSplashScreen = () => {};
     *     const showProgress = (progress) => {};
     *     app.on("preload:start", showSplashScreen);
     *     app.on("preload:progress", showProgress);
     *     app.on("start", hideSplashScreen);
     * });
     */
    createLoadingScreen(callback) {
        if (_createdLoadingScreen) {
            return;
        }

        _createdLoadingScreen = true;

        const app = getApplication();
        callback(app);
    }
};

export { script };
