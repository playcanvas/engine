import {
    BLEND_NORMAL,
    CULLFACE_NONE,
    Color,
    Entity,
    Mesh,
    MeshInstance,
    PlaneGeometry,
    PRIMITIVE_TRIANGLES,
    Script,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    ShaderMaterial,
    Vec2,
    Vec3
} from 'playcanvas';

/** @import { XrInputSource } from 'playcanvas' */

// Gravitational acceleration (m/s^2) used for the ballistic teleport arc
const ARC_GRAVITY = 9.81;

const tmpVec2A = new Vec2();
const tmpVec2B = new Vec2();
const tmpVec3A = new Vec3();
const tmpSegDir = new Vec3();
const tmpToCam = new Vec3();
const tmpSide = new Vec3();
const tmpAimOrigin = new Vec3();
const tmpAimDir = new Vec3();
const tmpAimPoint = new Vec3();

const arcVertexGLSL = /* glsl */ `
    attribute vec3 vertex_position;
    attribute vec2 aUv0;

    uniform mat4 matrix_model;
    uniform mat4 matrix_viewProjection;

    varying vec2 uv0;

    void main(void) {
        gl_Position = matrix_viewProjection * matrix_model * vec4(vertex_position, 1.0);
        uv0 = aUv0;
    }
`;

const arcFragmentGLSL = /* glsl */ `
    uniform vec4 uColor;

    varying vec2 uv0;

    void main(void) {
        float edge = 1.0 - abs(uv0.y * 2.0 - 1.0);
        edge *= edge;
        float ends = smoothstep(0.0, 0.1, uv0.x) * (1.0 - smoothstep(0.9, 1.0, uv0.x));
        gl_FragColor = vec4(uColor.rgb, uColor.a * edge * ends);
    }
`;

const arcVertexWGSL = /* wgsl */ `
    attribute vertex_position: vec3f;
    attribute aUv0: vec2f;

    uniform matrix_model: mat4x4f;
    uniform matrix_viewProjection: mat4x4f;

    varying uv0: vec2f;

    @vertex
    fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        output.position = uniform.matrix_viewProjection * uniform.matrix_model * vec4f(input.vertex_position, 1.0);
        output.uv0 = input.aUv0;
        return output;
    }
`;

const arcFragmentWGSL = /* wgsl */ `
    uniform uColor: vec4f;

    varying uv0: vec2f;

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        let edgeBase = 1.0 - abs(input.uv0.y * 2.0 - 1.0);
        let edge = edgeBase * edgeBase;
        let ends = smoothstep(0.0, 0.1, input.uv0.x) * (1.0 - smoothstep(0.9, 1.0, input.uv0.x));
        output.color = vec4f(uniform.uColor.rgb, uniform.uColor.a * edge * ends);
        return output;
    }
`;

const ringFragmentGLSL = /* glsl */ `
    uniform vec4 uColor;

    varying vec2 uv0;

    void main(void) {
        float d = length(uv0 * 2.0 - 1.0);
        float ring = smoothstep(0.55, 0.75, d) * (1.0 - smoothstep(0.85, 1.0, d));
        float fill = (1.0 - smoothstep(0.0, 0.85, d)) * 0.15;
        gl_FragColor = vec4(uColor.rgb, uColor.a * (ring + fill));
    }
`;

const ringFragmentWGSL = /* wgsl */ `
    uniform uColor: vec4f;

    varying uv0: vec2f;

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        let d = length(input.uv0 * 2.0 - 1.0);
        let ring = smoothstep(0.55, 0.75, d) * (1.0 - smoothstep(0.85, 1.0, d));
        let fill = (1.0 - smoothstep(0.0, 0.85, d)) * 0.15;
        output.color = vec4f(uniform.uColor.rgb, uniform.uColor.a * (ring + fill));
        return output;
    }
`;

/**
 * Handles VR navigation with support for teleportation, smooth locomotion, snap or smooth
 * turning, and snap vertical movement. All methods can be enabled simultaneously, allowing
 * users to choose their preferred navigation method on the fly.
 *
 * Teleportation: Point and teleport using trigger/pinch gestures. The aim is visualized as a
 * ballistic arc rendered as a glowing ribbon, landing on a flat navigation plane at
 * {@link XrNavigation#groundHeight}. Apps with physics or custom picking can override ground
 * detection by assigning {@link XrNavigation#castRay}.
 * Smooth Locomotion: Use left thumbstick for XZ movement
 * Turning: Right thumbstick X-axis — snap turn (default) or continuous smooth turn, selected
 *   via {@link XrNavigation#turnMode}
 * Snap Vertical: Use right thumbstick Y-axis to snap up/down (right grip for larger jumps)
 *
 * This script should be attached to a parent entity of the camera entity used for the XR
 * session. The entity hierarchy should be: XrNavigationEntity > CameraEntity for proper
 * locomotion handling. Use it in conjunction with the `XrControllers` script.
 */
class XrNavigation extends Script {
    static scriptName = 'xrNavigation';

    /**
     * Enable teleportation navigation using trigger/pinch gestures.
     * @attribute
     */
    enableTeleport = true;

    /**
     * Enable smooth locomotion using thumbsticks.
     * @attribute
     */
    enableMove = true;

    /**
     * Speed of smooth locomotion movement in meters per second.
     * @attribute
     * @range [0.1, 10]
     * @enabledif {enableMove}
     */
    movementSpeed = 1.5;

    /**
     * Selects the right-thumbstick turn behaviour. One of:
     * - `'snap'`: discrete rotation of {@link XrNavigation#rotateSpeed} degrees per gesture
     *   (default; existing behaviour).
     * - `'smooth'`: continuous rotation at {@link XrNavigation#smoothTurnSpeed} degrees/second
     *   while the thumbstick is past {@link XrNavigation#smoothTurnThreshold}.
     * - `'none'`: thumbstick X is ignored.
     * @attribute
     * @enabledif {enableMove}
     */
    turnMode = 'snap';

    /**
     * Angle in degrees for each snap turn. Used when {@link XrNavigation#turnMode} is `'snap'`.
     * @attribute
     * @range [15, 180]
     * @enabledif {enableMove}
     */
    rotateSpeed = 45;

    /**
     * Thumbstick deadzone threshold for movement.
     * @attribute
     * @range [0, 0.5]
     * @precision 0.01
     * @enabledif {enableMove}
     */
    movementThreshold = 0.1;

    /**
     * Thumbstick threshold to trigger snap turning.
     * @attribute
     * @range [0.1, 1]
     * @precision 0.01
     * @enabledif {enableMove}
     */
    rotateThreshold = 0.5;

    /**
     * Thumbstick threshold to reset snap turn state.
     * @attribute
     * @range [0.05, 0.5]
     * @precision 0.01
     * @enabledif {enableMove}
     */
    rotateResetThreshold = 0.25;

    /**
     * Rotation speed in degrees per second when {@link XrNavigation#turnMode} is `'smooth'`.
     * @attribute
     * @range [30, 360]
     * @enabledif {enableMove}
     */
    smoothTurnSpeed = 90;

    /**
     * Deadzone for the right-thumbstick X-axis when {@link XrNavigation#turnMode} is `'smooth'`.
     * Below this magnitude the stick is treated as centred.
     * @attribute
     * @range [0, 0.5]
     * @precision 0.01
     * @enabledif {enableMove}
     */
    smoothTurnThreshold = 0.15;

    /**
     * Maximum distance for teleportation in meters.
     * @attribute
     * @range [1, 50]
     * @enabledif {enableTeleport}
     */
    maxTeleportDistance = 10;

    /**
     * Height in meters of the flat navigation plane used for teleport ground detection.
     * @attribute
     * @enabledif {enableTeleport}
     */
    groundHeight = 0;

    /**
     * Initial speed of the ballistic teleport arc in meters per second. Higher values increase
     * the teleport reach.
     * @attribute
     * @range [2, 20]
     * @precision 0.1
     * @enabledif {enableTeleport}
     */
    teleportArcSpeed = 8;

    /**
     * Width in meters of the teleport arc ribbon.
     * @attribute
     * @range [0.01, 0.3]
     * @precision 0.01
     * @enabledif {enableTeleport}
     */
    arcWidth = 0.05;

    /**
     * Number of segments used to tessellate the teleport arc. Read once when the script
     * initializes; runtime changes have no effect.
     * @attribute
     * @range [8, 64]
     * @enabledif {enableTeleport}
     */
    arcSegments = 32;

    /**
     * Radius of the teleport target indicator ring.
     * @attribute
     * @range [0.1, 2]
     * @precision 0.1
     * @enabledif {enableTeleport}
     */
    teleportIndicatorRadius = 0.2;

    /**
     * Color for valid teleportation areas. Defaults to a soft cyan-white in the same family as
     * the `XrMenu` hover color, so pointer feedback reads as one visual system.
     * @attribute
     * @enabledif {enableTeleport}
     */
    validTeleportColor = new Color(0.5, 0.8, 0.95);

    /**
     * Color for invalid teleportation areas.
     * @attribute
     * @enabledif {enableTeleport}
     */
    invalidTeleportColor = new Color(0.9, 0.4, 0.35);

    /**
     * Enable snap vertical movement using right thumbstick Y (controllers only).
     * @attribute
     */
    enableSnapVertical = true;

    /**
     * Height in meters for each vertical snap.
     * @attribute
     * @range [0.1, 2]
     * @precision 0.1
     * @enabledif {enableSnapVertical}
     */
    snapVerticalHeight = 0.5;

    /**
     * Height in meters for each vertical snap when holding right grip (boost).
     * @attribute
     * @range [0.5, 10]
     * @precision 0.5
     * @enabledif {enableSnapVertical}
     */
    snapVerticalBoostHeight = 2.0;

    /**
     * Thumbstick Y threshold to trigger vertical snap.
     * @attribute
     * @range [0.1, 1]
     * @precision 0.01
     * @enabledif {enableSnapVertical}
     */
    snapVerticalThreshold = 0.5;

    /**
     * Thumbstick Y threshold to reset vertical snap state.
     * @attribute
     * @range [0.05, 0.5]
     * @precision 0.01
     * @enabledif {enableSnapVertical}
     */
    snapVerticalResetThreshold = 0.25;

    /**
     * Optional custom ground detection for teleportation. When set, it fully replaces the flat
     * plane at {@link XrNavigation#groundHeight}: the teleport arc is tested segment by segment
     * against this callback and only its hits are valid landing points. The callback receives
     * the world-space start and end of an arc segment and returns the hit point, or null if the
     * segment hits nothing. Not a script attribute (functions are not serializable) — assign it
     * from code, e.g. wrap `rigidbody.raycastFirst` or a custom picker.
     *
     * @type {((start: Vec3, end: Vec3) => Vec3 | null) | null}
     */
    castRay = null;

    /** @type {Set<XrInputSource>} */
    _inputSources = new Set();

    /** @type {Map<XrInputSource, boolean>} */
    _activePointers = new Map();

    /** @type {Map<XrInputSource, { handleSelectStart: Function, handleSelectEnd: Function }>} */
    _inputHandlers = new Map();

    // Hysteresis state for snap turning
    _rotateSnap = { last: 0 };

    // Hysteresis state for snap vertical movement
    _verticalSnap = { last: 0 };

    // Camera reference for movement calculations
    /** @type {import('playcanvas').Entity | null} */
    _cameraEntity = null;

    // Arc visualization state (created in initialize/lazily per input source)

    /** @type {ShaderMaterial | null} */
    _arcMaterial = null;

    /** @type {ShaderMaterial | null} */
    _ringMaterial = null;

    /** @type {Mesh | null} */
    _ringMesh = null;

    /** @type {Map<XrInputSource, { entity: Entity, meshInstance: MeshInstance, mesh: Mesh, positions: Float32Array, colorParam: Float32Array, ringEntity: Entity }>} */
    _arcVisuals = new Map();

    /** @type {Map<XrInputSource, { point: Vec3, valid: boolean }>} */
    _arcHits = new Map();

    /** @type {Vec3[]} */
    _arcPoints = [];

    // Y of the ground surface the rig currently stands on (groundHeight or last castRay hit)
    _currentGroundY = 0;

    initialize() {
        if (!this.app.xr) {
            console.error('XrNavigation script requires XR to be enabled on the application');
            return;
        }

        if (!this.enableTeleport && !this.enableMove && !this.enableSnapVertical) {
            console.warn('XrNavigation: All navigation methods are disabled. Navigation will not work.');
        }

        // Pre-allocate arc sample points (arcSegments is read once at initialization)
        for (let i = 0; i <= this.arcSegments; i++) {
            this._arcPoints.push(new Vec3());
        }

        this._currentGroundY = this.groundHeight;

        this._arcMaterial = new ShaderMaterial({
            uniqueName: 'xr-navigation-arc',
            vertexGLSL: arcVertexGLSL,
            fragmentGLSL: arcFragmentGLSL,
            vertexWGSL: arcVertexWGSL,
            fragmentWGSL: arcFragmentWGSL,
            attributes: {
                vertex_position: SEMANTIC_POSITION,
                aUv0: SEMANTIC_TEXCOORD0
            }
        });
        this._arcMaterial.blendType = BLEND_NORMAL;
        this._arcMaterial.cull = CULLFACE_NONE;
        this._arcMaterial.depthWrite = false;
        this._arcMaterial.update();

        this._ringMaterial = new ShaderMaterial({
            uniqueName: 'xr-navigation-ring',
            vertexGLSL: arcVertexGLSL,
            fragmentGLSL: ringFragmentGLSL,
            vertexWGSL: arcVertexWGSL,
            fragmentWGSL: ringFragmentWGSL,
            attributes: {
                vertex_position: SEMANTIC_POSITION,
                aUv0: SEMANTIC_TEXCOORD0
            }
        });
        this._ringMaterial.blendType = BLEND_NORMAL;
        this._ringMaterial.cull = CULLFACE_NONE;
        this._ringMaterial.depthWrite = false;
        this._ringMaterial.update();

        // Unit quad in XZ, shared by all ring mesh instances. Hold an extra reference so
        // destroying a ring MeshInstance (input sources are transient on some platforms -
        // e.g. one per pinch on Apple Vision Pro) cannot drop the refcount to zero and
        // destroy the shared mesh
        this._ringMesh = Mesh.fromGeometry(this.app.graphicsDevice, new PlaneGeometry());
        this._ringMesh.incRefCount();

        const onXrEnd = () => {
            this._destroyAllArcVisuals();
        };
        this.app.xr.on('end', onXrEnd);

        // Find camera entity - should be a descendant of this entity
        this._cameraEntity = this.entity.findComponent('camera')?.entity ?? null;
        if (!this._cameraEntity) {
            console.error('XrNavigation: No camera entity found. Movement calculations may not work correctly.');
        }

        const onInputAdd = (inputSource) => {
            const handleSelectStart = () => {
                this._activePointers.set(inputSource, true);
                // Invalidate any hit cached from a previous aim session, so a select that
                // starts and ends before the next update cannot teleport to a stale target.
                // tryTeleport recomputes when no cached hit exists; otherwise it commits the
                // last visualized hit, which is immune to the ray flicking on pinch release
                this._arcHits.delete(inputSource);
            };

            const handleSelectEnd = () => {
                this._activePointers.set(inputSource, false);
                // Only teleport when teleportation is enabled. Otherwise a select/pinch gesture
                // (e.g. used to click a UI element) would still snap the rig to the floor point
                // under the ray.
                if (this.enableTeleport) {
                    this.tryTeleport(inputSource);
                }
            };

            // Attach the handlers
            inputSource.on('selectstart', handleSelectStart);
            inputSource.on('selectend', handleSelectEnd);

            // Store the handlers in the map
            this._inputHandlers.set(inputSource, { handleSelectStart, handleSelectEnd });
            this._inputSources.add(inputSource);
        };
        this.app.xr.input.on('add', onInputAdd);

        const onInputRemove = (inputSource) => {
            const handlers = this._inputHandlers.get(inputSource);
            if (handlers) {
                inputSource.off('selectstart', handlers.handleSelectStart);
                inputSource.off('selectend', handlers.handleSelectEnd);
                this._inputHandlers.delete(inputSource);
            }
            this._activePointers.delete(inputSource);
            this._inputSources.delete(inputSource);
            this._destroyArcVisual(inputSource);
        };
        this.app.xr.input.on('remove', onInputRemove);

        this.once('destroy', () => {
            this.app.xr.off('end', onXrEnd);
            this.app.xr.input.off('add', onInputAdd);
            this.app.xr.input.off('remove', onInputRemove);

            // Detach per-source select handlers
            for (const [inputSource, handlers] of this._inputHandlers) {
                inputSource.off('selectstart', handlers.handleSelectStart);
                inputSource.off('selectend', handlers.handleSelectEnd);
            }
            this._inputHandlers.clear();
            this._activePointers.clear();
            this._inputSources.clear();

            this._destroyAllArcVisuals();
            if (this._arcMaterial) {
                this._arcMaterial.destroy();
                this._arcMaterial = null;
            }
            if (this._ringMaterial) {
                this._ringMaterial.destroy();
                this._ringMaterial = null;
            }
            if (this._ringMesh) {
                this._ringMesh.destroy();
                this._ringMesh = null;
            }
        });
    }

    /**
     * Computes the world-space aim ray for an input source, writing it into tmpAimOrigin and
     * tmpAimDir. The arc launches from the handheld grip position when the input source has
     * one, because the target ray origin sits at the head for gaze/pinch-style input (e.g.
     * Apple Vision Pro transient pointers). The direction is then re-aimed from the grip
     * toward the point the target ray indicates - using the raw target ray direction from the
     * hand would offset the trajectory by the hand-to-head parallax, making the landing depend
     * on where the hand happened to be when the pinch registered. For tracked-pointer
     * controllers the grip and ray origin coincide, so this reduces to the target ray itself.
     *
     * @param {XrInputSource} inputSource - The aiming input source.
     * @private
     */
    _getAimRay(inputSource) {
        // Copy immediately: getOrigin()/getDirection()/getPosition() return references to the
        // input source's internal vectors, which the engine reuses as scratch space on
        // subsequent calls
        tmpAimDir.copy(inputSource.getDirection());
        tmpAimOrigin.copy(inputSource.getOrigin());

        const grip = inputSource.grip ? inputSource.getPosition() : null;
        if (!grip) return;

        // Aim point: where the target ray meets the navigation plane, or a far point along
        // the ray when it never descends to it. When castRay replaces plane detection, the
        // plane is meaningless for aiming, so always use the far point
        let t = this.maxTeleportDistance;
        if (!this.castRay && tmpAimDir.y < -0.001) {
            const tPlane = (tmpAimOrigin.y - this.groundHeight) / -tmpAimDir.y;
            if (tPlane > 0 && tPlane < this.maxTeleportDistance * 2) {
                t = tPlane;
            }
        }
        tmpAimPoint.copy(tmpAimDir).mulScalar(t).add(tmpAimOrigin);

        tmpAimOrigin.copy(grip);
        tmpAimDir.sub2(tmpAimPoint, tmpAimOrigin).normalize();
    }

    /**
     * Computes the ballistic teleport arc for the given aim ray, filling {@link _arcPoints}
     * with world-space samples and writing the landing result into rec. The landing point is
     * the arc's intersection with the plane at {@link XrNavigation#groundHeight}, or the first
     * segment hit reported by {@link XrNavigation#castRay} when that is assigned.
     *
     * @param {Vec3} origin - World-space start of the aim ray.
     * @param {Vec3} direction - Normalized aim direction.
     * @param {{ point: Vec3, valid: boolean }} rec - Receives the landing point and validity.
     * @private
     */
    _computeArcHit(origin, direction, rec) {
        const segments = this._arcPoints.length - 1;
        const g = ARC_GRAVITY;
        const vx = direction.x * this.teleportArcSpeed;
        const vy = direction.y * this.teleportArcSpeed;
        const vz = direction.z * this.teleportArcSpeed;

        rec.valid = false;

        let tFlight;
        let planeHit = false;
        if (this.castRay) {
            // castRay replaces plane detection, so the sampling window must not stop at the
            // plane (hits below groundHeight would be unreachable). Fly until the arc reaches
            // the deepest point that could still pass the distance check - that check measures
            // from the rig position, which sits below the aim origin (the grip), so descend
            // maxTeleportDistance below the rig, not below the origin
            const fallDepth = this.maxTeleportDistance +
                Math.max(0, origin.y - this.entity.getPosition().y);
            tFlight = (vy + Math.sqrt(vy * vy + 2 * g * fallDepth)) / g;
        } else {
            // Closed-form flight time to the navigation plane: larger root of
            // origin.y + vy*t - 0.5*g*t^2 = groundHeight
            const disc = vy * vy + 2 * g * (origin.y - this.groundHeight);
            tFlight = disc >= 0 ? (vy + Math.sqrt(disc)) / g : 0;
            planeHit = tFlight > 0.001;
            if (!planeHit) {
                // Origin below the plane aiming down - draw a plausible full arc instead
                tFlight = (2 * this.teleportArcSpeed) / g;
            }
        }

        for (let i = 0; i <= segments; i++) {
            const t = (tFlight * i) / segments;
            this._arcPoints[i].set(
                origin.x + vx * t,
                origin.y + vy * t - 0.5 * g * t * t,
                origin.z + vz * t
            );
        }

        if (this.castRay) {
            // Custom ground detection: the first segment hit wins and truncates the arc there.
            // Remaining samples collapse onto the hit so the ribbon's quads become degenerate.
            for (let i = 0; i < segments; i++) {
                const hit = this.castRay(this._arcPoints[i], this._arcPoints[i + 1]);
                if (hit) {
                    rec.point.copy(hit);
                    for (let j = i + 1; j <= segments; j++) {
                        this._arcPoints[j].copy(rec.point);
                    }
                    rec.valid = this.isValidTeleportDistance(rec.point);
                    return;
                }
            }
        } else if (planeHit) {
            rec.point.copy(this._arcPoints[segments]);
            rec.point.y = this.groundHeight;
            rec.valid = this.isValidTeleportDistance(rec.point);
        }
    }

    /**
     * Returns the cached arc-hit record for an input source, creating it on first use.
     *
     * @param {XrInputSource} inputSource - The aiming input source.
     * @returns {{ point: Vec3, valid: boolean }} The hit record.
     * @private
     */
    _getOrCreateHit(inputSource) {
        let rec = this._arcHits.get(inputSource);
        if (!rec) {
            rec = { point: new Vec3(), valid: false };
            this._arcHits.set(inputSource, rec);
        }
        return rec;
    }

    tryTeleport(inputSource) {
        let rec = this._arcHits.get(inputSource);
        if (!rec) {
            rec = this._getOrCreateHit(inputSource);
            this._getAimRay(inputSource);
            this._computeArcHit(tmpAimOrigin, tmpAimDir, rec);
        }
        if (!rec.valid) return;

        const target = tmpVec3A.copy(rec.point);

        const rigPos = this.entity.getPosition();

        // Adjust for the camera's world-space XZ offset from the rig origin so the user's
        // head (not the rig origin) ends up at the target - correct under rig yaw, unlike
        // the raw local offset, which would misplace teleports after any snap/smooth turn
        if (this._cameraEntity) {
            const cameraPos = this._cameraEntity.getPosition();
            target.x -= cameraPos.x - rigPos.x;
            target.z -= cameraPos.z - rigPos.z;
        }

        // Preserve the rig's height offset above the ground it currently stands on, so castRay
        // hits on elevated surfaces step the rig up/down while snap vertical offsets carry over
        target.y = rigPos.y + (rec.point.y - this._currentGroundY);
        this._currentGroundY = rec.point.y;
        this.entity.setPosition(target);
    }

    update(dt) {
        // Left thumbstick drives movement; right drives turning and vertical snaps
        for (const inputSource of this._inputSources) {
            if (!this._hasThumbsticks(inputSource)) continue;

            if (inputSource.handedness === 'left') {
                if (this.enableMove && this._cameraEntity) {
                    this._handleMovement(inputSource, dt);
                }
            } else if (inputSource.handedness === 'right') {
                if (this.enableMove && this._cameraEntity) {
                    if (this.turnMode === 'smooth') {
                        this._handleSmoothTurning(inputSource, dt);
                    } else if (this.turnMode === 'snap') {
                        this._handleSnapTurning(inputSource);
                    }
                    // 'none' → thumbstick X is ignored
                }
                if (this.enableSnapVertical) {
                    this._handleSnapVertical(inputSource);
                }
            }
        }

        // Handle teleportation
        if (this.enableTeleport) {
            this._handleTeleportation();
        }
    }

    /**
     * Whether an input source has a gamepad with thumbstick axes (axes[2]/[3]). Hand-tracking
     * sources (e.g. Apple Vision Pro) report a gamepad with no axes, which would read as NaN.
     *
     * @param {XrInputSource} inputSource - The input source to check.
     * @returns {boolean} True when thumbstick axes can be read.
     * @private
     */
    _hasThumbsticks(inputSource) {
        return !!inputSource.gamepad && inputSource.gamepad.axes.length >= 4;
    }

    /**
     * Edge-detects a snap gesture on a thumbstick axis with hysteresis, so one deflection
     * fires exactly once: fires when the axis crosses `threshold` from neutral, and re-arms
     * only once it returns within `resetThreshold`.
     *
     * @param {{ last: number }} state - Persistent hysteresis state for this axis.
     * @param {number} value - Current axis value.
     * @param {number} threshold - Deflection magnitude that fires the snap.
     * @param {number} resetThreshold - Magnitude the axis must return within to re-arm.
     * @returns {number} The snap direction (-1 or 1), or 0 when nothing fired.
     * @private
     */
    _snapTrigger(state, value, threshold, resetThreshold) {
        if (state.last > 0 && value < resetThreshold) {
            state.last = 0;
        } else if (state.last < 0 && value > -resetThreshold) {
            state.last = 0;
        }

        if (state.last === 0 && Math.abs(value) > threshold) {
            state.last = Math.sign(value);
            return state.last;
        }
        return 0;
    }

    /**
     * Yaw-rotates the rig around the camera's local position, so the view pivots in place
     * rather than orbiting the rig origin.
     *
     * @param {number} degrees - The rotation angle in degrees.
     * @private
     */
    _rotateRigAroundCamera(degrees) {
        tmpVec3A.copy(this._cameraEntity.getLocalPosition());
        this.entity.translateLocal(tmpVec3A);
        this.entity.rotateLocal(0, degrees, 0);
        this.entity.translateLocal(tmpVec3A.mulScalar(-1));
    }

    /**
     * Smooth locomotion: translates the rig in the camera-relative direction of the left
     * thumbstick at {@link XrNavigation#movementSpeed}.
     *
     * @param {XrInputSource} inputSource - The left-hand input source.
     * @param {number} dt - Frame delta time in seconds.
     * @private
     */
    _handleMovement(inputSource, dt) {
        // Get thumbstick input (axes[2] = X, axes[3] = Y)
        tmpVec2A.set(inputSource.gamepad.axes[2], inputSource.gamepad.axes[3]);

        // Check if input exceeds deadzone
        if (tmpVec2A.length() <= this.movementThreshold) return;

        tmpVec2A.normalize();

        // Calculate camera-relative movement direction
        const forward = this._cameraEntity.forward;
        tmpVec2B.x = forward.x;
        tmpVec2B.y = forward.z;
        tmpVec2B.normalize();

        // Calculate rotation angle based on camera yaw
        const rad = Math.atan2(tmpVec2B.x, tmpVec2B.y) - Math.PI / 2;

        // Apply rotation to movement vector
        const t = tmpVec2A.x * Math.sin(rad) - tmpVec2A.y * Math.cos(rad);
        tmpVec2A.y = tmpVec2A.y * Math.sin(rad) + tmpVec2A.x * Math.cos(rad);
        tmpVec2A.x = t;

        // Scale by movement speed and delta time
        tmpVec2A.mulScalar(this.movementSpeed * dt);

        // Apply movement to camera parent (this entity)
        this.entity.translate(tmpVec2A.x, 0, tmpVec2A.y);
    }

    /**
     * Discrete turn of {@link XrNavigation#rotateSpeed} degrees per right-thumbstick gesture,
     * with hysteresis so one deflection fires exactly once.
     *
     * @param {XrInputSource} inputSource - The right-hand input source.
     * @private
     */
    _handleSnapTurning(inputSource) {
        // Get rotation input from right thumbstick X-axis
        const rotate = -inputSource.gamepad.axes[2];

        const dir = this._snapTrigger(this._rotateSnap, rotate, this.rotateThreshold, this.rotateResetThreshold);
        if (dir) {
            this._rotateRigAroundCamera(dir * this.rotateSpeed);
        }
    }

    /**
     * Continuous turn at {@link XrNavigation#smoothTurnSpeed} degrees per second while the
     * right thumbstick X-axis is held past {@link XrNavigation#smoothTurnThreshold}.
     *
     * @param {XrInputSource} inputSource - The right-hand input source.
     * @param {number} dt - Frame delta time in seconds.
     * @private
     */
    _handleSmoothTurning(inputSource, dt) {
        const turn = -inputSource.gamepad.axes[2];
        if (Math.abs(turn) <= this.smoothTurnThreshold) return;

        this._rotateRigAroundCamera(turn * this.smoothTurnSpeed * dt);
    }

    /**
     * Snap vertical movement on right thumbstick Y, with hysteresis so one deflection fires
     * exactly once. Hold right grip for the larger {@link XrNavigation#snapVerticalBoostHeight}.
     *
     * @param {XrInputSource} inputSource - The right-hand input source.
     * @private
     */
    _handleSnapVertical(inputSource) {
        // Get vertical input from right thumbstick Y axis (negative = up on stick)
        const vertical = -inputSource.gamepad.axes[3];

        const dir = this._snapTrigger(this._verticalSnap, vertical, this.snapVerticalThreshold, this.snapVerticalResetThreshold);
        if (dir) {
            // Check if right grip is held for boost (positive = up, negative = down)
            const boost = inputSource.gamepad.buttons[1]?.pressed;
            this.entity.translate(0, dir * (boost ? this.snapVerticalBoostHeight : this.snapVerticalHeight), 0);
        }
    }

    /** @private */
    _handleTeleportation() {
        for (const inputSource of this._inputSources) {
            // Only show the teleport arc while trigger/select is pressed
            if (!this._activePointers.get(inputSource)) {
                const visual = this._arcVisuals.get(inputSource);
                if (visual) {
                    visual.entity.enabled = false;
                    visual.ringEntity.enabled = false;
                }
                continue;
            }

            const rec = this._getOrCreateHit(inputSource);
            this._getAimRay(inputSource);
            this._computeArcHit(tmpAimOrigin, tmpAimDir, rec);

            const visual = this._getArcVisual(inputSource);
            visual.entity.enabled = true;
            this._updateArcVisual(visual, rec.valid);

            visual.ringEntity.enabled = rec.valid;
            if (rec.valid) {
                // Slightly above ground to avoid z-fighting
                visual.ringEntity.setPosition(rec.point.x, rec.point.y + 0.01, rec.point.z);
                const diameter = this.teleportIndicatorRadius * 2;
                visual.ringEntity.setLocalScale(diameter, 1, diameter);
            }
        }
    }

    /**
     * Returns the arc ribbon visual for an input source, creating it on first use.
     *
     * @param {XrInputSource} inputSource - The aiming input source.
     * @returns {{ entity: Entity, meshInstance: MeshInstance, mesh: Mesh, positions: Float32Array, colorParam: Float32Array }} The visual.
     * @private
     */
    _getArcVisual(inputSource) {
        let visual = this._arcVisuals.get(inputSource);
        if (visual) return visual;

        const segments = this._arcPoints.length - 1;
        const vertexCount = (segments + 1) * 2;

        // Positions change per frame; UVs (x along the arc, y across the ribbon) and the
        // quad-strip index list are static
        const positions = new Float32Array(vertexCount * 3);
        const uvs = new Float32Array(vertexCount * 2);
        const indices = new Uint16Array(segments * 6);

        for (let i = 0; i <= segments; i++) {
            const u = i / segments;
            uvs[i * 4 + 0] = u;
            uvs[i * 4 + 1] = 0;
            uvs[i * 4 + 2] = u;
            uvs[i * 4 + 3] = 1;
        }
        for (let i = 0; i < segments; i++) {
            const v = i * 2;
            indices[i * 6 + 0] = v;
            indices[i * 6 + 1] = v + 1;
            indices[i * 6 + 2] = v + 2;
            indices[i * 6 + 3] = v + 1;
            indices[i * 6 + 4] = v + 3;
            indices[i * 6 + 5] = v + 2;
        }

        const mesh = new Mesh(this.app.graphicsDevice);
        mesh.clear(true, false);
        mesh.setPositions(positions);
        mesh.setUvs(0, uvs);
        mesh.setIndices(indices);
        mesh.update(PRIMITIVE_TRIANGLES);

        const meshInstance = new MeshInstance(mesh, this._arcMaterial);
        meshInstance.pick = false;

        const entity = new Entity('XrNavigationArc');
        entity.addComponent('render', { castShadows: false });
        entity.render.meshInstances = [meshInstance];
        this.app.root.addChild(entity);

        const colorParam = new Float32Array(4);

        // Target indicator: a flat quad whose shader draws a soft glowing ring. Shares the
        // arc's color parameter array - it is only visible on valid (green) landings anyway
        const ringMeshInstance = new MeshInstance(this._ringMesh, this._ringMaterial);
        ringMeshInstance.pick = false;
        ringMeshInstance.setParameter('uColor', colorParam);

        const ringEntity = new Entity('XrNavigationRing');
        ringEntity.addComponent('render', { castShadows: false });
        ringEntity.render.meshInstances = [ringMeshInstance];
        ringEntity.enabled = false;
        this.app.root.addChild(ringEntity);

        visual = { entity, meshInstance, mesh, positions, colorParam, ringEntity };
        this._arcVisuals.set(inputSource, visual);
        return visual;
    }

    /**
     * Rebuilds the ribbon vertices from the current {@link _arcPoints} samples and applies the
     * valid/invalid color. Each arc point becomes a vertex pair offset sideways, with the
     * ribbon billboarded toward the camera.
     *
     * @param {{ entity: Entity, meshInstance: MeshInstance, mesh: Mesh, positions: Float32Array, colorParam: Float32Array }} visual - The arc visual.
     * @param {boolean} valid - Whether the current landing point is a valid teleport target.
     * @private
     */
    _updateArcVisual(visual, valid) {
        const points = this._arcPoints;
        const segments = points.length - 1;
        const positions = visual.positions;
        const camPos = this._cameraEntity ? this._cameraEntity.getPosition() : this.entity.getPosition();
        const halfWidth = this.arcWidth * 0.5;

        for (let i = 0; i <= segments; i++) {
            const point = points[i];

            // Segment direction (backward difference at the last point)
            if (i < segments) {
                tmpSegDir.sub2(points[i + 1], point);
            } else {
                tmpSegDir.sub2(point, points[i - 1]);
            }

            tmpToCam.sub2(camPos, point);
            tmpSide.cross(tmpSegDir, tmpToCam);
            const len = tmpSide.length();
            if (len > 1e-6) {
                tmpSide.mulScalar(halfWidth / len);
            } else {
                // Degenerate (collapsed samples past a castRay hit) - direction is irrelevant
                tmpSide.set(halfWidth, 0, 0);
            }

            const base = i * 6;
            positions[base + 0] = point.x - tmpSide.x;
            positions[base + 1] = point.y - tmpSide.y;
            positions[base + 2] = point.z - tmpSide.z;
            positions[base + 3] = point.x + tmpSide.x;
            positions[base + 4] = point.y + tmpSide.y;
            positions[base + 5] = point.z + tmpSide.z;
        }

        visual.mesh.setPositions(positions);
        visual.mesh.update(PRIMITIVE_TRIANGLES);

        // Read the color attributes directly so runtime changes take effect
        const color = valid ? this.validTeleportColor : this.invalidTeleportColor;
        visual.colorParam[0] = color.r;
        visual.colorParam[1] = color.g;
        visual.colorParam[2] = color.b;
        visual.colorParam[3] = color.a;
        visual.meshInstance.setParameter('uColor', visual.colorParam);
    }

    /**
     * Destroys the arc visual associated with an input source, if any.
     *
     * @param {XrInputSource} inputSource - The input source.
     * @private
     */
    _destroyArcVisual(inputSource) {
        const visual = this._arcVisuals.get(inputSource);
        if (!visual) return;

        visual.entity.destroy();
        visual.ringEntity.destroy();
        this._arcVisuals.delete(inputSource);
        this._arcHits.delete(inputSource);
    }

    /** @private */
    _destroyAllArcVisuals() {
        for (const inputSource of this._arcVisuals.keys()) {
            this._destroyArcVisual(inputSource);
        }
    }

    isValidTeleportDistance(hitPoint) {
        const distance = hitPoint.distance(this.entity.getPosition());
        return distance <= this.maxTeleportDistance;
    }
}

export { XrNavigation };
