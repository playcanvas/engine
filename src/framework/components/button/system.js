import { ComponentSystem } from '../system.js';
import { ButtonComponent } from './component.js';

/**
 * @import { AppBase } from '../../app-base.js'
 */

const _properties = [
    'imageEntity',
    'active',
    'hitPadding',
    'transitionMode',
    'hoverTint',
    'pressedTint',
    'inactiveTint',
    'fadeDuration',
    'hoverSpriteAsset',
    'hoverSpriteFrame',
    'pressedSpriteAsset',
    'pressedSpriteFrame',
    'inactiveSpriteAsset',
    'inactiveSpriteFrame'
];

/**
 * Manages creation of {@link ButtonComponent}s.
 *
 * @category User Interface
 */
class ButtonComponentSystem extends ComponentSystem {
    /**
     * Create a new ButtonComponentSystem.
     *
     * @param {AppBase} app - The application.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'button';

        this.ComponentType = ButtonComponent;

        this.on('beforeremove', this.onBeforeRemove, this);

        this.app.systems.on('update', this.onUpdate, this);
    }

    initializeComponentData(component, data, properties) {
        for (let i = 0; i < _properties.length; i++) {
            const property = _properties[i];
            // Guard on `undefined` rather than `hasOwnProperty` so that explicitly
            // passing `{ hoverTint: undefined }` does not clobber the class-field
            // default, matching the base initializer's behavior
            if (data[property] !== undefined) {
                component[property] = data[property];
            }
        }

        super.initializeComponentData(component, data);
    }

    cloneComponent(entity, clone) {
        const c = entity.button;

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
            const component = entity.button;
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

export { ButtonComponentSystem };
