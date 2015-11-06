pc.extend(pc, function () {
    /**
    * @component
    * @name pc.AudioListenerComponent
    * @class Represents the audio listener in the 3D world, so that 3D positioned audio sources are heard correctly.
    * @description Create new AudioListenerComponent
    * @param {pc.AudioListenerComponentSystem} system The ComponentSystem that created this Component
    * @param {pc.Entity} entity The Entity that this Component is attached to.
    * @extends pc.Component
    */
    var AudioListenerComponent = function (system, entity) {
    };

    AudioListenerComponent = pc.inherits(AudioListenerComponent, pc.Component);

    pc.extend(AudioListenerComponent.prototype, {
        setCurrentListener: function () {
            if (this.enabled && this.entity.audiolistener && this.entity.enabled) {
                this.system.current = this.entity;
                var position = this.system.current.getPosition();
                this.system.manager.listener.setPosition(position);
            }
        },

        onEnable: function () {
            AudioListenerComponent._super.onEnable.call(this);
            this.setCurrentListener();
        },

        onDisable: function () {
            AudioListenerComponent._super.onDisable.call(this);
            if (this.system.current === this.entity) {
                this.system.current = null;
            }
        }

    });

    return {
        AudioListenerComponent: AudioListenerComponent
    };
}());
