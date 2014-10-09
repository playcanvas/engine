pc.extend(pc.fw, function() {
    var ParticleSystemComponent = function ParticleSystemComponent(system, entity) {
        this.on("set", this.onSetParam, this);
    };
    ParticleSystemComponent = pc.inherits(ParticleSystemComponent, pc.fw.Component);

    pc.extend(ParticleSystemComponent.prototype, {

        onSetParam: function(name, oldValue, newValue) {
            if (name === "enabled") {
                return;
            }

            if (this.emitter) {
                this.emitter[name] = newValue; // some parameters can apply immediately

                if (name === "oneShot") {
                    this.emitter.resetTime();
                } else {
                    this.emitter.resetMaterial(); // some may require resetting shader constants

                    if ((name !== "spawnBounds") && (name !== "speedDiv") // && (name!="rate") && (name!="lifetime") // these params are better reflected after rebuild
                        && (name !== "constantSpeedDiv")) { // && (name!="stretch") && (name!="wrapBounds")) { // stretch and wrapBounds can be changed realtime, but not turned on/off, so let's just rebuild
                        this.rebuild();
                    }
                }
            }
        },

        onEnable: function() {
            if (!this.emitter) {
                this.emitter = new pc.scene.ParticleEmitter2(this.system.context.graphicsDevice, {
                    numParticles: this.data.numParticles,
                    spawnBounds: this.data.spawnBounds,
                    wrapBounds: this.data.wrapBounds,
                    lifetime: this.data.lifetime,
                    rate: this.data.rate,
                    localOffsetGraph: this.data.localOffsetGraph,
                    offsetGraph: this.data.offsetGraph,
                    angleGraph: this.data.angleGraph,
                    scaleGraph: this.data.scaleGraph,
                    colorGraph: this.data.colorGraph,
                    alphaGraph: this.data.alphaGraph,
                    localPosDivGraph: this.data.localPosDivGraph,
                    posDivGraph: this.data.posDivGraph,
                    scaleDiv: this.data.scaleDiv,
                    angleDivGraph: this.data.angleDivGraph,
                    alphaDivGraph: this.data.alphaDivGraph,
                    texture: this.data.texture,
                    normalTexture: this.data.normalTexture,
                    textureAsset: this.data.textureAsset,
                    normalTextureAsset: this.data.normalTextureAsset,
                    oneShot: this.data.oneShot,
                    speedDiv: this.data.speedDiv,
                    constantSpeedDiv: this.data.constantSpeedDiv,
                    sort: this.data.sort,
                    stretch: this.data.stretch,
                    lighting: this.data.lighting,
                    halfLambert: this.data.halfLambert,
                    maxEmissionTime: this.data.maxEmissionTime,
                    depthSoftening: this.data.depthSoftening,
                    camera: this.data.camera,
                    scene: this.system.context.scene,
                    mesh: this.data.mesh,
                    depthTest: this.data.depthTest,
                    gammaCorrect: this.data.gammaCorrect,
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
                }
            }
        },

        onDisable: function() {
            ParticleSystemComponent._super.onDisable.call(this);
            if (this.data.model) {
                if (this.system.context.scene.containsModel(this.data.model)) {
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
