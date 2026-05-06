import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { ScrollbarComponent } from './component.js';
import { ScrollbarComponentData } from './data.js';

/**
 * @import { AppBase } from '../../app-base.js'
 */

const _schema = ['enabled'];

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
        this.DataType = ScrollbarComponentData;

        this.schema = _schema;

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

        super.initializeComponentData(component, data, _schema);
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

Component._buildAccessors(ScrollbarComponent.prototype, _schema);

export { ScrollbarComponentSystem };
