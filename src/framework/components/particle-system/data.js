Object.assign(pc, function () {
    var ParticleSystemComponentData = function () {

        this.numParticles = 1;                  // Amount of particles allocated (max particles = max GL texture width at this moment)
        this.rate = 1;                          // Emission rate
        this.rate2 = null;
        this.startAngle = 0;
        this.startAngle2 = null;
        this.lifetime = 50;                     // Particle lifetime
        this.emitterExtents = new pc.Vec3();       // Spawn point divergence
        this.emitterExtentsInner = new pc.Vec3();
        this.emitterRadius = 0;
        this.emitterRadiusInner = 0;
        this.emitterShape = pc.EMITTERSHAPE_BOX;
        this.initialVelocity = 0;
        this.wrapBounds = new pc.Vec3();
        this.localSpace = false;
        this.colorMap = null;
        this.colorMapAsset = null;
        this.normalMap = null;
        this.normalMapAsset = null;
        this.loop = true;
        this.preWarm = false;
        this.sort = 0;                          // Sorting mode: 0 = none, 1 = by distance, 2 = by life, 3 = by -life;   Forces CPU mode if not 0
        this.mode = pc.PARTICLEMODE_GPU;
        this.scene = null;
        this.lighting = false;
        this.halfLambert = false;            // Uses half-lambert lighting instead of Lambert
        this.intensity = 1;
        this.stretch = 0.0;
        this.alignToMotion = false;
        this.depthSoftening = 0;
        this.meshAsset = null;
        this.mesh = null;                       // Mesh to be used as particle. Vertex buffer is supposed to hold vertex position in first 3 floats of each vertex
                                                // Leave undefined to use simple quads
        this.depthWrite = false;
        this.noFog = false;

        this.orientation = pc.PARTICLEORIENTATION_SCREEN;
        this.particleNormal = new pc.Vec3(0, 1, 0);

        this.animTilesX = 1;
        this.animTilesY = 1;
        this.animNumFrames = 1;
        this.animSpeed = 1;
        this.animLoop = true;

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

        this.radialSpeedGraph = null;
        this.radialSpeedGraph2 = null;

        this.blendType = pc.BLEND_NORMAL;

        this.model = null;

        this.enabled = true;

        this.paused = false;

        this.autoPlay = true;

        this.layers = [pc.LAYERID_WORLD]; // assign to the default world layer
    };

    return {
        ParticleSystemComponentData: ParticleSystemComponentData
    };
}());
