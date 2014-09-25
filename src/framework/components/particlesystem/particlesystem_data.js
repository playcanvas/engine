pc.extend(pc.fw, function() {
    var ParticleSystemComponentData = function() {

        this.numParticles = 1;                  // Amount of particles allocated                 (max particles = max GL texture width at this moment)
        this.rate = 1;                          // Emission rate
        this.lifetime = 50;                     // Particle lifetime
        this.birthBounds = new pc.Vec3(0, 0, 0);// Spawn point divergence
        this.wrapBounds = null;
        this.wind = new pc.Vec3(0, 0, 0);       // Wind velocity
        this.smoothness = 4;                    // Blurring width for graphs
        this.texture = null;
        this.textureAsset = null;
        this.textureNormal = null;
        this.textureNormalAsset = null;
        this.oneShot = false;
        this.deltaRandomness = 0.0;             // Randomizes particle simulation speed [0-1] per frame
        this.deltaRandomnessStatic = 0.0;       // Randomizes particle simulation speed   [0-1]
        this.sort = 0;                          // Sorting mode: 0 = none, 1 = by distance, 2 = by life, 3 = by -life;   Forces CPU mode if not 0
        this.mode = "GPU";
        this.camera = null;                // Required for CPU sorting
        this.scene = null;
        this.lighting = false;
        this.softerLighting = false;            // Uses half-lambert lighting instead of Lambert
        this.maxEmissionTime = 15;
        this.stretch = 0.0;
        this.depthSoftening = 0;
        this.mesh = null;                       // Mesh to be used as particle. Vertex buffer is supposed to hold vertex position in first 3 floats of each vertex
                                                // Leave undefined to use simple quads
        this.ztest = false;
        this.srgb = true;

        // Time-dependent parameters
        this.graphLocalOffset = null;
        this.graphWorldOffset = null;
        this.graphColor = null;
        this.graphPosDiv = null;
        this.graphPosWorldDiv = null;
        this.graphAngle = null;
        this.graphScale = null;
        this.graphAlpha = null;
        this.graphScaleDiv = null;
        this.graphAngleDiv = null;
        this.graphAlphaDiv = null;

        this.model = null;

        this.enabled = true;

    };
    ParticleSystemComponentData = pc.inherits(ParticleSystemComponentData, pc.fw.ComponentData);

    return {
        ParticleSystemComponentData: ParticleSystemComponentData
    };
}());
