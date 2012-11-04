pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.AudioSourceComponentSystem
     * @constructor AudioSourceComponentSystem controls playback of an audio sample 
     * @param {pc.fw.ApplicationContext} context The ApplicationContext
     * @param {pc.audio.AudioContext} audioContext AudioContext object used to create sources and filters
     * @extends pc.fw.ComponentSystem
     */
    var AudioSourceComponentSystem = function (context, manager) {
        this.id = "audiosource"
        context.systems.add(this.id, this);
    
        this.ComponentType = pc.fw.AudioSourceComponent;
        this.DataType = pc.fw.AudioSourceComponentData;

        this.manager = manager;
        
        //this.bind('remove', this.onRemove.bind(this));
        pc.fw.ComponentSystem.bind('initialize', this.onInitialize.bind(this));
        pc.fw.ComponentSystem.bind('update', this.onUpdate.bind(this));
    };
    AudioSourceComponentSystem = pc.inherits(AudioSourceComponentSystem, pc.fw.ComponentSystem);
    
    pc.extend(AudioSourceComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            properties = ['assets', 'volume', 'loop', 'activate', '3d', 'minDistance', 'maxDistance', 'rollOffFactor'];
            AudioSourceComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        
            component.paused = !data['activate'];
        },

        onInitialize: function(root) {
            if (root.audiosource) {
                if (root.audiosource.activate) {
                    root.audiosource.play(root.audiosource.currentSource);
                }
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
                    var entity = components[id].entity;
                    var componentData = components[id].data;
                    
                    // Update channel position if this is a 3d sound
                    if (componentData.channel instanceof pc.audio.Channel3d) {
                        var pos = entity.getPosition();
                        componentData.channel.setPosition(pos);
                    }
                }
            }
        }
    });
    
    return {
        AudioSourceComponentSystem: AudioSourceComponentSystem
    };
}());
