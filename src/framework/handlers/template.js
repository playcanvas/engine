import { http } from '../../platform/net/http.js';
import { Template } from '../template.js';
import { ResourceHandler } from './handler.js';

class TemplateHandler extends ResourceHandler {
    /**
     * TextDecoder for decoding binary data.
     *
     * @type {TextDecoder|null}
     * @private
     */
    decoder = null;

    constructor(app) {
        super(app, 'template');
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

        http.get(url.load, options, (err, response) => {
            if (err) {
                callback(`Error requesting template: ${url.original}`);
            } else {
                callback(err, response);
            }
        });
    }

    open(url, data) {
        return new Template(this._app, data);
    }

    /**
     * Parses raw DataView and returns string.
     *
     * @param {DataView} data - The raw data as a DataView
     * @returns {Template} The parsed resource data.
     */
    openBinary(data) {
        this.decoder ??= new TextDecoder('utf-8');
        return new Template(this._app, JSON.parse(this.decoder.decode(data)));
    }

    patch(asset, registry) {
        // only process if this looks like valid template data
        if (!asset || !asset.resource || !asset.data || !asset.data.entities) {
            return;
        }

        const template = asset.resource;

        // the `data` setter will handle cache invalidation
        template.data = asset.data;
    }
}

export { TemplateHandler };
