import { http, Http } from '../../platform/net/http.js';
import { GSplatOctreeResource } from '../../scene/gsplat-unified/gsplat-octree.resource.js';

/**
 * @import { AppBase } from '../app-base.js'
 * @import { ResourceHandlerCallback } from '../handlers/handler.js'
 */

class GSplatOctreeParser {
    /** @type {AppBase} */
    app;

    /** @type {number} */
    maxRetries;

    /**
     * @param {AppBase} app - The app instance.
     * @param {number} maxRetries - Maximum amount of retries.
     */
    constructor(app, maxRetries) {
        this.app = app;
        this.maxRetries = maxRetries;
    }

    /**
     * @param {object} url - The URL of the resource to load.
     * @param {string} url.load - The URL to use for loading the resource.
     * @param {string} url.original - The original URL useful for identifying the resource type.
     * @param {ResourceHandlerCallback} callback - The callback used when
     * the resource is loaded or an error occurs.
     * @param {object} asset - Container asset.
     */
    load(url, callback, asset) {
        // download .json using asset url
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        // we need to specify JSON for blob URLs
        const options = {
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries,
            responseType: Http.ResponseType.JSON
        };

        http.get(url.load, options, (err, data) => {
            if (!err) {
                // create a resource with the parsed data
                const resource = new GSplatOctreeResource(data);
                callback(null, resource);
            } else {
                callback(`Error loading gsplat octree: ${url.original} [${err}]`);
            }
        });
    }
}

export { GSplatOctreeParser };
