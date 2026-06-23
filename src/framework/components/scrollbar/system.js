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
        this.on('beforeremove', this.onBeforeRemove, this);
    }

    initializeComponentData(component, data, properties) {
        for (let i = 0; i < _properties.length; i++) {
            const property = _properties[i];
            if (data.hasOwnProperty(property)) {
                component[property] = data[property];
            }
        }

        super.initializeComponentData(component, data);
    }

    cloneComponent(entity, clone) {
        const c = entity.scrollbar;

        const data = {
            enabled: c.enabled
        };

        for (let i = 0; i < _properties.length; i++) {
            const property = _properties[i];
            data[property] = c[property];
        }

        return this.addComponent(clone, data);
    }

    _onAddComponent(entity) {
        entity.fire('scrollbar:add');
    }

    onBeforeRemove(entity, component) {
        component.onBeforeRemove();
    }
}

export { ScrollbarComponentSystem };
