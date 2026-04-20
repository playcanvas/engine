/**
 * Helper that caches derived fisheye projection values from a normalized slider value, camera FOV,
 * and projection matrix. Each consumer (renderer, culling, future skydome) creates its own instance
 * and calls {@link update} when it needs current values. The instance only mutates its own cached
 * fields, with no external side effects.
 *
 * Uses the generalized fisheye model g(θ) = k·tan(θ/k), where k controls the projection
 * characteristic: k=1 is rectilinear perspective, lower k increases barrel distortion.
 *
 * @ignore
 */
class FisheyeProjection {
    /**
     * Whether fisheye is active (t > 0).
     */
    enabled = false;

    /**
     * The fisheye k parameter controlling projection curvature.
     */
    k = 1.0;

    /**
     * Precomputed 1/k to avoid per-splat division in shaders.
     */
    invK = 1.0;

    /**
     * Scale factor blending from edge-fit (1.0) to corner-fit (sqrt(2)) based on t.
     */
    cornerScale = 1.0;

    /**
     * Fisheye-adjusted horizontal projection scale for NDC conversion.
     */
    projMat00 = 1.0;

    /**
     * Fisheye-adjusted vertical projection scale for NDC conversion.
     */
    projMat11 = 1.0;

    /**
     * Maximum viewing angle before singularity, used for cone culling.
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

        // Projection-dependent values derived from the camera's projection matrix.
        // Compute X and Y scales independently to avoid the 0/0 singularity at 180° FOV
        // and to correctly handle the non-linear fisheye mapping for non-square aspect ratios.
        const maxTheta = Math.min(k * Math.PI / 2, 3.13);
        const cs = this.cornerScale;

        const halfFovX = Math.atan2(1.0, p00);
        const effHalfFovX = Math.min(halfFovX, maxTheta - 0.01);
        this.projMat00 = cs / (k * Math.tan(effHalfFovX / k));

        const halfFovY = Math.atan2(1.0, p11);
        const effHalfFovY = Math.min(halfFovY, maxTheta - 0.01);
        this.projMat11 = cs / (k * Math.tan(effHalfFovY / k));

        this.maxTheta = maxTheta;
    }
}

export { FisheyeProjection };
