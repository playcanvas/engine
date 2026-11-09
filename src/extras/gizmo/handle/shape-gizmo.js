import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { HandleGizmo } from './handle-gizmo.js';

/**
 * @import { CameraComponent } from '../../../framework/components/camera/component.js'
 * @import { Layer } from '../../../scene/layer.js'
 */

/**
 * The base class of gizmos that draw their own shape with handles that edit its size. They attach
 * no nodes: set the {@link position}, {@link rotation} and size, and apply edits on
 * {@link HandleGizmo.EVENT_HANDLEMOVE}, whose node is null.
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
