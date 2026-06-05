import {
    math,
    Vec3,
    Quat,
    Mat4,
    KeyboardMouseSource,
    DualGestureSource
} from 'playcanvas';

// Frame-rate independent damping: fraction of the remaining distance to cover this frame.
const damp = (damping, dt) => 1 - Math.pow(damping, dt * 1000);

// scratch
const up = new Vec3();
const right = new Vec3();
const fwd = new Vec3();
const radial = new Vec3();
const levelUp = new Vec3();
const cross = new Vec3();
const disp = new Vec3();
const tmp = new Vec3();
const mat = new Mat4();
const qYaw = new Quat();
const qPitch = new Quat();
const qLevel = new Quat();
const qTmp = new Quat();

/**
 * Free-fly camera for the inside of a horizontal cylinder (axis parallel to world X at height
 * `radius`, passing through z = 0). The camera position and orientation are fully free — you can
 * fly anywhere inside the tube, including straight across or through the centre, and look in any
 * direction. The only cylinder-specific behaviour is a gentle auto-level: the camera's roll is
 * eased so the horizon stays flat relative to the curved ground (its "up" tends toward the
 * cylinder axis). That keeps controls feeling right while walking the curved floor, but it only
 * corrects roll (pitch/yaw stay free) and fades out near the axis, so flying across the open
 * interior never snaps or spins.
 *
 * Tracking position and orientation directly (rather than angle/radius) avoids the singularity at
 * the axis that makes angular schemes spin out as you approach the centre.
 *
 * Controls: keyboard (WASD/arrows move, Q/E or Ctrl/Space down/up, Shift to sprint) + mouse look
 * (pointer lock) on desktop; twin virtual joysticks (left = move, right = look) on touch.
 */
class CylinderController {
    /**
     * @param {import('playcanvas').AppBase} app - The application.
     * @param {import('playcanvas').Entity} camera - The camera entity to drive.
     * @param {object} [options] - Configuration.
     * @param {number} [options.radius] - Cylinder radius (distance from axis to the tile surface).
     * @param {number} [options.axialStart] - Initial position along the axis (world X).
     * @param {number} [options.startHeight] - Initial eye height above the surface (toward axis).
     * @param {number} [options.moveSpeed] - Normal move speed (world units / second).
     * @param {number} [options.moveFastSpeed] - Sprint (shift) move speed.
     * @param {number} [options.lookSpeed] - Mouse look sensitivity (degrees per pixel).
     * @param {number} [options.touchLookSpeed] - Touch look sensitivity (degrees / second at full deflection).
     * @param {number} [options.moveDamping] - Movement smoothing (0..1, higher = smoother).
     * @param {number} [options.rotateDamping] - Look smoothing (0..1, higher = smoother).
     * @param {number} [options.levelSpeed] - Auto-level rate (per second) when near the surface.
     */
    constructor(app, camera, options = {}) {
        this.app = app;
        this.camera = camera;

        this.radius = options.radius ?? 1000;
        this.moveSpeed = options.moveSpeed ?? 40;
        this.moveFastSpeed = options.moveFastSpeed ?? 600;
        this.lookSpeed = options.lookSpeed ?? 0.2;
        this.touchLookSpeed = options.touchLookSpeed ?? 60;
        this.moveDamping = options.moveDamping ?? 0.99;
        this.rotateDamping = options.rotateDamping ?? 0.985;
        this.levelSpeed = options.levelSpeed ?? 3;

        const startHeight = options.startHeight ?? 2;

        // Target position (input integrates into this) and smoothed current position. The camera
        // starts at the bottom of the loop (z = 0), `startHeight` above the ground.
        this._posT = new Vec3(options.axialStart ?? 0, startHeight, 0);
        this._pos = this._posT.clone();

        // Orientation as a free quaternion (target + smoothed current). Start level, looking
        // along +Z (down the tube) — at the bottom, up is +Y and the loop tangent is +Z.
        mat.setLookAt(new Vec3(0, 0, 0), new Vec3(0, 0, 1), new Vec3(0, 1, 0));
        this._rotT = new Quat().setFromMat4(mat);
        this._rot = this._rotT.clone();

        // accumulated held-key state (down/up deltas sum to current held state)
        this._axis = new Vec3();
        this._shift = 0;

        // cross-platform input sources (same primitives as FirstPersonController)
        this._desktopInput = new KeyboardMouseSource({ pointerLock: true });
        this._mobileInput = new DualGestureSource();
        this._desktopInput.attach(app.graphicsDevice.canvas);
        this._mobileInput.attach(app.graphicsDevice.canvas);

        this._applyTransform();
    }

    /**
     * @param {number} dt - Delta time in seconds.
     */
    update(dt) {
        const { keyCode } = KeyboardMouseSource;
        const { key, mouse } = this._desktopInput.read();
        const { leftInput, rightInput } = this._mobileInput.read();
        const R = this.radius;

        // accumulate currently-held keyboard state from per-frame deltas
        this._axis.x += (key[keyCode.D] - key[keyCode.A]) + (key[keyCode.RIGHT] - key[keyCode.LEFT]);
        this._axis.y += (key[keyCode.E] - key[keyCode.Q]) + (key[keyCode.SPACE] - key[keyCode.CTRL]);
        this._axis.z += (key[keyCode.W] - key[keyCode.S]) + (key[keyCode.UP] - key[keyCode.DOWN]);
        this._shift += key[keyCode.SHIFT];

        // combined move input (keyboard + left joystick), clamped to unit range per axis
        const moveX = math.clamp(this._axis.x + leftInput[0], -1, 1);   // strafe
        const moveY = math.clamp(this._axis.y, -1, 1);                  // up (camera up)
        const moveZ = math.clamp(this._axis.z - leftInput[1], -1, 1);   // forward

        // --- look: apply yaw about the camera's up and pitch about its right (free 6-DOF) ---
        const yawIn = (mouse[0] * this.lookSpeed) + (rightInput[0] * this.touchLookSpeed * dt);
        const pitchIn = (mouse[1] * this.lookSpeed) + (rightInput[1] * this.touchLookSpeed * dt);
        if (yawIn || pitchIn) {
            this._rotT.transformVector(Vec3.UP, up);
            this._rotT.transformVector(Vec3.RIGHT, right);
            qYaw.setFromAxisAngle(up, -yawIn);
            qPitch.setFromAxisAngle(right, -pitchIn);
            qTmp.mul2(qPitch, this._rotT);
            this._rotT.mul2(qYaw, qTmp);
        }

        // --- move: free-fly along the look direction (forward / strafe / camera-up) ---
        const speed = (this._shift > 0 ? this.moveFastSpeed : this.moveSpeed) * dt;
        this._rotT.transformVector(Vec3.FORWARD, fwd);
        this._rotT.transformVector(Vec3.RIGHT, right);
        this._rotT.transformVector(Vec3.UP, up);
        disp.set(0, 0, 0);
        disp.add(tmp.copy(fwd).mulScalar(moveZ * speed));
        disp.add(tmp.copy(right).mulScalar(moveX * speed));
        disp.add(tmp.copy(up).mulScalar(moveY * speed));
        this._posT.add(disp);

        // keep the camera inside the tube: clamp distance from the axis (radial only)
        radial.set(0, this._posT.y - R, this._posT.z);
        let rlen = radial.length();
        const maxR = R * 1.1;
        if (rlen > maxR) {
            const k = maxR / rlen;
            this._posT.y = R + radial.y * k;
            this._posT.z = radial.z * k;
        }

        // --- auto-level: ease ROLL only so the horizon stays flat relative to the curved floor;
        // pitch/yaw stay free. Faded by distance from the axis so the open interior is free-fly. ---
        radial.set(0, this._posT.y - R, this._posT.z);
        rlen = radial.length();
        if (rlen > R * 1e-3) {
            this._rotT.transformVector(Vec3.FORWARD, fwd);
            this._rotT.transformVector(Vec3.UP, up);
            radial.mulScalar(-1 / rlen);                         // radial up (toward axis)
            // component of radial-up perpendicular to the view direction = the level up we want
            levelUp.copy(radial).sub(tmp.copy(fwd).mulScalar(radial.dot(fwd)));
            const llen = levelUp.length();
            if (llen > 1e-4) {
                levelUp.mulScalar(1 / llen);
                const cosA = math.clamp(up.dot(levelUp), -1, 1);
                cross.cross(up, levelUp);
                const rollDeg = Math.atan2(cross.dot(fwd), cosA) * math.RAD_TO_DEG;
                const closeness = math.clamp(rlen / R, 0, 1);    // 1 at surface, 0 at axis
                const frac = math.clamp(this.levelSpeed * dt, 0, 1) * closeness;
                if (frac > 0 && Math.abs(rollDeg) > 1e-3) {
                    // Apply the level correction to BOTH the target and the smoothed current
                    // orientation. Because it's the same rigid rotation, it preserves the look
                    // offset the slerp below is smoothing — so auto-level doesn't fight the look
                    // damping (which otherwise shows up as a wobble), it just rigidly eases roll.
                    qLevel.setFromAxisAngle(fwd, rollDeg * frac);
                    this._rotT.mul2(qLevel, this._rotT);
                    this._rot.mul2(qLevel, this._rot);
                }
            }
        }

        // smooth current state toward targets
        this._pos.lerp(this._pos, this._posT, damp(this.moveDamping, dt));
        this._rot.slerp(this._rot, this._rotT, damp(this.rotateDamping, dt));

        this._applyTransform();
    }

    /** @private */
    _applyTransform() {
        this.camera.setPosition(this._pos);
        this.camera.setRotation(this._rot);
    }

    destroy() {
        this._desktopInput.detach();
        this._mobileInput.detach();
    }
}

export { CylinderController };
