import { ComponentSystem } from '../system.js';

import { ScrollViewComponent } from './component.js';
import { ScrollViewComponentData } from './data.js';

import { Vec2 } from '../../../core/math/vec2.js';

const _schema = [
    { name: 'enabled', type: 'boolean' },
    { name: 'horizontal', type: 'boolean' },
    { name: 'vertical', type: 'boolean' },
    { name: 'scrollMode', type: 'number' },
    { name: 'bounceAmount', type: 'number' },
    { name: 'friction', type: 'number' },
    { name: 'dragThreshold', type: 'number' },
    { name: 'useMouseWheel', type: 'boolean' },
    { name: 'mouseWheelSensitivity', type: 'vec2' },
    { name: 'horizontalScrollbarVisibility', type: 'number' },
    { name: 'verticalScrollbarVisibility', type: 'number' },
    { name: 'viewportEntity', type: 'entity' },
    { name: 'contentEntity', type: 'entity' },
    { name: 'horizontalScrollbarEntity', type: 'entity' },
    { name: 'verticalScrollbarEntity', type: 'entity' }
];

const DEFAULT_DRAG_THRESHOLD = 10;

/**
 * Manages creation of {@link ScrollViewComponent}s.
 *
 * @category User Interface
 */
class ScrollViewComponentSystem extends ComponentSystem {
    /**
     * Create a new ScrollViewComponentSystem instance.
     *
     * @param {import('../../app-base.js').AppBase} app - The application.
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
        if (data.dragThreshold === undefined) {
            data.dragThreshold = DEFAULT_DRAG_THRESHOLD;
        }
        if (data.useMouseWheel === undefined) {
            data.useMouseWheel = true;
        }
        if (data.mouseWheelSensitivity === undefined) {
            data.mouseWheelSensitivity = new Vec2(1, 1);
        }

        super.initializeComponentData(component, data, _schema);
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

export { ScrollViewComponentSystem };
