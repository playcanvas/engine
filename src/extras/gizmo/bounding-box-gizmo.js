import { BoundingBox } from '../../core/shape/bounding-box.js';
import { Gizmo } from './gizmo.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { Layer } from '../../scene/layer.js'
 */

class BoundingBoxGizmo extends Gizmo {
    /**
     * @type {BoundingBox}
     */
    _bb = new BoundingBox();

    /**
     * Creates a new TransformGizmo object.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} [layer] - The render layer.
     * @example
     * const gizmo = new pc.TransformGizmo(app, camera, layer);
     */
    constructor(camera, layer) {
        super(camera, layer);

        for (let i = 0; i < this.nodes.length; i++) {
            this._bb.add(this.nodes[i].getBoundingBox());
        }
    }
}

export { BoundingBoxGizmo };
