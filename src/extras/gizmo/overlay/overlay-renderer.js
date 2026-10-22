import { Color } from '../../../core/math/color.js';
import { math } from '../../../core/math/math.js';
import { Mat4 } from '../../../core/math/mat4.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { PROJECTION_PERSPECTIVE } from '../../../scene/constants.js';
import { MeshLineBatch } from '../mesh/mesh-line-batch.js';
import { Pool } from '../pool.js';
import { getIconTextures } from './icon-textures.js';
import { OverlayIcons } from './overlay-icons.js';
import { Readout } from './readout.js';
import { ShapePool } from './shape-pool.js';
import { ArcShape } from '../shape/arc-shape.js';
import { ArrowShape } from '../shape/arrow-shape.js';
import { BoxShape } from '../shape/box-shape.js';
import { CapsuleShape } from '../shape/capsule-shape.js';
import { ConeShape } from '../shape/cone-shape.js';
import { GlyphShape } from '../shape/glyph-shape.js';
import { SphereShape } from '../shape/sphere-shape.js';

/**
 * @import { Entity } from '../../../framework/entity.js'
 * @import { Gizmo } from '../gizmo.js'
 * @import { Layer } from '../../../scene/layer.js'
 * @import { OverlayIcon } from './icon-glyphs.js'
 * @import { Shape } from '../shape/shape.js'
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
const tmpClipA = new Vec3();
const tmpClipB = new Vec3();

const PIECE_RATIO = 1.5;
const MAX_PIECES = 32;

const TUBE_TOLERANCE = 0.25;

// dash period as a multiple of the line thickness
const DASH_PERIOD = 4;
const DASH_FRACTION = 0.5;
const MAX_DASHES = 24;
const MAX_LINE_DASHES = 256;

const SECTOR_TOLERANCE = 0.5;

const CONES = {
    cone: { segments: 32 },
    disk: { segments: 32, peakRadius: 1 },
    cylinder: { segments: 32, peakRadius: 1 },
    triangle: { segments: 3 },
    frustum: { segments: 4, twist: 45 }
};

const PEAK_TOLERANCE = 1e-3;
const FILL_DEPTH_BIAS = 2;

// placements count up from the start of their band, so a frame draws in placement order with
// the fills first, whatever order the layer added the shapes in
const FILL_DRAW_ORDER = 0;
const SHAPE_DRAW_ORDER = 1 << 20;

/**
 * @typedef {object} OverlayRendererTheme
 * @property {Color} base - The color where the shapes are visible.
 * @property {Color} occluded - The color where the scene hides the shapes.
 * @property {Color} [fill] - The color of filled volumes, needed only to place them.
 * @property {Color} [backdrop] - The color of the icon backdrops, needed only to place icons.
 */

/**
 * Pooled shapes drawn each frame between {@link begin} and {@link end}: lines and rings of a
 * constant screen thickness, handles of a constant screen size, labels and icons. Placed in world
 * space under a parent that must not be rotated or scaled.
 *
 * @ignore
 */
class OverlayRenderer {
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
     * The icon size in CSS pixels.
     *
     * @type {number}
     */
    iconSize = 24;

    /**
     * The rgb replacing the theme colors, or null to keep them.
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
     * @type {OverlayRendererTheme}
     * @private
     */
    _theme;

    /**
     * Gets the theme the shapes follow.
     *
     * @type {OverlayRendererTheme}
     */
    get theme() {
        return this._theme;
    }

    /**
     * @type {ShapePool[]}
     * @private
     */
    _pools = [];

    /**
     * @type {Pool<Readout>}
     * @private
     */
    _labels;

    /**
     * The world size of a pixel at unit depth, or at any depth in orthographic.
     *
     * @private
     */
    _pixel = 0;

    /**
     * @private
     */
    _perspective = true;

    /**
     * The number of draw orders taken this frame.
     *
     * @private
     */
    _order = 0;

    /**
     * The layer the shapes stay on, or null to follow the layer of the gizmo.
     *
     * @type {Layer|null}
     * @private
     */
    _fixedLayer;

    /**
     * The layer of the shapes.
     *
     * @type {Layer}
     * @private
     */
    _layer;

    /**
     * The icons drawn with the shapes.
     *
     * @type {OverlayIcons}
     */
    icons;

    /**
     * @param {Gizmo} gizmo - The gizmo owning the shapes.
     * @param {OverlayRendererTheme} theme - The theme, whose colors the shapes follow.
     * @param {Entity} [parent] - The parent of the shapes, which must not be rotated or scaled.
     * Defaults to the root of the gizmo.
     * @param {Layer|null} [layer] - The layer of the shapes, which must keep the scene depth.
     * Defaults to following the layer of the gizmo.
     */
    constructor(gizmo, theme, parent = gizmo.root, layer = null) {
        this._gizmo = gizmo;
        this._theme = theme;
        this._parent = parent;
        this._fixedLayer = layer;
        this._layer = layer ?? gizmo.layer;

        const { app } = gizmo.camera.system;
        const device = app.graphicsDevice;
        this._labels = new Pool(() => new Readout(device.canvas));

        this.icons = new OverlayIcons(this, gizmo);

        // filled shapes draw first in a manually sorted layer, so they hide the lines behind them
        const pool = (/** @type {(base: Color, occluded: Color) => Shape} */ create, drawOrder = SHAPE_DRAW_ORDER) => {
            const p = new ShapePool(create, parent, drawOrder);
            this._pools.push(p);
            return p;
        };

        // shapes are created lazily, so they take the current layer
        const args = (/** @type {Color} */ base, /** @type {Color} */ occluded) => ({
            layers: [this._layer.id],
            defaultColor: base,
            hoverColor: base,
            occludedColor: occluded
        });

        this._lines = new MeshLineBatch(app, this._layer, parent, SHAPE_DRAW_ORDER);
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

        // filled shapes sit just behind their surface, so lines and matching meshes don't z-fight
        const filled = (/** @type {Shape} */ shape) => {
            shape.depthBias = FILL_DEPTH_BIAS;
            return shape;
        };
        this._boxes = pool((base, occluded) => filled(new BoxShape(device, args(base, occluded))), FILL_DRAW_ORDER);

        // bracket arms draw over the shapes behind them
        this._arms = pool((base, occluded) => {
            const arm = new BoxShape(device, args(base, occluded));
            arm.depthWrite = false;
            return arm;
        });
        this._handles = pool((base, occluded) => {
            const box = new BoxShape(device, args(base, occluded));
            gizmo.intersectShapes.push(box);
            return box;
        });
        this._pickDiscs = pool((base, occluded) => {
            const disc = new ConeShape(device, { ...args(base, occluded), ...CONES.disk });
            gizmo.intersectShapes.push(disc);
            return disc;
        });
        this._spheres = pool((base, occluded) => filled(new SphereShape(device, args(base, occluded))), FILL_DRAW_ORDER);
        this._capsules = pool((base, occluded) => filled(new CapsuleShape(device, args(base, occluded))), FILL_DRAW_ORDER);

        const cone = (/** @type {keyof CONES} */ kind) => pool((base, occluded) => filled(new ConeShape(device, { ...args(base, occluded), ...CONES[kind] })), FILL_DRAW_ORDER);
        /**
         * The pools of each kind of cone.
         *
         * @type {{ [K in keyof CONES]: ShapePool }}
         */
        this._cones = {
            cone: cone('cone'),
            disk: cone('disk'),
            cylinder: cone('cylinder'),
            triangle: cone('triangle'),
            frustum: cone('frustum')
        };

        const textures = getIconTextures(device);
        /**
         * The pools of each icon glyph.
         *
         * @type {Record<OverlayIcon, ShapePool>}
         */
        this._glyphs = /** @type {Record<OverlayIcon, ShapePool>} */ ({});
        for (const [kind, texture] of Object.entries(textures)) {
            this._glyphs[/** @type {OverlayIcon} */ (kind)] = pool((base, occluded) => new GlyphShape(device, { ...args(base, occluded), texture }));
        }
    }

    /**
     * Starts a frame.
     */
    begin() {
        const camera = this._gizmo.camera;
        const { width, height } = camera.system.app.graphicsDevice.clientRect;
        this._perspective = camera.projection === PROJECTION_PERSPECTIVE;
        const span = this._perspective ? 2 * Math.tan(0.5 * camera.fov * math.DEG_TO_RAD) : 2 * camera.orthoHeight;
        this._pixel = span / Math.max(this._perspective && camera.horizontalFov ? width : height, 1);

        const layer = this._fixedLayer ?? this._gizmo.layer;
        if (layer !== this._layer) {
            this._moveTo(layer);
        }

        for (let i = 0; i < this._pools.length; i++) {
            this._pools[i].count = 0;
        }
        this._lines.begin();
        this._lines.drawOrder = SHAPE_DRAW_ORDER;
        this._order = 0;
        this._labels.count = 0;
        this.icons.begin();
    }

    /**
     * Moves the shapes to a layer.
     *
     * @param {Layer} layer - The layer.
     * @private
     */
    _moveTo(layer) {
        this._layer = layer;
        this._lines.layer = layer;
        const ids = [layer.id];
        for (let i = 0; i < this._pools.length; i++) {
            const { items } = this._pools[i];
            for (let j = 0; j < items.length; j++) {
                items[j].entity.forEach((node) => {
                    const { render } = /** @type {Entity} */ (node);
                    if (render) {
                        render.layers = ids;
                    }
                });
            }
        }
    }

    /**
     * Hides the shapes not placed this frame.
     */
    end() {
        for (let i = 0; i < this._pools.length; i++) {
            this._pools[i].hide();
        }
        this._lines.end();
        const labels = this._labels;
        for (let i = labels.count; i < labels.items.length; i++) {
            labels.items[i].hide();
        }
    }

    /**
     * Hides every shape and label.
     */
    clear() {
        for (let i = 0; i < this._pools.length; i++) {
            this._pools[i].count = 0;
        }
        this._lines.begin();
        this._labels.count = 0;
        this.icons.begin();
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
     * Sets the temporary colors from the theme.
     *
     * @param {number} alpha - The alpha factor.
     * @param {boolean} [volume] - Whether to use the fill color.
     * @param {Color|null} [color] - The color replacing the rgb, before the tint.
     * @private
     */
    _colors(alpha, volume = false, color = null) {
        const { base, occluded } = this._theme;
        const fill = /** @type {Color} */ (this._theme.fill);
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
     * Places the next shape of a pool after those placed before it, recoloring it only on change.
     *
     * @param {ShapePool} pool - The pool.
     * @returns {Shape} The shape.
     * @private
     */
    _next(pool) {
        const item = pool.next();
        const order = pool.drawOrder + ++this._order;
        const { meshInstances } = item;
        for (let i = 0; i < meshInstances.length; i++) {
            meshInstances[i].drawOrder = order;
        }

        // start a new line run, so later lines draw over this shape
        this._lines.split();
        this._lines.drawOrder = SHAPE_DRAW_ORDER + ++this._order;
        const shape = item.shape;
        if (!item.base.equals(tmpBase) || !item.occluded.equals(tmpOccluded)) {
            item.base.copy(tmpBase);
            item.occluded.copy(tmpOccluded);
            shape.hover(false);
        }
        return shape;
    }

    /**
     * Places one piece of a line.
     *
     * @param {Vec3} from - The start point.
     * @param {Vec3} to - The end point.
     * @param {number} weight - The thickness as a factor of the line thickness.
     * @private
     */
    _piece(from, to, weight) {
        const mid = tmpV3.lerp(from, to, 0.5);
        const thickness = weight * this.lineThickness * this._pixel * this._depth(mid);
        this._lines.add(this._local(from, tmpV4), this._local(to, tmpV5), thickness, tmpBase, tmpOccluded);
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
     * Gets the world size of a screen length at a point.
     *
     * @param {Vec3} point - The world point.
     * @param {number} count - The length in CSS pixels.
     * @returns {number} The world size.
     */
    pixels(point, count) {
        return count * this._pixel * this._depth(point);
    }

    /**
     * Adds a line between two world points.
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

        // split into pieces growing with depth, so the thickness stays constant on screen
        let d0 = this._depth(a);
        let d1 = this._depth(b);
        if (d0 > d1) {
            const point = a;
            a = b;
            b = point;
            const depth = d0;
            d0 = d1;
            d1 = depth;
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

        // dashes are spaced on screen from the start, so moving the end only changes the last
        // dash; screen fraction s maps to line fraction s d0 / (d1 - s (d1 - d0))
        const period = Math.max(DASH_PERIOD * this.lineThickness, length / MAX_LINE_DASHES) / length;
        const dashes = Math.ceil(1 / period);
        this._colors(alpha, false, color);
        for (let i = 0; i < dashes; i++) {
            const u0 = i * period;
            const u1 = Math.min((i + DASH_FRACTION) * period, 1);
            const from = tmpV5.lerp(start, end, u0 * d0 / (d1 - u0 * (d1 - d0)));
            const to = tmpV6.lerp(start, end, u1 * d0 / (d1 - u1 * (d1 - d0)));
            this._piece(from, to, weight);
        }
    }

    /**
     * Adds an arc.
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
            const angle = from;
            from = to;
            to = angle;
        }
        const tube = this._tube(center, radius, weight);
        const sector = (to - from) * math.RAD_TO_DEG;

        this._colors(alpha, false, color);
        const arc = /** @type {ArcShape} */ (this._next(this._arcs));

        // rebuilding the torus is costly, so only rebuild once well off
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
     * Gets the tube radius of a unit torus for a constant screen thickness.
     *
     * @param {Vec3} center - The world center.
     * @param {number} radius - The radius.
     * @param {number} weight - The thickness as a factor of the line thickness.
     * @returns {number} The tube radius.
     * @private
     */
    _tube(center, radius, weight) {

        // the ring may surround the camera, so use the distance to its edge
        const camera = this._gizmo.camera;
        const dist = Math.hypot(center.distance(camera.entity.getPosition()), radius);
        const depth = this._perspective ? Math.max(dist, camera.nearClip) : 1;
        return 0.5 * weight * this.lineThickness * this._pixel * depth / radius;
    }

    /**
     * Adds a ring in the xz plane of the rotation.
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

        // rebuilding the torus is costly, so only rebuild once well off
        if (Math.abs(ring.tubeRadius - tube) > tube * TUBE_TOLERANCE) {
            ring.tubeRadius = tube;
        }

        ring.entity.setLocalPosition(this._local(center, tmpV1));
        ring.entity.setLocalRotation(rotation);
        ring.entity.setLocalScale(radius, radius, radius);
    }

    /**
     * Adds a ring facing the normal.
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
     * Adds a dashed ring facing the normal.
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
        const size = this.screenSize(center, radius);
        const dashes = math.clamp(Math.round(2 * Math.PI * size / (DASH_PERIOD * this.lineThickness)), 8, MAX_DASHES);
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
     * Adds an arrow along the y axis of the rotation.
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
     * Adds a pickable handle, a cube of a constant screen size.
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
     * Adds a corner bracket arm along a world axis, overhanging the corner so the arms meet.
     *
     * @param {Vec3} corner - The world corner.
     * @param {'x' | 'y' | 'z'} axis - The world axis the arm runs along.
     * @param {number} sign - The side of the corner along the axis, -1 or 1.
     * @param {number} length - The arm length from the corner.
     * @param {number} thickness - The thickness in CSS pixels.
     */
    arm(corner, axis, sign, length, thickness) {
        const t = this.pixels(corner, thickness);
        this._colors(1);
        const arm = this._next(this._arms);
        const pos = this._local(corner, tmpV1);
        pos[axis] -= sign * 0.5 * (length - 0.5 * t);
        const along = length + 0.5 * t;
        arm.entity.setLocalPosition(pos);
        arm.entity.setLocalRotation(Quat.IDENTITY);
        arm.entity.setLocalScale(axis === 'x' ? along : t, axis === 'y' ? along : t, axis === 'z' ? along : t);
    }

    /**
     * Adds a dot of a constant screen size.
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
     * @param {boolean} [volume] - Whether to use the theme fill color.
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
     * Adds a filled capsule along the y axis of the rotation.
     *
     * @param {Vec3} center - The world center.
     * @param {Quat} rotation - The world rotation.
     * @param {number} radius - The radius.
     * @param {number} height - The height, caps included.
     * @param {number} [alpha] - The alpha factor.
     */
    capsule(center, rotation, radius, height, alpha = 1) {
        this._colors(alpha, true);
        const capsule = /** @type {CapsuleShape} */ (this._next(this._capsules));
        const ratio = height / Math.max(radius, 1e-6);
        if (Math.abs(capsule.height - ratio) > PEAK_TOLERANCE * ratio) {
            capsule.height = ratio;
        }
        capsule.entity.setLocalPosition(this._local(center, tmpV1));
        capsule.entity.setLocalRotation(rotation);
        capsule.entity.setLocalScale(radius, radius, radius);
    }

    /**
     * Adds a filled unit cone along the y axis of the rotation, its base at y = -0.5. A disk and a
     * triangle are meant to be flattened by the size; a cylinder keeps its radius to the peak; a
     * frustum is a square pyramid.
     *
     * @param {keyof CONES} kind - The kind of cone.
     * @param {Vec3} center - The world center.
     * @param {Quat} rotation - The world rotation.
     * @param {Vec3} size - The size along each axis of the rotation; 1 gives a base radius of 0.5.
     * @param {number} [alpha] - The alpha factor.
     * @param {boolean} [volume] - Whether to use the theme fill color.
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
     * Adds a flat disc facing the y axis of the rotation, picked by the gizmo.
     *
     * @param {Vec3} center - The world center.
     * @param {Quat} rotation - The world rotation.
     * @param {number} size - The diameter.
     * @param {number} [alpha] - The alpha factor.
     * @param {Color|null} [color] - The color replacing the rgb of the theme color.
     * @returns {Shape} The disc.
     */
    disc(center, rotation, size, alpha = 1, color = null) {
        this._colors(alpha, false, color);
        const disc = this._next(this._pickDiscs);
        disc.entity.setLocalPosition(this._local(center, tmpV1));
        disc.entity.setLocalRotation(rotation);
        disc.entity.setLocalScale(size, 1e-3 * size, size);
        return disc;
    }

    /**
     * Adds an icon glyph on the xz plane of the rotation, its top toward -z.
     *
     * @param {OverlayIcon} kind - The icon.
     * @param {Vec3} center - The world center.
     * @param {Quat} rotation - The world rotation.
     * @param {number} size - The width and height.
     */
    glyph(kind, center, rotation, size) {
        this._colors(1);
        const glyph = this._next(this._glyphs[kind]);
        glyph.entity.setLocalPosition(this._local(center, tmpV1));
        glyph.entity.setLocalRotation(rotation);
        glyph.entity.setLocalScale(size, 1, size);
    }

    /**
     * Copies the colors of a partial theme into the theme.
     *
     * @param {Partial<OverlayRendererTheme>} [partial] - The partial theme.
     */
    applyTheme(partial) {
        const theme = this._theme;
        for (const key of /** @type {(keyof OverlayRendererTheme)[]} */ (Object.keys(theme))) {
            const color = partial?.[key];
            if (color instanceof Color) {
                theme[key]?.copy(color);
            }
        }
    }

    /**
     * Adds a text label just below a world point.
     *
     * @param {Vec3} position - The world position.
     * @param {string} html - The label markup.
     * @param {number} [below] - The extra offset below the point, in CSS pixels.
     */
    label(position, html, below = 0) {
        if (this._perspective && this._viewDepth(position) < this._gizmo.camera.nearClip) {
            return;
        }
        const label = this._labels.next();
        const screen = this._gizmo.camera.worldToScreen(position, tmpV1);
        label.show(html, screen.x, screen.y + below);
    }

    /**
     * Destroys the shapes. Safe to call again.
     */
    destroy() {
        this._pools.forEach(pool => pool.destroy());
        this._lines.destroy();
        this._labels.items.forEach(label => label.destroy());
        this._labels.items.length = 0;
    }
}

export { OverlayRenderer };
