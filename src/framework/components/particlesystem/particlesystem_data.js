pc.extend(pc.fw, function() {
    var ParticleSystemComponentData = function() {

        this.numParticles = 1;                  // Amount of particles allocated (max particles = max GL texture width at this moment)
        this.rate = 1;                          // Emission rate
        this.rate2 = null;
        this.startAngle = 0;
        this.startAngle2 = null;
        this.lifetime = 50;                     // Particle lifetime
        this.lifetime2 = null;
        this.spawnBounds = new pc.Vec3();       // Spawn point divergence
        this.wrapBounds = new pc.Vec3();
        this.smoothness = 4;                    // Blurring width for graphs
        this.colorMap = null;
        this.colorMapAsset = null;
        this.normalMap = null;
        this.normalMapAsset = null;
        this.oneShot = false;
        this.preWarm = false;
        this.sort = 0;                          // Sorting mode: 0 = none, 1 = by distance, 2 = by life, 3 = by -life;   Forces CPU mode if not 0
        this.mode = "GPU";
        this.camera = null;                // Required for CPU sorting
        this.scene = null;
        this.lighting = false;
        this.halfLambert = false;            // Uses half-lambert lighting instead of Lambert
        this.intensity = 1;
        this.maxEmissionTime = 15;
        this.stretch = 0.0;
        this.depthSoftening = 0;
        this.mesh = null;                       // Mesh to be used as particle. Vertex buffer is supposed to hold vertex position in first 3 floats of each vertex
                                                // Leave undefined to use simple quads
        this.depthTest = false;

        // Time-dependent parameters
        this.scaleGraph = null;
        this.scaleGraph2 = null;

        this.colorGraph = null;
        this.colorGraph2 = null;

        this.alphaGraph = null;
        this.alphaGraph2 = null;

        this.localVelocityGraph = null;
        this.localVelocityGraph2 = null;

        this.velocityGraph = null;
        this.velocityGraph2 = null;

        this.rotationSpeedGraph = null;
        this.rotationSpeedGraph2 = null;

        this.blendType = pc.scene.BLEND_PREMULTIPLIED;

        this.model = null;

        this.enabled = true;

    };
    ParticleSystemComponentData = pc.inherits(ParticleSystemComponentData, pc.fw.ComponentData);

    return {
        ParticleSystemComponentData: ParticleSystemComponentData
    };
}());
