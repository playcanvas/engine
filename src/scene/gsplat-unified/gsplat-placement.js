import { BoundingBox } from '../../core/shape/bounding-box.js';

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
     * The axis-aligned bounding box for this placement, in local space.
     *
     * @type {BoundingBox}
     */
    _aabb = new BoundingBox();

    /**
     * Create a new GSplatPlacement.
     *
     * @param {GSplatResource|null} resource - The resource of the splat.
     * @param {GraphNode} node - The node that the gsplat is linked to.
     * @param {number} lodIndex - The LOD index for this placement.
     */
    constructor(resource, node, lodIndex = 0) {
        this.resource = resource;
        this.node = node;
        this.lodIndex = lodIndex;
    }

    set aabb(aabb) {
        this._aabb.copy(aabb);
    }

    get aabb() {
        return this._aabb;
    }
}


export { GSplatPlacement };
