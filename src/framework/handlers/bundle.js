import { Bundle } from '../bundle/bundle.js';
import { Debug } from '../../core/debug.js';
import { Untar } from './untar.js';

/** @typedef {import('./handler.js').ResourceHandler} ResourceHandler */

/**
 * Loads Bundle Assets.
 *
 * @implements {ResourceHandler}
 * @ignore
 */
class BundleHandler {
    /**
     * Type of the resource the handler handles.
     *
     * @type {string}
     */
    handlerType = "bundle";

    /**
     * Create a new BundleHandler instance.
     *
     * @param {import('../app-base.js').AppBase} app - The running {@link AppBase}.
     * @hideconstructor
     */
    constructor(app) {
        this._assets = app.assets;
        this.maxRetries = 0;
    }

    load(url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        fetch(url.load, {
            mode: 'cors',
            credentials: 'include'
        }).then((res) => {
            const bundle = new Bundle();
            callback(null, bundle);

            const untar = new Untar(res, this._assets.prefix);

            untar.on('file', (file) => {
                bundle.addFile(file.name, file.data);
            });

            untar.on('done', () => {
                bundle.loaded = true;
            });

            untar.on('error', (err) => {
                Debug.error(err);
                callback(err);
            });
        }).catch((err) => {
            Debug.error(err);
            callback(err);
        });
    }

    open(url, bundle) {
        return bundle;
    }

    patch(asset, assets) { }
}

export { BundleHandler };
