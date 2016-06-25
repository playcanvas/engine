pc.extend(pc, function () {
    /**
     * @name pc.AudioSourceComponentSystem
     * @class Controls playback of an audio sample. This class will be deprecated in favor of {@link pc.SoundComponentSystem}.
     * @param {pc.Application} app The Application
     * @param {pc.SoundManager} manager The sound manager
     * @extends pc.ComponentSystem
     */
    var AudioSourceComponentSystem = function (app, manager) {
        this.id = "audiosource";
        this.description = "Specifies audio assets that can be played at the position of the Entity.";
        app.systems.add(this.id, this);

        this.ComponentType = pc.AudioSourceComponent;
        this.DataType = pc.AudioSourceComponentData;

        this.schema = [
            'enabled',
            'assets',
            'volume',
            'pitch',
            'loop',
            'activate',
            '3d',
            'minDistance',
            'maxDistance',
            'rollOffFactor',
            'distanceModel',
            'sources',
            'currentSource',
            'channel'
        ];

        this.manager = manager;

        this.initialized = false;

        pc.ComponentSystem.on('initialize', this.onInitialize, this);
        pc.ComponentSystem.on('update', this.onUpdate, this);

        this.on('remove', this.onRemove, this);
    };
    AudioSourceComponentSystem = pc.inherits(AudioSourceComponentSystem, pc.ComponentSystem);

    pc.extend(AudioSourceComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            properties = ['activate', 'volume', 'pitch', 'loop', '3d', 'minDistance', 'maxDistance', 'rollOffFactor', 'distanceModel', 'enabled', 'assets'];
            AudioSourceComponentSystem._super.initializeComponentData.call(this, component, data, properties);

            component.paused = !(component.enabled && component.activate);
        },

        onInitialize: function(root) {
            if (root.audiosource &&
                root.enabled &&
                root.audiosource.enabled &&
                root.audiosource.activate) {

                root.audiosource.play(root.audiosource.currentSource);
            }

            var children = root._children;
            var i, len = children.length;
            for (i = 0; i < len; i++) {
                if (children[i] instanceof pc.Entity) {
                    this.onInitialize(children[i]);
                }
            }

            this.initialized = true;
        },

        onUpdate: function(dt) {
            var components = this.store;

            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var component = components[id];
                    var entity = component.entity;
                    var componentData = component.data;

                    // Update channel position if this is a 3d sound
                    if (componentData.enabled && entity.enabled && componentData.channel instanceof pc.Channel3d) {
                        var pos = entity.getPosition();
                        componentData.channel.setPosition(pos);
                    }
                }
            }
        },

        onRemove: function (entity, data) {
            if (data.channel) {
                data.channel.stop();
                data.channel = null;
            }
        },

        /**
         * @name pc.AudioSourceComponentSystem#setVolume()
         * @function
         * @description Set the volume for the entire AudioSource system. All sources will have their volume multiplied by this value
         * @param {Number} value The value to set the volume to. Valid from 0.0 - 1.0
         */
        setVolume: function (volume) {
            this.manager.setVolume(volume);
        }
    });

    return {
        AudioSourceComponentSystem: AudioSourceComponentSystem
    };
}());
