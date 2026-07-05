import { Color, Quat, Script, Vec3, LAYERID_SKYBOX } from 'playcanvas';

/** @import { Entity } from 'playcanvas' */

/**
 * Manages WebXR session lifecycle for VR and AR experiences. This script handles starting and
 * ending XR sessions, manages camera rig transforms during XR, and provides automatic cleanup
 * when sessions end.
 *
 * Features:
 * - Supports both immersive-vr and immersive-ar session types
 * - Configurable app events for starting/ending sessions
 * - Automatic camera transform management for VR/AR transitions
 * - AR mode automatically makes camera background transparent and hides skybox
 * - ESC key support to exit XR sessions
 * - Proper cleanup on session end and script destruction
 *
 * This script should be attached to a parent entity of the camera entity used for the XR
 * session. The entity hierarchy should be: CameraParent (with XrSession) > CameraEntity.
 * Use it in conjunction with `XrControllers`, `XrNavigation`, and `XrMenu` scripts.
 *
 * @example
 * // Add to camera parent entity
 * cameraParent.addComponent('script');
 * cameraParent.script.create(XrSession, {
 *     properties: {
 *         startVrEvent: 'vr:start',
 *         startArEvent: 'ar:start',
 *         endEvent: 'xr:end'
 *     }
 * });
 *
 * // Start VR from anywhere in your app
 * app.fire('vr:start');
 *
 * // Or start AR
 * app.fire('ar:start');
 */
class XrSession extends Script {
    static scriptName = 'xrSession';

    /**
     * Event name to start the WebXR AR session.
     *
     * @type {string}
     * @attribute
     */
    startArEvent = 'ar:start';

    /**
     * Event name to start the WebXR VR session.
     *
     * @type {string}
     * @attribute
     */
    startVrEvent = 'vr:start';

    /**
     * Event name to end the WebXR VR session.
     *
     * @type {string}
     * @attribute
     */
    endEvent = 'xr:end';

    /**
     * Reference to the camera entity (child of this entity).
     *
     * @type {Entity|null}
     * @private
     */
    _cameraEntity = null;

    /**
     * Cached clear color for restoration after AR session.
     *
     * @type {Color}
     * @private
     */
    _clearColor = new Color();

    /**
     * Cached root entity position for restoration after XR session.
     *
     * @type {Vec3}
     * @private
     */
    _positionRoot = new Vec3();

    /**
     * Cached root entity rotation for restoration after XR session.
     *
     * @type {Quat}
     * @private
     */
    _rotationRoot = new Quat();

    /**
     * Cached camera entity position for restoration after XR session.
     *
     * @type {Vec3}
     * @private
     */
    _positionCamera = new Vec3();

    /**
     * Cached camera entity rotation for restoration after XR session.
     *
     * @type {Quat}
     * @private
     */
    _rotationCamera = new Quat();

    /**
     * Bound keydown event handler for ESC key detection.
     *
     * @type {((event: KeyboardEvent) => void)|null}
     * @private
     */
    _onKeyDownHandler = null;

    /**
     * Cached sky layer enabled state for restoration after AR session.
     *
     * @type {boolean}
     * @private
     */
    _skyEnabled = true;

    initialize() {
        this._cameraEntity = this.entity.findComponent('camera')?.entity ?? null;

        // Listen to global XR lifecycle to mirror example.mjs behavior
        this.app.xr?.on('start', this.onXrStart, this);
        this.app.xr?.on('end', this.onXrEnd, this);

        // Listen for external events to control session
        this.app.on(this.startArEvent, this.onStartArEvent, this);
        this.app.on(this.startVrEvent, this.onStartVrEvent, this);
        this.app.on(this.endEvent, this.onEndEvent, this);

        // ESC to exit
        this._onKeyDownHandler = (event) => {
            if (event.key === 'Escape' && this.app.xr?.active) {
                this.endSession();
            }
        };
        window.addEventListener('keydown', this._onKeyDownHandler);

        this.on('destroy', () => {
            this.onDestroy();
        });
    }

    onDestroy() {
        this.app.xr?.off('start', this.onXrStart, this);
        this.app.xr?.off('end', this.onXrEnd, this);

        this.app.off(this.startVrEvent, this.onStartVrEvent, this);
        this.app.off(this.startArEvent, this.onStartArEvent, this);
        this.app.off(this.endEvent, this.onEndEvent, this);

        if (this._onKeyDownHandler) {
            window.removeEventListener('keydown', this._onKeyDownHandler);
            this._onKeyDownHandler = null;
        }
    }

    onStartArEvent(space = 'local-floor') {
        this.startSession('immersive-ar', space);
    }

    onStartVrEvent(space = 'local-floor') {
        this.startSession('immersive-vr', space);
    }

    onEndEvent() {
        this.endSession();
    }

    startSession(type = 'immersive-vr', space = 'local-floor') {
        if (!this._cameraEntity?.camera) {
            console.error('XrSession: No cameraEntity.camera found on the entity.');
            return;
        }

        // Start XR on the camera component
        this._cameraEntity.camera.startXr(type, space, {
            callback: (err) => {
                if (err) console.error(`WebXR ${type} failed to start: ${err.message}`);
            }
        });
    }

    endSession() {
        if (!this._cameraEntity?.camera) return;
        this._cameraEntity.camera.endXr();
    }

    onXrStart() {
        if (!this._cameraEntity) return;

        // Cache original camera rig transforms
        this._positionRoot.copy(this.entity.getPosition());
        this._rotationRoot.copy(this.entity.getRotation());
        this._positionCamera.copy(this._cameraEntity.getPosition());
        this._rotationCamera.copy(this._cameraEntity.getRotation());

        // Place root at camera position, but reset orientation to horizontal
        this.entity.setPosition(this._positionCamera.x, 0, this._positionCamera.z);

        // Only preserve Y-axis rotation (yaw), reset pitch and roll for VR
        const eulerAngles = this._rotationCamera.getEulerAngles();
        this.entity.setEulerAngles(0, eulerAngles.y, 0);

        if (this.app.xr.type === 'immersive-ar') {
            // Make camera background transparent and hide the sky
            this._clearColor.copy(this._cameraEntity.camera.clearColor);
            this._cameraEntity.camera.clearColor = new Color(0, 0, 0, 0);
            this.disableSky();
        }
    }

    onXrEnd() {
        if (!this._cameraEntity) return;

        // Restore original transforms
        this.entity.setPosition(this._positionRoot);
        this.entity.setRotation(this._rotationRoot);
        this._cameraEntity.setPosition(this._positionCamera);
        this._cameraEntity.setRotation(this._rotationCamera);

        if (this.app.xr.type === 'immersive-ar') {
            this._cameraEntity.camera.clearColor = this._clearColor;
            this.restoreSky();
        }
    }

    disableSky() {
        const layer = this.app.scene.layers.getLayerById(LAYERID_SKYBOX);
        if (layer) {
            this._skyEnabled = layer.enabled;
            layer.enabled = false;
        }
    }

    restoreSky() {
        const layer = this.app.scene.layers.getLayerById(LAYERID_SKYBOX);
        if (layer) {
            layer.enabled = this._skyEnabled;
        }
    }
}

export { XrSession };
