import { PlyParser } from '../parsers/ply.js';
import { ResourceHandler } from './handler.js';

/**
 * @import { AppBase } from '../app-base.js'
 */

class GSplatHandler extends ResourceHandler {
    /**
     * Create a new GSplatHandler instance.
     *
     * @param {AppBase} app - The running {@link AppBase}.
     * @ignore
     */
    constructor(app) {
        super(app, 'gsplat');
        this.parser = new PlyParser(app, 3);
    }

    load(url, callback, asset) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        this.parser.load(url, callback, asset);
    }

    open(url, data, asset) {
        return this.parser.open(url, data, asset);
    }
}

export { GSplatHandler };
