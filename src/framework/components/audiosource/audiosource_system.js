pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.AudioSourceComponentSystem
     * @constructor AudioSourceComponentSystem controls playback of an audio sample 
     * @param {pc.fw.ApplicationContext} context The ApplicationContext
     * @param {pc.audio.AudioContext} audioContext AudioContext object used to create sources and filters
     * @extends pc.fw.ComponentSystem
     */
    var AudioSourceComponentSystem = function (context, manager) {
        this.id = "audiosource";
        this.description = "Specifies audio assets that can be played at the position of the Entity.";
        context.systems.add(this.id, this);
    
        this.ComponentType = pc.fw.AudioSourceComponent;
        this.DataType = pc.fw.AudioSourceComponentData;

        this.schema = [{
            name: "enabled",
            displayName: "Enabled",
            description: "Disabled audiosource components do not play any sounds",
            type: "boolean",
            defaultValue: true
        },{
            name: "assets",
            displayName: "Assets",
            description: "Audio assets",
            type: "asset",
            options: {
                max: 100,
                type: 'audio'
            },
            defaultValue: []
        }, {
            name: "volume",
            displayName: "Volume",
            description: "The sound volume",
            type: "number",
            options: {
                max: 1,
                min: 0,
                step: 0.1
            },
            defaultValue: 1
        }, {
            name: "pitch",
            displayName: "Pitch",
            description: "The sound pitch",
            type: "number",
            defaultValue: 1,
            options: {
                min: 0.01,
                step: 0.01
            },
        }, {
            name: "loop",
            displayName: "Loop",
            description: "Set whether sound loops or not",
            type: "boolean",
            defaultValue: false
        }, {
            name: "activate",
            displayName: "Activate",
            description: "Play first audio sample when scene loads",
            type: "boolean",
            defaultValue: true
        }, {
            name: "positional",
            displayName: "Positional",
            description: "Positional sounds are positioned in space, and their sound is dependent on listener position/orientation. Non-positional sounds are uniform aross space",
            type: "boolean",
            defaultValue: true
        }, {
            name: "refDistance",
            displayName: "Ref Distance",
            description: "Distance from listener under which the sound is at full volume",
            type: "number",
            defaultValue: 1,
            options: {
                min: 0
            }
        }, {
            name: "maxDistance",
            displayName: "Max Distance",
            description: "Distance from listener over which the sound cannot be heard",
            type: "number",
            defaultValue: 10000,
            options: {
                min: 0
            }
        }, {
            name: "rollOffFactor",
            displayName: "Roll-off factor",
            description: "Strength of the roll off",
            type: "number",
            defaultValue: 1,
            options: {
                min: 0
            }
        }, {
            name: "sources",
            exposed: false,
            readOnly: true
        }, {
            name: "currentSource",
            exposed: false,
            readOnly: true
        }, {
            name: "channel",
            exposed: false,
            readOnly: true
        }];

        this.exposeProperties();
        
        this.manager = manager;
        
        pc.fw.ComponentSystem.on('initialize', this.onInitialize, this);
        pc.fw.ComponentSystem.on('update', this.onUpdate, this);
    };
    AudioSourceComponentSystem = pc.inherits(AudioSourceComponentSystem, pc.fw.ComponentSystem);
    
    pc.extend(AudioSourceComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            if (data.minDistance) {
                console.warn("WARNING: minDistance: Property is deprecated. Set refDistance property instead.");
                data.refDistance = data.minDistance;
            }

            if (data['3d']) {
                console.warn("WARNING: 3d: Property is deprecated. Set positional property instead.");
                data.positional = data['3d'];
            }

            properties = ['enabled', 'assets', 'volume', 'pitch', 'loop', 'activate', 'positional', 'refDistance', 'maxDistance', 'rollOffFactor'];
            AudioSourceComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        
            component.paused = !(component.enabled && data.activate);
        },

        onInitialize: function(root) {
            if (root.audiosource && 
                root.enabled &&
                root.audiosource.enabled &&
                root.audiosource.activate) {
                
                root.audiosource.play(root.audiosource.currentSource);
            }
            
            var children = root.getChildren();
            var i, len = children.length;
            for (i = 0; i < len; i++) {
                if (children[i] instanceof pc.fw.Entity) {
                    this.onInitialize(children[i]);    
                }
            } 
        },

        onUpdate: function(dt) {
            var components = this.store;

            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var component = components[id];
                    var entity = component.entity;
                    var componentData = component.data;
                    
                    // Update channel position if this is a 3d sound
                    if (componentData.enabled && entity.enabled && componentData.channel instanceof pc.audio.Channel3d) {
                        var pos = entity.getPosition();
                        componentData.channel.setPosition(pos);
                    }
                }
            }
        },

        /**
         * @name pc.fw.AudioSourceComponentSystem#setVolume()
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
