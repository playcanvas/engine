/**
 * @import { GraphNode } from '../../graph-node.js'
 * @import { GSplatResource } from '../gsplat-resource.js'
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
     * @type {GSplatResource}
     */
    resource;

    /**
     * The node that the gsplat is linked to.
     *
     * @type {GraphNode}
     */
    node;

    /**
     * Create a new GSplatPlacement.
     *
     * @param {GSplatResource} resource - The resource of the splat.
     * @param {GraphNode} node - The node that the gsplat is linked to.
     */
    constructor(resource, node) {
        this.resource = resource;
        this.node = node;
    }
}

export { GSplatPlacement };
