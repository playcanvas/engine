import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { AudioListenerComponent } from './component.js';
import { AudioListenerComponentData } from './data.js';

var _schema = ['enabled'];

/**
 * @class
 * @name pc.AudioListenerComponentSystem
 * @augments pc.ComponentSystem
 * @classdesc Component System for adding and removing {@link pc.AudioComponent} objects to Entities.
 * @description Create a new AudioListenerComponentSystem.
 * @param {pc.Application} app - The application managing this system.
 * @param {pc.SoundManager} manager - A sound manager instance.
 */
function AudioListenerComponentSystem(app, manager) {
    ComponentSystem.call(this, app);

    this.id = "audiolistener";

    this.ComponentType = AudioListenerComponent;
    this.DataType = AudioListenerComponentData;

    this.schema = _schema;

    this.manager = manager;
    this.current = null;

    ComponentSystem.bind('update', this.onUpdate, this);
}
AudioListenerComponentSystem.prototype = Object.create(ComponentSystem.prototype);
AudioListenerComponentSystem.prototype.constructor = AudioListenerComponentSystem;

Component._buildAccessors(AudioListenerComponent.prototype, _schema);

Object.assign(AudioListenerComponentSystem.prototype, {
    initializeComponentData: function (component, data, properties) {
        properties = ['enabled'];

        ComponentSystem.prototype.initializeComponentData.call(this, component, data, properties);
    },

    onUpdate: function (dt) {
        if (this.current) {
            var position = this.current.getPosition();
            this.manager.listener.setPosition(position);

            var wtm = this.current.getWorldTransform();
            this.manager.listener.setOrientation(wtm);
        }
    }
});

export { AudioListenerComponentSystem };
