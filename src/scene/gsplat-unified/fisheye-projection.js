/**
 * Helper that caches derived fisheye projection values from a normalized slider value, camera FOV,
 * and projection matrix. Each consumer (renderer, culling, future skydome) creates its own instance
 * and calls {@link FisheyeProjection#update} when it needs current values. The instance only
 * mutates its own cached fields, with no external side effects.
 *
 * Uses the generalized fisheye model g(θ) = k·tan(θ/k), where k controls the projection
 * characteristic: k=1 is rectilinear perspective, lower k increases barrel distortion.
 *
 * @ignore
 */
class FisheyeProjection {
    /**
     * Whether fisheye is active (t > 0).
     *
     * @type {boolean}
     */
    enabled = false;

    /**
     * The fisheye k parameter controlling projection curvature.
     *
     * @type {number}
     */
    k = 1.0;

    /**
     * Precomputed 1/k to avoid per-splat division in shaders.
     *
     * @type {number}
     */
    invK = 1.0;

    /**
     * Scale factor blending from edge-fit (1.0) to corner-fit (sqrt(2)) based on t.
     *
     * @type {number}
     */
    cornerScale = 1.0;

    /**
     * Fisheye-adjusted horizontal projection scale for NDC conversion.
     *
     * @type {number}
     */
    projMat00 = 1.0;

    /**
     * Fisheye-adjusted vertical projection scale for NDC conversion.
     *
     * @type {number}
     */
    projMat11 = 1.0;

    /**
     * Maximum viewing angle before singularity, used for cone culling.
     *
     * @type {number}
     */
    maxTheta = Math.PI;

    // Cached inputs for short-circuit check
    /** @private */
    _lastT = -1;

    /** @private */
    _lastFov = -1;

    /** @private */
    _lastP00 = 0;

    /** @private */
    _lastP11 = 0;

    /**
     * Recomputes all derived fisheye values. Short-circuits if inputs haven't changed.
     *
     * @param {number} t - Normalized fisheye slider value in [0, 1]. 0 = rectilinear, 1 = max distortion.
     * @param {number} fov - Camera vertical FOV in degrees.
     * @param {import('../../core/math/mat4.js').Mat4} projMatrix - The camera's projection matrix.
     */
    update(t, fov, projMatrix) {
        // Fisheye is only meaningful for perspective cameras (projMatrix[15] === 0).
        // Force it off for orthographic projections.
        if (projMatrix.data[15] === 1) {
            t = 0;
        }

        const p00 = projMatrix.data[0];
        const p11 = projMatrix.data[5];

        if (t === this._lastT && fov === this._lastFov && p00 === this._lastP00 && p11 === this._lastP11) {
            return;
        }
        this._lastT = t;
        this._lastFov = fov;
        this._lastP00 = p00;
        this._lastP11 = p11;

        if (t <= 0) {
            this.enabled = false;
            this.k = 1.0;
            this.invK = 1.0;
            this.cornerScale = 1.0;
            this.maxTheta = Math.PI;
            return;
        }

        this.enabled = true;

        // Map t to internal k via log-space interpolation.
        // kMin is derived from FOV to stay clear of the singularity at θ = k·π/2.
        const kMin = fov / 180 + 0.15;
        const kStart = Math.max(1.0, fov / 180 + 0.05);
        const k = kStart * Math.pow(kMin / kStart, t);

        this.k = k;
        this.invK = 1.0 / k;
        this.cornerScale = 1.0 + (Math.SQRT2 - 1.0) * t;

        // Projection-dependent values derived from the camera's projection matrix
        const halfFovX = Math.atan2(1.0, p00);
        const maxTheta = Math.min(k * Math.PI / 2, 3.13);
        const effHalfFov = Math.min(halfFovX, maxTheta - 0.01);
        const gFov = k * Math.tan(effHalfFov / k);
        const pm00 = this.cornerScale / gFov;

        this.projMat00 = pm00;
        this.projMat11 = pm00 * p11 / p00;
        this.maxTheta = maxTheta;
    }
}

export { FisheyeProjection };
