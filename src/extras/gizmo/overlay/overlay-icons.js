import { Color } from '../../../core/math/color.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { PROJECTION_PERSPECTIVE } from '../../../scene/constants.js';
import { Pool } from '../pool.js';

/**
 * @import { Gizmo } from '../gizmo.js'
 * @import { GraphNode } from '../../../scene/graph-node.js'
 * @import { MeshInstance } from '../../../scene/mesh-instance.js'
 * @import { OverlayIcon } from './icon-glyphs.js'
 * @import { OverlayRenderer } from './overlay-renderer.js'
 * @import { Shape } from '../shape/shape.js'
 */

const tmpV = new Vec3();
const tmpQ = new Quat();

// turns the xz plane of a glyph to face the camera, its top up the screen
const GLYPH_TO_VIEW = new Quat().setFromEulerAngles(90, 0, 0);

const ICON_SIZE = 24;
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
        const renderer = this._renderer;
        const pixel = renderer.pixels(position, 1);

        // the backdrop sits a pixel behind the glyph, away from the camera
        if (camera.projection === PROJECTION_PERSPECTIVE) {
            tmpV.sub2(position, entity.getPosition()).normalize();
        } else {
            tmpV.copy(entity.forward);
        }
        tmpV.mulScalar(pixel).add(position);
        const backdrop = renderer.disc(tmpV, tmpQ.setFromDirections(Vec3.UP, entity.forward), 2 * ICON_BACKDROP_RADIUS * pixel, ICON_BACKDROP.a, ICON_BACKDROP);

        renderer.glyph(kind, position, tmpQ.copy(entity.getRotation()).mul(GLYPH_TO_VIEW), ICON_SIZE * pixel);

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
}

export { OverlayIcons };
