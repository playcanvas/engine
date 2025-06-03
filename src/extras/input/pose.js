import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';

class Pose {
    /**
     * The position of the pose.
     *
     * @type {Vec3}
     */
    position = new Vec3();

    /**
     * The rotation of the pose.
     *
     * @type {Quat}
     */
    rotation = new Quat();

    /**
     * Creates a new Pose instance.
     *
     * @param {Vec3} [position] - The position of the pose.
     * @param {Quat} [rotation] - The rotation of the pose.
     */
    constructor(position = Vec3.ZERO, rotation = Quat.IDENTITY) {
        this.set(position, rotation);
    }

    /**
     * Sets the position and rotation of the pose.
     *
     * @param {Vec3} position - The new position.
     * @param {Quat} rotation - The new rotation.
     * @returns {Pose} The updated Pose instance.
     */
    set(position, rotation) {
        this.position.copy(position);
        this.rotation.copy(rotation);
        return this;
    }

    /**
     * Copies the position and rotation from another pose.
     *
     * @param {Pose} other - The pose to copy from.
     * @returns {Pose} The updated Pose instance.
     */
    copy(other) {
        return this.set(other.position, other.rotation);
    }
}

export { Pose };
