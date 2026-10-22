import { Color } from '../../../core/math/color.js';
import { Pool } from '../pool.js';

/**
 * @import { Entity } from '../../../framework/entity.js'
 * @import { MeshInstance } from '../../../scene/mesh-instance.js'
 * @import { Shape } from '../shape/shape.js'
 */

/**
 * @typedef {object} Item
 * @property {Entity} entity - The entity placed each frame.
 * @property {Shape} shape - The pooled shape.
 * @property {Color} base - The color the shape was created with, updated in place.
 * @property {Color} occluded - The occluded color the shape was created with, updated in place.
 * @property {MeshInstance[]} meshInstances - The mesh instances of the shape, in draw order.
 */

/**
 * A pool of shapes, placed in order each frame and hidden when unused.
 *
 * @augments {Pool<Item>}
 * @ignore
 */
class ShapePool extends Pool {
    /**
     * The draw order the shapes are placed from in a manually sorted layer.
     *
     * @type {number}
     */
    drawOrder;

    /**
     * @param {(base: Color, occluded: Color) => Shape} create - Creates a shape in the colors.
     * @param {Entity} parent - The parent of the shapes.
     * @param {number} drawOrder - The draw order the shapes are placed from in a manually sorted
     * layer.
     */
    constructor(create, parent, drawOrder) {
        super(() => {
            const base = new Color();
            const occluded = new Color();
            const shape = create(base, occluded);

            /**
             * @type {MeshInstance[]}
             */
            const meshInstances = [];
            shape.entity.forEach((node) => {
                const { render } = /** @type {Entity} */ (node);
                if (render) {
                    meshInstances.push(...render.meshInstances);
                }
            });
            parent.addChild(shape.entity);
            return { entity: shape.entity, shape, base, occluded, meshInstances };
        });
        this.drawOrder = drawOrder;
    }

    /**
     * @returns {Item} The next shape, enabled.
     */
    next() {
        const item = super.next();
        item.entity.enabled = true;
        return item;
    }

    hide() {
        for (let i = this.count; i < this.items.length; i++) {
            this.items[i].entity.enabled = false;
        }
    }

    destroy() {
        this.items.forEach(item => item.shape.destroy());
        this.items.length = 0;
    }
}

export { ShapePool };
