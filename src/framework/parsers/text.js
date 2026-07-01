import { Http } from '../../platform/net/http.js';

/**
 * Parser for text-based resources (css, html, shader, plain text). Fetches the URL as text and returns
 * the string. Shared by the handlers whose only difference is the resource type used in error messages.
 *
 * @ignore
 */
class TextParser {
    canParse() {
        return true;
    }

    load(url, callback, asset) {
        const original = typeof url === 'string' ? url : url.original;
        this.handler.fetch(url, Http.ResponseType.TEXT, (err, response) => {
            if (err) {
                callback(`Error loading ${this.handler.handlerType} resource: ${original} [${err}]`);
            } else {
                callback(null, response);
            }
        }, asset);
    }
}

export { TextParser };
