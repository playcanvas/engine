import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { HandleGizmo } from './handle-gizmo.js';

/**
 * @import { CameraComponent } from '../../../framework/components/camera/component.js'
 * @import { Layer } from '../../../scene/layer.js'
 */

/**
 * The base class of gizmos that draw a shape of their own, a box, sphere, capsule or cone, with
 * handles that edit its size. They attach to no nodes: an app sets the shape's {@link position},
 * {@link rotation} and size, and listens to {@link HandleGizmo.EVENT_HANDLEMOVE} to apply edits
 * however it needs, such as to a collision shape or a trigger volume. The handle events pass a
 * null node.
 *
 * @category Gizmo
 */
class ShapeGizmo extends HandleGizmo {
    /**
     * The world position of the center of the shape.
     *
     * @type {Vec3}
     */
    position = new Vec3();

    /**
     * The world rotation of the shape.
     *
     * @type {Quat}
     */
    rotation = new Quat();

    /**
     * Creates a new ShapeGizmo object.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The render layer.
     * @param {string} [name] - The name of the gizmo.
     */
    constructor(camera, layer, name = 'gizmo:shape') {
        super(camera, layer, name);

        this.enabled = true;
    }

    /**
     * Shape gizmos show without attached nodes.
     *
     * @type {boolean}
     * @protected
     * @override
     */
    get _requiresNodes() {
        return false;
    }
}

export { ShapeGizmo };
