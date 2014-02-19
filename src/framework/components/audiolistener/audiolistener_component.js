pc.extend(pc.fw, function () {
    /**
    * @component
    * @name pc.fw.AudioListenerComponent
    * @class Represent the audio listener in the 3D world, so that 3D positioned audio sources are heard correctly.
    * @constructor Create new AudioListenerComponent
    * @param {pc.fw.AudioListenerComponentSystem} system The ComponentSystem that created this Component
    * @param {pc.fw.Entity} entity The Entity that this Component is attached to.
    * @extends pc.fw.Component
    */
    var AudioListenerComponent = function (system, entity) {
        this.on('set_enabled', this.onSetEnabled, this);
    };

    AudioListenerComponent = pc.inherits(AudioListenerComponent, pc.fw.Component);

    pc.extend(AudioListenerComponent.prototype, {
        setCurrentListener: function () {
            if (this.data.enabled && this.entity.audiolistener) {
                this.system.current = this.entity;
                var position = this.system.current.getPosition();
                this.system.manager.listener.setPosition(position);
            }
        },

        onSetEnabled: function (name, oldValue, newValue) {
            if (oldValue !== newValue) {
                if (newValue) {
                    this.setCurrentListener();
                } else {
                    if (this.system.current === this.entity) {
                        this.system.current = null;
                    }
                }
            }
        }
    });

    return {
        AudioListenerComponent: AudioListenerComponent
    };
}());