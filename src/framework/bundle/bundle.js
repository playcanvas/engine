import { EventHandler } from '../../core/event-handler.js';

/**
 * A Bundle is the resource of a `bundle` asset: an archive whose files back other assets. As the
 * archive downloads, each file is indexed by its URL and announced with the `add` event, and
 * `load` fires once the whole archive has arrived. When a file's URL is indexed by a bundle, the
 * {@link ResourceLoader} reads it from the bundle through the {@link BundleRegistry} instead of
 * fetching it from the network.
 *
 * @ignore
 */
class Bundle extends EventHandler {
    /**
     * Index of file url to DataView.
     *
     * @type {Map<string, DataView>}
     * @private
     */
    _index = new Map();

    /**
     * If Bundle has all files loaded.
     *
     * @private
     */
    _loaded = false;

    /**
     * Fired when a file has been added to a Bundle.
     *
     * @event
     * @example
     * bundle.on("add", (url, data) => {
     *     console.log("file added: " + url);
     * });
     */
    static EVENT_ADD = 'add';

    /**
     * Fired when all files of a Bundle has been loaded.
     *
     * @event
     * @example
     * bundle.on("load", () => {
     *     console.log("All Bundle files has been loaded");
     * });
     */
    static EVENT_LOAD = 'load';

    /**
     * Add file to a Bundle.
     *
     * @param {string} url - A url of a file.
     * @param {DataView} data - A DataView of a file.
     * @ignore
     */
    addFile(url, data) {
        if (this._index.has(url)) {
            return;
        }
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
     * True if all files of a Bundle are loaded.
     *
     * @type {boolean}
     */
    set loaded(value) {
        if (!value || this._loaded) {
            return;
        }

        this._loaded = true;
        this.fire('load');
    }

    get loaded() {
        return this._loaded;
    }
}

export { Bundle };
