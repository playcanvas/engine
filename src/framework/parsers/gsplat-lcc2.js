import { Debug } from '../../core/debug.js';
import { http, Http } from '../../platform/net/http.js';
import { GSplatOctreeResource } from '../../scene/gsplat-unified/gsplat-octree.resource.js';
import { GSplatAssetLoader } from '../components/gsplat/gsplat-asset-loader.js';

/**
 * @import { AppBase } from '../app-base.js'
 * @import { ResourceHandlerCallback } from '../handlers/handler.js'
 */

/**
 * Converts one LCC2 node and its subtree to a node of the hierarchical octree data. The coarsest
 * level is at depth 1, below the root, and each level down is one LOD level finer.
 *
 * @param {object} node - The LCC2 node.
 * @param {number} depth - Depth of the node below the root.
 * @param {number} totalLevels - Number of LOD levels of the scene.
 * @returns {object} The converted node.
 */
const convertNode = (node, depth, totalLevels) => {
    Debug.assert(depth <= totalLevels, `GSplatLcc2Parser: node ${node.id} is deeper than the ${totalLevels} levels of the scene`);
    const level = Math.max(0, totalLevels - depth);
    const splats = node.data?.['3dgs'];
    return {
        bound: node.boundingBox,
        level,
        lods: splats ? { [level]: { file: splats.name, offset: splats.start, count: splats.count } } : {},
        children: Object.values(node.child ?? {}).map(child => convertNode(child, depth + 1, totalLevels))
    };
};

// whether a vector is absent or has every component equal to value
const isUniform = (v, value) => !v || (v[0] === value && v[1] === value && v[2] === value);

/**
 * Parser for LCC2 scenes, the XGRIDS level of detail tree of Gaussian splat files. Data
 * Organization Format originated from XGRIDS.
 *
 * The `.lcc2` file describes the tree, and every node below its root references a range of splats
 * in one of the scene's splat files, which are streamed on demand. Each node holds one LOD level of
 * its region and is replaced by its children for more detail, so the tree loads directly as a
 * hierarchical {@link GSplatOctree}. Only the splats are loaded: the scene's meshes and collision
 * data are not.
 *
 * @ignore
 */
class GSplatLcc2Parser {
    /** @type {AppBase} */
    app;

    /**
     * @param {AppBase} app - The app instance.
     */
    constructor(app) {
        this.app = app;
    }

    canParse(context) {
        return context.ext === 'lcc2';
    }

    /**
     * Converts parsed LCC2 data to the data a hierarchical {@link GSplatOctree} is created from.
     *
     * @param {object} lcc - The parsed `.lcc2` JSON.
     * @returns {object} The octree data.
     */
    static convert(lcc) {
        Debug.call(() => {
            if (!lcc.version?.startsWith('0.0.')) {
                Debug.warnOnce(`GSplatLcc2Parser: LCC2 version ${lcc.version} is untested.`);
            }
            if (!isUniform(lcc.offset, 0) || !isUniform(lcc.shift, 0) || !isUniform(lcc.scale, 1)) {
                Debug.warnOnce('GSplatLcc2Parser: the offset, shift and scale of the LCC2 scene are not applied.');
            }
        });

        const root = lcc.root;
        const totalLevels = lcc.totalLevels;
        const filenames = root.splatFiles ?? [];
        const envIndex = root.data?.env?.name;

        return {
            lodLevels: totalLevels,
            filenames,
            environment: envIndex !== undefined ? filenames[envIndex] : null,
            hierarchical: true,
            tree: {
                bound: root.boundingBox,
                children: Object.values(root.child ?? {}).map(child => convertNode(child, 1, totalLevels))
            }
        };
    }

    /**
     * @param {object} url - The URL of the resource to load.
     * @param {string} url.load - The URL to use for loading the resource.
     * @param {string} url.original - The original URL useful for identifying the resource type.
     * @param {ResourceHandlerCallback} callback - The callback used when
     * the resource is loaded or an error occurs.
     * @param {object} asset - Container asset.
     */
    load(url, callback, asset) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        // the http layer does not recognize .lcc2 as JSON
        const options = {
            retry: this.handler.maxRetries > 0,
            maxRetries: this.handler.maxRetries,
            responseType: Http.ResponseType.JSON
        };

        http.get(url.load, options, (err, data) => {
            if (!err) {
                const assetLoader = new GSplatAssetLoader(this.app.assets);
                const resource = new GSplatOctreeResource(asset.file.url, GSplatLcc2Parser.convert(data), assetLoader);
                callback(null, resource);
            } else {
                callback(`Error loading LCC2 gsplat scene: ${url.original} [${err}]`);
            }
        });
    }
}

export { GSplatLcc2Parser };
