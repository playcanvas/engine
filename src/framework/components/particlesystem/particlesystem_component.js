pc.extend(pc.fw, function() {
    var ParticleSystemComponent = function ParticleSystemComponent(system, entity) {
        this.on("set", this.onSetParam, this);
    };
    ParticleSystemComponent = pc.inherits(ParticleSystemComponent, pc.fw.Component);

    pc.extend(ParticleSystemComponent.prototype, {

        onSetParam: function(name, oldValue, newValue) {
            if (name=="enabled") return;

            if (this.emitter) {
                this.emitter[name] = newValue; // some parameters can apply immediately

                if (name!="oneShot") {
                    this.emitter.resetMaterial(); // some may require resetting shader constants

                    if ((name!="birthBounds") && (name!="deltaRandomness") // && (name!="rate") && (name!="lifetime") // these params are better reflected after rebuild
                        && (name!="deltaRandomnessStatic")) { // && (name!="stretch") && (name!="wrapBounds")) { // stretch and wrapBounds can be changed realtime, but not turned on/off, so let's just rebuild
                        this.rebuild();
                    }
                } else {
                    this.emitter.resetTime();
                }
            }
        },

        onEnable: function() {

            if (!this.emitter) {
                this.emitter = new pc.scene.ParticleEmitter2(this.system.context.graphicsDevice, {
                    numParticles: this.data.numParticles,
                    birthBounds: this.data.birthBounds,
                    wrapBounds: this.data.wrapBounds,
                    lifetime: this.data.lifetime,
                    rate: this.data.rate,
                    graphLocalOffset: this.data.graphLocalOffset,
                    graphWorldOffset: this.data.graphWorldOffset,
                    graphAngle: this.data.graphAngle,
                    graphScale: this.data.graphScale,
                    graphColor: this.data.graphColor,
                    graphAlpha: this.data.graphAlpha,
                    graphPosDiv: this.data.graphPosDiv,
                    graphPosWorldDiv: this.data.graphPosWorldDiv,
                    graphScaleDiv: this.data.graphScaleDiv,
                    graphAngleDiv: this.data.graphAngleDiv,
                    graphAlphaDiv: this.data.graphAlphaDiv,
                    texture: this.data.texture,
                    textureNormal: this.data.textureNormal,
                    textureAsset: this.data.textureAsset,
                    textureNormalAsset: this.data.textureNormalAsset,
                    oneShot: this.data.oneShot,
                    deltaRandomness: this.data.deltaRandomness,
                    deltaRandomnessStatic: this.data.deltaRandomnessStatic,
                    sort: this.data.sort,
                    stretch: this.data.stretch,
                    lighting: this.data.lighting,
                    softerLighting: this.data.softerLighting,
                    maxEmissionTime: this.data.maxEmissionTime,
                    depthSoftening: this.data.depthSoftening,
                    camera: this.data.camera,
                    scene: this.system.context.scene,
                    mesh: this.data.mesh,
                    ztest: this.data.ztest,
                    srgb: this.data.srgb,
                    smoothness: this.data.smoothness
                });
                this.emitter.meshInstance.node = this.entity;

                this.psys = new pc.scene.Model();
                this.psys.graph = this.entity;
                this.psys.emitter = this.emitter;
                this.psys.meshInstances = [this.emitter.meshInstance];
                this.data.model = this.psys;
                this.emitter.psys = this.psys;

                var comp = this;
				this.emitter.onFinished = function() { // called after oneShot emitter is finished. As you can dynamically change oneShot parameter, it should be always initialized
					comp.enabled = false; // should call onDisable internally
					comp.data.enabled = false;
				};
            }


            ParticleSystemComponent._super.onEnable.call(this);
            if (this.data.model) {
                if (!this.system.context.scene.containsModel(this.data.model)) {
                    if (this.emitter.texture) {
                        this.system.context.scene.addModel(this.data.model);
                    }
                    //this.entity.addChild(this.data.model.graph);
                }
            }
        },

        onDisable: function() {
            ParticleSystemComponent._super.onDisable.call(this);
            if (this.data.model) {
                if (this.system.context.scene.containsModel(this.data.model)) {
                    //this.entity.removeChild(this.data.model.graph);
                    this.system.context.scene.removeModel(this.data.model);
                }
            }
        },

        reset: function() {
            this.emitter.reset();
        },

        rebuild: function() {
            this.enabled = false;
            this.emitter.rebuild(); // worst case: required to rebuild buffers/shaders
            this.emitter.meshInstance.node = this.entity;
            this.data.model.meshInstances = [this.emitter.meshInstance];
            this.enabled = true;
        },
    });


    return {
        ParticleSystemComponent: ParticleSystemComponent
    };
}());
