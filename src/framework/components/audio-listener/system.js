import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { AudioListenerComponent } from './component.js';
import { AudioListenerComponentData } from './data.js';

const _schema = ['enabled'];

/**
 * @class
 * @name AudioListenerComponentSystem
 * @augments ComponentSystem
 * @classdesc Component System for adding and removing {@link AudioComponent} objects to Entities.
 * @description Create a new AudioListenerComponentSystem.
 * @param {Application} app - The application managing this system.
 * @param {SoundManager} manager - A sound manager instance.
 */
class AudioListenerComponentSystem extends ComponentSystem {
    constructor(app, manager) {
        super(app);

        this.id = "audiolistener";

        this.ComponentType = AudioListenerComponent;
        this.DataType = AudioListenerComponentData;

        this.schema = _schema;

        this.manager = manager;
        this.current = null;

        ComponentSystem.bind('update', this.onUpdate, this);
    }

    initializeComponentData(component, data, properties) {
        properties = ['enabled'];

        super.initializeComponentData(component, data, properties);
    }

    onUpdate(dt) {
        if (this.current) {
            var position = this.current.getPosition();
            this.manager.listener.setPosition(position);

            var wtm = this.current.getWorldTransform();
            this.manager.listener.setOrientation(wtm);
        }
    }
}

Component._buildAccessors(AudioListenerComponent.prototype, _schema);

export { AudioListenerComponentSystem };
