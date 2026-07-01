import { GSplatOctreeParser } from '../parsers/gsplat-octree.js';
import { PlyParser } from '../parsers/ply.js';
import { SogBundleParser } from '../parsers/sog-bundle.js';
import { SogParser } from '../parsers/sog.js';
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

        // `lod-meta.json` matches both the octree parser (by basename) and the SOG parser (by its
        // `.json` extension); the octree parser is registered last so that, with newest-first
        // selection, it is consulted first and wins. Other extensions are unambiguous, and an
        // unrecognized extension matches no parser (there is no catch-all) and fails with a clear error.
        this.addParser(new PlyParser(app));             // .ply
        this.addParser(new SogBundleParser(app));       // .sog bundle
        this.addParser(new SogParser(app));             // .json (SOG meta)
        this.addParser(new GSplatOctreeParser(app));    // lod-meta.json
    }
}

export { GSplatHandler };
