import { Color } from '../../core/math/color.js';
import { Gizmo } from './gizmo.js';
import { OverlayShapes } from './overlay/overlay-shapes.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { Entity } from '../../framework/entity.js'
 * @import { Layer } from '../../scene/layer.js'
 * @import { OverlayIcon } from './overlay/icon-glyphs.js'
 */

/**
 * @typedef {object} IconGizmoTheme
 * @property {Color} base - The color of the icons, drawn faint where the scene hides them.
 */

/**
 * The components that show an icon, in order of priority, each drawing the icon of its name.
 *
 * @type {OverlayIcon[]}
 */
const ICONS = ['camera', 'light', 'audiolistener', 'sound', 'particlesystem'];

// the alpha of an icon where the scene hides it, as a factor of its color alpha
const OCCLUDED_ALPHA = 0.2;

/**
 * Draws an icon at each attached entity that has nothing else to see or click: a glyph of a
 * constant size on screen, for the first of its camera, light, audio listener, sound and particle
 * system components. Entities that render, with an enabled render, model, sprite or element
 * component, show no icon, as does the camera viewing the gizmo. Clicking an icon fires
 * {@link IconGizmo.EVENT_ICONSELECT}, so an app can select its entity.
 *
 * Use a layer that keeps the scene depth so icons the scene hides draw faint; a
 * {@link Gizmo.createLayer} layer clears depth.
 *
 * ```javascript
 * const layer = new Layer({ name: 'Overlays', transparentSortMode: SORTMODE_MANUAL });
 * app.scene.layers.push(layer);
 * const gizmo = new IconGizmo(cameraComponent, layer);
 * gizmo.attach([lightEntity, soundEntity]);
 * gizmo.on('icon:select', entity => select(entity));
 * ```
 *
 * Relevant Engine API examples:
 *
 * - [Icon Gizmo](https://playcanvas.github.io/#/gizmos/icon)
 * - [Editor](https://playcanvas.github.io/#/misc/editor)
 *
 * @category Gizmo
 */
class IconGizmo extends Gizmo {
    /**
     * Fired when the icon of an entity is clicked, so an app can select the entity.
     *
     * @event
     * @example
     * const gizmo = new pc.IconGizmo(camera, layer);
     * gizmo.on('icon:select', (entity) => {
     *     console.log(`Clicked the icon of ${entity.name}`);
     * });
     */
    static EVENT_ICONSELECT = 'icon:select';

    /**
     * Whether to draw the icon of each light in its own color, keeping the alpha of the theme
     * colors. Defaults to false.
     *
     * @type {boolean}
     */
    useLightColor = false;

    /**
     * Internal theme.
     *
     * @type {IconGizmoTheme}
     * @private
     */
    _theme = {
        base: Color.WHITE.clone()
    };

    /**
     * The colors the icon shapes follow, the occluded color taken from the base color each frame.
     *
     * @private
     */
    _colors = {
        base: this._theme.base,
        occluded: new Color()
    };

    /**
     * The icon shapes.
     *
     * @type {OverlayShapes}
     * @private
     */
    _shapes;

    /**
     * Creates a new IconGizmo object.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The render layer.
     * @example
     * const gizmo = new IconGizmo(camera, layer);
     */
    constructor(camera, layer) {
        super(camera, layer, 'gizmo:icon');

        this._shapes = new OverlayShapes(this, this._colors);

        this.on(Gizmo.EVENT_POINTERDOWN, (_x, _y, meshInstance) => {
            const entity = this._shapes.icons.pick(meshInstance);
            if (entity) {
                this.fire(IconGizmo.EVENT_ICONSELECT, entity);
            }
        });
    }

    /**
     * Gets the current theme for the gizmo.
     *
     * @type {IconGizmoTheme}
     */
    get theme() {
        return this._theme;
    }

    /**
     * Sets the theme or partial theme for the gizmo.
     *
     * @param {Partial<IconGizmoTheme>} partial - The partial theme to set.
     * @example
     * gizmo.setTheme({ base: new Color(1, 0.8, 0.3) });
     */
    setTheme(partial) {
        if (partial?.base instanceof Color) {
            this._theme.base.copy(partial.base);
        }
    }

    /**
     * The icons face the camera in world space.
     *
     * @override
     */
    _updateRotation() {
    }

    /**
     * The icons keep their size on screen themselves.
     *
     * @override
     */
    _updateScale() {
    }

    /**
     * Gets the icon an entity shows.
     *
     * @param {Entity} entity - The entity.
     * @returns {OverlayIcon|null} The icon, or null for none.
     * @private
     */
    _iconOf(entity) {
        const { render, model, sprite, element } = entity;
        if (!entity.enabled || entity.camera === this._camera ||
            (render?.enabled && render.meshInstances.length > 0) ||
            (model?.enabled && model.meshInstances?.length) ||
            sprite?.enabled || element?.enabled) {
            return null;
        }
        for (let i = 0; i < ICONS.length; i++) {
            if (entity[ICONS[i]]?.enabled) {
                return ICONS[i];
            }
        }
        return null;
    }

    /**
     * Places the icons of the attached entities.
     *
     * @override
     */
    prerender() {
        const shapes = this._shapes;
        if (!this.enabled) {
            shapes.clear();
            return;
        }

        const { base, occluded } = this._colors;
        occluded.copy(base).a *= OCCLUDED_ALPHA;

        shapes.begin();
        for (let i = 0; i < this.nodes.length; i++) {
            const entity = /** @type {Entity} */ (this.nodes[i]);
            const icon = this._iconOf(entity);
            if (icon) {
                shapes.tint = this.useLightColor && icon === 'light' ? /** @type {Color} */ (entity.light?.color) : null;
                shapes.icons.add(icon, entity.getPosition(), entity);
            }
        }
        shapes.tint = null;
        shapes.end();
    }

    /**
     * Destroys the gizmo and its icons.
     *
     * @override
     */
    destroy() {
        this._shapes.destroy();

        super.destroy();
    }
}

export { IconGizmo };
