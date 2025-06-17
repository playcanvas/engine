import { math } from '../../core/math/math.js';
import { Quat } from '../../core/math/quat.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';

const tmpV1 = new Vec3();
const tmpQ1 = new Quat();
const tmpQ2 = new Quat();

/**
 * Represents a pose in 3D space, including position and rotation.
 *
 * @category Input
 * @alpha
 */
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
     * @type {Vec2}
     */
    pitchRange = new Vec2(-Infinity, Infinity);

    /**
     * @type {Vec2}
     */
    yawRange = new Vec2(-Infinity, Infinity);

    /**
     * @type {Vec2}
     */
    xRange = new Vec2(-Infinity, Infinity);

    /**
     * @type {Vec2}
     */
    yRange = new Vec2(-Infinity, Infinity);

    /**
     * @type {Vec2}
     */
    zRange = new Vec2(-Infinity, Infinity);

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

    /**
     * Lerps between two poses based on the given alpha values.
     *
     * @param {Pose} lhs - The left-hand side pose.
     * @param {Pose} rhs - The right-hand side pose.
     * @param {number} alpha1 - The alpha value for position interpolation.
     * @param {number} alpha2 - The alpha value for angles interpolation.
     * @returns {Pose} The updated Pose instance.
     */
    lerp(lhs, rhs, alpha1, alpha2) {
        this.position.lerp(lhs.position, rhs.position, alpha1);
        this.angles.x = math.lerpAngle(lhs.angles.x, rhs.angles.x, alpha2) % 360;
        this.angles.y = math.lerpAngle(lhs.angles.y, rhs.angles.y, alpha2) % 360;
        this.angles.z = math.lerpAngle(lhs.angles.z, rhs.angles.z, alpha2) % 360;
        return this;
    }

    /**
     * Moves the pose by the given vector.
     *
     * @param {Vec3} offset - The vector to move by.
     * @returns {Pose} The updated Pose instance.
     */
    move(offset) {
        this.position.add(offset);

        // clamp position
        this.position.x = math.clamp(this.position.x, this.xRange.x, this.xRange.y);
        this.position.y = math.clamp(this.position.y, this.yRange.x, this.yRange.y);
        this.position.z = math.clamp(this.position.z, this.zRange.x, this.zRange.y);

        return this;
    }

    /**
     * Rotates the pose by the given angles in degrees.
     *
     * @param {Vec3} euler - The angles to rotate by.
     * @returns {Pose} The updated Pose instance.
     */
    rotate(euler) {
        this.angles.add(euler);

        // wrap angles to [0, 360)
        this.angles.x %= 360;
        this.angles.y %= 360;
        this.angles.z %= 360;

        // clamp pitch and yaw
        this.angles.x = math.clamp(this.angles.x, this.pitchRange.x, this.pitchRange.y);
        this.angles.y = math.clamp(this.angles.y, this.yawRange.x, this.yawRange.y);

        return this;
    }

    /**
     * Sets the pose to look in the direction of the given vector.
     *
     * @param {Vec3} position - The position of the pose.
     * @param {Vec3} focus - The point to look at.
     * @returns {Pose} The updated Pose instance.
     */
    look(position, focus) {
        this.position.copy(position);
        const dir = tmpV1.sub2(focus, position).normalize();
        const elev = Math.atan2(-dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z)) * math.RAD_TO_DEG;
        const azim = Math.atan2(-dir.x, -dir.z) * math.RAD_TO_DEG;
        this.angles.set(-elev, azim, 0);
        return this;
    }

    /**
     * Multiplies this pose with another pose, combining their positions and rotations.
     *
     * @param {Pose} lhs - The left-hand side pose.
     * @param {Pose} rhs - The right-hand side pose.
     * @returns {Pose} The updated Pose instance.
     */
    mul2(lhs, rhs) {
        tmpQ1.setFromEulerAngles(lhs.angles);
        tmpQ2.setFromEulerAngles(rhs.angles);

        tmpQ1.transformVector(rhs.position, tmpV1).add(lhs.position);
        tmpQ1.mul(tmpQ2);

        return this.set(tmpV1, tmpQ1.getEulerAngles());
    }

    /**
     * Calculates the linear distance to another pose.
     *
     * @param {Pose} other - The other pose to compare with.
     * @returns {number} The distance between the two poses.
     */
    distance(other) {
        return this.position.distance(other.position) + this.angles.distance(other.angles);
    }
}

export { Pose };
