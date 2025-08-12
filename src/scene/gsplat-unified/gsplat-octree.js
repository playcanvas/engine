import { GSplatOctreeNode } from './gsplat-octree-node.js';
import { path } from '../../core/path.js';

/**
 * @import { GSplatResource } from '../gsplat/gsplat-resource.js'
 * @import { GSplatOctreeNodeLod } from './gsplat-octree-node.js'
 * @import { GSplatAssetLoaderBase } from './gsplat-asset-loader-base.js'
 */

class GSplatOctree {
    /**
     * @type {GSplatOctreeNode[]}
     */
    nodes;

    /**
     * @type {string[]}
     */
    files;

    /**
     * The file URL of the container asset, used as the base for resolving relative URLs.
     *
     * @type {string}
     */
    assetFileUrl;

    /**
     * Resources of individual files, identified by their filename.
     *
     * @type {Map<string, GSplatResource>}
     */
    fileResources = new Map();

    /**
     * @param {string} assetFileUrl - The file URL of the container asset.
     * @param {Object} data - The parsed JSON data containing files and nodes.
     */
    constructor(assetFileUrl, data) {

        // files - now an array instead of a map
        this.files = data.files;
        this.assetFileUrl = assetFileUrl;

        // Create nodes from the parsed data
        this.nodes = data.nodes.map((nodeData) => {
            /** @type {GSplatOctreeNodeLod[]} */
            const lods = nodeData.lods.map(lodData => ({
                file: this.files[lodData.file] || '',
                fileIndex: lodData.file,
                offset: lodData.offset || 0,
                count: lodData.count || 0
            }));
            return new GSplatOctreeNode(lods);
        });
    }

    getFullUrl(url) {
        // Extract the base directory from the asset file URL and join with the relative URL
        const baseUrl = path.getDirectory(this.assetFileUrl);
        return path.join(baseUrl, url);
    }

    getFileResource(url) {
        return this.fileResources.get(url);
    }

    /**
     * Ensures a file resource is loaded and available. This function:
     * - Starts loading if not already started
     * - Checks if loading completed and stores the resource if available
     *
     * @param {string} url - The url of the file.
     * @param {GSplatAssetLoaderBase} assetLoader - The asset loader.
     */
    ensureFileResource(url, assetLoader) {
        const fullUrl = this.getFullUrl(url);

        // Check if we already have the resource
        if (this.fileResources.has(url)) {
            return;
        }

        // Check if the resource is now available from the asset loader
        const res = assetLoader.getResource(fullUrl);
        if (res) {
            this.fileResources.set(url, res);
            return;
        }

        // Start/continue loading (asset loader handles duplicates internally)
        assetLoader.load(fullUrl);
    }
}

export { GSplatOctree };
