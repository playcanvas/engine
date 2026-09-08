import { ComponentSystem } from '../system.js';
import { ScrollViewComponent } from './component.js';

/**
 * @import { AppBase } from '../../app-base.js'
 * @import { Entity } from '../../entity.js'
 * @import { Vec2 } from '../../../core/math/vec2.js'
 */

/**
 * Options of the `scrollview` component accepted by {@link ScrollViewComponentSystem} that differ
 * from the properties of {@link ScrollViewComponent}. Each replaces the same-named property of the
 * options that {@link Entity#addComponent} derives from the component class; see
 * {@link ComponentOptionsOverrides}.
 *
 * @typedef {object} ScrollViewComponentOptionsOverrides
 * @property {Vec2 | number[]} [mouseWheelSensitivity] - Same as
 * {@link ScrollViewComponent#mouseWheelSensitivity}, also accepting an `[x, y]` array.
 * @ignore
 */

// Order matters: scalars/booleans/visibility flags must precede the four entity refs.
// Assigning a scrollbar entity triggers _onHorizontalScrollbarGain / _onVerticalScrollbarGain,
// which call _syncScrollbarEnabledState — that reads `horizontal`/`vertical` and the visibility
// fields. If those are still undefined/0 at that moment, the wrong branch fires.
const _properties = [
    'horizontal',
    'vertical',
    'scrollMode',
    'bounceAmount',
    'friction',
    'dragThreshold',
    'useMouseWheel',
    'mouseWheelSensitivity',
    'horizontalScrollbarVisibility',
    'verticalScrollbarVisibility',
    'viewportEntity',
    'contentEntity',
    'horizontalScrollbarEntity',
    'verticalScrollbarEntity'
];

/**
 * Manages creation of {@link ScrollViewComponent}s.
 *
 * @category User Interface
 */
class ScrollViewComponentSystem extends ComponentSystem {
    /**
     * Create a new ScrollViewComponentSystem instance.
     *
     * @param {AppBase} app - The application.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'scrollview';

        this.ComponentType = ScrollViewComponent;

        this.on('beforeremove', this.onBeforeRemove, this);

        this.app.systems.on('update', this.onUpdate, this);
    }

    initializeComponentData(component, data, properties) {
        for (let i = 0; i < _properties.length; i++) {
            const property = _properties[i];
            // Skip explicit `undefined` so the component's class-field defaults survive.
            // The old initializer normalized dragThreshold / useMouseWheel /
            // mouseWheelSensitivity when they were `=== undefined`; a `hasOwnProperty`
            // guard alone would clobber those defaults with `undefined` if a caller
            // shipped `{ dragThreshold: undefined }`.
            if (data[property] !== undefined) {
                component[property] = data[property];
            }
        }

        super.initializeComponentData(component, data);
    }

    cloneComponent(entity, clone) {
        const c = entity.scrollview;

        const data = {
            enabled: c.enabled
        };

        for (let i = 0; i < _properties.length; i++) {
            const property = _properties[i];
            data[property] = c[property];
        }

        return this.addComponent(clone, data);
    }

    onUpdate(dt) {
        const components = this.store;

        for (const id in components) {
            const entity = components[id].entity;
            const component = entity.scrollview;
            if (component.enabled && entity.enabled) {
                component.onUpdate();
            }

        }
    }

    onBeforeRemove(entity, component) {
        component.onBeforeRemove();
    }

    destroy() {
        super.destroy();

        this.app.systems.off('update', this.onUpdate, this);
    }
}

export { ScrollViewComponentSystem };
