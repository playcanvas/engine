import { path } from '../../core/path.js';
import { PlyParser } from '../parsers/ply.js';
import { ResourceHandler } from './handler.js';
import { SogsParser } from '../parsers/sogs.js';

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
        this.parsers = {
            ply: new PlyParser(app, 3),
            json: new SogsParser(app, 3)
        };
    }

    _getUrlWithoutParams(url) {
        return url.indexOf('?') >= 0 ? url.split('?')[0] : url;
    }

    _getParser(url) {
        const ext = path.getExtension(this._getUrlWithoutParams(url)).toLowerCase().replace('.', '');
        return this.parsers[ext] || this.parsers.ply;
    }

    load(url, callback, asset) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        this._getParser(url.original).load(url, callback, asset);
    }

    open(url, data, asset) {
        return data;
    }
}

export { GSplatHandler };
