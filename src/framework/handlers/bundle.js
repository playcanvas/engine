import { Bundle } from '../bundle/bundle.js';
import { Debug } from '../../core/debug.js';
import { Untar } from './untar.js';
import { ResourceHandler } from './handler.js';

/**
 * Loads Bundle Assets.
 *
 * @ignore
 */
class BundleHandler extends ResourceHandler {
    /**
     * Create a new BundleHandler instance.
     *
     * @param {import('../app-base.js').AppBase} app - The running {@link AppBase}.
     */
    constructor(app) {
        super(app, 'bundle');

        this._assets = app.assets;
        this._retries = 0;
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
            this._retries++;
            Debug.error(err);
            if (this._retries < this.maxRetries) {
                Debug.error(`Bundle failed to load retrying (attempt ${this._retries}`);
                this.load(url, callback);
            } else {
                callback(err);
            }

        });
    }

    /**
     * Open the bundle.
     *
     * @param {string} url - The URL of the resource to open.
     * @param {Bundle} bundle - Bundle to open.
     * @returns {Bundle} The bundle.
     */
    open(url, bundle) {
        return bundle;
    }
}

export { BundleHandler };
