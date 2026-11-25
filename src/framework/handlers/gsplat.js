import { GSplatLcc2Parser } from '../parsers/gsplat-lcc2.js';
import { GSplatOctreeParser } from '../parsers/gsplat-octree.js';
import { PlyParser } from '../parsers/ply.js';
import { SogBundleParser } from '../parsers/sog-bundle.js';
import { SogParser } from '../parsers/sog.js';
import { SogTextureCache } from '../parsers/sog-texture-cache.js';
import { ResourceHandler } from './handler.js';

/**
 * @import { AppBase } from '../app-base.js'
 */

/**
 * Resource handler for the `gsplat` asset type. Loads Gaussian splat scenes from PLY files, SOG
 * files and SOG bundles, and level-of-detail scenes from their octree metadata or XGRIDS LCC2
 * files, into a Gaussian splat resource. SPZ files are supported once the `SpzParser` shipped
 * in `playcanvas/scripts/esm/parsers/spz-parser.mjs` is registered with
 * {@link ResourceHandler#addParser}.
 *
 * @category Asset
 */
class GSplatHandler extends ResourceHandler {
    /**
     * Ref-counted cache of the textures SOG files and SOG bundles load. Files pointing at the
     * same texture url share one download and one GPU texture, which is destroyed once the last
     * file using it unloads.
     *
     * @type {SogTextureCache}
     * @ignore
     */
    sogTextureCache;

    /**
     * Create a new GSplatHandler instance.
     *
     * @param {AppBase} app - The running {@link AppBase}.
     * @ignore
     */
    constructor(app) {
        super(app, 'gsplat');

        this.sogTextureCache = new SogTextureCache(app);

        // `lod-meta.json` matches both the octree parser (by basename) and the SOG parser (by its
        // `.json` extension); the octree parser is registered last so that, with newest-first
        // selection, it is consulted first and wins. Other extensions are unambiguous, and an
        // unrecognized extension matches no parser (there is no catch-all) and fails with a clear error.
        this.addParser(new PlyParser(app));             // .ply
        this.addParser(new SogBundleParser(app));       // .sog bundle
        this.addParser(new SogParser(app));             // .json (SOG meta)
        this.addParser(new GSplatOctreeParser(app));    // lod-meta.json
        this.addParser(new GSplatLcc2Parser(app));      // .lcc2
    }
}

export { GSplatHandler };
