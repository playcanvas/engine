import { Color } from '../../core/math/color.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { GIZMOAXIS_X, GIZMOAXIS_Y, GIZMOAXIS_Z } from './constants.js';
import { Gizmo } from './gizmo.js';
import { PlaneShape } from './shape/plane-shape.js';

/**
 * @import { Shape } from './shape/shape.js'
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { Layer } from '../../scene/layer.js'
 */

const tmpV1 = new Vec3();

class BoundingBoxGizmo extends Gizmo {
    /**
     * @type {BoundingBox}
     */
    _bb = new BoundingBox();

    /**
     * @type {Color}
     */
    _color = new Color().fromString('#ff0000');

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
            const node = this.nodes[i];
            const bb = new BoundingBox(
                node.getPosition(),
                tmpV1.copy(node.getScale()).mulScalar(0.5)
            );
            this._bb.add(bb);
        }

        const shapes = {
            x: new PlaneShape(this._device, {
                axis: GIZMOAXIS_X,
                layers: [this._layer.id],
                rotation: new Vec3(0, 0, -90),
                defaultColor: this._color
            }),
            y: new PlaneShape(this._device, {
                axis: GIZMOAXIS_Y,
                layers: [this._layer.id],
                rotation: new Vec3(0, 0, 0),
                defaultColor: this._color
            }),
            z: new PlaneShape(this._device, {
                axis: GIZMOAXIS_Z,
                layers: [this._layer.id],
                rotation: new Vec3(90, 0, 0),
                defaultColor: this._color
            })
        };

        for (const key in shapes) {
            const shape = shapes[key];
            shape.gap = -0.5;
            shape.size = 1;
            this.root.addChild(shape.entity);
        }
    }
}

export { BoundingBoxGizmo };
