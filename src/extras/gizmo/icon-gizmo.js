import { Color } from '../../core/math/color.js';
import { Gizmo } from './gizmo.js';
import { GIZMO_ICONS } from './overlay/icon-glyphs.js';
import { OverlayRenderer } from './overlay/overlay-renderer.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { Entity } from '../../framework/entity.js'
 * @import { Layer } from '../../scene/layer.js'
 */

/**
 * @typedef {object} IconGizmoTheme
 * @property {Color} base - The color of the icons, drawn faint where the scene hides them.
 */

// alpha factor of icons the scene hides
const OCCLUDED_ALPHA = 0.2;

/**
 * Draws an icon at each attached entity with nothing else to see, such as a light, camera or sound.
 * Entities with an enabled render, model, sprite or element component show none. Clicking an icon
 * fires {@link IconGizmo.EVENT_ICONSELECT}. The icons are SVG markup in {@link IconGizmo#icons},
 * which can be replaced or extended, and are {@link IconGizmo#iconSize} CSS pixels square.
 *
 * Use a layer that keeps the scene depth, so hidden icons draw faint; a {@link Gizmo.createLayer}
 * layer clears depth.
 *
 * ```javascript
 * const layer = new Layer({ name: 'Overlays', transparentSortMode: SORTMODE_MANUAL });
 * app.scene.layers.push(layer);
 * const gizmo = new IconGizmo(cameraComponent, layer);
 * gizmo.attach([lightEntity, soundEntity]);
 * gizmo.on('icon:select', entity => select(entity));
 *
 * // show a custom icon for entities with a script component
 * gizmo.icons.script = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
 *     <circle cx="12" cy="12" r="8" fill="none" stroke="white" stroke-width="1.6"/>
 * </svg>`;
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
     * Fired when the icon of an entity is clicked.
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
     * The icon of each component, as SVG markup with a square view box, drawn
     * {@link IconGizmo#iconSize} CSS pixels square in the theme color by its alpha. An entity shows
     * the icon of its first enabled component in this order. Defaults to a copy of {@link GIZMO_ICONS}.
     *
     * @type {Record<string, string>}
     * @example
     * // replace the light icon
     * gizmo.icons.light = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">...</svg>';
     */
    icons = { ...GIZMO_ICONS };

    /**
     * Whether to draw light icons in the light color. Defaults to false.
     *
     * @type {boolean}
     */
    useLightColor = false;

    /**
     * The theme.
     *
     * @type {IconGizmoTheme}
     * @private
     */
    _theme = {
        base: Color.WHITE.clone()
    };

    /**
     * The icon colors, the occluded one derived from the base each frame.
     *
     * @private
     */
    _colors = {
        base: this._theme.base,
        occluded: new Color()
    };

    /**
     * The renderer drawing the icons.
     *
     * @type {OverlayRenderer}
     * @private
     */
    _renderer;

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

        this._renderer = new OverlayRenderer(this, this._colors);

        this.on(Gizmo.EVENT_POINTERDOWN, (_x, _y, meshInstance) => {
            const entity = this._renderer.icons.pick(meshInstance);
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
     * Sets the icon size in CSS pixels. Defaults to 24.
     *
     * @type {number}
     */
    set iconSize(value) {
        this._renderer.iconSize = value;
    }

    /**
     * Gets the icon size in CSS pixels.
     *
     * @type {number}
     */
    get iconSize() {
        return this._renderer.iconSize;
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
     * Gets the icon an entity shows. Override to choose icons another way.
     *
     * @param {Entity} entity - The entity.
     * @returns {string|null} The key of the icon in {@link IconGizmo#icons}, or null for none.
     * @protected
     */
    _iconOf(entity) {
        const { render, model, sprite, element } = entity;
        if (!entity.enabled || entity.camera === this._camera ||
            (render?.enabled && render.meshInstances.length > 0) ||
            (model?.enabled && model.meshInstances?.length) ||
            sprite?.enabled || element?.enabled) {
            return null;
        }
        for (const key in this.icons) {
            if (entity.c[key]?.enabled) {
                return key;
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
        const renderer = this._renderer;
        if (!this.enabled) {
            renderer.clear();
            return;
        }

        const { base, occluded } = this._colors;
        occluded.copy(base).a *= OCCLUDED_ALPHA;

        renderer.begin();
        for (let i = 0; i < this.nodes.length; i++) {
            const entity = /** @type {Entity} */ (this.nodes[i]);
            const icon = this._iconOf(entity);
            const svg = icon && this.icons[icon];
            if (svg) {
                renderer.tint = this.useLightColor && icon === 'light' ? /** @type {Color} */ (entity.light?.color) : null;
                renderer.icons.add(svg, entity.getPosition(), entity);
            }
        }
        renderer.tint = null;
        renderer.end();
    }

    /**
     * Destroys the gizmo and its icons.
     *
     * @override
     */
    destroy() {
        this._renderer.destroy();

        super.destroy();
    }
}

export { IconGizmo };
