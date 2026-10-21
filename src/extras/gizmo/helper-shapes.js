import { Color } from '../../core/math/color.js';
import { math } from '../../core/math/math.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { PROJECTION_PERSPECTIVE } from '../../scene/constants.js';
import { MeshLine } from './mesh-line.js';
import { Readout } from './readout.js';
import { ArcShape } from './shape/arc-shape.js';
import { ArrowShape } from './shape/arrow-shape.js';
import { BoxShape } from './shape/box-shape.js';
import { ConeShape } from './shape/cone-shape.js';
import { SphereShape } from './shape/sphere-shape.js';

/**
 * @import { Entity } from '../../framework/entity.js'
 * @import { Gizmo } from './gizmo.js'
 * @import { Layer } from '../../scene/layer.js'
 * @import { Shape } from './shape/shape.js'
 */

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();
const tmpV4 = new Vec3();
const tmpV5 = new Vec3();
const tmpV6 = new Vec3();
const tmpDepth = new Vec3();
const tmpM = new Mat4();
const tmpX = new Vec3();
const tmpZ = new Vec3();
const tmpQ1 = new Quat();
const tmpBase = new Color();
const tmpOccluded = new Color();
const tmpIconA = new Vec3();
const tmpIconB = new Vec3();
const tmpIconC = new Vec3();
const tmpIconQ = new Quat();
const tmpClipA = new Vec3();
const tmpClipB = new Vec3();

const PIECE_RATIO = 1.5;
const MAX_PIECES = 32;

const TUBE_TOLERANCE = 0.25;

const DASH_PERIOD = 8;
const DASH_FRACTION = 0.5;
const MAX_DASHES = 24;
const MAX_LINE_DASHES = 256;

const SECTOR_TOLERANCE = 0.5;

const CONES = {
    cone: { segments: 32 },
    disk: { segments: 32, peakRadius: 1 },
    triangle: { segments: 3 },
    frustum: { segments: 4, twist: 45 }
};

const PEAK_TOLERANCE = 1e-3;

const ICON_WEIGHT = 0.8;
const ICON_BACKDROP_RADIUS = 14;
const ICON_BACKDROP = Object.freeze(new Color(0.05, 0.055, 0.07, 0.6));


/**
 * @typedef {object} HelperShapesTheme
 * @property {Color} base - The color where the shapes are visible.
 * @property {Color} occluded - The color where the scene hides the shapes.
 * @property {Color} fill - The color of filled volumes.
 */

/**
 * @typedef {object} Item
 * @property {Entity} entity - The entity placed each frame.
 * @property {MeshLine | Shape} shape - The pooled shape.
 * @property {Color} base - The color the shape was created with, updated in place.
 * @property {Color} occluded - The occluded color the shape was created with, updated in place.
 */

/**
 * A pool of shapes, placed in order each frame and hidden when unused.
 *
 * @ignore
 */
class Pool {
    /** @type {Item[]} */
    items = [];

    count = 0;

    /**
     * @param {(base: Color, occluded: Color) => MeshLine | Shape} create - Creates a shape in the
     * supplied colors.
     * @param {Entity} parent - The parent of the shapes.
     */
    constructor(create, parent) {
        this._create = create;
        this._parent = parent;
    }

    /**
     * @returns {Item} The next shape, enabled.
     */
    next() {
        let item = this.items[this.count];
        if (!item) {
            const base = new Color();
            const occluded = new Color();
            const shape = this._create(base, occluded);
            this._parent.addChild(shape.entity);
            item = { entity: shape.entity, shape, base, occluded };
            this.items.push(item);
        }
        this.count++;
        item.entity.enabled = true;
        return item;
    }

    hide() {
        for (let i = this.count; i < this.items.length; i++) {
            this.items[i].entity.enabled = false;
        }
    }

    destroy() {
        this.items.forEach(item => item.shape.destroy());
        this.items.length = 0;
    }
}

/**
 * Pools of the gizmo shapes drawn by helper gizmos around world-sized geometry, with lines and
 * rings of a constant thickness on screen, handles of a constant size and text labels. Shapes are
 * placed each frame between {@link begin} and {@link end}, in world space, under the root of the
 * gizmo, which must not be rotated or scaled.
 *
 * @ignore
 */
class HelperShapes {
    /**
     * The line thickness in CSS pixels.
     *
     * @type {number}
     */
    lineThickness = 2;

    /**
     * The handle size in CSS pixels.
     *
     * @type {number}
     */
    handleSize = 7;

    /**
     * The color replacing the rgb of the theme colors, or null to keep them.
     *
     * @type {Color|null}
     */
    tint = null;

    /**
     * @type {Gizmo}
     * @private
     */
    _gizmo;

    /**
     * @type {HelperShapesTheme}
     * @private
     */
    _theme;

    /**
     * @type {Pool[]}
     * @private
     */
    _pools = [];

    /**
     * @type {Readout[]}
     * @private
     */
    _labels = [];

    /** @private */
    _labelCount = 0;

    /**
     * The world size of a pixel at unit depth in perspective, or at any depth in orthographic.
     *
     * @private
     */
    _pixel = 0;

    /** @private */
    _perspective = true;

    /**
     * The frame of the icon being placed.
     *
     * @private
     */
    _icon = {
        center: new Vec3(),
        right: new Vec3(),
        up: new Vec3(),
        forward: new Vec3(),
        rotation: new Quat(),
        pixel: 0
    };

    /**
     * @param {Gizmo} gizmo - The gizmo owning the shapes.
     * @param {HelperShapesTheme} theme - The theme, whose colors the shapes follow.
     * @param {Entity} [parent] - The parent of the shapes, which must not be rotated or scaled.
     * Defaults to the root of the gizmo.
     * @param {Layer} [layer] - The layer of the shapes, which must keep the scene depth for the
     * scene to hide them. Defaults to the layer of the gizmo.
     */
    constructor(gizmo, theme, parent = gizmo.root, layer = gizmo.layer) {
        this._gizmo = gizmo;
        this._theme = theme;
        this._parent = parent;

        const { app } = gizmo.camera.system;
        const device = app.graphicsDevice;
        const layers = [layer.id];
        const pool = (/** @type {(base: Color, occluded: Color) => MeshLine | Shape} */ create) => {
            const p = new Pool(create, parent);
            this._pools.push(p);
            return p;
        };
        const args = (/** @type {Color} */ base, /** @type {Color} */ occluded) => ({
            layers,
            defaultColor: base,
            hoverColor: base,
            occludedColor: occluded
        });

        this._lines = pool(() => new MeshLine(app, layer, { occluded: true }));
        this._rings = pool((base, occluded) => {
            const ring = new ArcShape(device, { ...args(base, occluded), ringRadius: 1 });
            ring.show('ring');
            return ring;
        });
        this._arcs = pool((base, occluded) => {
            const arc = new ArcShape(device, { ...args(base, occluded), ringRadius: 1, sectorAngle: 90 });
            arc.show('sector');
            return arc;
        });
        this._arrows = pool((base, occluded) => new ArrowShape(device, args(base, occluded)));
        this._boxes = pool((base, occluded) => new BoxShape(device, args(base, occluded)));
        this._handles = pool((base, occluded) => {
            const box = new BoxShape(device, args(base, occluded));
            gizmo.intersectShapes.push(box);
            return box;
        });
        this._spheres = pool((base, occluded) => new SphereShape(device, args(base, occluded)));

        /** @type {{ [K in keyof CONES]: Pool }} */
        this._cones = /** @type {any} */ ({});
        for (const kind of /** @type {(keyof CONES)[]} */ (Object.keys(CONES))) {
            this._cones[kind] = pool((base, occluded) => new ConeShape(device, { ...args(base, occluded), ...CONES[kind] }));
        }
    }

    /**
     * Starts placing the shapes of a frame.
     */
    begin() {
        const camera = this._gizmo.camera;
        const { width, height } = camera.system.app.graphicsDevice.clientRect;
        this._perspective = camera.projection === PROJECTION_PERSPECTIVE;
        const span = this._perspective ? 2 * Math.tan(0.5 * camera.fov * math.DEG_TO_RAD) : 2 * camera.orthoHeight;
        this._pixel = span / Math.max(camera.horizontalFov ? width : height, 1);

        for (let i = 0; i < this._pools.length; i++) {
            this._pools[i].count = 0;
        }
        this._labelCount = 0;
    }

    /**
     * Hides the shapes and labels not placed this frame.
     */
    end() {
        for (let i = 0; i < this._pools.length; i++) {
            this._pools[i].hide();
        }
        for (let i = this._labelCount; i < this._labels.length; i++) {
            this._labels[i].hide();
        }
    }

    /**
     * Hides every shape and label.
     */
    clear() {
        for (let i = 0; i < this._pools.length; i++) {
            this._pools[i].count = 0;
        }
        this._labelCount = 0;
        this.end();
    }

    /**
     * @param {Vec3} point - The world point.
     * @returns {number} The distance of the point in front of the camera, unclamped.
     * @private
     */
    _viewDepth(point) {
        const camera = this._gizmo.camera;
        return tmpDepth.sub2(point, camera.entity.getPosition()).dot(camera.entity.forward);
    }

    /**
     * @param {Vec3} point - The world point.
     * @returns {number} The depth of the point, as used for perspective scaling.
     * @private
     */
    _depth(point) {
        return this._perspective ? Math.max(this._viewDepth(point), this._gizmo.camera.nearClip) : 1;
    }

    /**
     * @param {Vec3} point - The world point.
     * @param {Vec3} out - The point relative to the gizmo root.
     * @returns {Vec3} The point relative to the gizmo root.
     * @private
     */
    _local(point, out) {
        return out.sub2(point, this._parent.getPosition());
    }

    /**
     * Sets the temporary colors, from the base or fill color of the theme.
     *
     * @param {number} alpha - The alpha factor.
     * @param {boolean} [volume] - Whether to use the fill color.
     * @param {Color|null} [color] - The color replacing the rgb, before the tint.
     * @private
     */
    _colors(alpha, volume = false, color = null) {
        const { base, occluded, fill } = this._theme;
        const source = volume ? fill : base;
        tmpBase.copy(source);
        tmpBase.a *= alpha;
        tmpOccluded.copy(occluded);
        tmpOccluded.a *= alpha * (volume ? fill.a : 1);
        const tint = color ?? this.tint;
        if (tint) {
            tmpBase.r = tmpOccluded.r = tint.r;
            tmpBase.g = tmpOccluded.g = tint.g;
            tmpBase.b = tmpOccluded.b = tint.b;
        }
    }

    /**
     * Places the next shape of a pool in the temporary colors, recoloring it only on change.
     *
     * @param {Pool} pool - The pool.
     * @returns {Shape} The shape.
     * @private
     */
    _next(pool) {
        const item = pool.next();
        const shape = /** @type {Shape} */ (item.shape);
        if (!item.base.equals(tmpBase) || !item.occluded.equals(tmpOccluded)) {
            item.base.copy(tmpBase);
            item.occluded.copy(tmpOccluded);
            shape.hover(false);
        }
        return shape;
    }

    /**
     * Places one piece of a line in the temporary colors.
     *
     * @param {Vec3} from - The start point.
     * @param {Vec3} to - The end point.
     * @param {number} weight - The thickness as a factor of the line thickness.
     * @private
     */
    _piece(from, to, weight) {
        const mid = tmpV3.lerp(from, to, 0.5);
        const line = /** @type {MeshLine} */ (this._lines.next().shape);
        line.thickness = weight * this.lineThickness * this._pixel * this._depth(mid);
        line.draw(this._local(from, tmpV4), this._local(to, tmpV5), 1, tmpBase, tmpOccluded);
    }

    /**
     * Gets the size of a sphere on screen.
     *
     * @param {Vec3} center - The world center.
     * @param {number} radius - The radius.
     * @returns {number} The approximate radius on screen in CSS pixels.
     */
    screenSize(center, radius) {
        return radius / (this._pixel * this._depth(center));
    }

    /**
     * Gets the world size of a length on screen at a point.
     *
     * @param {Vec3} point - The world point.
     * @param {number} count - The length in CSS pixels.
     * @returns {number} The world size.
     */
    pixels(point, count) {
        return count * this._pixel * this._depth(point);
    }

    /**
     * Adds a line between two world points, split into pieces along its depth.
     *
     * @param {Vec3} a - The start point.
     * @param {Vec3} b - The end point.
     * @param {number} [weight] - The thickness as a factor of the line thickness.
     * @param {number} [alpha] - The alpha factor.
     * @param {Color|null} [color] - The color replacing the rgb of the theme colors.
     */
    line(a, b, weight = 1, alpha = 1, color = null) {
        // keep the part in front of the near plane
        if (this._perspective) {
            const near = this._gizmo.camera.nearClip;
            const v0 = this._viewDepth(a);
            const v1 = this._viewDepth(b);
            if (v0 < near && v1 < near) {
                return;
            }
            if (v0 < near) {
                a = tmpClipA.lerp(a, b, (near - v0) / (v1 - v0));
            } else if (v1 < near) {
                b = tmpClipB.lerp(b, a, (near - v1) / (v0 - v1));
            }
        }

        // pieces grow geometrically away from the near end, as the depth does along them
        let d0 = this._depth(a);
        let d1 = this._depth(b);
        if (d0 > d1) {
            [a, b] = [b, a];
            [d0, d1] = [d1, d0];
        }
        const ratio = d1 / d0;
        const pieces = ratio < PIECE_RATIO ? 1 :
            Math.min(MAX_PIECES, Math.ceil(Math.log(ratio) / Math.log(PIECE_RATIO)));

        this._colors(alpha, false, color);
        for (let i = 0; i < pieces; i++) {
            const t0 = pieces === 1 ? 0 : (ratio ** (i / pieces) - 1) / (ratio - 1);
            const t1 = pieces === 1 ? 1 : (ratio ** ((i + 1) / pieces) - 1) / (ratio - 1);
            this._piece(tmpV1.lerp(a, b, t0), tmpV2.lerp(a, b, t1), weight);
        }
    }

    /**
     * Adds a dashed line between two world points, the dashes evenly spaced on screen.
     *
     * @param {Vec3} a - The start point.
     * @param {Vec3} b - The end point.
     * @param {number} [weight] - The thickness as a factor of the line thickness.
     * @param {number} [alpha] - The alpha factor.
     * @param {Color|null} [color] - The color replacing the rgb of the theme colors.
     */
    dashed(a, b, weight = 1, alpha = 1, color = null) {
        const camera = this._gizmo.camera;
        const start = tmpV1.copy(a);
        const end = tmpV2.copy(b);
        let d0 = 1;
        let d1 = 1;

        // keep the part in front of the near plane
        if (this._perspective) {
            const near = camera.nearClip;
            d0 = this._viewDepth(start);
            d1 = this._viewDepth(end);
            if (d0 < near && d1 < near) {
                return;
            }
            if (d0 < near) {
                start.lerp(start, end, (near - d0) / (d1 - d0));
                d0 = near;
            } else if (d1 < near) {
                end.lerp(end, start, (near - d1) / (d0 - d1));
                d1 = near;
            }
        }

        const s0 = camera.worldToScreen(start, tmpV3);
        const s1 = camera.worldToScreen(end, tmpV4);
        const length = Math.hypot(s1.x - s0.x, s1.y - s0.y);
        if (length < 1) {
            return;
        }

        // dashes a fixed distance apart on screen from the start, so moving the end only grows or
        // shrinks the last dash, where a point a fraction s of the way across the screen is a
        // fraction t = s d0 / (d1 - s (d1 - d0)) along the line
        const period = Math.max(DASH_PERIOD, length / MAX_LINE_DASHES) / length;
        const dashes = Math.ceil(1 / period);
        const along = (/** @type {number} */ s) => s * d0 / (d1 - s * (d1 - d0));
        this._colors(alpha, false, color);
        for (let i = 0; i < dashes; i++) {
            const from = tmpV5.lerp(start, end, along(i * period));
            const to = tmpV6.lerp(start, end, along(Math.min((i + DASH_FRACTION) * period, 1)));
            this._piece(from, to, weight);
        }
    }

    /**
     * Adds an arc, a sector of a ring.
     *
     * @param {Vec3} center - The world center.
     * @param {Vec3} x - The unit direction at angle 0.
     * @param {Vec3} y - The unit direction at a quarter turn.
     * @param {number} radius - The radius.
     * @param {number} from - The start angle in radians.
     * @param {number} to - The end angle in radians.
     * @param {number} [weight] - The thickness as a factor of the line thickness.
     * @param {number} [alpha] - The alpha factor.
     * @param {Color|null} [color] - The color replacing the rgb of the theme colors.
     */
    arc(center, x, y, radius, from, to, weight = 1, alpha = 1, color = null) {
        if (to < from) {
            [from, to] = [to, from];
        }
        const tube = this._tube(center, radius, weight);
        const sector = (to - from) * math.RAD_TO_DEG;

        this._colors(alpha, false, color);
        const arc = /** @type {ArcShape} */ (this._next(this._arcs));

        // rebuilding the torus is costly, so only once the tube or sector is well off
        if (Math.abs(arc.tubeRadius - tube) > tube * TUBE_TOLERANCE) {
            arc.tubeRadius = tube;
        }
        if (Math.abs(arc.sectorAngle - sector) > SECTOR_TOLERANCE) {
            arc.sectorAngle = sector;
        }

        // the torus sweeps from its x axis towards its z axis, about its y axis
        const start = tmpV1.copy(x).mulScalar(Math.cos(from)).add(tmpV3.copy(y).mulScalar(Math.sin(from)));
        const side = tmpV2.copy(x).mulScalar(-Math.sin(from)).add(tmpV3.copy(y).mulScalar(Math.cos(from)));
        const normal = tmpV3.cross(side, start);
        const d = tmpM.setIdentity().data;
        d[0] = start.x;
        d[1] = start.y;
        d[2] = start.z;
        d[4] = normal.x;
        d[5] = normal.y;
        d[6] = normal.z;
        d[8] = side.x;
        d[9] = side.y;
        d[10] = side.z;

        arc.entity.setLocalPosition(this._local(center, tmpV1));
        arc.entity.setLocalRotation(tmpQ1.setFromMat4(tmpM));
        arc.entity.setLocalScale(radius, radius, radius);
    }

    /**
     * Gets the tube radius of a unit torus scaled to a ring, for a constant thickness on screen.
     *
     * @param {Vec3} center - The world center.
     * @param {number} radius - The radius.
     * @param {number} weight - The thickness as a factor of the line thickness.
     * @returns {number} The tube radius.
     * @private
     */
    _tube(center, radius, weight) {
        // the distance to the visible part of the ring, which may surround the camera
        const camera = this._gizmo.camera;
        const dist = Math.hypot(center.distance(camera.entity.getPosition()), radius);
        const depth = this._perspective ? Math.max(dist, camera.nearClip) : 1;
        return 0.5 * weight * this.lineThickness * this._pixel * depth / radius;
    }

    /**
     * Adds a ring, lying in the xz plane of the supplied rotation.
     *
     * @param {Vec3} center - The world center.
     * @param {Quat} rotation - The world rotation.
     * @param {number} radius - The radius.
     * @param {number} [weight] - The thickness as a factor of the line thickness.
     * @param {number} [alpha] - The alpha factor.
     */
    ring(center, rotation, radius, weight = 1, alpha = 1) {
        const tube = this._tube(center, radius, weight);

        this._colors(alpha);
        const ring = /** @type {ArcShape} */ (this._next(this._rings));

        // rebuilding the torus is costly, so only once the tube is well off
        if (Math.abs(ring.tubeRadius - tube) > tube * TUBE_TOLERANCE) {
            ring.tubeRadius = tube;
        }

        ring.entity.setLocalPosition(this._local(center, tmpV1));
        ring.entity.setLocalRotation(rotation);
        ring.entity.setLocalScale(radius, radius, radius);
    }

    /**
     * Adds a ring facing the supplied normal.
     *
     * @param {Vec3} center - The world center.
     * @param {Vec3} normal - The ring normal. Need not be normalized.
     * @param {number} radius - The radius.
     * @param {number} [weight] - The thickness as a factor of the line thickness.
     * @param {number} [alpha] - The alpha factor.
     */
    circle(center, normal, radius, weight = 1, alpha = 1) {
        this.ring(center, tmpQ1.setFromDirections(Vec3.UP, tmpV2.copy(normal).normalize()), radius, weight, alpha);
    }

    /**
     * Adds a dashed ring facing the supplied normal, each dash a chord.
     *
     * @param {Vec3} center - The world center.
     * @param {Vec3} normal - The ring normal. Need not be normalized.
     * @param {number} radius - The radius.
     * @param {number} [weight] - The thickness as a factor of the line thickness.
     * @param {number} [alpha] - The alpha factor.
     */
    dashedCircle(center, normal, radius, weight = 1, alpha = 1) {
        const rotation = tmpQ1.setFromDirections(Vec3.UP, tmpV1.copy(normal).normalize());
        const x = rotation.transformVector(Vec3.RIGHT, tmpX);
        const z = rotation.transformVector(Vec3.BACK, tmpZ);
        const dashes = math.clamp(Math.round(2 * Math.PI * this.screenSize(center, radius) / DASH_PERIOD), 8, MAX_DASHES);
        const step = 2 * Math.PI / dashes;
        this._colors(alpha);
        for (let i = 0; i < dashes; i++) {
            const a0 = i * step;
            const a1 = a0 + DASH_FRACTION * step;
            const from = tmpV1.copy(x).mulScalar(Math.cos(a0) * radius).add(tmpV3.copy(z).mulScalar(Math.sin(a0) * radius)).add(center);
            const to = tmpV2.copy(x).mulScalar(Math.cos(a1) * radius).add(tmpV3.copy(z).mulScalar(Math.sin(a1) * radius)).add(center);
            this._piece(from, to, weight);
        }
    }

    /**
     * Adds an arrow pointing along the y axis of the supplied rotation.
     *
     * @param {Vec3} position - The world position of the arrow base.
     * @param {Quat} rotation - The world rotation.
     * @param {number} scale - The scale, as for a transform gizmo.
     */
    arrow(position, rotation, scale) {
        this._colors(1);
        const arrow = this._next(this._arrows);
        arrow.entity.setLocalPosition(this._local(position, tmpV1));
        arrow.entity.setLocalRotation(rotation);
        arrow.entity.setLocalScale(scale, scale, scale);
    }

    /**
     * Adds a handle, a cube of a constant size on screen, which the gizmo picks.
     *
     * @param {Vec3} position - The world position.
     * @param {Color|null} [hover] - The color of a hovered handle, or null for the theme color.
     * @returns {BoxShape} The handle shape.
     */
    handle(position, hover = null) {
        const { base, occluded } = this._theme;
        tmpBase.copy(hover ?? base);
        tmpBase.a = base.a;
        tmpOccluded.copy(hover ?? occluded);
        tmpOccluded.a = occluded.a;
        const box = /** @type {BoxShape} */ (this._next(this._handles));
        box.entity.setLocalPosition(this._local(position, tmpV1));
        box.entity.setLocalRotation(Quat.IDENTITY);
        box.size = this.handleSize * this._pixel * this._depth(position);
        return box;
    }

    /**
     * Adds a dot, a sphere of a constant size on screen.
     *
     * @param {Vec3} position - The world position.
     * @param {number} radius - The radius in CSS pixels.
     */
    dot(position, radius) {
        this._colors(1);
        const sphere = /** @type {SphereShape} */ (this._next(this._spheres));
        sphere.entity.setLocalPosition(this._local(position, tmpV1));
        sphere.radius = radius * this._pixel * this._depth(position);
    }

    /**
     * Adds a filled box.
     *
     * @param {Vec3} center - The world center.
     * @param {Quat} rotation - The world rotation.
     * @param {Vec3} size - The size along each axis of the rotation.
     * @param {number} [alpha] - The alpha factor.
     * @param {boolean} [volume] - Whether to use the theme fill color rather than the base color.
     */
    box(center, rotation, size, alpha = 1, volume = true) {
        this._colors(alpha, volume);
        const box = this._next(this._boxes);
        box.entity.setLocalPosition(this._local(center, tmpV1));
        box.entity.setLocalRotation(rotation);
        box.entity.setLocalScale(size);
    }

    /**
     * Adds a filled sphere.
     *
     * @param {Vec3} center - The world center.
     * @param {number} radius - The radius.
     * @param {number} [alpha] - The alpha factor.
     */
    sphere(center, radius, alpha = 1) {
        this._colors(alpha, true);
        const sphere = /** @type {SphereShape} */ (this._next(this._spheres));
        sphere.entity.setLocalPosition(this._local(center, tmpV1));
        sphere.radius = radius;
    }

    /**
     * Adds a filled unit cone along the y axis of the rotation, its base at y = -0.5. A disk is a
     * cylinder and a triangle a three sided pyramid, both meant to be flattened by the size, and a
     * frustum a four sided pyramid with square sides along the x and z axes.
     *
     * @param {keyof CONES} kind - The kind of cone.
     * @param {Vec3} center - The world center.
     * @param {Quat} rotation - The world rotation.
     * @param {Vec3} size - The size along each axis of the rotation, where a size of 1 gives a
     * base radius of 0.5.
     * @param {number} [alpha] - The alpha factor.
     * @param {boolean} [volume] - Whether to use the theme fill color rather than the base color.
     * @param {number} [peak] - The peak radius of a frustum, as a fraction of its base radius.
     */
    cone(kind, center, rotation, size, alpha = 1, volume = true, peak = 0) {
        this._colors(alpha, volume);
        const cone = /** @type {ConeShape} */ (this._next(this._cones[kind]));
        if (kind === 'frustum' && Math.abs(cone.peakRadius - peak) > PEAK_TOLERANCE) {
            cone.peakRadius = peak;
        }
        cone.entity.setLocalPosition(this._local(center, tmpV1));
        cone.entity.setLocalRotation(rotation);
        cone.entity.setLocalScale(size);
    }

    /**
     * Places a line of an icon, in CSS pixels from its center, x to the right and y up the screen.
     *
     * @param {number} x0 - The start x.
     * @param {number} y0 - The start y.
     * @param {number} x1 - The end x.
     * @param {number} y1 - The end y.
     * @private
     */
    _iconLine(x0, y0, x1, y1) {
        const { center, right, up, pixel } = this._icon;
        const a = tmpIconA.copy(right).mulScalar(x0 * pixel).add(tmpIconB.copy(up).mulScalar(y0 * pixel)).add(center);
        const b = tmpIconB.copy(right).mulScalar(x1 * pixel).add(tmpIconC.copy(up).mulScalar(y1 * pixel)).add(center);
        this.line(a, b, ICON_WEIGHT);
    }

    /**
     * Places a disc of an icon facing the camera.
     *
     * @param {number} radius - The radius in CSS pixels.
     * @param {Color|null} color - The color replacing the rgb of the theme color.
     * @param {number} alpha - The alpha factor.
     * @param {number} [back] - How far behind the icon to place the disc, in CSS pixels.
     * @private
     */
    _iconDisc(radius, color, alpha, back = 0) {
        const { center, forward, pixel, rotation } = this._icon;
        const size = 2 * radius * pixel;
        this._colors(alpha, false, color);
        const disc = this._next(this._cones.disk);
        disc.entity.setLocalPosition(this._local(tmpIconA.copy(forward).mulScalar(back * pixel).add(center), tmpIconA));
        disc.entity.setLocalRotation(rotation);
        disc.entity.setLocalScale(size, 1e-3 * size, size);
    }

    /**
     * Adds an icon at a point, a glyph of a constant size on screen facing the camera over a faint
     * dark backdrop, as Blender draws at the origin of a light.
     *
     * - `omni` is a ring around a dot.
     * - `spot` adds a tick to the ring, pointing the way the light shines.
     * - `sun` is a dot with eight spokes.
     * - `area` is a square around a dot.
     * - `camera` is a camera body with a lens.
     *
     * @param {'omni' | 'spot' | 'sun' | 'area' | 'camera'} kind - The icon.
     * @param {Vec3} position - The world position.
     * @param {Vec3} [dir] - The direction a spot light shines.
     */
    icon(kind, position, dir) {
        const camera = this._gizmo.camera.entity;
        const icon = this._icon;
        icon.center.copy(position);
        icon.right.copy(camera.right);
        icon.up.copy(camera.up);
        icon.forward.copy(camera.forward);
        icon.pixel = this.pixels(position, 1);
        icon.rotation.setFromDirections(Vec3.UP, camera.forward);

        this._iconDisc(ICON_BACKDROP_RADIUS, ICON_BACKDROP, ICON_BACKDROP.a, 1);
        switch (kind) {
            case 'omni':
            case 'spot': {
                this.circle(position, camera.forward, 8 * icon.pixel, ICON_WEIGHT);
                this._iconDisc(3.5, null, 1);
                if (kind === 'spot' && dir) {
                    // the tick points the way the light shines on screen
                    const x = dir.dot(icon.right);
                    const y = dir.dot(icon.up);
                    const length = Math.hypot(x, y);
                    if (length > 1e-3) {
                        this._iconLine(8 * x / length, 8 * y / length, 13 * x / length, 13 * y / length);
                    }
                }
                break;
            }
            case 'sun': {
                this._iconDisc(4.5, null, 1);
                for (let i = 0; i < 8; i++) {
                    const angle = i * Math.PI / 4;
                    const x = Math.cos(angle);
                    const y = Math.sin(angle);
                    this._iconLine(7.5 * x, 7.5 * y, 10.5 * x, 10.5 * y);
                }
                break;
            }
            case 'area': {
                this._iconLine(-7, -7, 7, -7);
                this._iconLine(7, -7, 7, 7);
                this._iconLine(7, 7, -7, 7);
                this._iconLine(-7, 7, -7, -7);
                this._iconDisc(2.5, null, 1);
                break;
            }
            case 'camera': {
                this._iconLine(-8, -5, 3, -5);
                this._iconLine(3, -5, 3, 5);
                this._iconLine(3, 5, -8, 5);
                this._iconLine(-8, 5, -8, -5);

                // the lens, a triangle widening to the right, flattened onto the screen
                const { right, up, forward, pixel } = icon;
                const d = tmpM.setIdentity().data;
                const back = tmpIconC.copy(forward).mulScalar(-1);
                d[0] = up.x;
                d[1] = up.y;
                d[2] = up.z;
                d[4] = back.x;
                d[5] = back.y;
                d[6] = back.z;
                d[8] = right.x;
                d[9] = right.y;
                d[10] = right.z;
                const height = 5 / 0.75;
                const lens = tmpIconA.copy(right).mulScalar((9 - 0.25 * height) * pixel).add(position);
                this.cone('triangle', lens, tmpIconQ.setFromMat4(tmpM), tmpIconB.set(8 / (0.5 * Math.sqrt(3)) * pixel, 1e-3 * pixel, height * pixel), 1, false);
                break;
            }
        }
    }

    /**
     * Adds a text label centered just below a world point, in the style of the transform readout.
     *
     * @param {Vec3} position - The world position.
     * @param {string} html - The label markup.
     */
    label(position, html) {
        if (this._perspective && this._viewDepth(position) < this._gizmo.camera.nearClip) {
            return;
        }
        let label = this._labels[this._labelCount];
        if (!label) {
            label = new Readout(this._gizmo.camera.system.app.graphicsDevice.canvas);
            this._labels.push(label);
        }
        this._labelCount++;
        const screen = this._gizmo.camera.worldToScreen(position, tmpV1);
        label.show(html, screen.x, screen.y);
    }

    /**
     * Destroys the shapes and labels. Safe to call again.
     */
    destroy() {
        this._pools.forEach(pool => pool.destroy());
        this._labels.forEach(label => label.destroy());
        this._labels.length = 0;
    }
}

export { HelperShapes };
