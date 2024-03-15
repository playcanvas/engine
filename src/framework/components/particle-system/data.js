import { Vec3 } from '../../../core/math/vec3.js';

import { BLEND_NORMAL, EMITTERSHAPE_BOX, LAYERID_WORLD, PARTICLEMODE_GPU, PARTICLEORIENTATION_SCREEN } from '../../../scene/constants.js';

class ParticleSystemComponentData {
    constructor() {
        this.numParticles = 1;                  // Amount of particles allocated (max particles = max GL texture width at this moment)
        this.rate = 1;                          // Emission rate
        /** @type {number} */
        this.rate2 = null;
        this.startAngle = 0;
        /** @type {number} */
        this.startAngle2 = null;
        this.lifetime = 50;                     // Particle lifetime
        this.emitterExtents = new Vec3();       // Spawn point divergence
        this.emitterExtentsInner = new Vec3();
        this.emitterRadius = 0;
        this.emitterRadiusInner = 0;
        this.emitterShape = EMITTERSHAPE_BOX;
        this.initialVelocity = 0;
        this.wrap = false;
        this.wrapBounds = new Vec3();
        this.localSpace = false;
        this.screenSpace = false;
        /** @type {import('../../../platform/graphics/texture.js').Texture} */
        this.colorMap = null;
        /** @type {import('../../../framework/asset/asset.js').Asset} */
        this.colorMapAsset = null;
        /** @type {import('../../../platform/graphics/texture.js').Texture} */
        this.normalMap = null;
        /** @type {import('../../../framework/asset/asset.js').Asset} */
        this.normalMapAsset = null;
        this.loop = true;
        this.preWarm = false;
        this.sort = 0;                          // Sorting mode: 0 = none, 1 = by distance, 2 = by life, 3 = by -life;   Forces CPU mode if not 0
        this.mode = PARTICLEMODE_GPU;
        this.scene = null;
        this.lighting = false;
        this.halfLambert = false;            // Uses half-lambert lighting instead of Lambert
        this.intensity = 1;
        this.stretch = 0.0;
        this.alignToMotion = false;
        this.depthSoftening = 0;
        /** @type {import('../../../framework/asset/asset.js').Asset} */
        this.renderAsset = null;
        /** @type {import('../../../framework/asset/asset.js').Asset} */
        this.meshAsset = null;
        /** @type {import('../../../scene/mesh.js').Mesh} */
        this.mesh = null;                       // Mesh to be used as particle. Vertex buffer is supposed to hold vertex position in first 3 floats of each vertex
                                                // Leave undefined to use simple quads
        this.depthWrite = false;
        this.noFog = false;

        this.orientation = PARTICLEORIENTATION_SCREEN;
        this.particleNormal = new Vec3(0, 1, 0);

        this.animTilesX = 1;
        this.animTilesY = 1;
        this.animStartFrame = 0;
        this.animNumFrames = 1;
        this.animNumAnimations = 1;
        this.animIndex = 0;
        this.randomizeAnimIndex = false;
        this.animSpeed = 1;
        this.animLoop = true;

        // Time-dependent parameters
        /** @type {import('../../../core/math/curve.js').Curve} */
        this.scaleGraph = null;
        /** @type {import('../../../core/math/curve.js').Curve} */
        this.scaleGraph2 = null;

        /** @type {import('../../../core/math/curve-set.js').CurveSet} */
        this.colorGraph = null;
        /** @type {import('../../../core/math/curve-set.js').CurveSet} */
        this.colorGraph2 = null;

        /** @type {import('../../../core/math/curve.js').Curve} */
        this.alphaGraph = null;
        /** @type {import('../../../core/math/curve.js').Curve} */
        this.alphaGraph2 = null;

        /** @type {import('../../../core/math/curve-set.js').CurveSet} */
        this.localVelocityGraph = null;
        /** @type {import('../../../core/math/curve-set.js').CurveSet} */
        this.localVelocityGraph2 = null;

        /** @type {import('../../../core/math/curve-set.js').CurveSet} */
        this.velocityGraph = null;
        /** @type {import('../../../core/math/curve-set.js').CurveSet} */
        this.velocityGraph2 = null;

        /** @type {import('../../../core/math/curve.js').Curve} */
        this.rotationSpeedGraph = null;
        /** @type {import('../../../core/math/curve.js').Curve} */
        this.rotationSpeedGraph2 = null;

        /** @type {import('../../../core/math/curve.js').Curve} */
        this.radialSpeedGraph = null;
        /** @type {import('../../../core/math/curve.js').Curve} */
        this.radialSpeedGraph2 = null;

        this.blendType = BLEND_NORMAL;

        this.enabled = true;

        this.paused = false;

        this.autoPlay = true;

        this.layers = [LAYERID_WORLD]; // assign to the default world layer
    }
}

export { ParticleSystemComponentData };
