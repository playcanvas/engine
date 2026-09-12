import { Vec3 } from '../../core/math/vec3.js';
import { WireRenderer } from '../renderers/wire-renderer.js';

/** @import { Color } from '../../core/math/color.js' */
/** @import { AppBase } from '../../framework/app-base.js' */
/** @import { Layer } from '../../scene/layer.js' */

/**
 * Bullet's `btIDebugDraw` mode flags, combined into {@link AmmoDebugDraw#mode}.
 *
 * @ignore
 * @type {{ WIREFRAME: number, AABB: number, CONTACT_POINTS: number, NO_DEACTIVATION: number,
 * CONSTRAINTS: number, CONSTRAINT_LIMITS: number, NORMALS: number, FRAMES: number }}
 */
const DEBUG_DRAW = {
    /** Collision shapes, colored by activation state. */
    WIREFRAME: 1,
    /** Axis-aligned bounds of each body. */
    AABB: 2,
    /** Contact points with their normals. Reported during the physics step itself. */
    CONTACT_POINTS: 8,
    /** Not a drawing flag: stops bodies from falling asleep while set. */
    NO_DEACTIVATION: 16,
    /** Joint frames. */
    CONSTRAINTS: 2048,
    /** Joint limits. */
    CONSTRAINT_LIMITS: 4096,
    /** Face normals of mesh shapes. */
    NORMALS: 16384,
    /** Local axes of each body. */
    FRAMES: 32768
};

// the flags that make debugDrawWorld emit lines
const DRAW_FLAGS = DEBUG_DRAW.WIREFRAME | DEBUG_DRAW.AABB | DEBUG_DRAW.CONTACT_POINTS | DEBUG_DRAW.CONSTRAINTS |
    DEBUG_DRAW.CONSTRAINT_LIMITS | DEBUG_DRAW.NORMALS | DEBUG_DRAW.FRAMES;

const CONTACT_NORMAL_LENGTH = 0.25;
const CONTACT_CROSS_SIZE = 0.04;
const INITIAL_SEGMENTS = 4096;

const _a = new Vec3();
const _b = new Vec3();
const _c = new Vec3();
const _d = new Vec3();

/**
 * @param {Vec3} a - A point.
 * @param {Vec3} b - Another point.
 * @returns {number} The squared distance between them.
 */
function distanceSq(a, b) {
    const x = a.x - b.x;
    const y = a.y - b.y;
    const z = a.z - b.z;
    return x * x + y * y + z * z;
}

/**
 * Draws the state of the Ammo dynamics world through Bullet's own debug drawer, so what you see is
 * exactly what the physics engine simulates: compound and mesh shapes, contact points, joints.
 *
 * Bullet hands over every line as a pair of `btVector3` pointers. Those are read straight out of
 * the Ammo heap into a growing pair of typed arrays, so a frame of thousands of lines allocates
 * nothing, and the whole batch is submitted with one {@link WireRenderer#linesPacked} call.
 *
 * Contact points arrive during the physics step rather than from `debugDrawWorld`, so lines are
 * accumulated across the frame and only reset once {@link AmmoDebugDraw#update} has drawn them.
 *
 * Usable on its own:
 *
 * ```javascript
 * const physicsDebug = new AmmoDebugDraw(app);
 * physicsDebug.enabled = true;
 * physicsDebug.mode = DEBUG_DRAW.WIREFRAME | DEBUG_DRAW.CONTACT_POINTS;
 * app.on('update', () => physicsDebug.update()); // fires after the physics step
 * ```
 *
 * @ignore
 */
class AmmoDebugDraw {
    /**
     * The app whose rigid body system is drawn.
     *
     * @type {AppBase}
     */
    app;

    /**
     * The renderer the lines go through. Its layer and depth test are applied on every flush from
     * {@link depthTest} and {@link layer}.
     *
     * @type {WireRenderer}
     */
    wire;

    /**
     * Whether the world is drawn. While off, {@link mode} still applies its simulation flags such
     * as {@link DEBUG_DRAW.NO_DEACTIVATION}.
     *
     * @type {boolean}
     */
    enabled = false;

    /**
     * A combination of {@link DEBUG_DRAW} flags.
     *
     * @type {number}
     */
    mode = DEBUG_DRAW.WIREFRAME;

    /**
     * Whether the lines are depth tested against the scene. Off shows the physics world through
     * the geometry.
     *
     * @type {boolean}
     */
    depthTest = false;

    /**
     * The layer to draw into, or null for the immediate layer.
     *
     * @type {Layer|null}
     */
    layer = null;

    /**
     * Only lines within this distance of {@link center} are drawn, in meters. Zero draws everything.
     *
     * @type {number}
     */
    range = 0;

    /**
     * The point {@link range} is measured from, typically the camera position.
     *
     * @type {Vec3|null}
     */
    center = null;

    /**
     * When culling by range, drop lines with only one end in range instead of keeping them.
     *
     * @type {boolean}
     */
    cullPartial = false;

    /**
     * Overrides the colors Bullet assigns, which encode the activation state. Null keeps them.
     *
     * @type {Color|null}
     */
    color = null;

    /**
     * The number of line segments drawn by the last {@link update}.
     *
     * @type {number}
     */
    lineCount = 0;

    /**
     * The number of line segments dropped by range culling in the last {@link update}.
     *
     * @type {number}
     */
    culledCount = 0;

    /** @private */
    _positions = new Float32Array(INITIAL_SEGMENTS * 6);

    /** @private */
    _colors = new Float32Array(INITIAL_SEGMENTS * 8);

    /** @private */
    _count = 0;

    /** @private */
    _culled = 0;

    /**
     * @type {any}
     * @private
     */
    _drawer = null;

    /**
     * @type {any}
     * @private
     */
    _world = null;

    /**
     * Whether a debug drawer can be attached right now: Ammo is loaded with `DebugDrawer` support
     * and the rigid body system has created its world.
     *
     * @param {AppBase} app - The app.
     * @returns {boolean} True when {@link attach} would succeed.
     */
    static isAvailable(app) {
        const Ammo = /** @type {any} */ (globalThis).Ammo;
        return !!(Ammo?.DebugDrawer && app.systems.rigidbody?.dynamicsWorld);
    }

    /**
     * @param {AppBase} app - The app.
     * @param {WireRenderer} [wire] - The renderer to draw through. Defaults to a new one.
     */
    constructor(app, wire) {
        this.app = app;
        this.wire = wire ?? new WireRenderer(app);
    }

    /**
     * Whether a debug drawer is currently installed on the world.
     *
     * @type {boolean}
     */
    get attached() {
        return !!this._drawer;
    }

    /**
     * Installs the debug drawer on the dynamics world. Called on demand by {@link update}.
     *
     * @returns {boolean} False when Ammo or the world is not available.
     */
    attach() {
        if (this._drawer) return true;
        if (!AmmoDebugDraw.isAvailable(this.app)) return false;

        const Ammo = /** @type {any} */ (globalThis).Ammo;
        const drawer = new Ammo.DebugDrawer();
        drawer.drawLine = (from, to, color) => this._drawLine(from, to, color);
        drawer.drawContactPoint = (point, normal, distance, lifeTime, color) => this._drawContactPoint(point, normal, color);
        drawer.reportErrorWarning = () => {};
        drawer.draw3dText = () => {};
        drawer.setDebugMode = (mode) => {
            this.mode = mode;
        };
        // while disabled, only the simulation flags are reported so Bullet stops calling back
        drawer.getDebugMode = () => (this.enabled ? this.mode : (this.mode & DEBUG_DRAW.NO_DEACTIVATION));

        this._world = this.app.systems.rigidbody.dynamicsWorld;
        this._world.setDebugDrawer(drawer);
        this._drawer = drawer;
        return true;
    }

    /**
     * Removes the debug drawer from the world and frees it.
     */
    detach() {
        if (!this._drawer) return;
        try {
            this._world?.setDebugDrawer(null);
        } catch (e) {
            // the world may already be gone
        }
        this._releaseDrawer();
    }

    /**
     * Draws the world for this frame. Call once per frame after the physics step, for example from
     * a script's `postUpdate`.
     */
    update() {
        const world = this.app.systems.rigidbody?.dynamicsWorld ?? null;

        // the world was destroyed or recreated under us
        if (this._drawer && world !== this._world) {
            this._releaseDrawer();
        }

        if (!this.enabled) {
            this._count = 0;
            this._culled = 0;
            this.lineCount = 0;
            this.culledCount = 0;
            return;
        }

        if (!this._drawer && !this.attach()) return;

        if (this.mode & DRAW_FLAGS) {
            this._world.debugDrawWorld();
        }
        this._flush();
    }

    /**
     * Submits the accumulated lines and resets the buffers.
     *
     * @private
     */
    _flush() {
        const count = this._count;
        if (count > 0) {
            const wire = this.wire;
            wire.depthTest = this.depthTest;
            wire.layer = this.layer;
            wire.linesPacked(this._positions.subarray(0, count * 6), this._colors.subarray(0, count * 8));
        }
        this.lineCount = count;
        this.culledCount = this._culled;
        this._count = 0;
        this._culled = 0;
    }

    /**
     * @private
     */
    _releaseDrawer() {
        const Ammo = /** @type {any} */ (globalThis).Ammo;
        try {
            Ammo?.destroy?.(this._drawer);
        } catch (e) {
            // nothing to do
        }
        this._drawer = null;
        this._world = null;
        this._count = 0;
        this._culled = 0;
    }

    /**
     * Reads a `btVector3` at a heap pointer.
     *
     * @param {number} ptr - The pointer.
     * @param {Vec3} out - Receives the vector.
     * @private
     */
    _read(ptr, out) {
        const Ammo = /** @type {any} */ (globalThis).Ammo;
        const heap = Ammo.HEAPF32;
        if (heap) {
            const i = ptr >> 2;
            out.set(heap[i], heap[i + 1], heap[i + 2]);
        } else {
            const v = Ammo.wrapPointer(ptr, Ammo.btVector3);
            out.set(v.x(), v.y(), v.z());
        }
    }

    /**
     * @param {number} from - Pointer to the start point.
     * @param {number} to - Pointer to the end point.
     * @param {number} color - Pointer to the color.
     * @private
     */
    _drawLine(from, to, color) {
        this._read(from, _a);
        this._read(to, _b);

        if (this.range > 0 && this.center) {
            const rangeSq = this.range * this.range;
            const inA = distanceSq(_a, this.center) <= rangeSq;
            const inB = distanceSq(_b, this.center) <= rangeSq;
            const keep = this.cullPartial ? (inA && inB) : (inA || inB);
            if (!keep) {
                this._culled++;
                return;
            }
        }

        this._read(color, _c);
        this._push(_a, _b, _c);
    }

    /**
     * Draws a contact as its normal plus a small cross at the point.
     *
     * @param {number} point - Pointer to the contact point on the second body.
     * @param {number} normal - Pointer to the contact normal.
     * @param {number} color - Pointer to the color.
     * @private
     */
    _drawContactPoint(point, normal, color) {
        this._read(point, _a);
        this._read(normal, _b);
        this._read(color, _c);

        _b.mulScalar(CONTACT_NORMAL_LENGTH).add(_a);
        this._push(_a, _b, _c);

        const s = CONTACT_CROSS_SIZE;
        _b.set(_a.x - s, _a.y, _a.z);
        _d.set(_a.x + s, _a.y, _a.z);
        this._push(_b, _d, _c);
        _b.set(_a.x, _a.y - s, _a.z);
        _d.set(_a.x, _a.y + s, _a.z);
        this._push(_b, _d, _c);
        _b.set(_a.x, _a.y, _a.z - s);
        _d.set(_a.x, _a.y, _a.z + s);
        this._push(_b, _d, _c);
    }

    /**
     * @param {Vec3} a - The start point.
     * @param {Vec3} b - The end point.
     * @param {Vec3} c - The color as rgb.
     * @private
     */
    _push(a, b, c) {
        const i = this._count;
        if ((i + 1) * 6 > this._positions.length) {
            this._grow();
        }

        const positions = this._positions;
        let p = i * 6;
        positions[p++] = a.x;
        positions[p++] = a.y;
        positions[p++] = a.z;
        positions[p++] = b.x;
        positions[p++] = b.y;
        positions[p++] = b.z;

        const override = this.color;
        const r = override ? override.r : c.x;
        const g = override ? override.g : c.y;
        const bl = override ? override.b : c.z;
        const alpha = override ? override.a : 1;

        const colors = this._colors;
        let k = i * 8;
        colors[k++] = r;
        colors[k++] = g;
        colors[k++] = bl;
        colors[k++] = alpha;
        colors[k++] = r;
        colors[k++] = g;
        colors[k++] = bl;
        colors[k++] = alpha;

        this._count = i + 1;
    }

    /**
     * @private
     */
    _grow() {
        const positions = new Float32Array(this._positions.length * 2);
        positions.set(this._positions);
        this._positions = positions;

        const colors = new Float32Array(this._colors.length * 2);
        colors.set(this._colors);
        this._colors = colors;
    }
}

export { AmmoDebugDraw, DEBUG_DRAW };
