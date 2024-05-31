import { updateDeviceType, fetchFile, localImport, clearImports, parseConfig, fire } from 'examples/utils';
import { data, refresh } from 'examples/observer';
import files from 'examples/files';

import MiniStats from './ministats.mjs';

class ExampleLoader {
    /**
     * @type {Record<string, any>}
     * @private
     */
    _config;

    /**
     * @type {import('playcanvas').AppBase}
     * @private
     */
    _app;

    /**
     * @type {boolean}
     * @private
     */
    _started = false;

    /**
     * @type {boolean}
     * @private
     */
    _allowRestart = true;

    /**
     * @type {Function[]}
     * @private
     */
    destroyHandlers = [];

    /**
     * @type {boolean}
     */
    ready = false;

    _appStart() {
        // set ready state
        this.ready = true;

        if (this._app) {
            if (!this._app?.graphicsDevice?.canvas) {
                console.warn('No canvas found.');
                return;
            }
            this.setMiniStats(true);
        }

        if (!this._started) {
            // Sets code editor component files
            // Sets example component files (for controls + description)
            // Sets mini stats enabled state based on UI
            fire('exampleLoad', { observer: data, files, description: this._config.DESCRIPTION || '' });
        }
        this._started = true;

        // Updates controls UI
        fire('updateFiles', { observer: data, files });

        if (this._app) {
            // Updates device UI
            fire('updateActiveDevice', { deviceType: this._app?.graphicsDevice?.deviceType });
        }

        this._allowRestart = true;
    }

    /**
     * @param {string} stack - The stack trace.
     * @returns {{ file: string, line: number, column: number }[]} - The error locations.
     */
    _parseErrorLocations(stack) {
        const lines = stack.split('\n');
        /**
         * @type {{ file: string, line: number, column: number }[]}
         */
        const locations = [];
        lines.forEach((line) => {
            const match = /^\s*at\s(.+):(\d+):(\d+)$/g.exec(line);
            if (!match) {
                return;
            }
            locations.push({
                file: match[1],
                line: +match[2],
                column: +match[3]
            });
        });
        return locations;
    }

    /**
     * @param {{ engineUrl: string, fileNames: string[] }} options - Options to start the loader
     */
    async start({ engineUrl, fileNames }) {
        window.pc = await import(engineUrl);

        // @ts-ignore
        window.top.pc = window.pc;

        // extracts example category and name from the URL
        const match = /([^/]+)\.html$/.exec(new URL(location.href).pathname);
        if (!match) {
            return;
        }

        // loads each files
        /**
         * @type {Record<string, string>}
         */
        const unorderedFiles = {};
        await Promise.all(fileNames.map(async (name) => {
            unorderedFiles[name] = await fetchFile(`./${match[1]}.${name}`);
        }));
        for (const name of Object.keys(unorderedFiles).sort()) {
            files[name] = unorderedFiles[name];
        }


        await this.load();
    }

    async load() {
        this._allowRestart = false;

        // refresh observer instance
        refresh();

        // parse config
        this._config = parseConfig(files['example.mjs']);

        // update device type
        updateDeviceType(this._config);

        if (!this._started) {
            // just notify to clean UI, but not during hot-reload
            fire('exampleLoading', { showDeviceSelector: !this._config.NO_DEVICE_SELECTOR });
        }

        clearImports();

        try {
            // import local file
            const module = await localImport('example.mjs');
            this._app = module.app;

            // additional destroy handler in case no app provided
            if (typeof module.destroy === 'function') {
                this.destroyHandlers.push(module.destroy);
            }
        } catch (e) {
            console.error(e);
            const locations = this._parseErrorLocations(e.stack);
            window.top?.dispatchEvent(new CustomEvent('exampleError', {
                detail: {
                    name: e.constructor.name,
                    message: e.message,
                    locations
                }
            }));

            this._allowRestart = true;
            return;
        }

        if (this._app) {
            if (this._app.frame) {
                this._appStart();
            } else {
                this._app.once('start', () => this._appStart());
            }
        } else {
            this._appStart();
        }
    }

    sendRequestedFiles() {
        fire('requestedFiles', { files });
    }

    /**
     * @param {boolean} enabled - The enabled state of ministats
     */
    setMiniStats(enabled = false) {
        if (this._config.NO_MINISTATS) {
            return;
        }
        MiniStats.enable(this._app, enabled);
    }

    hotReload() {
        if (!this._allowRestart) {
            console.warn('Dropping restart while still restarting');
            return;
        }
        window.top?.dispatchEvent(new CustomEvent('exampleHotReload'));
        this.destroy();
        this.load();
    }

    destroy() {
        MiniStats.destroy();
        if (this._app && this._app.graphicsDevice) {
            this._app.destroy();
        }
        this.destroyHandlers.forEach(destroy => destroy());
        this.ready = false;
    }

    exit() {
        clearImports();
        this.destroy();
    }
}

export { ExampleLoader };
