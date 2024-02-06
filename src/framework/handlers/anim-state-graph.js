import { http, Http } from '../../platform/net/http.js';
import { AnimStateGraph } from '../anim/state-graph/anim-state-graph.js';

import { ResourceHandler } from './handler.js';

/**
 * Resource handler used for loading {@link AnimStateGraph} resources.
 *
 * @augments ResourceHandler
 * @ignore
 */
class AnimStateGraphHandler extends ResourceHandler {
    /**
     * Type of the resource the handler handles.
     *
     * @type {string}
     */
    handlerType = "animstategraph";

    constructor(app) {
        super(app);
        this.maxRetries = 0;
    }

    load(url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        // we need to specify JSON for blob URLs
        const options = {
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
        };

        if (url.load.startsWith('blob:')) {
            options.responseType = Http.ResponseType.JSON;
        }

        http.get(url.load, options, function (err, response) {
            if (err) {
                callback(`Error loading animation state graph resource: ${url.original} [${err}]`);
            } else {
                callback(null, response);
            }
        });
    }

    open(url, data) {
        return new AnimStateGraph(data);
    }

    patch(asset, assets) {
    }
}

export { AnimStateGraphHandler };
