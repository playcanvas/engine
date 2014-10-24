pc.extend(pc.fw, function() {
    var ParticleSystemComponentData = function() {

        this.numParticles = 1;                  // Amount of particles allocated (max particles = max GL texture width at this moment)
        this.rate = 1;                          // Emission rate
        this.lifetime = 50;                     // Particle lifetime
        this.spawnBounds = new pc.Vec3();       // Spawn point divergence
        this.wrapBounds = new pc.Vec3();
        this.wind = new pc.Vec3(0, 0, 0);       // Wind velocity
        this.smoothness = 4;                    // Blurring width for graphs
        this.colorMap = null;
        this.colorMapAsset = null;
        this.normalMap = null;
        this.normalMapAsset = null;
        this.oneShot = false;
        this.speedDiv = 0.0;             // Randomizes particle simulation speed [0-1] per frame
        this.constantSpeedDiv = 0.0;       // Randomizes particle simulation speed   [0-1]
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
        this.gammaCorrect = true;

        // Time-dependent parameters
        this.localOffsetGraph = null;
        this.offsetGraph = null;
        this.angleGraph = null;
        this.scaleGraph = null;
        this.colorGraph = null;
        this.alphaGraph = null;
        this.localPosDivGraph = null;
        this.posDivGraph = null;
        this.scaleDivGraph = null;
        this.angleDivGraph = null;
        this.alphaDivGraph = null;

        this.model = null;

        this.enabled = true;

    };
    ParticleSystemComponentData = pc.inherits(ParticleSystemComponentData, pc.fw.ComponentData);

    return {
        ParticleSystemComponentData: ParticleSystemComponentData
    };
}());
