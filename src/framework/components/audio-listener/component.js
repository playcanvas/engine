import { Component } from '../component.js';

/** @typedef {import('../../entity.js').Entity} Entity */
/** @typedef {import('./system.js').AudioListenerComponentSystem} AudioListenerComponentSystem */

/**
 * Represents the audio listener in the 3D world, so that 3D positioned audio sources are heard
 * correctly.
 *
 * @augments Component
 */
class AudioListenerComponent extends Component {
    /**
     * Create a new AudioListenerComponent instance.
     *
     * @param {AudioListenerComponentSystem} system - The ComponentSystem that created this Component.
     * @param {Entity} entity - The Entity that this Component is attached to.
     */
    constructor(system, entity) { // eslint-disable-line no-useless-constructor
        super(system, entity);
    }

    setCurrentListener() {
        if (this.enabled && this.entity.audiolistener && this.entity.enabled) {
            this.system.current = this.entity;
            const position = this.system.current.getPosition();
            this.system.manager.listener.setPosition(position);
        }
    }

    onEnable() {
        this.setCurrentListener();
    }

    onDisable() {
        if (this.system.current === this.entity) {
            this.system.current = null;
        }
    }
}

export { AudioListenerComponent };
