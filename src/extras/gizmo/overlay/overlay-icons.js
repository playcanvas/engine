import { Color } from '../../../core/math/color.js';
import { Mat4 } from '../../../core/math/mat4.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { PROJECTION_PERSPECTIVE } from '../../../scene/constants.js';
import { Pool } from '../pool.js';
import { ICON_GLYPHS } from './icon-glyphs.js';

/**
 * @import { Gizmo } from '../gizmo.js'
 * @import { GraphNode } from '../../../scene/graph-node.js'
 * @import { MeshInstance } from '../../../scene/mesh-instance.js'
 * @import { OverlayIcon } from './icon-glyphs.js'
 * @import { OverlayRenderer } from './overlay-renderer.js'
 * @import { Shape } from '../shape/shape.js'
 */

const tmpA = new Vec3();
const tmpB = new Vec3();
const tmpC = new Vec3();
const tmpM = new Mat4();
const tmpQ = new Quat();

const ICON_WEIGHT = 0.8;
const ICON_BACKDROP_RADIUS = 14;
const ICON_BACKDROP = Object.freeze(new Color(0.05, 0.055, 0.07, 0.6));

/**
 * Camera-facing icons of a constant screen size, drawn with {@link OverlayRenderer} and picked by
 * their backdrops.
 *
 * @ignore
 */
class OverlayIcons {
    /**
     * @type {OverlayRenderer}
     * @private
     */
    _renderer;

    /**
     * @type {Gizmo}
     * @private
     */
    _gizmo;

    /**
     * The frame of the icon being placed.
     *
     * @private
     */
    _frame = {
        center: new Vec3(),
        right: new Vec3(),
        up: new Vec3(),
        forward: new Vec3(),
        rotation: new Quat(),
        away: new Vec3(),
        pixel: 0
    };

    /**
     * The icons placed this frame, with the nodes they mark.
     *
     * @type {Pool<{ shape: Shape|null, node: GraphNode|null }>}
     * @private
     */
    _placed = new Pool(() => ({ shape: null, node: null }));

    /**
     * @param {OverlayRenderer} renderer - The renderer the icons are drawn with.
     * @param {Gizmo} gizmo - The gizmo owning the shapes.
     */
    constructor(renderer, gizmo) {
        this._renderer = renderer;
        this._gizmo = gizmo;
    }

    /**
     * Starts a frame.
     */
    begin() {
        this._placed.count = 0;
    }

    /**
     * Adds an icon at a point, a glyph over a dark backdrop that {@link OverlayIcons#pick} picks.
     *
     * @param {OverlayIcon} kind - The icon.
     * @param {Vec3} position - The world position.
     * @param {GraphNode} node - The node the icon marks.
     */
    add(kind, position, node) {
        const camera = this._gizmo.camera;
        const entity = camera.entity;
        const frame = this._frame;
        frame.center.copy(position);
        frame.right.copy(entity.right);
        frame.up.copy(entity.up);
        frame.forward.copy(entity.forward);
        if (camera.projection === PROJECTION_PERSPECTIVE) {
            frame.away.sub2(position, entity.getPosition()).normalize();
        } else {
            frame.away.copy(entity.forward);
        }
        frame.pixel = this._renderer.pixels(position, 1);
        frame.rotation.setFromDirections(Vec3.UP, entity.forward);

        const backdrop = this._disc(ICON_BACKDROP_RADIUS, ICON_BACKDROP, ICON_BACKDROP.a, 1, true);
        const glyph = ICON_GLYPHS[kind];
        for (let i = 0; i < glyph.length; i++) {
            const s = glyph[i];
            switch (s[0]) {
                case 'line': {
                    for (let j = 1; j + 3 < s.length; j += 2) {
                        this._line(s[j], s[j + 1], s[j + 2], s[j + 3]);
                    }
                    break;
                }
                case 'arc': {
                    this._arc(s[1], s[2], s[3], s[4], s[5], s[6]);
                    break;
                }
                case 'disc': {
                    this._disc(s[3], null, 1, 0, false, s[1], s[2]);
                    break;
                }
                case 'triangle': {
                    // a three sided cone flattened onto the screen
                    const { right, up, forward, pixel } = frame;
                    const d = tmpM.setIdentity().data;
                    const back = tmpC.copy(forward).mulScalar(-1);
                    d[0] = up.x;
                    d[1] = up.y;
                    d[2] = up.z;
                    d[4] = back.x;
                    d[5] = back.y;
                    d[6] = back.z;
                    d[8] = right.x;
                    d[9] = right.y;
                    d[10] = right.z;
                    const length = (s[2] - s[1]) / 0.75;
                    const center = tmpA.copy(right).mulScalar((s[2] - 0.25 * length) * pixel).add(position);
                    this._renderer.cone('triangle', center, tmpQ.setFromMat4(tmpM), tmpB.set(s[3] / (0.5 * Math.sqrt(3)) * pixel, 1e-3 * pixel, length * pixel), 1, false);
                    break;
                }
            }
        }
        const record = this._placed.next();
        record.shape = backdrop;
        record.node = node;
    }

    /**
     * Gets the node whose icon, placed this frame, was picked.
     *
     * @param {MeshInstance} [meshInstance] - The picked mesh instance.
     * @returns {GraphNode|null} The node, or null when no icon was picked.
     */
    pick(meshInstance) {
        if (!meshInstance) {
            return null;
        }
        const placed = this._placed;
        for (let i = 0; i < placed.count; i++) {
            if (placed.items[i].shape?.meshInstances[0] === meshInstance) {
                return placed.items[i].node;
            }
        }
        return null;
    }

    /**
     * Places a line of the icon, in CSS pixels from its center, y up the screen.
     *
     * @param {number} x0 - The start x.
     * @param {number} y0 - The start y.
     * @param {number} x1 - The end x.
     * @param {number} y1 - The end y.
     * @private
     */
    _line(x0, y0, x1, y1) {
        const { center, right, up, pixel } = this._frame;
        const a = tmpA.copy(right).mulScalar(x0 * pixel).add(tmpB.copy(up).mulScalar(y0 * pixel)).add(center);
        const b = tmpB.copy(right).mulScalar(x1 * pixel).add(tmpC.copy(up).mulScalar(y1 * pixel)).add(center);
        this._renderer.line(a, b, ICON_WEIGHT);
    }

    /**
     * Places an arc of the icon as straight segments.
     *
     * @param {number} x - The x of the arc center.
     * @param {number} y - The y of the arc center, up the screen.
     * @param {number} radius - The radius.
     * @param {number} from - The start angle in radians, from the x axis.
     * @param {number} to - The end angle in radians.
     * @param {number} segments - The number of segments.
     * @private
     */
    _arc(x, y, radius, from, to, segments) {
        const step = (to - from) / segments;
        for (let i = 0; i < segments; i++) {
            const a0 = from + i * step;
            const a1 = a0 + step;
            this._line(x + radius * Math.cos(a0), y + radius * Math.sin(a0), x + radius * Math.cos(a1), y + radius * Math.sin(a1));
        }
    }

    /**
     * Places a disc of the icon facing the camera.
     *
     * @param {number} radius - The radius in CSS pixels.
     * @param {Color|null} color - The color replacing the rgb of the theme color.
     * @param {number} alpha - The alpha factor.
     * @param {number} back - How far behind the icon to place the disc, in CSS pixels.
     * @param {boolean} pickable - Whether the gizmo picks the disc.
     * @param {number} [x] - The x of the disc center, in CSS pixels from the icon center.
     * @param {number} [y] - The y of the disc center, up the screen.
     * @returns {Shape} The disc.
     * @private
     */
    _disc(radius, color, alpha, back, pickable, x = 0, y = 0) {
        const { center, away, right, up, pixel, rotation } = this._frame;
        const pos = tmpA.copy(away).mulScalar(back * pixel).add(center)
        .add(tmpB.copy(up).mulScalar(y * pixel)).add(tmpB.copy(right).mulScalar(x * pixel));
        return this._renderer.disc(pos, rotation, 2 * radius * pixel, alpha, color, pickable);
    }
}

export { OverlayIcons };
