import { EventHandler } from '../../core/event-handler.js';

/**
 * Represents the resource of a Bundle Asset, which contains an index that maps URLs to DataViews.
 *
 * @ignore
 */
class Bundle extends EventHandler {
    /**
     * index of file urls to to DataView
     * @type {Map<string, DataView>}
     * @private
     */
    _index = new Map();

    /**
     * if Bundle has all files loaded
     * @type {boolean}
     * @private
     */
    _loaded = false;

    /**
     * Fired when a file has been added to a Bundle.
     *
     * @event Bundle#add
     * @param {string} url - A url of a file
     * @param {DataView} data - A DataView of a file
     * @example
     * bundle.on("add", function (url, data) {
     *     console.log("file added: " + url);
     * });
     */

    /**
     * Fired when all files of a Bundle has been loaded.
     *
     * @event Bundle#load
     * @example
     * bundle.on("load", function () {
     *     console.log("All Bundle files has been loaded");
     * });
     */

    /**
     * Add file to a Bundle.
     *
     * @param {string} url - A url of a file.
     * @param {DataView} data - A DataView of a file.
     * @ignore
     */
    addFile(url, data) {
        if (this._index.has(url))
            return;
        this._index.set(url, data);
        this.fire('add', url, data);
    }

    /**
     * Returns true if the specified URL exists in the loaded bundle.
     *
     * @param {string} url - The original file URL. Make sure you have called decodeURIComponent on
     * the URL first.
     * @returns {boolean} True of false.
     */
    has(url) {
        return this._index.has(url);
    }

    /**
     * Returns a DataView for the specified URL.
     *
     * @param {string} url - The original file URL. Make sure you have called decodeURIComponent on
     * the URL first.
     * @returns {DataView|null} A DataView.
     */
    get(url) {
        return this._index.get(url) || null;
    }

    /**
     * Destroys the bundle.
     */
    destroy() {
        this._index.clear();
    }

    /**
     * True if all files of a Bundle are loaded
     * @type {boolean}
     */
    set loaded(value) {
        if (!value || this._loaded)
            return;

        this._loaded = true;
        this.fire('load');
    }

    get loaded() {
        return this._loaded;
    }
}

export { Bundle };
