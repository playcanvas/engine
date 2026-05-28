import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { ScrollViewComponent } from './component.js';
import { ScrollViewComponentData } from './data.js';

/**
 * @import { AppBase } from '../../app-base.js'
 */

const _schema = ['enabled'];

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
        this.DataType = ScrollViewComponentData;

        this.schema = _schema;

        this.on('beforeremove', this._onRemoveComponent, this);

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

        super.initializeComponentData(component, data, _schema);
    }

    cloneComponent(entity, clone) {
        const c = entity.scrollview;
        return this.addComponent(clone, {
            enabled: c.enabled,
            horizontal: c.horizontal,
            vertical: c.vertical,
            scrollMode: c.scrollMode,
            bounceAmount: c.bounceAmount,
            friction: c.friction,
            dragThreshold: c.dragThreshold,
            useMouseWheel: c.useMouseWheel,
            mouseWheelSensitivity: c.mouseWheelSensitivity,
            horizontalScrollbarVisibility: c.horizontalScrollbarVisibility,
            verticalScrollbarVisibility: c.verticalScrollbarVisibility,
            viewportEntity: c.viewportEntity,
            contentEntity: c.contentEntity,
            horizontalScrollbarEntity: c.horizontalScrollbarEntity,
            verticalScrollbarEntity: c.verticalScrollbarEntity
        });
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

    _onRemoveComponent(entity, component) {
        component.onRemove();
    }

    destroy() {
        super.destroy();

        this.app.systems.off('update', this.onUpdate, this);
    }
}

Component._buildAccessors(ScrollViewComponent.prototype, _schema);

export { ScrollViewComponentSystem };
