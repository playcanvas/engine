pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.AnimationComponentSystem
     * @constructor Create an AnimationComponentSystem
     * @class The AnimationComponentSystem is manages creating and deleting AnimationComponents
     * @param {pc.fw.ApplicationContext} context The ApplicationContext for the current application 
     * @extends pc.fw.ComponentSystem
     */
    var AnimationComponentSystem = function AnimationComponentSystem (context) {
        this.id = 'animation';
        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.AnimationComponent;
        this.DataType = pc.fw.AnimationComponentData;
        
        this.schema = [{
            name: "assets",
            displayName: "Asset",
            description: "Animation Asset",
            type: "asset",
            options: {
                max: 100
            },
            defaultValue: null
        }, {
            name: "speed",
            displayName: "Speed Factor",
            description: "Scale the animation playback speed",
            type: "number",
            options: {
                min: 0.0,
                step: 0.1
            },
            defaultValue: 1.0
        }, {
            name: "loop",
            displayName: "Loop",
            description: "Loop the animation back to the start on completion",
            type: "boolean",
            defaultValue: true
        }, {
            name: "activate",
            displayName: "Activate",
            description: "Play the configured animation on load",
            type: "boolean",
            defaultValue: true
        }, {
            name: "animations",
            exposed: false
        }, {
            name: "skeleton",
            exposed: false,
            readOnly: true
        }, {
            name: "model",
            exposed: false,
            readOnly: true
        }, {
            name: "prevAnim",
            exposed: false,
            readOnly: true
        }, {
            name: "currAnim",
            exposed: false,
            readOnly: true
        }, {
            name: "fromSkel",
            exposed: false,
            readOnly: true
        }, {
            name: "toSkel",
            exposed: false,
            readOnly: true
        }, {
            name: "blending",
            exposed: false,
            readOnly: true
        }, {
            name: "blendTime",
            exposed: false,
            readOnly: true
        }, {
            name: "blendTimeRemaining",
            exposed: false,
            readOnly: true
        }, {
            name: "playing",
            exposed: false,
            readOnly: true
        }];

        this.exposeProperties();

        this.on('remove', this.onRemove, this);
        this.on('update', this.onUpdate, this);

        pc.fw.ComponentSystem.on('update', this.onUpdate, this);
    };
    AnimationComponentSystem = pc.inherits(AnimationComponentSystem, pc.fw.ComponentSystem);
    
    pc.extend(AnimationComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            properties = ['activate', 'loop', 'speed', 'assets'];
            AnimationComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        cloneComponent: function (entity, clone) {
            var component = this.addComponent(clone, {});
            
            clone.animation.data.assets = pc.extend([], entity.animation.assets);
            clone.animation.data.speed = entity.animation.speed;
            clone.animation.data.loop = entity.animation.loop;
            clone.animation.data.activate = entity.animation.activate;

            clone.animation.animations = pc.extend({}, entity.animation.animations);
        },

        onRemove: function (entity, data) {
            delete data.animation;
            delete data.skeleton;
            delete data.fromSkel;
            delete data.toSkel;            
        },

        onUpdate: function (dt) {
            var components = this.store;

            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var componentData = components[id].data;
                    if (componentData.playing) {
                        var skeleton = componentData.skeleton;
                        if (skeleton !== null && componentData.model !== null) {
                            if (componentData.blending) {
                                componentData.blendTimeRemaining -= dt;
                                if (componentData.blendTimeRemaining < 0.0) {
                                    componentData.blendTimeRemaining = 0.0;
                                }
                                var alpha = 1.0 - (componentData.blendTimeRemaining / componentData.blendTime);
                                skeleton.blend(componentData.fromSkel, componentData.toSkel, alpha);
                            } else {
                                // Advance the animation, interpolating keyframes at each animated node in
                                // skeleton
                                var delta = dt * componentData.speed;
                                skeleton.addTime(delta);
                                if ((skeleton.getCurrentTime() === skeleton.getAnimation().getDuration()) && !componentData.loop) {
                                    componentData.playing = false;
                                }
                            }

                            if (componentData.blending && (componentData.blendTimeRemaining === 0.0)) {
                                componentData.blending = false;
                                skeleton.setAnimation(componentData.toSkel.getAnimation());
                            }

                            skeleton.updateGraph();
                        }
                    }            
                }
            }            
        }
    });
    
    return {
        AnimationComponentSystem: AnimationComponentSystem
    };
}());