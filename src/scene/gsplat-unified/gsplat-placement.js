/**
 * @import { GraphNode } from '../graph-node.js'
 * @import { GSplatResource } from '../gsplat/gsplat-resource.js'
 * @import { GSplatOctreeResource } from './gsplat-octree.resource.js'
 * @import { Vec2 } from '../../core/math/vec2.js'
 */

/**
 * Class representing a placement of a gsplat resource.
 *
 * @ignore
 */
class GSplatPlacement {
    /**
     * The resource of the splat..
     *
     * @type {GSplatResource|GSplatOctreeResource|null}
     */
    resource;

    /**
     * The node that the gsplat is linked to.
     *
     * @type {GraphNode}
     */
    node;

    /**
     * Whether this placement is a secondary placement, generated from an octree.
     *
     * @type {boolean}
     */
    secondary = false;

    /**
     * Map of intervals for octree nodes using this placement.
     * Key is octree node index, value is Vec2 representing start and end index (inclusive).
     *
     * @type {Map<number, Vec2>}
     */
    intervals = new Map();

    /**
     * The LOD index for this placement.
     *
     * @type {number}
     */
    lodIndex = 0;

    /**
     * Create a new GSplatPlacement.
     *
     * @param {GSplatResource|null} resource - The resource of the splat.
     * @param {GraphNode} node - The node that the gsplat is linked to.
     * @param {boolean} secondary - Whether this placement is a secondary placement, generated from
     * an octree.
     */
    constructor(resource, node, secondary = false) {
        this.resource = resource;
        this.node = node;
        this.secondary = secondary;
    }
}

export { GSplatPlacement };
