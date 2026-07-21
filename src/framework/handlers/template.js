import { TemplateParser } from '../parsers/template.js';
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

        this.addParser(new TemplateParser());
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
