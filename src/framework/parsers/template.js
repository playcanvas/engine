import { Http } from '../../platform/net/http.js';
import { Template } from '../template.js';

/**
 * Parser for template resources. Fetches the JSON data and wraps it in a {@link Template}.
 *
 * @ignore
 */
class TemplateParser {
    canParse() {
        // json is the only built-in template format; it acts as the catch-all, so any template
        // asset resolves to it unless a more specific parser is registered
        return true;
    }

    load(url, callback, asset) {
        const original = typeof url === 'string' ? url : url.original;
        this.handler.fetch(url, Http.ResponseType.JSON, (err, response) => {
            if (err) {
                callback(`Error requesting template: ${original}`);
            } else {
                callback(null, response);
            }
        }, asset);
    }

    open(url, data) {
        return new Template(this.handler.app, data);
    }
}

export { TemplateParser };
