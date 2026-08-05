import { Http } from '../../platform/net/http.js';
import { AnimStateGraph } from '../anim/state-graph/anim-state-graph.js';

/**
 * Parser for animation state graph resources. Fetches the JSON data and builds an
 * {@link AnimStateGraph}.
 *
 * @ignore
 */
class AnimStateGraphParser {
    canParse() {
        // json is the only built-in animation state graph format; it acts as the catch-all, so any
        // state graph asset resolves to it unless a more specific parser is registered
        return true;
    }

    load(url, callback, asset) {
        const original = typeof url === 'string' ? url : url.original;
        this.handler.fetch(url, Http.ResponseType.JSON, (err, response) => {
            if (err) {
                callback(`Error loading animation state graph resource: ${original} [${err}]`);
            } else {
                callback(null, response);
            }
        }, asset);
    }

    open(url, data) {
        return new AnimStateGraph(data);
    }
}

export { AnimStateGraphParser };
