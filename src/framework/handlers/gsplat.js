import { PlyParser } from '../parsers/ply.js';

import { ResourceHandler } from './handler.js';

class GSplatHandler extends ResourceHandler {
    /**
     * Create a new GSplatHandler instance.
     *
     * @param {import('../app-base.js').AppBase} app - The running {@link AppBase}.
     * @ignore
     */
    constructor(app) {
        super(app, 'gsplat');
        this.parser = new PlyParser(app.graphicsDevice, app.assets, 3);
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
