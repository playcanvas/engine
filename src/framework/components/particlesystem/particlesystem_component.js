pc.extend(pc.fw, function() {
    var ParticleSystemComponent = function ParticleSystemComponent(system, entity) {
        this.on("set_oneShot", this.onSetParam, this);
    };
    ParticleSystemComponent = pc.inherits(ParticleSystemComponent, pc.fw.Component);

    pc.extend(ParticleSystemComponent.prototype, {

        onSetParam: function(name, oldValue, newValue) {
            if (this.emitter != undefined) {
                this.emitter[name] = newValue;
            }
        },

        onEnable: function() {

            if (this.emitter == undefined) {
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
                //if (this.emitter.oneShot)
                {
                    this.emitter.onFinished = function() {
                        //comp.onDisable();
                        comp.enabled = false;
                        comp.data.enabled = false;
                    };
                }
            }


            ParticleSystemComponent._super.onEnable.call(this);
            if (this.data.model) {
                if (!this.system.context.scene.containsModel(this.data.model)) {
                    if (this.emitter.texture != undefined) {
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

        Reset: function() {
            this.emitter.Reset();
        },

    });


    return {
        ParticleSystemComponent: ParticleSystemComponent
    };
}());