import { ComponentSystem } from '../system.js';
import { ScrollbarComponent } from './component.js';

/**
 * @import { AppBase } from '../../app-base.js'
 */

const _properties = ['orientation', 'value', 'handleSize', 'handleEntity'];

/**
 * Manages creation of {@link ScrollbarComponent}s.
 *
 * @category User Interface
 */
class ScrollbarComponentSystem extends ComponentSystem {
    /**
     * Create a new ScrollbarComponentSystem.
     *
     * @param {AppBase} app - The application.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'scrollbar';

        this.ComponentType = ScrollbarComponent;

        this.on('add', this._onAddComponent, this);
        this.on('beforeremove', this._onRemoveComponent, this);
    }

    initializeComponentData(component, data, properties) {
        for (let i = 0; i < _properties.length; i++) {
            const property = _properties[i];
            if (data.hasOwnProperty(property)) {
                component[property] = data[property];
            }
        }

        super.initializeComponentData(component, data, ['enabled']);
    }

    cloneComponent(entity, clone) {
        const c = entity.scrollbar;
        return this.addComponent(clone, {
            enabled: c.enabled,
            orientation: c.orientation,
            value: c.value,
            handleSize: c.handleSize,
            handleEntity: c.handleEntity
        });
    }

    _onAddComponent(entity) {
        entity.fire('scrollbar:add');
    }

    _onRemoveComponent(entity, component) {
        component.onRemove();
    }
}

export { ScrollbarComponentSystem };
