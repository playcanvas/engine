import { Component } from '../component.js';

/**
 * Represents the audio listener in the 3D world, so that 3D positioned audio sources are heard
 * correctly.
 *
 * @hideconstructor
 * @category Sound
 */
class AudioListenerComponent extends Component {
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
