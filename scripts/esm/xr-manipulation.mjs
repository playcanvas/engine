import { math, Quat, Script, Vec3 } from 'playcanvas';

/** @import { Entity, XrInputSource } from 'playcanvas' */

// Minimum 3D hand separation (meters) below which the scale solve is held, avoiding division
// blow-up when the two grip poses (near-)coincide
const EPS_SEPARATION = 1e-3;

// Minimum XZ-plane projection (meters) of the hand-pair vector below which the yaw heading is
// degenerate (hands stacked vertically) and the rotation solve is held
const EPS_XZ = 1e-4;

const tmpHandLeft = new Vec3();
const tmpHandRight = new Vec3();
const tmpHandMid = new Vec3();
const tmpHandDelta = new Vec3();
const tmpPrevDelta = new Vec3();
const tmpMidWorld = new Vec3();
const tmpSolvedPos = new Vec3();
const tmpScratch = new Vec3();
const tmpQuat = new Quat();
const tmpQuatB = new Quat();

/**
 * Rotates a vector in place around the world Y axis. Matches the rotation applied by a
 * yaw-only entity rotation, i.e. `rotateY(v, yaw)` computes `R(yaw) * v`.
 *
 * @param {Vec3} v - The vector to rotate in place.
 * @param {number} angle - The rotation angle in radians.
 * @returns {Vec3} The rotated vector (same object as `v`).
 */
const rotateY = (v, angle) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const x = v.x * c + v.z * s;
    v.z = -v.x * s + v.z * c;
    v.x = x;
    return v;
};

/**
 * Wraps an angle to the (-PI, PI] range.
 *
 * @param {number} angle - The angle in radians.
 * @returns {number} The wrapped angle in radians.
 */
const wrapPi = (angle) => {
    angle %= Math.PI * 2;
    if (angle > Math.PI) {
        angle -= Math.PI * 2;
    } else if (angle <= -Math.PI) {
        angle += Math.PI * 2;
    }
    return angle;
};

/**
 * Lets the user grab the world with both hands to drag, rotate and scale the scene in XR.
 * Squeeze both grip buttons (or make fists with both tracked hands - the engine emulates
 * squeeze from the fist gesture) to grab the world. While grabbing, the world sticks to the
 * hands:
 * - Drag: move both hands together to pull the world in any direction, including vertically
 * - Rotate: swing the hand pair to yaw-rotate the world around the hands (yaw only, so floors
 *   stay level)
 * - Scale: change the distance between the hands to scale the world - spreading them apart
 *   grows it. Horizontally the content follows the hands; vertically the scale pivots at the
 *   user's feet by default ({@link XrManipulation#scalePivot}), so the user stays standing on
 *   the world instead of the floor rising or sinking through them
 *
 * The manipulation is applied to the {@link XrManipulation#target} entity, under which the scene
 * content to manipulate should be parented. The camera rig is never modified, so the XR rig
 * keeps its 1:1 real-world mapping - controller models, hand meshes, menus and any user
 * scripts that measure hand-space distances are unaffected by the world being scaled.
 *
 * Hand motion is measured in the camera rig's local space, so rig locomotion (XrNavigation
 * teleports, snap turns) occurring mid-grab does not drag the world along; the grab re-anchors
 * against the moved rig instead.
 *
 * Notes:
 * - {@link XrManipulation#minScale}/{@link XrManipulation#maxScale} bound the target's scale
 *   relative to its scale when the script initialized (1 = authored size).
 * - The target keeps its manipulated transform when the XR session ends. Call
 *   {@link XrManipulation#reset} (or fire {@link XrManipulation#resetEvent}) to restore it.
 * - The target's parent chain should be unrotated and unscaled. The target itself may have
 *   any transform; rotation stays yaw-only relative to its initial rotation.
 * - World-anchored systems do not follow the target: XrNavigation's teleport ground plane
 *   ({@link XrNavigation#groundHeight}) stays where it is, so consider assigning
 *   {@link XrNavigation#castRay} if users can drag the world vertically. Physics colliders
 *   under the target rebuild on scale changes (mesh shapes) or ignore scale entirely
 *   (primitive shapes), so avoid parenting rigidbodies under the target where possible.
 *
 * Fires `xr:manipulation:active` (with a boolean) on the app when a grab starts or ends. Listens
 * for `xr:menu:active` (fired by `XrMenu`) and blocks or ends grabs while a menu is open.
 *
 * The script can be attached to any entity (e.g. the camera rig alongside the other XR
 * scripts). Use it alongside the `XrSession`, `XrControllers` and `XrNavigation` scripts.
 *
 * @example
 * // Parent the scene content under a world root and grab-manipulate it
 * const worldRoot = new pc.Entity('WorldRoot');
 * app.root.addChild(worldRoot);
 * worldRoot.addChild(galleryEntity);
 *
 * cameraParent.addComponent('script');
 * cameraParent.script.create(XrManipulation, {
 *     properties: {
 *         target: worldRoot,
 *         minScale: 0.5,
 *         maxScale: 4
 *     }
 * });
 */
class XrManipulation extends Script {
    static scriptName = 'xrManipulation';

    /**
     * The entity that is dragged, rotated and scaled by the grab gesture. Parent the scene
     * content to manipulate under this entity. The camera rig is never modified.
     * @type {Entity}
     * @attribute
     */
    target = null;

    /**
     * Enable dragging the world by moving both hands while grabbing.
     * @attribute
     */
    enableTranslate = true;

    /**
     * Enable yaw-rotating the world by swinging the hand pair while grabbing.
     * @attribute
     */
    enableRotate = true;

    /**
     * Enable scaling the world by changing the hand separation while grabbing.
     * @attribute
     */
    enableScale = true;

    /**
     * The vertical pivot used while scaling. One of:
     * - `'feet'`: whatever sits at the user's floor level stays there while scaling - the
     *   user remains standing on the world, and a scene floor stays aligned with
     *   XrNavigation's teleport plane (default).
     * - `'hands'`: the world scales symmetrically about the hand midpoint and sticks to the
     *   hands vertically - suits tabletop/diorama targets.
     * Horizontal behavior is identical in both modes: content follows the hands in XZ.
     * @attribute
     * @enabledif {enableScale}
     */
    scalePivot = 'feet';

    /**
     * Minimum scale of the target relative to its scale at initialization (1 is authored
     * size). Grabbing cannot shrink the world below this factor.
     * @attribute
     * @range [0.01, 1]
     * @precision 0.01
     * @enabledif {enableScale}
     */
    minScale = 0.2;

    /**
     * Maximum scale of the target relative to its scale at initialization (1 is authored
     * size). Grabbing cannot grow the world beyond this factor.
     * @attribute
     * @range [1, 50]
     * @precision 0.1
     * @enabledif {enableScale}
     */
    maxScale = 5;

    /**
     * App event that triggers {@link XrManipulation#reset}. Set to an empty string to disable.
     * Read once at initialization.
     * @type {string}
     * @attribute
     */
    resetEvent = 'xr:manipulation:reset';

    /** @type {Set<XrInputSource>} */
    _inputSources = new Set();

    // True while both grips are held and the world is being manipulated
    _grabbing = false;

    /** @type {XrInputSource | null} */
    _leftSource = null;

    /** @type {XrInputSource | null} */
    _rightSource = null;

    /** @type {Entity | null} */
    _grabTarget = null;

    // Grab frame: the camera rig transform captured at grab start (and refreshed when the rig
    // moves mid-grab). Hand poses are measured in rig space and mapped to world space through
    // this frame, so rig locomotion does not move the grabbed world
    _framePos = new Vec3();

    _frameYaw = 0;

    _frameScale = 1;

    // Target state captured at grab start (or at the last re-anchor)
    _targetPos0 = new Vec3();

    _targetRot0 = new Quat();

    _targetScale0 = new Vec3();

    // Hand-pair reference captured at grab start (rig space): midpoint, separation, heading
    _midPose0 = new Vec3();

    _grabDist = 0;

    /** @type {number | null} */
    _grabHeading = null;

    // Rig-space hand positions from the previous grabbed frame (incremental mode)
    _prevLeft = new Vec3();

    _prevRight = new Vec3();

    // enableTranslate as of the previous grabbed frame, to detect mid-grab toggle flips
    _prevTranslateEnabled = true;

    // True while an XrMenu is open (grabs are blocked)
    _menuActive = false;

    // Event name captured from resetEvent at initialization, for symmetric unsubscription
    _resetEventName = '';

    // Baseline transform of the target for reset() and the min/max scale bounds, captured
    // when the target is first seen (tracked so a runtime target swap recaptures it)
    /** @type {Entity | null} */
    _baselineTarget = null;

    _initPosition = new Vec3();

    _initRotation = new Quat();

    _initScale = new Vec3(1, 1, 1);

    initialize() {
        if (!this.app.xr) {
            console.error('XrManipulation script requires XR to be enabled on the application');
            return;
        }

        if (!this.target) {
            console.warn('XrManipulation: No target entity assigned. Grabbing will not work until one is set.');
        }

        if (!this.enableTranslate && !this.enableRotate && !this.enableScale) {
            console.warn('XrManipulation: All manipulation modes are disabled. Grabbing will not work.');
        }

        this._captureBaseline(this.target);

        const onInputAdd = (inputSource) => {
            this._inputSources.add(inputSource);
        };
        this.app.xr.input.on('add', onInputAdd);

        const onInputRemove = (inputSource) => {
            this._inputSources.delete(inputSource);
            if (this._grabbing && (inputSource === this._leftSource || inputSource === this._rightSource)) {
                this._endGrab();
            }
        };
        this.app.xr.input.on('remove', onInputRemove);

        const onMenuActive = (active) => {
            this._menuActive = !!active;
            if (this._menuActive) {
                this._endGrab();
            }
        };
        this.app.on('xr:menu:active', onMenuActive);

        this._resetEventName = this.resetEvent;
        if (this._resetEventName) {
            this.app.on(this._resetEventName, this.reset, this);
        }

        this.once('destroy', () => {
            this.app.xr.input.off('add', onInputAdd);
            this.app.xr.input.off('remove', onInputRemove);
            this.app.off('xr:menu:active', onMenuActive);
            if (this._resetEventName) {
                this.app.off(this._resetEventName, this.reset, this);
            }
            this._inputSources.clear();
            this._endGrab();
        });
    }

    /**
     * Restores the target to the transform it had when the script (or a newly assigned
     * target) was first seen. Also fired by the {@link XrManipulation#resetEvent} app event.
     */
    reset() {
        this._endGrab();
        const target = this._baselineTarget;
        if (!target) return;
        target.setPosition(this._initPosition);
        target.setRotation(this._initRotation);
        target.setLocalScale(this._initScale);
    }

    /**
     * Captures the baseline transform of a newly seen target, used by {@link XrManipulation#reset}
     * and as the reference for the {@link XrManipulation#minScale}/{@link XrManipulation#maxScale}
     * bounds.
     *
     * @param {Entity | null} target - The target entity, or null.
     * @private
     */
    _captureBaseline(target) {
        this._baselineTarget = target;
        if (!target) return;
        this._initPosition.copy(target.getPosition());
        this._initRotation.copy(target.getRotation());
        this._initScale.copy(target.getLocalScale());
    }

    /**
     * Whether an input source currently provides a usable position for grabbing: a grip pose
     * for controllers, or a tracked wrist joint for hands.
     *
     * @param {XrInputSource} inputSource - The input source to check.
     * @returns {boolean} True when the input source can be grabbed with.
     * @private
     */
    _hasUsablePose(inputSource) {
        return inputSource.grip || !!(inputSource.hand && inputSource.hand.tracking && inputSource.hand.wrist);
    }

    /**
     * Whether a grabbed input source is still valid to keep grabbing with. Tracking quality is
     * deliberately not checked here (only at grab start), so transient hand tracking loss
     * holds the grab on frozen poses instead of dropping it.
     *
     * @param {XrInputSource | null} inputSource - The grabbed input source.
     * @returns {boolean} True when the grab can continue with this input source.
     * @private
     */
    _canContinueGrab(inputSource) {
        return !!inputSource && this._inputSources.has(inputSource) && inputSource.squeezing &&
            (inputSource.grip || !!inputSource.hand);
    }

    /**
     * Writes the rig-space position of an input source into `out`. Controllers expose this
     * directly via their grip pose. Tracked hands only expose world space joint positions, so
     * the wrist position is converted to rig space by inverting the rig's current translation
     * + yaw + uniform scale (the transform the suite maintains on the rig).
     *
     * @param {XrInputSource} inputSource - The input source to read.
     * @param {Vec3} out - The vector to write the rig-space position into.
     * @returns {Vec3} The rig-space position (same object as `out`).
     * @private
     */
    _getRigSpacePosition(inputSource, out) {
        if (inputSource.grip) {
            out.copy(inputSource.getLocalPosition());
        } else {
            out.copy(inputSource.hand.wrist.getPosition());
            const rig = this.app.xr.camera?.parent;
            if (rig) {
                const rigPos = rig.getPosition();
                const forward = rig.forward;
                const yaw = Math.atan2(-forward.x, -forward.z);
                const scale = rig.getLocalScale().x || 1;
                out.sub(rigPos);
                rotateY(out, -yaw);
                out.mulScalar(1 / scale);
            }
        }
        return out;
    }

    /**
     * Captures the grab frame from the camera rig's current transform. Rig-space hand
     * positions are mapped to world space through this frame.
     *
     * @private
     */
    _captureFrame() {
        const rig = this.app.xr.camera?.parent;
        if (rig) {
            this._framePos.copy(rig.getPosition());
            const forward = rig.forward;
            this._frameYaw = Math.atan2(-forward.x, -forward.z);
            this._frameScale = rig.getLocalScale().x || 1;
        } else {
            this._framePos.set(0, 0, 0);
            this._frameYaw = 0;
            this._frameScale = 1;
        }
    }

    /**
     * Whether the camera rig has moved since the grab frame was captured (e.g. an XrNavigation
     * teleport or snap turn happened mid-grab).
     *
     * @returns {boolean} True when the rig transform no longer matches the grab frame.
     * @private
     */
    _frameStale() {
        const rig = this.app.xr.camera?.parent;
        if (!rig) return false;
        const forward = rig.forward;
        const yaw = Math.atan2(-forward.x, -forward.z);
        // squared distance avoids a per-frame sqrt (1e-12 is the squared 1e-6 threshold)
        const rigPos = rig.getPosition();
        const dx = rigPos.x - this._framePos.x;
        const dy = rigPos.y - this._framePos.y;
        const dz = rigPos.z - this._framePos.z;
        return dx * dx + dy * dy + dz * dz > 1e-12 || Math.abs(wrapPi(yaw - this._frameYaw)) > 1e-6;
    }

    /**
     * Maps a rig-space position to world space through the grab frame, in place.
     *
     * @param {Vec3} v - The rig-space position to map in place.
     * @returns {Vec3} The world-space position (same object as `v`).
     * @private
     */
    _frameToWorld(v) {
        rotateY(v, this._frameYaw);
        v.mulScalar(this._frameScale).add(this._framePos);
        return v;
    }

    /**
     * Captures the grab reference state: the target's current transform and the hand pair's
     * rig-space midpoint, separation and heading. The solve maps this reference onto the
     * current hand pair each frame. Recaptured whenever the applied transform deviated from
     * the raw solve (scale clamped, or a component held due to degeneracy or rig motion),
     * which prevents rubber-banding and heals degenerate headings.
     *
     * @param {Vec3} handLeft - The rig-space position of the first hand.
     * @param {Vec3} handRight - The rig-space position of the second hand.
     * @private
     */
    _captureGrabState(handLeft, handRight) {
        const target = this._grabTarget;
        this._targetPos0.copy(target.getPosition());
        this._targetRot0.copy(target.getRotation());
        this._targetScale0.copy(target.getLocalScale());

        this._midPose0.add2(handLeft, handRight).mulScalar(0.5);
        tmpScratch.sub2(handRight, handLeft);
        this._grabDist = tmpScratch.length();
        const xz = Math.sqrt(tmpScratch.x * tmpScratch.x + tmpScratch.z * tmpScratch.z);
        this._grabHeading = xz > EPS_XZ ? Math.atan2(tmpScratch.x, tmpScratch.z) : null;
    }

    /**
     * Starts a two-handed grab with the given pair of input sources.
     *
     * @param {Entity} target - The target entity being manipulated.
     * @param {XrInputSource} left - The first input source (left hand when available).
     * @param {XrInputSource} right - The second input source (right hand when available).
     * @private
     */
    _startGrab(target, left, right) {
        this._grabTarget = target;
        this._leftSource = left;
        this._rightSource = right;

        this._captureFrame();
        this._getRigSpacePosition(left, this._prevLeft);
        this._getRigSpacePosition(right, this._prevRight);
        this._captureGrabState(this._prevLeft, this._prevRight);
        this._prevTranslateEnabled = this.enableTranslate;

        this._grabbing = true;
        this.app.fire('xr:manipulation:active', true);
    }

    /**
     * Ends the active grab, if any. The target keeps its last applied transform.
     *
     * @private
     */
    _endGrab() {
        if (!this._grabbing) return;
        this._leftSource = null;
        this._rightSource = null;
        this._grabTarget = null;
        this._grabbing = false;
        this.app.fire('xr:manipulation:active', false);
    }

    /**
     * Clamps the relative scale factor so the target's total scale stays within
     * {@link XrManipulation#minScale}/{@link XrManipulation#maxScale} of its baseline scale.
     *
     * @param {number} factor - The proposed relative scale factor.
     * @param {number} currentScale - The target's current local X scale.
     * @returns {number} The clamped relative factor.
     * @private
     */
    _clampScaleFactor(factor, currentScale) {
        const base = this._initScale.x || 1;
        const total = math.clamp((currentScale * factor) / base, this.minScale, this.maxScale);
        return currentScale > 0 ? (total * base) / currentScale : 1;
    }

    /**
     * @param {number} dt - The delta time in seconds.
     */
    update(dt) {
        // Track runtime target swaps regardless of XR state, so reset() always has a baseline
        const target = this.target;
        if (target !== this._baselineTarget) {
            this._captureBaseline(target);
        }

        if (!this.app.xr?.active) {
            this._endGrab();
            return;
        }

        if (!target || this._menuActive || (!this.enableTranslate && !this.enableRotate && !this.enableScale)) {
            this._endGrab();
            return;
        }

        // Grab pair maintenance: the pair is fixed until broken; extra squeezing sources are
        // ignored. squeezing is polled - the engine updates it before script update runs. A
        // runtime target swap also ends the grab (the grab state belongs to the old target)
        if (this._grabbing && (target !== this._grabTarget ||
            !this._canContinueGrab(this._leftSource) || !this._canContinueGrab(this._rightSource))) {
            this._endGrab();
        }

        if (!this._grabbing) {
            let left = null;
            let right = null;
            let first = null;
            let second = null;
            for (const inputSource of this._inputSources) {
                if (!inputSource.squeezing || !this._hasUsablePose(inputSource)) continue;
                if (inputSource.handedness === 'left' && !left) {
                    left = inputSource;
                } else if (inputSource.handedness === 'right' && !right) {
                    right = inputSource;
                }
                if (!first) {
                    first = inputSource;
                } else if (!second) {
                    second = inputSource;
                }
            }
            if (left && right) {
                this._startGrab(target, left, right);
            } else if (first && second) {
                // Rare devices report 'none' handedness - fall back to the first two sources
                this._startGrab(target, first, second);
            }
            // The first solve would reproduce the grab-start transform exactly - skip it
            return;
        }

        this._getRigSpacePosition(this._leftSource, tmpHandLeft);
        this._getRigSpacePosition(this._rightSource, tmpHandRight);

        tmpHandMid.add2(tmpHandLeft, tmpHandRight).mulScalar(0.5);
        tmpHandDelta.sub2(tmpHandRight, tmpHandLeft);
        const sep = tmpHandDelta.length();
        const sepXz = Math.sqrt(tmpHandDelta.x * tmpHandDelta.x + tmpHandDelta.z * tmpHandDelta.z);
        const heading = sepXz > EPS_XZ ? Math.atan2(tmpHandDelta.x, tmpHandDelta.z) : null;

        // If the rig moved mid-grab (teleport, snap turn, smooth locomotion), re-anchor
        // against the new rig transform instead of dragging the world along with the rig
        if (this._frameStale()) {
            this._captureFrame();
            this._captureGrabState(tmpHandLeft, tmpHandRight);
        }

        // A mid-grab translate toggle flip switches solve modes - re-anchor so the new mode
        // continues from the applied transform seamlessly
        if (this.enableTranslate !== this._prevTranslateEnabled) {
            this._captureGrabState(tmpHandLeft, tmpHandRight);
            this._prevTranslateEnabled = this.enableTranslate;
        }

        const curScale = this._grabTarget.getLocalScale();

        if (this.enableTranslate) {
            // Anchor solve: apply the world-space similarity that maps the grab-start hand
            // pair onto the current hand pair to the target's grab-start transform. Drift-free
            // - the grabbed content sticks to the hands exactly while unconstrained
            let deltaYaw = 0;
            let yawHeld = false;
            if (this.enableRotate) {
                if (heading !== null && this._grabHeading !== null) {
                    deltaYaw = wrapPi(heading - this._grabHeading);
                } else {
                    yawHeld = true;
                }
            }

            let scaleRel = 1;
            let scaleHeld = false;
            let scaleClamped = false;
            if (this.enableScale) {
                if (sep > EPS_SEPARATION && this._grabDist > EPS_SEPARATION) {
                    // Spreading the hands grows the world (pinch-zoom semantics)
                    const raw = sep / this._grabDist;
                    scaleRel = this._clampScaleFactor(raw, this._targetScale0.x);
                    scaleClamped = scaleRel !== raw;
                } else {
                    scaleHeld = true;
                }
            }

            // World-space grab points through the (frozen) grab frame
            tmpMidWorld.copy(this._midPose0);
            this._frameToWorld(tmpMidWorld);
            tmpScratch.copy(tmpHandMid);
            this._frameToWorld(tmpScratch);

            // newPos = curMid + scaleRel * R(deltaYaw) * (targetPos0 - grabMid)
            tmpSolvedPos.sub2(this._targetPos0, tmpMidWorld);
            rotateY(tmpSolvedPos, deltaYaw);
            tmpSolvedPos.mulScalar(scaleRel).add(tmpScratch);

            // Feet pivot: pin the scale's vertical pivot to the user's floor level (the rig
            // origin Y, i.e. the physical floor in local-floor space) so whatever is at the
            // feet stays there while scaling. Vertical drag still passes through, and with
            // scaleRel = 1 this is identical to the hands pivot
            if (this.scalePivot !== 'hands') {
                const feetY = this._framePos.y;
                tmpSolvedPos.y = feetY + scaleRel * (this._targetPos0.y - feetY) + (tmpScratch.y - tmpMidWorld.y);
            }

            tmpQuat.setFromEulerAngles(0, deltaYaw * math.RAD_TO_DEG, 0);
            tmpQuatB.mul2(tmpQuat, this._targetRot0);

            this._grabTarget.setPosition(tmpSolvedPos);
            this._grabTarget.setRotation(tmpQuatB);
            this._grabTarget.setLocalScale(
                this._targetScale0.x * scaleRel,
                this._targetScale0.y * scaleRel,
                this._targetScale0.z * scaleRel
            );

            // Whenever the applied transform deviated from the raw solve, rebase the grab
            // reference on it: releasing a clamp responds immediately and degenerate headings
            // self-heal once the hands regain XZ separation
            if (yawHeld || scaleHeld || scaleClamped) {
                this._captureGrabState(tmpHandLeft, tmpHandRight);
            }
        } else {
            // Incremental pivot solve: without the translation degree of freedom there is no
            // fixed anchor - apply each frame's delta rotation/scale about the current world
            // hand midpoint, so zoom and rotation pivot on the hands without dragging
            tmpPrevDelta.sub2(this._prevRight, this._prevLeft);
            const sepPrev = tmpPrevDelta.length();
            const sepPrevXz = Math.sqrt(tmpPrevDelta.x * tmpPrevDelta.x + tmpPrevDelta.z * tmpPrevDelta.z);

            let deltaYaw = 0;
            if (this.enableRotate && sepXz > EPS_XZ && sepPrevXz > EPS_XZ) {
                deltaYaw = wrapPi(Math.atan2(tmpHandDelta.x, tmpHandDelta.z) - Math.atan2(tmpPrevDelta.x, tmpPrevDelta.z));
            }

            let scaleRatio = 1;
            if (this.enableScale && sep > EPS_SEPARATION && sepPrev > EPS_SEPARATION) {
                scaleRatio = this._clampScaleFactor(sep / sepPrev, curScale.x);
            }

            // Pivot: the current hand midpoint in world space through the grab frame. With
            // the feet pivot, the vertical component moves to the user's floor level so
            // scaling never lifts or sinks the floor underfoot
            tmpMidWorld.copy(tmpHandMid);
            this._frameToWorld(tmpMidWorld);
            if (this.scalePivot !== 'hands') {
                tmpMidWorld.y = this._framePos.y;
            }

            tmpSolvedPos.sub2(this._grabTarget.getPosition(), tmpMidWorld);
            rotateY(tmpSolvedPos, deltaYaw);
            tmpSolvedPos.mulScalar(scaleRatio).add(tmpMidWorld);

            tmpQuat.setFromEulerAngles(0, deltaYaw * math.RAD_TO_DEG, 0);
            tmpQuatB.mul2(tmpQuat, this._grabTarget.getRotation());

            this._grabTarget.setPosition(tmpSolvedPos);
            this._grabTarget.setRotation(tmpQuatB);
            this._grabTarget.setLocalScale(
                curScale.x * scaleRatio,
                curScale.y * scaleRatio,
                curScale.z * scaleRatio
            );
        }

        this._prevLeft.copy(tmpHandLeft);
        this._prevRight.copy(tmpHandRight);
    }
}

export { XrManipulation };
