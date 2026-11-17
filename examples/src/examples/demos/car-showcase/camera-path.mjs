import { Vec3 } from 'playcanvas';

/**
 * @typedef {object} CameraPose
 * @property {Vec3} position - The position of the camera.
 * @property {Vec3} focus - The point the camera looks at.
 * @property {number} [pace] - How many times slower the camera moves to this pose than the
 * average speed. Defaults to 1.
 */

const tmpV = new Vec3();

/**
 * A smooth flight of the camera through a few poses. The positions, as well as the points the
 * camera looks at, follow a cubic spline through the poses. It is timed by the distances between
 * the positions, so the camera moves at an even speed, easing in and out over the whole flight.
 */
class CameraPath {
    /**
     * The time since the start of the flight, in seconds.
     *
     * @type {number}
     */
    time = 0;

    /**
     * The duration of the flight, in seconds.
     *
     * @type {number}
     */
    duration;

    /**
     * The length of the path, longer by the paces of the poses.
     *
     * @type {number}
     */
    length;

    /**
     * The progress of the flight at each pose, from 0 at the first one to 1 at the last one.
     *
     * @type {number[]}
     */
    knots;

    /**
     * @param {CameraPose[]} poses - The poses to pass through, from the first to the last.
     * @param {(length: number) => number} duration - Gets the duration of the flight, in seconds,
     * from the length of the path.
     */
    constructor(poses, duration) {
        this._positions = poses.map(({ position }) => position.clone());
        this._focuses = poses.map(({ focus }) => focus.clone());

        // the progress of the flight at each pose
        const lengths = poses.map((pose, i) =>
            i > 0 ? pose.position.distance(poses[i - 1].position) * (pose.pace ?? 1) : 0
        );
        this.length = lengths.reduce((sum, length) => sum + length, 0);
        this.duration = duration(this.length);
        const total = Math.max(this.length, 1e-6);
        let sum = 0;
        this.knots = lengths.map((length) => {
            sum += length;
            return sum / total;
        });

        this._positionTangents = this._tangents(this._positions);
        this._focusTangents = this._tangents(this._focuses);
    }

    /**
     * Whether the flight is over.
     *
     * @type {boolean}
     */
    get done() {
        return this.time >= this.duration;
    }

    /**
     * Gets the progress of the flight along the path at a time, from 0 to 1.
     *
     * @param {number} time - The time, in seconds.
     * @returns {number} The progress.
     */
    progressAt(time) {
        const t = Math.min(Math.max(time / this.duration, 0), 1);
        return t * t * (3 - 2 * t);
    }

    /**
     * Gets the pose of the camera at the current time.
     *
     * @param {Vec3} position - Receives the position of the camera.
     * @param {Vec3} focus - Receives the point the camera looks at.
     */
    evaluate(position, focus) {
        const progress = this.progressAt(this.time);
        let i = 0;
        while (i < this.knots.length - 2 && progress > this.knots[i + 1]) {
            i++;
        }
        const span = this.knots[i + 1] - this.knots[i];
        const u = span > 0 ? (progress - this.knots[i]) / span : 1;
        this._hermite(this._positions, this._positionTangents, i, u, span, position);
        this._hermite(this._focuses, this._focusTangents, i, u, span, focus);
    }

    /**
     * The tangents of a spline through points, by the progress, so its speed does not change at the
     * points.
     *
     * @param {Vec3[]} points - The points.
     * @returns {Vec3[]} The tangents.
     * @private
     */
    _tangents(points) {
        return points.map((point, i) => {
            const prev = Math.max(i - 1, 0);
            const next = Math.min(i + 1, points.length - 1);
            const span = this.knots[next] - this.knots[prev];
            return new Vec3().sub2(points[next], points[prev]).mulScalar(span > 0 ? 1 / span : 0);
        });
    }

    /**
     * @param {Vec3[]} points - The points.
     * @param {Vec3[]} tangents - The tangents at the points.
     * @param {number} i - The index of the segment.
     * @param {number} u - The position in the segment, from 0 to 1.
     * @param {number} span - The progress the segment takes.
     * @param {Vec3} result - Receives the point.
     * @private
     */
    _hermite(points, tangents, i, u, span, result) {
        const u2 = u * u;
        const u3 = u2 * u;
        result.copy(points[i]).mulScalar(2 * u3 - 3 * u2 + 1);
        result.add(tmpV.copy(tangents[i]).mulScalar((u3 - 2 * u2 + u) * span));
        result.add(tmpV.copy(points[i + 1]).mulScalar(3 * u2 - 2 * u3));
        result.add(tmpV.copy(tangents[i + 1]).mulScalar((u3 - u2) * span));
    }
}

export { CameraPath };
