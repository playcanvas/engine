import { http, Http } from '../net/http.js';

import { AnimStateGraph } from '../framework/components/anim/state-graph.js';

/**
 * @private
 * @class
 * @name pc.AnimStateGraphHandler
 * @implements {pc.ResourceHandler}
 * @classdesc Resource handler used for loading {@link pc.AnimStateGraph} resources.
 */
function AnimStateGraphHandler() {
    this.retryRequests = false;
}

Object.assign(AnimStateGraphHandler.prototype, {
    load: function (url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        // we need to specify JSON for blob URLs
        var options = {
            retry: this.retryRequests
        };

        if (url.load.startsWith('blob:')) {
            options.responseType = Http.ResponseType.JSON;
        }

        http.get(url.load, options, function (err, response) {
            if (err) {
                callback("Error loading animation state graph resource: " + url.original + " [" + err + "]");
            } else {
                callback(null, response);
            }
        });
    },

    open: function (url, data) {
        return new AnimStateGraph(data);
    }
});

export { AnimStateGraphHandler };
