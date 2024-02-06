import { http } from '../../platform/net/http.js';

import { Template } from '../template.js';

import { ResourceHandler } from './handler.js';

/**
 * @augments ResourceHandler
 */
class TemplateHandler extends ResourceHandler {
    /**
     * Type of the resource the handler handles.
     *
     * @type {string}
     */
    handlerType = "template";

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

        http.get(url.load, options, function (err, response) {
            if (err) {
                callback('Error requesting template: ' + url.original);
            } else {
                callback(err, response);
            }
        });
    }

    open(url, data) {
        return new Template(this._app, data);
    }
}

export { TemplateHandler };
