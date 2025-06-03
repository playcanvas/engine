import { Vec3 } from '../../core/math/vec3.js';

class Pose {
    /**
     * The position of the pose.
     *
     * @type {Vec3}
     */
    position = new Vec3();

    /**
     * The angles of the pose in degrees.
     *
     * @type {Vec3}
     */
    angles = new Vec3();

    /**
     * Creates a new Pose instance.
     *
     * @param {Vec3} [position] - The position of the pose.
     * @param {Vec3} [angles] - The angles of the pose in degrees.
     */
    constructor(position = Vec3.ZERO, angles = Vec3.ZERO) {
        this.set(position, angles);
    }

    /**
     * Sets the position and rotation of the pose.
     *
     * @param {Vec3} position - The new position.
     * @param {Vec3} angles - The new angles in degrees.
     * @returns {Pose} The updated Pose instance.
     */
    set(position, angles) {
        this.position.copy(position);
        this.angles.copy(angles);
        return this;
    }

    /**
     * Copies the position and rotation from another pose.
     *
     * @param {Pose} other - The pose to copy from.
     * @returns {Pose} The updated Pose instance.
     */
    copy(other) {
        return this.set(other.position, other.angles);
    }
}

export { Pose };
