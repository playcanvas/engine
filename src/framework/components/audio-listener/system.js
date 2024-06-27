import { Debug } from '../../../core/debug.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { AudioListenerComponent } from './component.js';
import { AudioListenerComponentData } from './data.js';

const _schema = ['enabled'];

/**
 * Component System for adding and removing {@link AudioListenerComponent} objects to Entities.
 *
 * @category Sound
 */
class AudioListenerComponentSystem extends ComponentSystem {
    /**
     * Create a new AudioListenerComponentSystem instance.
     *
     * @param {import('../../app-base.js').AppBase} app - The application managing this system.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'audiolistener';

        this.ComponentType = AudioListenerComponent;
        this.DataType = AudioListenerComponentData;

        this.schema = _schema;

        this.manager = app.soundManager;
        Debug.assert(this.manager, "AudioListenerComponentSystem cannot be created witout sound manager");

        this.current = null;

        this.app.systems.on('update', this.onUpdate, this);
    }

    initializeComponentData(component, data, properties) {
        properties = ['enabled'];

        super.initializeComponentData(component, data, properties);
    }

    onUpdate(dt) {
        if (this.current) {
            const position = this.current.getPosition();
            this.manager.listener.setPosition(position);

            const wtm = this.current.getWorldTransform();
            this.manager.listener.setOrientation(wtm);
        }
    }

    destroy() {
        super.destroy();

        this.app.systems.off('update', this.onUpdate, this);
    }
}

Component._buildAccessors(AudioListenerComponent.prototype, _schema);

export { AudioListenerComponentSystem };
