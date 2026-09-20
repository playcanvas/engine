import { Bundle } from '../bundle/bundle.js';
import { Debug } from '../../core/debug.js';
import { math } from '../../core/math/math.js';
import { getFetchCredentials, Http } from '../../platform/net/http.js';
import { Untar } from './untar.js';
import { ResourceHandler } from './handler.js';

/**
 * @import { AppBase } from '../app-base.js'
 */

// Longest wait between attempts, matching the default {@link Http#request} uses for its own
// retries.
const maxRetryDelay = 5000;

/**
 * Loads Bundle Assets.
 *
 * @ignore
 */
class BundleHandler extends ResourceHandler {
    /**
     * Create a new BundleHandler instance.
     *
     * @param {AppBase} app - The running {@link AppBase}.
     */
    constructor(app) {
        super(app, 'bundle');

        this._assets = app.assets;
    }

    /**
     * Fetch the bundle, retrying {@link ResourceHandler#maxRetries} times on a network error. Only
     * a rejected fetch is retried: an HTTP error status resolves instead, and is failed by the
     * caller rather than retried.
     *
     * @param {string} url - The URL to fetch.
     * @param {object} options - The fetch options.
     * @returns {Promise<Response>} The response.
     * @private
     */
    _fetchRetries(url, options) {
        return new Promise((resolve, reject) => {
            let retries = 0;
            const tryFetch = () => {
                fetch(url, options).then(resolve).catch((err) => {
                    if (retries < this.maxRetries) {
                        retries++;

                        // back off exponentially, as Http#request does, so a retry gives whatever
                        // failed a chance to recover rather than hammering it
                        const delay = math.clamp(Math.pow(2, retries) * Http.retryDelay, 0, maxRetryDelay);
                        Debug.log(`Bundle failed to load, retrying in ${delay}ms (attempt ${retries} of ${this.maxRetries})`);
                        setTimeout(tryFetch, delay);
                    } else {
                        reject(err);
                    }
                });
            };
            tryFetch();
        });
    }

    load(url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        this._fetchRetries(url.load, {
            mode: 'cors',
            credentials: getFetchCredentials()
        }).then((res) => {
            // fetch resolves an HTTP error status rather than rejecting it. Without this the
            // error response is handed over as a successful bundle and Untar is left to read it,
            // so the load reports success first and only then fails on the response body.
            if (!res.ok) {
                throw new Error(`Error loading bundle: ${res.status} ${res.statusText}`);
            }

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
