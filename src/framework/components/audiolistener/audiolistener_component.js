pc.extend(pc.fw, function () {
    /**
    * @component
    * @name pc.fw.AudioListenerComponent
    * @class Represent the audio listener in the 3D world, so that 3D positioned audio sources are heard correctly.
    * @constructor Create new AudioListenerComponent
    * @param {pc.fw.AudioListenerComponentSystem} system The ComponentSystem that created this Component
    * @param {pc.fw.Entity} entity The Entity that this Component is attached to.
    * @extends pc.fw.Component
    * @property {Boolean} enabled If false the component will not affect any audio sources
    */
    var AudioListenerComponent = function (system, entity) {
    };

    AudioListenerComponent = pc.inherits(AudioListenerComponent, pc.fw.Component);

    pc.extend(AudioListenerComponent.prototype, {
        setCurrentListener: function () {
            if (this.enabled && this.entity.audiolistener && this.entity.isEnabledInHierarchy()) {
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