import { Color, Inspector, Script } from 'playcanvas';

/**
 * Hosts an {@link Inspector} on an entity, so the debug panel can be added to a project from the
 * Editor like any other script. Attach it to a dedicated entity at the root; the panel appears
 * when the script initializes and goes away with it.
 *
 * ```javascript
 * import { EntityInspector } from 'playcanvas/scripts/esm/inspector/entity-inspector.mjs';
 *
 * const entity = new Entity('inspector');
 * entity.addComponent('script');
 * entity.script.create(EntityInspector, {
 *     properties: { dock: 'left', visible: false }
 * });
 * app.root.addChild(entity);
 * ```
 *
 * The hosting entity and its ancestors get no enabled checkbox in the hierarchy, so the panel
 * cannot switch itself off. Everything else is the {@link Inspector} API, reachable through
 * {@link EntityInspector#inspector}.
 */
class EntityInspector extends Script {
    static scriptName = 'entityInspector';

    /**
     * Whether the panel is shown. Toggled by {@link toggleKey}.
     *
     * @attribute
     * @type {boolean}
     */
    visible = true;

    /**
     * The side of the viewport the panel docks to.
     *
     * @attribute
     * @type {'left'|'right'}
     */
    dock = 'right';

    /**
     * The width of the docked panel in CSS pixels.
     *
     * @attribute
     * @type {number}
     * @range [240, 1600]
     */
    width = 420;

    /**
     * A gap left above the panel in CSS pixels, to keep it clear of other overlays.
     *
     * @attribute
     * @type {number}
     * @range [0, 400]
     */
    top = 0;

    /**
     * The `KeyboardEvent.code` or `key` that shows and hides the panel. Empty disables the key.
     *
     * @attribute
     * @type {string}
     */
    toggleKey = 'Backquote';

    /**
     * The key that pauses and resumes the app. Empty disables the key.
     *
     * @attribute
     * @type {string}
     */
    pauseKey = 'F9';

    /**
     * The key that advances one frame while paused. Empty disables the key.
     *
     * @attribute
     * @type {string}
     */
    stepKey = 'F10';

    /**
     * Outline the selected node in the viewport.
     *
     * @attribute
     * @type {boolean}
     */
    highlight = true;

    /**
     * The color of the viewport outline.
     *
     * @attribute
     * @type {Color}
     */
    highlightColor = new Color(1, 0.55, 0.1);

    /**
     * Whether the physics world is drawn over the scene from the start.
     *
     * @attribute
     * @type {boolean}
     */
    physicsDraw = false;

    /**
     * @type {Inspector|null}
     * @private
     */
    _inspector = null;

    /**
     * The inspector this script hosts, or null before the script initializes.
     *
     * @type {Inspector|null}
     */
    get inspector() {
        return this._inspector;
    }

    initialize() {
        this._inspector = new Inspector(this.app, {
            visible: this.visible,
            dock: this.dock,
            width: this.width,
            top: this.top,
            toggleKey: this.toggleKey,
            pauseKey: this.pauseKey,
            stepKey: this.stepKey,
            highlight: this.highlight,
            highlightColor: this.highlightColor,
            physicsDraw: this.physicsDraw,
            lockedNode: this.entity
        });

        // disabling the script hides the panel; enabling it restores whatever the user left
        this.on('disable', () => {
            if (this._inspector) {
                this.visible = this._inspector.visible;
                this._inspector.visible = false;
            }
        });
        this.on('enable', () => {
            if (this._inspector) this._inspector.visible = this.visible;
        });
        this.on('destroy', () => {
            this._inspector?.destroy();
            this._inspector = null;
        });
    }
}

export { EntityInspector };
