import { Vec3 } from '../../core/math/vec3.js';
import { Gizmo } from './gizmo.js';

/**
 * @import { Color } from '../../core/math/color.js'
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { Layer } from '../../scene/layer.js'
 */

const tmpSide = new Vec3();

const LINE_EPSILON = 1e-8;

/**
 * The base class of gizmos dragged to edit values: {@link TransformGizmo}s and
 * {@link HandleGizmo}s. With {@link DragGizmo#snap} on, lengths snap to
 * {@link DragGizmo#snapIncrement} and angles to {@link DragGizmo#snapAngleIncrement}.
 *
 * @category Gizmo
 */
class DragGizmo extends Gizmo {
    /**
     * Whether dragging snaps to the increments. Defaults to false.
     *
     * @type {boolean}
     */
    snap = false;

    /**
     * The increment angles snap to, in degrees. Defaults to 5.
     *
     * @type {number}
     */
    snapAngleIncrement = 5;

    /**
     * The increment lengths snap to.
     *
     * @private
     */
    _snapIncrement = 1;

    /**
     * Creates a new DragGizmo object.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The render layer.
     * @param {string} [name] - The name of the gizmo.
     */
    constructor(camera, layer, name = 'gizmo:drag') {
        super(camera, layer, name);
    }

    /**
     * Sets the increment lengths and {@link ScaleGizmo} factors snap to. Defaults to 1.
     *
     * @type {number}
     */
    set snapIncrement(value) {
        this._snapIncrement = value;
    }

    /**
     * Gets the increment lengths and {@link ScaleGizmo} factors snap to.
     *
     * @type {number}
     */
    get snapIncrement() {
        return this._snapIncrement;
    }

    /**
     * Rounds a value to a multiple of an increment while snapping.
     *
     * @param {number} value - The value.
     * @param {number} increment - The increment.
     * @returns {number} The value, snapped while {@link DragGizmo#snap} is on.
     * @protected
     */
    _snapValue(value, increment) {
        return this.snap ? Math.round(value / increment) * increment : value;
    }

    /**
     * Rounds each component of a vector to a multiple of an increment while snapping.
     *
     * @param {Vec3} vec - The vector, snapped in place.
     * @param {number} increment - The increment.
     * @returns {Vec3} The vector.
     * @protected
     */
    _snapVector(vec, increment) {
        if (this.snap) {
            vec.mulScalar(1 / increment);
            vec.round();
            vec.mulScalar(increment);
        }
        return vec;
    }

    /**
     * Rounds a length to a multiple of {@link DragGizmo#snapIncrement} while snapping, at least one
     * increment so a size never snaps to zero.
     *
     * @param {number} value - The length.
     * @returns {number} The length, snapped while {@link DragGizmo#snap} is on.
     * @protected
     */
    _snapLength(value) {
        if (!this.snap) {
            return value;
        }
        const increment = this.snapIncrement;
        return Math.max(Math.round(value / increment), 1) * increment;
    }

    /**
     * Rounds an angle to a multiple of {@link DragGizmo#snapAngleIncrement} while snapping.
     *
     * @param {number} value - The angle in degrees.
     * @returns {number} The angle, snapped while {@link DragGizmo#snap} is on.
     * @protected
     */
    _snapAngle(value) {
        return this._snapValue(value, this.snapAngleIncrement);
    }

    /**
     * Gets the normal of the plane through a line that best faces the camera, for dragging along
     * the line.
     *
     * @param {Vec3} dir - The unit direction of the line.
     * @param {Vec3} facing - The unit direction towards the camera.
     * @param {Vec3} out - Receives the unit normal.
     * @returns {boolean} False when the line points at the camera.
     * @protected
     */
    _lineNormal(dir, facing, out) {
        const side = tmpSide.cross(dir, facing);
        const valid = side.lengthSq() >= LINE_EPSILON;
        side.normalize();
        out.cross(side, dir).normalize();
        return valid;
    }

    /**
     * Formats a readout label in its color.
     *
     * @param {string} text - The label.
     * @param {Color} color - The label color.
     * @returns {string} The label markup.
     * @protected
     */
    _labelMarkup(text, color) {
        return `<b style="color: ${color.toString(false)}">${text}</b>`;
    }
}

export { DragGizmo };
