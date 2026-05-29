import files from './files.mjs';
import MiniStats from './ministats.mjs';
import { fetchFile, importModule, clearImports, parseConfig, fire, win } from './runtime.mjs';
import { data, deviceType as selectedDeviceType, refreshContext, updateDeviceType } from './state.mjs';
import { blockZoom } from './zoom.mjs';

/** @import { AppBase } from 'playcanvas' */

class ExampleLoader {
    /**
     * @type {Record<string, any>}
     * @private
     */
    _config;

    /**
     * @type {Record<string, any>}
     * @private
     */
    _baseConfig = {};

    /**
     * @type {string[]}
     * @private
     */
    _fileNames = [];

    /**
     * @type {string}
     * @private
     */
    _name = '';

    /**
     * @type {AppBase}
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
        }

        if (!this._started) {
            // Sets code editor component files
            // Sets example component files (for controls + description)
            // Sets mini stats enabled state based on UI
            fire('exampleLoad', {
                observer: data,
                files,
                description: this._config.DESCRIPTION || '',
                credits: this._config.CREDITS || []
            });
        }
        this._started = true;

        // Updates controls UI
        fire('updateFiles', {
            observer: data,
            files,
            description: this._config.DESCRIPTION || '',
            credits: this._config.CREDITS || []
        });

        if (this._app) {
            // Report the selected variant (e.g. 'webgpu:bare') back to the UI when the
            // engine device type matches the expected family, otherwise report the actual
            // engine device type to surface fallbacks.
            const engineType = this._app?.graphicsDevice?.deviceType;
            const isWebGPU = dt => dt === 'webgpu' || dt.startsWith('webgpu:');
            const reportedType = (isWebGPU(selectedDeviceType) && engineType === 'webgpu') ?
                selectedDeviceType :
                engineType;
            win.activeGraphicsDevice = reportedType;
            fire('updateActiveDevice', { deviceType: reportedType });
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
            const match = /^\s*at\s(.+):(\d+):(\d+)$/.exec(line);
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

    _clearFiles() {
        for (const name of Object.keys(files)) {
            delete files[name];
        }
    }

    /**
     * @param {string} [stamp] - The cache-busting stamp.
     */
    async _fetchFiles(stamp = '') {
        const suffix = stamp ? `?t=${stamp}` : '';
        // extracts example category and name from the URL
        const match = /([^/]+)\.html$/.exec(new URL(location.href).pathname);
        if (!match) {
            return;
        }
        this._name = match[1];

        // loads each files
        /**
         * @type {Record<string, string>}
         */
        const unorderedFiles = {};
        await Promise.all(this._fileNames.map(async (name) => {
            unorderedFiles[name] = await fetchFile(`../iframe/${this._name}.${name}${suffix}`);
        }));
        this._clearFiles();
        for (const name of Object.keys(unorderedFiles).sort()) {
            files[name] = unorderedFiles[name];
        }
    }

    /**
     * @param {{ engineUrl: string, fileNames: string[], config?: Record<string, any> }} options - Options to start the loader
     */
    async start({ engineUrl, fileNames, config = {} }) {
        blockZoom();

        this._baseConfig = config;
        this._fileNames = fileNames;

        window.pc = await import(engineUrl);

        // @ts-ignore
        win.pc = window.pc;

        await this._fetchFiles();

        await this.load();
    }

    async load() {
        this._allowRestart = false;

        // refresh observer instance
        refreshContext();

        // parse config
        this._config = {
            ...this._baseConfig,
            ...parseConfig(files['example.mjs'])
        };

        // update device type
        updateDeviceType(this._config);

        if (!this._started) {
            // just notify to clean UI, but not during hot-reload
            fire('exampleLoading', { showDeviceSelector: !this._config.NO_DEVICE_SELECTOR });
        }

        clearImports();

        try {
            // import local file
            const module = await importModule('example.mjs');
            this._app = module.app ?? window.pc?.AppBase.getApplication('application-canvas');

            // additional destroy handler for non-app resources
            if (typeof module.destroy === 'function') {
                this.destroyHandlers.push(module.destroy);
            }
        } catch (e) {
            console.error(e);
            const locations = this._parseErrorLocations(e.stack);
            fire('exampleError', {
                name: e.constructor.name,
                message: e.message,
                locations
            });

            this._allowRestart = true;
            return;
        }

        if (this._app) {
            // Check if app has already started (frame is a number, including 0)
            if (this._app.frame !== undefined) {
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
     * @param {{ stamp?: string, config?: Record<string, any>, files?: string[] }} [options] - Reload options.
     */
    async reloadFiles({ stamp = '', config = null, files: names = null } = {}) {
        if (!this._allowRestart) {
            console.warn('Dropping restart while still restarting');
            return;
        }
        if (config) {
            this._baseConfig = config;
        }
        if (names) {
            this._fileNames = names;
        }
        await this._fetchFiles(stamp);
        this.sendRequestedFiles();
        this.hotReload();
    }

    /**
     * @param {boolean} enabled - The enabled state of ministats
     */
    setMiniStats(enabled = false) {
        if (this._config.NO_MINISTATS) {
            fire('miniStats', { state: false });
            return;
        }
        fire('miniStats', { state: MiniStats.enable(this._app, enabled) });
    }

    hotReload() {
        if (!this._allowRestart) {
            console.warn('Dropping restart while still restarting');
            return;
        }
        fire('exampleHotReload');
        this.destroy();
        this.load();
    }

    _destroyApps() {
        const canvases = document.querySelectorAll('#appInner canvas[id]');
        for (const canvas of canvases) {
            const app = window.pc?.AppBase.getApplication(canvas.id);
            if (app?.graphicsDevice) {
                app.destroy();
            }
            if (canvas.id !== 'application-canvas') {
                canvas.remove();
            }
        }
    }

    destroy() {
        MiniStats.destroy();
        this._destroyApps();
        const handlers = this.destroyHandlers;
        this.destroyHandlers = [];
        handlers.forEach(destroy => destroy());
        this.ready = false;
    }

    exit() {
        clearImports();
        this.destroy();
    }
}

export { ExampleLoader };
