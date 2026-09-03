import { Debug } from '../../core/debug.js';
import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';

/**
 * @import { AppBase } from '../../framework/app-base.js'
 * @import { BoundingBox } from '../../core/shape/bounding-box.js'
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { Layer } from '../../scene/layer.js'
 * @import { LightComponent } from '../../framework/components/light/component.js'
 * @import { OrientedBox } from '../../core/shape/oriented-box.js'
 */

const _u = new Vec3();
const _v = new Vec3();
const _dir = new Vec3();
const _pos = new Vec3();
const _head = new Vec3();
const _lightDir = new Vec3();
const _mat = new Mat4();
const _view = new Mat4();
const _color = new Color();

const DEG_TO_RAD = Math.PI / 180;

// the 8 corners of a frustum in normalized device coordinates, near plane first
const NDC_CORNERS = [
    -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1,
    -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1
];

// index pairs forming the 12 edges of the corners above
const FRUSTUM_EDGES = [
    0, 1, 1, 2, 2, 3, 3, 0,
    4, 5, 5, 6, 6, 7, 7, 4,
    0, 4, 1, 5, 2, 6, 3, 7
];

// scratch storage for the unprojected frustum corners
const _corners = [];
for (let i = 0; i < 8; i++) {
    _corners.push(new Vec3());
}

/**
 * Builds an arbitrary orthonormal basis perpendicular to the supplied direction, storing the two
 * tangents in `_u` and `_v`. The direction is expected to be normalized.
 *
 * The choice of basis is not continuous as `dir` rotates - it cannot be, as no continuous tangent
 * field exists over a whole sphere - so it swings around as `dir.x` passes the threshold below.
 * That is invisible for the rings of a circle, cylinder, capsule or cone, and for the barbs of an
 * arrow, all of which are symmetric about their axis. It is visible for {@link WireRenderer#plane},
 * whose square has a definite orientation.
 *
 * @param {Vec3} dir - The normalized direction to build a basis around.
 * @ignore
 */
const buildBasis = (dir) => {
    // pick the world axis least aligned with dir, so the cross product stays well conditioned
    if (Math.abs(dir.x) < 0.5) {
        _u.set(1, 0, 0);
    } else {
        _u.set(0, 1, 0);
    }
    _v.cross(dir, _u).normalize();
    _u.cross(_v, dir).normalize();
};

/**
 * Renders wireframe shapes for a single frame, for debugging and visualization. Shapes are
 * submitted as line segments to the layer given by {@link WireRenderer#layer}, which defaults to
 * the {@link LAYERID_IMMEDIATE} layer, and are discarded once the frame has been rendered, so
 * they must be issued again on every frame they should be visible.
 *
 * The renderer holds the state used by the shapes it draws - {@link WireRenderer#color},
 * {@link WireRenderer#layer}, {@link WireRenderer#depthTest}, {@link WireRenderer#segments} and
 * {@link WireRenderer#transform}. Fields can be assigned between calls, and drawing many shapes
 * with the same state allocates nothing:
 *
 * ```javascript
 * const wire = new WireRenderer(app);
 * wire.color = Color.RED;
 *
 * app.on('update', () => {
 *     for (const item of items) {
 *         wire.sphere(item.position, item.radius);
 *     }
 * });
 * ```
 *
 * A second set of state is simply a second instance. Instances hold no GPU resources, and those
 * sharing a layer and depth test mode submit into the same batch, so using several has no
 * additional rendering cost:
 *
 * ```javascript
 * const xray = new WireRenderer(app);
 * xray.depthTest = false;
 * ```
 *
 * These are thin lines, one pixel wide. For thick lines with caps, joins and dashes, intended as
 * part of the rendered scene rather than as a debugging aid, see {@link WideLineRenderer} instead.
 *
 * @category Graphics
 */
class WireRenderer {
    /**
     * The color used by shapes, specified in sRGB color space. The alpha component is respected.
     * Defaults to white.
     *
     * @type {Color}
     */
    color = new Color(1, 1, 1, 1);

    /**
     * The layer shapes are rendered into, or null to use the {@link LAYERID_IMMEDIATE} layer.
     * Defaults to null.
     *
     * @type {Layer|null}
     */
    layer = null;

    /**
     * Whether shapes are depth tested against the depth buffer. Defaults to true.
     *
     * @type {boolean}
     */
    depthTest = true;

    /**
     * The number of line segments used to approximate a full circle. Defaults to 20.
     *
     * @type {number}
     */
    segments = 20;

    /**
     * A matrix applied to every point of every shape, or null for no transform. Assign this to
     * draw a group of shapes in the local space of a node. Defaults to null.
     *
     * @type {Mat4|null}
     */
    transform = null;

    /**
     * Creates a new WireRenderer instance.
     *
     * @param {AppBase} app - The application.
     * @example
     * const wire = new WireRenderer(app);
     */
    constructor(app) {
        Debug.assert(app, 'WireRenderer requires an application.');
        this.app = app;
        this._scene = app.scene;
        this._immediate = app.scene.immediate;

        /**
         * Cursor for the shape currently being written, valid only for the duration of one call.
         *
         * @type {LineWriter|null}
         * @private
         */
        this._writer = null;
    }

    /**
     * Allocates room for a shape and points the cursor at it. The count must match exactly what
     * the shape goes on to write.
     *
     * @param {number} vertexCount - The number of vertices the shape writes. Two per segment.
     * @ignore
     */
    _begin(vertexCount) {
        this._writer = this._immediate.allocateLines(
            vertexCount, this.color, this.depthTest, this.layer ?? this._scene.defaultDrawLayer);
    }

    /**
     * @returns {number} The circle segment count, clamped to a usable range.
     * @ignore
     */
    _steps() {
        return Math.max(3, Math.floor(this.segments));
    }

    /**
     * Writes a single segment, applying {@link WireRenderer#transform}.
     *
     * @param {number} x0 - The start x coordinate.
     * @param {number} y0 - The start y coordinate.
     * @param {number} z0 - The start z coordinate.
     * @param {number} x1 - The end x coordinate.
     * @param {number} y1 - The end y coordinate.
     * @param {number} z1 - The end z coordinate.
     * @ignore
     */
    _segment(x0, y0, z0, x1, y1, z1) {
        const m = this.transform;
        if (m) {
            const d = m.data;
            this._writer.segment(
                d[0] * x0 + d[4] * y0 + d[8] * z0 + d[12],
                d[1] * x0 + d[5] * y0 + d[9] * z0 + d[13],
                d[2] * x0 + d[6] * y0 + d[10] * z0 + d[14],
                d[0] * x1 + d[4] * y1 + d[8] * z1 + d[12],
                d[1] * x1 + d[5] * y1 + d[9] * z1 + d[13],
                d[2] * x1 + d[6] * y1 + d[10] * z1 + d[14]
            );
        } else {
            this._writer.segment(x0, y0, z0, x1, y1, z1);
        }
    }

    /**
     * Writes a single vertex with its own color, applying {@link WireRenderer#transform}.
     *
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @param {number} z - The z coordinate.
     * @param {Color} color - The color of the vertex.
     * @ignore
     */
    _vertex(x, y, z, color) {
        const m = this.transform;
        if (m) {
            const d = m.data;
            this._writer.vertex(
                d[0] * x + d[4] * y + d[8] * z + d[12],
                d[1] * x + d[5] * y + d[9] * z + d[13],
                d[2] * x + d[6] * y + d[10] * z + d[14],
                color.r, color.g, color.b, color.a
            );
        } else {
            this._writer.vertex(x, y, z, color.r, color.g, color.b, color.a);
        }
    }

    /**
     * Appends a circular arc lying in the plane spanned by the two supplied tangents.
     *
     * @param {Vec3} center - The center of the arc.
     * @param {Vec3} u - The first tangent of the arc plane, normalized.
     * @param {Vec3} v - The second tangent of the arc plane, normalized.
     * @param {number} radius - The radius of the arc.
     * @param {number} steps - The number of segments used by the arc.
     * @param {number} [start] - The start angle in radians. Defaults to 0.
     * @param {number} [sweep] - The swept angle in radians. Defaults to a full circle.
     * @ignore
     */
    _arc(center, u, v, radius, steps, start = 0, sweep = Math.PI * 2) {

        // this is the hot path - it backs sphere, circle, cylinder, capsule, cone and arrow, so
        // the overwhelming majority of segments come through here. It writes the batch storage
        // itself rather than calling LineWriter#segment per segment, which measured about a
        // quarter of the cost of generating a shape. The transform test is hoisted out of the
        // loop for the same reason.
        const writer = this._writer;
        const positions = writer.positions;
        const colors = writer.colors;
        let k = writer.cursor;

        Debug.assert(k + steps * 2 <= writer.end,
            'WireRenderer#_arc would write past the end of its allocation.');

        const { r, g, b, a } = this.color;
        const m = this.transform;
        const d = m ? m.data : null;

        // the center and both tangents are hoisted into locals, as reading them off the Vec3
        // instances inside the loop costs more than the write itself
        const cx = center.x, cy = center.y, cz = center.z;
        const ux = u.x, uy = u.y, uz = u.z;
        const vx = v.x, vy = v.y, vz = v.z;

        const step = sweep / steps;
        let angle = start;
        let c0 = Math.cos(angle) * radius;
        let s0 = Math.sin(angle) * radius;

        for (let i = 0; i < steps; i++) {
            angle += step;
            const c1 = Math.cos(angle) * radius;
            const s1 = Math.sin(angle) * radius;

            let x0 = cx + ux * c0 + vx * s0;
            let y0 = cy + uy * c0 + vy * s0;
            let z0 = cz + uz * c0 + vz * s0;
            let x1 = cx + ux * c1 + vx * s1;
            let y1 = cy + uy * c1 + vy * s1;
            let z1 = cz + uz * c1 + vz * s1;

            if (d) {
                const ax = x0, ay = y0, az = z0;
                const bx = x1, by = y1, bz = z1;
                x0 = d[0] * ax + d[4] * ay + d[8] * az + d[12];
                y0 = d[1] * ax + d[5] * ay + d[9] * az + d[13];
                z0 = d[2] * ax + d[6] * ay + d[10] * az + d[14];
                x1 = d[0] * bx + d[4] * by + d[8] * bz + d[12];
                y1 = d[1] * bx + d[5] * by + d[9] * bz + d[13];
                z1 = d[2] * bx + d[6] * by + d[10] * bz + d[14];
            }

            let p = k * 3;
            positions[p++] = x0;
            positions[p++] = y0;
            positions[p++] = z0;
            positions[p++] = x1;
            positions[p++] = y1;
            positions[p] = z1;

            let c = k * 4;
            colors[c++] = r;
            colors[c++] = g;
            colors[c++] = b;
            colors[c++] = a;
            colors[c++] = r;
            colors[c++] = g;
            colors[c++] = b;
            colors[c] = a;

            k += 2;
            c0 = c1;
            s0 = s1;
        }

        writer.cursor = k;
    }

    /**
     * Writes a list of points, expanding a strip into discrete segments when requested.
     *
     * @param {Vec3[]} positions - The points to write.
     * @param {Color[]|undefined} colors - One color per point, or undefined to use
     * {@link WireRenderer#color}.
     * @param {boolean} strip - True to connect consecutive points, false to treat them as pairs.
     * @param {boolean} closed - True to also connect the last point back to the first. Only used
     * when `strip` is true.
     * @ignore
     */
    _writePoints(positions, colors, strip, closed) {
        const count = positions.length;

        Debug.assert(!colors || colors.length === count,
            `WireRenderer: expected ${count} colors to match the supplied positions, got ${colors?.length}.`);

        const segments = strip ? (closed ? count : count - 1) : count / 2;
        this._begin(segments * 2);

        if (colors) {
            // one color per point, so each end of a segment is written on its own
            if (strip) {
                for (let i = 0; i < segments; i++) {
                    const next = (i + 1) % count;
                    this._vertex(positions[i].x, positions[i].y, positions[i].z, colors[i]);
                    this._vertex(positions[next].x, positions[next].y, positions[next].z, colors[next]);
                }
            } else {
                for (let i = 0; i < count; i++) {
                    this._vertex(positions[i].x, positions[i].y, positions[i].z, colors[i]);
                }
            }
        } else if (strip) {
            for (let i = 0; i < segments; i++) {
                const a = positions[i];
                const b = positions[(i + 1) % count];
                this._segment(a.x, a.y, a.z, b.x, b.y, b.z);
            }
        } else {
            for (let i = 0; i < count; i += 2) {
                const a = positions[i];
                const b = positions[i + 1];
                this._segment(a.x, a.y, a.z, b.x, b.y, b.z);
            }
        }
    }

    /**
     * Renders a single line segment.
     *
     * @param {Vec3} start - The start of the line, in world space.
     * @param {Vec3} end - The end of the line, in world space.
     * @example
     * wire.line(new Vec3(0, 0, 0), new Vec3(0, 1, 0));
     */
    line(start, end) {
        this._begin(2);
        this._segment(start.x, start.y, start.z, end.x, end.y, end.z);
    }

    /**
     * Renders discrete line segments, formed by consecutive pairs of points.
     *
     * @param {Vec3[]} positions - The points to draw lines between. The length must be a multiple
     * of two.
     * @param {Color[]} [colors] - One color per point, or undefined to use
     * {@link WireRenderer#color}. The color of each segment is interpolated between its ends.
     * @example
     * wire.lines([start, end], [Color.RED, Color.WHITE]);
     */
    lines(positions, colors) {
        Debug.assert(positions.length % 2 === 0,
            'WireRenderer#lines requires an even number of positions.');
        Debug.assert(colors === undefined || Array.isArray(colors),
            'WireRenderer#lines colors must be an array of Color, or undefined to use the renderer color.');

        // pass user data straight through when it needs no transform
        if (!this.transform) {
            this.app.drawLines(positions, colors ?? this.color, this.depthTest, this.layer ?? undefined);
            return;
        }

        this._writePoints(positions, colors, false, false);
    }

    /**
     * Renders discrete line segments from packed arrays of numbers. This is the fastest of the
     * line functions, as it avoids reading individual {@link Vec3} and {@link Color} instances.
     *
     * @param {number[]|Float32Array} positions - Packed xyz coordinates, forming pairs of points.
     * @param {number[]|Float32Array} [colors] - Packed rgba values, one color per point, or
     * undefined to use {@link WireRenderer#color}.
     * @example
     * wire.linesPacked([0, 0, 0, 0, 1, 0]);
     */
    linesPacked(positions, colors) {
        Debug.assert(colors === undefined || colors.length === (positions.length / 3) * 4,
            'WireRenderer#linesPacked colors must hold four values per position, or be undefined.');

        if (!this.transform) {
            this.app.drawLineArrays(positions, colors ?? this.color, this.depthTest, this.layer ?? undefined);
            return;
        }

        const count = positions.length / 3;
        this._begin(count);

        if (colors) {
            for (let i = 0, p = 0, c = 0; i < count; i++, p += 3, c += 4) {
                _color.set(colors[c], colors[c + 1], colors[c + 2], colors[c + 3]);
                this._vertex(positions[p], positions[p + 1], positions[p + 2], _color);
            }
        } else {
            for (let i = 0, p = 0; i < count; i += 2, p += 6) {
                this._segment(
                    positions[p], positions[p + 1], positions[p + 2],
                    positions[p + 3], positions[p + 4], positions[p + 5]
                );
            }
        }
    }

    /**
     * Renders an open strip of connected line segments.
     *
     * @param {Vec3[]} positions - The points of the strip, in order.
     * @param {Color[]} [colors] - One color per point, or undefined to use
     * {@link WireRenderer#color}.
     * @example
     * wire.polyline(trajectory);
     */
    polyline(positions, colors) {
        Debug.assert(colors === undefined || Array.isArray(colors),
            'WireRenderer#polyline colors must be an array of Color, or undefined to use the renderer color.');

        if (positions.length < 2) {
            return;
        }

        this._writePoints(positions, colors, true, false);
    }

    /**
     * Renders a closed strip of connected line segments, joining the last point back to the first.
     *
     * @param {Vec3[]} positions - The points of the loop, in order.
     * @param {Color[]} [colors] - One color per point, or undefined to use
     * {@link WireRenderer#color}.
     * @example
     * wire.loop(outline);
     */
    loop(positions, colors) {
        Debug.assert(colors === undefined || Array.isArray(colors),
            'WireRenderer#loop colors must be an array of Color, or undefined to use the renderer color.');

        if (positions.length < 2) {
            return;
        }

        this._writePoints(positions, colors, true, true);
    }

    /**
     * Renders the edges of a box specified by its min and max corners.
     *
     * @param {Vec3} min - The min corner of the box.
     * @param {Vec3} max - The max corner of the box.
     * @example
     * wire.boxMinMax(new Vec3(-1, -1, -1), new Vec3(1, 1, 1));
     */
    boxMinMax(min, max) {
        this._begin(12 * 2);

        const { x: ax, y: ay, z: az } = min;
        const { x: bx, y: by, z: bz } = max;

        // near face
        this._segment(ax, ay, az, bx, ay, az);
        this._segment(bx, ay, az, bx, by, az);
        this._segment(bx, by, az, ax, by, az);
        this._segment(ax, by, az, ax, ay, az);

        // far face
        this._segment(ax, ay, bz, bx, ay, bz);
        this._segment(bx, ay, bz, bx, by, bz);
        this._segment(bx, by, bz, ax, by, bz);
        this._segment(ax, by, bz, ax, ay, bz);

        // connecting edges
        this._segment(ax, ay, az, ax, ay, bz);
        this._segment(bx, ay, az, bx, ay, bz);
        this._segment(bx, by, az, bx, by, bz);
        this._segment(ax, by, az, ax, by, bz);
    }

    /**
     * Renders the edges of a bounding box. An {@link OrientedBox} is rendered in its own
     * orientation, composed with {@link WireRenderer#transform}.
     *
     * @param {BoundingBox|OrientedBox} box - The box to render.
     * @example
     * wire.box(meshInstance.aabb);
     */
    box(box) {
        const orientation = /** @type {OrientedBox} */ (box).worldTransform;

        if (orientation) {
            // an oriented box is a unit-centered box in the space of its own transform
            const outer = this.transform;
            this.transform = outer ? _mat.mul2(outer, orientation) : orientation;

            const he = box.halfExtents;
            _u.set(-he.x, -he.y, -he.z);
            _v.set(he.x, he.y, he.z);
            this.boxMinMax(_u, _v);

            this.transform = outer;
            return;
        }

        this.boxMinMax(box.getMin(), box.getMax());
    }

    /**
     * Renders a sphere as three great circles, one in each of the primary planes.
     *
     * @param {Vec3} center - The center of the sphere.
     * @param {number} radius - The radius of the sphere.
     * @example
     * wire.sphere(new Vec3(0, 1, 0), 0.5);
     */
    sphere(center, radius) {
        const steps = this._steps();
        this._begin(steps * 3 * 2);

        _u.set(1, 0, 0);
        _v.set(0, 1, 0);
        this._arc(center, _u, _v, radius, steps);

        _u.set(1, 0, 0);
        _v.set(0, 0, 1);
        this._arc(center, _u, _v, radius, steps);

        _u.set(0, 1, 0);
        _v.set(0, 0, 1);
        this._arc(center, _u, _v, radius, steps);
    }

    /**
     * Renders a circle lying in the plane described by a normal.
     *
     * @param {Vec3} center - The center of the circle.
     * @param {Vec3} normal - The normal of the plane containing the circle. Need not be
     * normalized.
     * @param {number} radius - The radius of the circle.
     * @example
     * wire.circle(Vec3.ZERO, Vec3.UP, 5);
     */
    circle(center, normal, radius) {
        const steps = this._steps();
        this._begin(steps * 2);

        _dir.copy(normal).normalize();
        buildBasis(_dir);
        this._arc(center, _u, _v, radius, steps);
    }

    /**
     * Renders a cylinder as a ring at each end joined by four side lines.
     *
     * @param {Vec3} start - The center of the start cap.
     * @param {Vec3} end - The center of the end cap.
     * @param {number} radius - The radius of the cylinder.
     * @example
     * wire.cylinder(base, tip, 0.5);
     */
    cylinder(start, end, radius) {
        _dir.sub2(end, start);
        if (_dir.length() < 1e-6) {
            return;
        }
        _dir.normalize();
        buildBasis(_dir);

        const steps = this._steps();
        this._begin((steps * 2 + 4) * 2);

        this._arc(start, _u, _v, radius, steps);
        this._arc(end, _u, _v, radius, steps);
        this._sideLines(start, end, radius);
    }

    /**
     * Appends the four longitudinal lines joining two rings, using the basis in `_u` and `_v`.
     *
     * @param {Vec3} start - The center of the start ring.
     * @param {Vec3} end - The center of the end ring.
     * @param {number} radius - The radius of both rings.
     * @ignore
     */
    _sideLines(start, end, radius) {
        for (let i = 0; i < 4; i++) {
            const t = i & 1 ? _v : _u;
            const s = i < 2 ? radius : -radius;
            this._segment(
                start.x + t.x * s, start.y + t.y * s, start.z + t.z * s,
                end.x + t.x * s, end.y + t.y * s, end.z + t.z * s
            );
        }
    }

    /**
     * Renders a capsule as a ring and hemispherical cap at each end, joined by four side lines.
     *
     * @param {Vec3} start - The center of the start cap sphere.
     * @param {Vec3} end - The center of the end cap sphere.
     * @param {number} radius - The radius of the capsule.
     * @example
     * wire.capsule(feet, head, 0.4);
     */
    capsule(start, end, radius) {
        _dir.sub2(end, start);
        if (_dir.length() < 1e-6) {
            this.sphere(start, radius);
            return;
        }
        _dir.normalize();
        buildBasis(_dir);

        const steps = this._steps();
        const half = Math.max(2, steps >> 1);
        this._begin((steps * 2 + 4 + half * 4) * 2);

        this._arc(start, _u, _v, radius, steps);
        this._arc(end, _u, _v, radius, steps);
        this._sideLines(start, end, radius);

        // hemispherical caps, two half arcs bending away from the body at each end
        this._arc(end, _u, _dir, radius, half, 0, Math.PI);
        this._arc(end, _v, _dir, radius, half, 0, Math.PI);
        this._arc(start, _u, _dir, radius, half, Math.PI, Math.PI);
        this._arc(start, _v, _dir, radius, half, Math.PI, Math.PI);
    }

    /**
     * Renders a cone as a base ring joined to its apex by four side lines. The parameters match
     * those describing a spot light, so a light's cone can be visualized directly.
     *
     * @param {Vec3} apex - The tip of the cone.
     * @param {Vec3} direction - The direction the cone opens along. Need not be normalized.
     * @param {number} angle - The half-angle of the cone, in degrees, measured from `direction` to
     * the cone edge.
     * @param {number} length - The distance from the apex to the base.
     * @example
     * wire.cone(position, direction, 30, 10);
     */
    cone(apex, direction, angle, length) {
        _dir.copy(direction);
        if (_dir.length() < 1e-6) {
            return;
        }
        _dir.normalize();
        buildBasis(_dir);

        const radius = length * Math.tan(Math.min(angle, 89.9) * DEG_TO_RAD);
        _pos.copy(_dir).mulScalar(length).add(apex);

        const steps = this._steps();
        this._begin((steps + 4) * 2);

        this._arc(_pos, _u, _v, radius, steps);

        for (let i = 0; i < 4; i++) {
            const t = i & 1 ? _v : _u;
            const s = i < 2 ? radius : -radius;
            this._segment(
                apex.x, apex.y, apex.z,
                _pos.x + t.x * s, _pos.y + t.y * s, _pos.z + t.z * s
            );
        }
    }

    /**
     * Renders a square section of a plane, with a short stub along its normal.
     *
     * The rotation of the square within its plane is derived from the normal, and no such
     * derivation is continuous over all directions. An animated normal will therefore make the
     * square appear to jump as it passes the direction where the derivation switches. To rotate a
     * square smoothly, pass a fixed normal and drive {@link WireRenderer#transform} instead.
     *
     * @param {Vec3} center - The center of the square.
     * @param {Vec3} normal - The normal of the plane. Need not be normalized.
     * @param {number} size - The side length of the square.
     * @example
     * wire.plane(Vec3.ZERO, Vec3.UP, 10);
     */
    plane(center, normal, size) {
        this._begin(5 * 2);

        _dir.copy(normal).normalize();
        buildBasis(_dir);

        const h = size * 0.5;
        const ax = _u.x * h, ay = _u.y * h, az = _u.z * h;
        const bx = _v.x * h, by = _v.y * h, bz = _v.z * h;

        this._segment(
            center.x - ax - bx, center.y - ay - by, center.z - az - bz,
            center.x + ax - bx, center.y + ay - by, center.z + az - bz
        );
        this._segment(
            center.x + ax - bx, center.y + ay - by, center.z + az - bz,
            center.x + ax + bx, center.y + ay + by, center.z + az + bz
        );
        this._segment(
            center.x + ax + bx, center.y + ay + by, center.z + az + bz,
            center.x - ax + bx, center.y - ay + by, center.z - az + bz
        );
        this._segment(
            center.x - ax + bx, center.y - ay + by, center.z - az + bz,
            center.x - ax - bx, center.y - ay - by, center.z - az - bz
        );

        this._segment(
            center.x, center.y, center.z,
            center.x + _dir.x * h, center.y + _dir.y * h, center.z + _dir.z * h
        );
    }

    /**
     * Renders a small axis-aligned cross marking a position.
     *
     * @param {Vec3} position - The position to mark.
     * @param {number} size - The overall length of each arm of the cross.
     * @example
     * wire.point(hit.point, 0.2);
     */
    point(position, size) {
        this._begin(3 * 2);

        const h = size * 0.5;
        const { x, y, z } = position;

        this._segment(x - h, y, z, x + h, y, z);
        this._segment(x, y - h, z, x, y + h, z);
        this._segment(x, y, z - h, x, y, z + h);
    }

    /**
     * Renders an arrow, as a shaft with four barbs at its tip.
     *
     * @param {Vec3} from - The tail of the arrow.
     * @param {Vec3} to - The tip of the arrow.
     * @example
     * wire.arrow(position, position.clone().add(velocity));
     */
    arrow(from, to) {
        _dir.sub2(to, from);
        const length = _dir.length();
        if (length < 1e-6) {
            return;
        }
        _dir.mulScalar(1 / length);
        buildBasis(_dir);

        const steps = this._steps();
        this._begin((steps + 5) * 2);

        this._segment(from.x, from.y, from.z, to.x, to.y, to.z);

        // the head is a small cone rather than a few barbs, so it still reads as an arrow at a
        // distance where isolated lines do not. `to` may alias the _pos scratch, so use _head.
        const headLength = length * 0.2;
        const headRadius = headLength * 0.5;
        _head.copy(_dir).mulScalar(-headLength).add(to);

        this._arc(_head, _u, _v, headRadius, steps);

        for (let i = 0; i < 4; i++) {
            const t = i & 1 ? _v : _u;
            const s = i < 2 ? headRadius : -headRadius;
            this._segment(
                to.x, to.y, to.z,
                _head.x + t.x * s, _head.y + t.y * s, _head.z + t.z * s
            );
        }
    }

    /**
     * Renders the three axes of a matrix, colored red, green and blue for x, y and z respectively.
     * This function ignores {@link WireRenderer#color}.
     *
     * @param {Mat4} matrix - The transform whose axes are rendered.
     * @param {number} size - The length of each axis.
     * @example
     * wire.axes(entity.getWorldTransform(), 1);
     */
    axes(matrix, size) {
        this._begin(3 * 2);

        const d = matrix.data;
        const ox = d[12], oy = d[13], oz = d[14];

        for (let i = 0; i < 3; i++) {
            const c = i * 4;

            // both ends of an axis share its color, so it reads as a solid line
            _color.set(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0, 1);
            this._vertex(ox, oy, oz, _color);
            this._vertex(
                ox + d[c] * size, oy + d[c + 1] * size, oz + d[c + 2] * size, _color
            );
        }
    }

    /**
     * Renders the edges of a view frustum. The camera does not need to be enabled or rendering,
     * so the view volume of an inactive camera can be visualized.
     *
     * @param {CameraComponent|Mat4} source - A camera, or a view-projection matrix.
     * @example
     * wire.frustum(otherCamera.camera);
     */
    frustum(source) {
        // a Component also has a `data` property, so discriminate on the camera API rather than
        // on the shape of a Mat4
        const camera = /** @type {CameraComponent} */ (source);
        if (camera.projectionMatrix) {

            // the view matrix is derived from the entity transform rather than read from
            // camera.viewMatrix, which is only refreshed for a camera that is being rendered -
            // and visualizing a camera you are not looking through is the point of this function
            _view.copy(camera.entity.getWorldTransform()).invert();
            _mat.mul2(camera.projectionMatrix, _view);
        } else {
            _mat.copy(/** @type {Mat4} */ (source));
        }
        _mat.invert();

        this._begin(12 * 2);

        const d = _mat.data;
        for (let i = 0; i < 8; i++) {
            const x = NDC_CORNERS[i * 3];
            const y = NDC_CORNERS[i * 3 + 1];
            const z = NDC_CORNERS[i * 3 + 2];

            // a perspective matrix needs the w divide, so this cannot use transformPoint
            const iw = 1 / (d[3] * x + d[7] * y + d[11] * z + d[15]);
            _corners[i].set(
                (d[0] * x + d[4] * y + d[8] * z + d[12]) * iw,
                (d[1] * x + d[5] * y + d[9] * z + d[13]) * iw,
                (d[2] * x + d[6] * y + d[10] * z + d[14]) * iw
            );
        }

        for (let i = 0; i < FRUSTUM_EDGES.length; i += 2) {
            const a = _corners[FRUSTUM_EDGES[i]];
            const b = _corners[FRUSTUM_EDGES[i + 1]];
            this._segment(a.x, a.y, a.z, b.x, b.y, b.z);
        }
    }

    /**
     * Renders the shape and extent of a light, using the light's own color. An omni light is drawn
     * as a sphere of its range, a spot light as its cone, and a directional light as an arrow
     * showing the direction it shines in. A light shines along the negative y-axis of its entity,
     * so the shape follows that axis rather than the entity's forward direction.
     *
     * @param {LightComponent} light - The light to render.
     * @param {number} [size] - The length of the arrow used for a directional light, which has no
     * inherent extent. Defaults to 1.
     * @example
     * wire.light(entity.light);
     */
    light(light, size = 1) {
        const entity = light.entity;
        const position = entity.getPosition();

        // a light shines along the negative y-axis of its entity - see LightComponent. This is
        // not the entity's forward (negative z) axis, which is what lookAt aims.
        const direction = _lightDir.copy(entity.up).mulScalar(-1);

        // the shapes below submit using the renderer color, so swap it for the light's own
        const outer = this.color;
        this.color = light.color;

        switch (light.type) {
            case 'omni':
                this.sphere(position, light.range);
                break;
            case 'spot':
                this.cone(position, direction, light.outerConeAngle, light.range);
                break;
            case 'directional':
                _pos.copy(direction).mulScalar(size).add(position);
                this.arrow(position, _pos);
                break;
        }

        this.color = outer;
    }
}

export { WireRenderer };
