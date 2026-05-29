import { Vec3 } from '../../../core/math/vec3.js';
import { BLEND_NORMAL, EMITTERSHAPE_BOX, LAYERID_WORLD, PARTICLEMODE_GPU, PARTICLEORIENTATION_SCREEN } from '../../../scene/constants.js';

/**
 * @import { Asset } from '../../../framework/asset/asset.js'
 * @import { CurveSet } from '../../../core/math/curve-set.js'
 * @import { Curve } from '../../../core/math/curve.js'
 * @import { Mesh } from '../../../scene/mesh.js'
 * @import { Texture } from '../../../platform/graphics/texture.js'
 */

class ParticleSystemComponentData {
    numParticles = 1;                  // Amount of particles allocated (max particles = max GL texture width at this moment)

    rate = 1;                          // Emission rate

    /** @type {number|null} */
    rate2 = null;

    startAngle = 0;

    /** @type {number|null} */
    startAngle2 = null;

    lifetime = 50;                     // Particle lifetime

    emitterExtents = new Vec3();       // Spawn point divergence

    emitterExtentsInner = new Vec3();

    emitterRadius = 0;

    emitterRadiusInner = 0;

    emitterShape = EMITTERSHAPE_BOX;

    initialVelocity = 0;

    wrap = false;

    wrapBounds = new Vec3();

    localSpace = false;

    screenSpace = false;

    /** @type {Texture|null} */
    colorMap = null;

    /** @type {Asset|null} */
    colorMapAsset = null;

    /** @type {Texture|null} */
    normalMap = null;

    /** @type {Asset|null} */
    normalMapAsset = null;

    loop = true;

    preWarm = false;

    sort = 0;                          // Sorting mode: 0 = none, 1 = by distance, 2 = by life, 3 = by -life;   Forces CPU mode if not 0

    mode = PARTICLEMODE_GPU;

    scene = null;

    lighting = false;

    halfLambert = false;            // Uses half-lambert lighting instead of Lambert

    intensity = 1;

    stretch = 0.0;

    alignToMotion = false;

    depthSoftening = 0;

    /** @type {Asset|null} */
    renderAsset = null;

    /** @type {Asset|null} */
    meshAsset = null;

    /** @type {Mesh|null} */
    mesh = null;                       // Mesh to be used as particle. Vertex buffer is supposed to hold vertex position in first 3 floats of each vertex
    // Leave undefined to use simple quads

    depthWrite = false;

    noFog = false;

    orientation = PARTICLEORIENTATION_SCREEN;

    particleNormal = new Vec3(0, 1, 0);

    animTilesX = 1;

    animTilesY = 1;

    animStartFrame = 0;

    animNumFrames = 1;

    animNumAnimations = 1;

    animIndex = 0;

    randomizeAnimIndex = false;

    animSpeed = 1;

    animLoop = true;

    // Time-dependent parameters
    /** @type {Curve|null} */
    scaleGraph = null;

    /** @type {Curve|null} */
    scaleGraph2 = null;

    /** @type {CurveSet|null} */
    colorGraph = null;

    /** @type {CurveSet|null} */
    colorGraph2 = null;

    /** @type {Curve|null} */
    alphaGraph = null;

    /** @type {Curve|null} */
    alphaGraph2 = null;

    /** @type {CurveSet|null} */
    localVelocityGraph = null;

    /** @type {CurveSet|null} */
    localVelocityGraph2 = null;

    /** @type {CurveSet|null} */
    velocityGraph = null;

    /** @type {CurveSet|null} */
    velocityGraph2 = null;

    /** @type {Curve|null} */
    rotationSpeedGraph = null;

    /** @type {Curve|null} */
    rotationSpeedGraph2 = null;

    /** @type {Curve|null} */
    radialSpeedGraph = null;

    /** @type {Curve|null} */
    radialSpeedGraph2 = null;

    blendType = BLEND_NORMAL;

    enabled = true;

    paused = false;

    autoPlay = true;

    layers = [LAYERID_WORLD]; // assign to the default world layer
}

export { ParticleSystemComponentData };
