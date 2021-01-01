import { Component } from '../component.js';

/**
 * @component
 * @class
 * @name pc.AudioListenerComponent
 * @augments pc.Component
 * @classdesc Represents the audio listener in the 3D world, so that 3D positioned audio sources are heard correctly.
 * @description Create new AudioListenerComponent.
 * @param {pc.AudioListenerComponentSystem} system - The ComponentSystem that created this Component.
 * @param {pc.Entity} entity - The Entity that this Component is attached to.
 */
function AudioListenerComponent(system, entity) {
    Component.call(this, system, entity);
}
AudioListenerComponent.prototype = Object.create(Component.prototype);
AudioListenerComponent.prototype.constructor = AudioListenerComponent;

Object.assign(AudioListenerComponent.prototype, {
    setCurrentListener: function () {
        if (this.enabled && this.entity.audiolistener && this.entity.enabled) {
            this.system.current = this.entity;
            var position = this.system.current.getPosition();
            this.system.manager.listener.setPosition(position);
        }
    },

    onEnable: function () {
        this.setCurrentListener();
    },

    onDisable: function () {
        if (this.system.current === this.entity) {
            this.system.current = null;
        }
    }

});

export { AudioListenerComponent };
