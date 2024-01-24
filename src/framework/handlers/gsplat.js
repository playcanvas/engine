import { PlyParser } from '../parsers/ply.js';

class GSplatHandler {
    /**
     * Type of the resource the handler handles.
     *
     * @type {string}
     */
    handlerType = "gsplat";

    /**
     * Create a new GSplatHandler instance.
     *
     * @param {import('../app-base.js').AppBase} app - The running {@link AppBase}.
     * @hideconstructor
     */
    constructor(app) {
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

    patch(asset, assets) {
    }
}

export { GSplatHandler };
