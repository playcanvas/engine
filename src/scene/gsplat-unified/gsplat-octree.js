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
     * @type {number}
     */
    lodLevels;

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
     * @param {Object} data - The parsed JSON data containing info, filenames and tree.
     */
    constructor(assetFileUrl, data) {

        this.files = data.filenames;
        this.lodLevels = data.lodLevels;
        this.assetFileUrl = assetFileUrl;

        // Extract leaf nodes from hierarchical tree structure
        const leafNodes = [];
        this._extractLeafNodes(data.tree, leafNodes);

        // Create nodes from the extracted leaf nodes
        this.nodes = leafNodes.map((nodeData) => {
            /** @type {GSplatOctreeNodeLod[]} */
            const lods = [];

            // Ensure we have exactly lodLevels entries
            for (let i = 0; i < this.lodLevels; i++) {
                const lodData = nodeData.lods[i.toString()];
                if (lodData) {
                    lods.push({
                        file: this.files[lodData.file] || '',
                        fileIndex: lodData.file,
                        offset: lodData.offset || 0,
                        count: lodData.count || 0
                    });
                } else {
                    // Missing LOD entry - fill with defaults
                    lods.push({
                        file: '',
                        fileIndex: -1,
                        offset: 0,
                        count: 0
                    });
                }
            }

            return new GSplatOctreeNode(lods, nodeData.bound);
        });
    }

    /**
     * Recursively extracts leaf nodes (nodes with 'lods' property) from the hierarchical tree.
     *
     * @param {Object} node - The current tree node to process.
     * @param {Array} leafNodes - Array to collect leaf nodes.
     * @private
     */
    _extractLeafNodes(node, leafNodes) {
        if (node.lods) {
            // This is a leaf node with LOD data
            leafNodes.push({
                lods: node.lods,
                bound: node.bound
            });
        } else if (node.children) {
            // This is a branch node, recurse into children
            for (const child of node.children) {
                this._extractLeafNodes(child, leafNodes);
            }
        }
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
