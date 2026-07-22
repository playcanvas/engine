import { PROJECTION_PERSPECTIVE, Quat, Script, Vec2, math } from 'playcanvas';

/**
 * Applies architectural perspective correction (shift lens) to a camera, keeping vertical lines
 * parallel when the camera looks up or down. For rendering only, part of the camera pitch is
 * removed so the image plane stays vertical, and the framing is preserved using a vertical
 * {@link CameraComponent#projectionOffset} (off-center projection). The entity rotation is
 * modified for the duration of the render and restored afterwards, so camera controls and other
 * scripts observing the entity are unaffected.
 *
 * The script must be added to an entity with a camera component. Perspective projection only;
 * it is inactive in XR, where the projection is supplied by the XR system.
 *
 * @example
 * const camera = new Entity();
 * camera.addComponent('camera');
 * camera.addComponent('script');
 * const correction = camera.script.create(PerspectiveCorrection);
 * correction.verticalCorrection = 1; // fully parallel verticals
 * app.root.addChild(camera);
 * @category Camera
 */
class PerspectiveCorrection extends Script {
    static scriptName = 'perspectiveCorrection';

    /**
     * The amount of vertical perspective correction. 0 renders true perspective, 1 keeps
     * vertical lines fully parallel (two-point perspective).
     *
     * @attribute
     * @range [0, 1]
     * @type {number}
     */
    verticalCorrection = 0;

    /**
     * The maximum camera pitch, in degrees, that is converted into projection offset. Any
     * residual pitch stays in the view, preventing extreme stretching as the camera approaches
     * straight up or down.
     *
     * @attribute
     * @range [0, 85]
     * @type {number}
     */
    maxShiftAngle = 70;

    /** @private */
    _trueRotation = new Quat();

    /** @private */
    _levelRotation = new Quat();

    /** @private */
    _offset = new Vec2();

    /** @private */
    _applied = false;

    initialize() {
        if (!this.entity.camera) {
            console.error('PerspectiveCorrection: the script requires a camera component on its entity.');
            this.enabled = false;
            return;
        }

        const onPrerender = () => this._apply();
        const onPostrender = () => this._restore();

        this.app.on('prerender', onPrerender);
        this.app.on('postrender', onPostrender);

        this.on('disable', () => this._reset());
        this.on('destroy', () => {
            this.app.off('prerender', onPrerender);
            this.app.off('postrender', onPostrender);
            this._reset();
        });
    }

    /** @private */
    _apply() {
        const camera = this.entity.camera;
        if (!this.enabled || !camera || camera.projection !== PROJECTION_PERSPECTIVE || this.app.xr?.active) {
            return;
        }

        this._trueRotation.copy(this.entity.getRotation());

        // move (up to maxShiftAngle degrees of) pitch from the camera rotation into the
        // projection offset
        const amount = math.clamp(this.verticalCorrection, 0, 1);
        const pitch = Math.asin(math.clamp(this.entity.forward.y, -1, 1)) * math.RAD_TO_DEG;
        const shiftPitch = math.clamp(pitch * amount, -this.maxShiftAngle, this.maxShiftAngle);

        // tilt the render camera back down towards level, around its right axis
        this._levelRotation.setFromAxisAngle(this.entity.right, -shiftPitch);
        this.entity.setRotation(this._levelRotation.mul(this._trueRotation));

        // vertical rise/fall of the projection window: tan(shift) / tan(fovY/2), which maps the
        // original view center back to the screen center
        let tanHalfFovY = Math.tan(0.5 * camera.fov * math.DEG_TO_RAD);
        if (camera.horizontalFov) {
            tanHalfFovY /= camera.aspectRatio;
        }
        this._offset.set(0, Math.tan(shiftPitch * math.DEG_TO_RAD) / tanHalfFovY);
        camera.projectionOffset = this._offset;

        this._applied = true;
    }

    /** @private */
    _restore() {
        if (this._applied) {
            this._applied = false;
            this.entity.setRotation(this._trueRotation);
        }
    }

    /** @private */
    _reset() {
        if (this.entity.camera) {
            this.entity.camera.projectionOffset = Vec2.ZERO;
        }
    }
}

export { PerspectiveCorrection };
