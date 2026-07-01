import { Debug } from '../../core/debug.js';
import { path } from '../../core/path.js';
import { http, Http } from '../../platform/net/http.js';
import { Asset } from '../asset/asset.js';

/**
 * @import { AppBase } from '../app-base.js'
 * @import { AssetRegistry } from '../asset/asset-registry.js'
 */

/**
 * @callback ResourceHandlerCallback
 * Callback used by {@link ResourceHandler#load} when a resource is loaded (or an error occurs).
 * @param {string|null} err - The error message in the case where the load fails.
 * @param {any} [response] - The raw data that has been successfully loaded.
 * @returns {void}
 */

/**
 * The context describing the resource being loaded, passed to {@link ResourceParser#canParse}.
 *
 * @typedef {object} ParserContext
 * @property {string|null} url - The original resource URL with any query string removed, or null.
 * @property {string} ext - The lower-cased file extension without a leading dot (for example `'json'`),
 * or an empty string if there is none.
 * @property {string} basename - The lower-cased file name (for example `'lod-meta.json'`), or an empty
 * string.
 * @property {Asset|undefined} asset - The asset being loaded, if any.
 * @property {AppBase} app - The running {@link AppBase}.
 */

/**
 * A parser used by a {@link ResourceHandler} to recognize and load a specific resource format. A parser
 * implements `canParse` (to claim a resource) and `load` (to fetch and produce it), and may implement
 * `open`. When registered with {@link ResourceHandler#addParser} the handler assigns itself to the
 * parser's `handler` property, so `load` can fetch the data via `this.handler.fetch(...)`.
 *
 * @typedef {object} ResourceParser
 * @property {(context: ParserContext) => boolean} canParse - Returns true if this parser can handle the
 * described resource. Parsers are consulted newest-first; the first to return true is used.
 * @property {(url: (string | {load: string, original: string}), callback: ResourceHandlerCallback, asset?: Asset) => void} load -
 * Fetches (typically via `this.handler.fetch`) and produces the resource, then invokes the callback.
 * @property {(url: string, data: *, asset?: Asset) => *} [open] - Optional. Called by the default
 * {@link ResourceHandler#open} when parsers are registered.
 * @property {ResourceHandler} [handler] - Assigned by the owning handler on registration; available in
 * `load`/`open` (for example `this.handler.fetch(...)`).
 */

/**
 * Base class for ResourceHandlers used by {@link ResourceLoader}. A handler is a collection of
 * {@link ResourceParser}s for a single asset type; register parsers with {@link ResourceHandler#addParser}
 * and the base implementation selects the matching one to load and open the resource. A handler with a
 * single parser is the common (single-format) case.
 */
class ResourceHandler {
    /**
     * Type of the resource the handler handles.
     */
    handlerType = '';

    /**
     * The running app instance.
     *
     * @type {AppBase}
     * @protected
     */
    _app;

    /** @private */
    _maxRetries = 0;

    /**
     * The registered parsers, consulted newest-first during selection.
     *
     * @type {ResourceParser[]}
     * @ignore
     */
    _parsers = [];

    /**
     * @param {AppBase} app - The running {@link AppBase}.
     * @param {string} handlerType - The type of the resource the handler handles.
     */
    constructor(app, handlerType) {
        this._app = app;
        this.handlerType = handlerType;
    }

    /**
     * Gets the running {@link AppBase} instance.
     *
     * @type {AppBase}
     */
    get app() {
        return this._app;
    }

    /**
     * Sets the number of times to retry a failed request for the resource.
     *
     * @type {number}
     */
    set maxRetries(value) {
        this._maxRetries = value;
    }

    /**
     * Gets the number of times to retry a failed request for the resource.
     *
     * @type {number}
     */
    get maxRetries() {
        return this._maxRetries;
    }

    /**
     * Registers a {@link ResourceParser} for this handler. Parsers are consulted newest-first: the most
     * recently added parser whose {@link ResourceParser#canParse} returns true is selected. This lets a
     * later registration override a built-in parser for the same format.
     *
     * @param {ResourceParser} parser - The parser to register. Must implement `canParse(context)`.
     * @param {*} [decider] - Removed. Previously a `(url, data) => boolean` selector; implement
     * `canParse(context)` on the parser instead. If passed, it is ignored and logs a warning.
     * @example
     * app.loader.getHandler('model').addParser(new ObjModelParser(app.graphicsDevice));
     */
    addParser(parser, decider) {
        Debug.assert(parser && typeof parser.canParse === 'function',
            'ResourceHandler#addParser: the parser must implement canParse(context). The (parser, decider) ' +
            'form was removed - move the decider logic into the parser\'s canParse(context) method.');
        if (decider !== undefined) {
            Debug.removed('ResourceHandler#addParser(parser, decider): the "decider" argument was removed. ' +
                'Implement canParse(context) on the parser instead.');
        }
        // give the parser a public back-reference to its owning handler, so its load()/open() can use
        // this.handler.fetch(...) without reaching through a private property
        parser.handler = this;
        this._parsers.push(parser);
    }

    /**
     * Removes a previously registered {@link ResourceParser}.
     *
     * @param {ResourceParser} parser - The parser to remove.
     */
    removeParser(parser) {
        const index = this._parsers.indexOf(parser);
        if (index !== -1) {
            this._parsers.splice(index, 1);
            parser.handler = null;
        }
    }

    /**
     * Gets a read-only copy of the registered parsers.
     *
     * @type {ResourceParser[]}
     */
    get parsers() {
        return this._parsers.slice();
    }

    /**
     * Fetches a resource's raw data using this handler's retry settings, reusing pre-fetched
     * `asset.file.contents` when available. A convenience for a {@link ResourceParser}'s `load` method,
     * so parsers don't reimplement the fetch boilerplate.
     *
     * @param {string | {load: string, original: string}} url - The resource URL, or a load/original
     * structure.
     * @param {string} responseType - The {@link Http.ResponseType} to fetch as (for example
     * `Http.ResponseType.ARRAY_BUFFER` for a binary format, or `Http.ResponseType.TEXT`).
     * @param {ResourceHandlerCallback} callback - Called with `(err, data)` when the fetch completes.
     * @param {Asset} [asset] - The asset being loaded, used to reuse already-fetched contents.
     */
    fetch(url, responseType, callback, asset) {
        if (typeof url === 'string') {
            url = { load: url, original: url };
        }

        // ArrayBuffer reuses the asset.file.contents fast path (bundle / editor-supplied bytes)
        if (responseType === Http.ResponseType.ARRAY_BUFFER) {
            Asset.fetchArrayBuffer(url.load, callback, asset, this.maxRetries);
            return;
        }

        http.get(url.load, {
            responseType,
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
        }, callback);
    }

    /**
     * Builds the {@link ParserContext} used for parser selection.
     *
     * @param {string | {load: string, original: string} | null} url - The URL, a load/original
     * structure, or null.
     * @param {Asset} [asset] - The asset being loaded, if any.
     * @returns {ParserContext} The parser context.
     * @ignore
     */
    _makeContext(url, asset) {
        const original = (url && typeof url === 'object') ? url.original : url;
        const clean = original ? original.split('?')[0] : '';
        return {
            url: original ?? null,
            ext: original ? path.getExtension(clean).toLowerCase().replace('.', '') : '',
            basename: original ? path.getBasename(clean).toLowerCase() : '',
            asset,
            app: this._app
        };
    }

    /**
     * Selects a parser for the given context, consulting registered parsers newest-first.
     *
     * @param {ParserContext} context - The context built by {@link ResourceHandler#_makeContext}.
     * @returns {ResourceParser|null} The first parser whose `canParse` returns true, or null.
     * @ignore
     */
    _selectParser(context) {
        for (let i = this._parsers.length - 1; i >= 0; i--) {
            if (this._parsers[i].canParse(context)) {
                return this._parsers[i];
            }
        }
        return null;
    }

    /**
     * Load a resource from a remote URL. When parsers are registered, the matching parser's `load` is
     * used; otherwise the base implementation does nothing (subclasses may override).
     *
     * @param {string | {load: string, original: string}} url - Either the URL of the resource to
     * load or a structure containing the load URL (used for loading the resource) and the original
     * URL (used for identifying the resource format; necessary when loading, for example, from
     * a blob URL).
     * @param {ResourceHandlerCallback} callback - The callback used when the resource is loaded or
     * an error occurs.
     * @param {Asset} [asset] - Optional asset that is passed by ResourceLoader.
     */
    load(url, callback, asset) {
        // no parsers registered - the base implementation does nothing (subclasses may override)
        if (this._parsers.length === 0) {
            return;
        }

        const context = this._makeContext(url, asset);
        const parser = this._selectParser(context);
        if (!parser) {
            callback(`No parser found for resource: ${context.url}`);
            return;
        }

        Debug.assert(typeof parser.load === 'function',
            `ResourceHandler('${this.handlerType}'): the selected parser has no load(url, callback, asset) ` +
            'method. Pre-fetch parsers that implement parse(data, ...) must be used by a handler that ' +
            'overrides load().');
        parser.load(url, callback, asset);
    }

    /**
     * The open function is passed the raw resource data. The handler can then process the data
     * into a format that can be used at runtime. When parsers are registered, the matching parser's
     * `open` is used (if it implements one); otherwise the base implementation simply returns the data.
     *
     * @param {string} url - The URL of the resource to open.
     * @param {*} data - The raw resource data passed by callback from {@link load}.
     * @param {Asset} [asset] - Optional asset that is passed by ResourceLoader.
     * @returns {*} The parsed resource data.
     */
    open(url, data, asset) {
        if (this._parsers.length === 0) {
            return data;
        }

        const parser = this._selectParser(this._makeContext(url, asset));
        return parser?.open ? parser.open(url, data, asset) : data;
    }

    /**
     * The patch function performs any operations on a resource that requires a dependency on its
     * asset data or any other asset data. The base implementation does nothing.
     *
     * @param {Asset} asset - The asset to patch.
     * @param {AssetRegistry} assets - The asset registry.
     */
    patch(asset, assets) {
        // do nothing
    }
}

export { ResourceHandler };
