import { now } from '../../core/time.js';

import { math } from '../../math/math.js';
import { Mat4 } from '../../math/mat4.js';
import { Quat } from '../../math/quat.js';
import { Vec3 } from '../../math/vec3.js';

import { BoundingBox } from '../../shape/bounding-box.js';

import { Curve } from '../../math/curve.js';
import { CurveSet } from '../../math/curve-set.js';

import {
    ADDRESS_CLAMP_TO_EDGE,
    BUFFER_DYNAMIC,
    CULLFACE_NONE,
    FILTER_LINEAR, FILTER_NEAREST,
    INDEXFORMAT_UINT16,
    PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_RGBA32F,
    PRIMITIVE_TRIANGLES,
    SEMANTIC_ATTR0, SEMANTIC_ATTR1, SEMANTIC_ATTR2, SEMANTIC_ATTR3, SEMANTIC_ATTR4, SEMANTIC_TEXCOORD0,
    TYPE_FLOAT32
} from '../../graphics/constants.js';
import { createShaderFromCode } from '../../graphics/program-lib/utils.js';
import { shaderChunks } from '../../graphics/program-lib/chunks/chunks.js';
import { IndexBuffer } from '../../graphics/index-buffer.js';
import { RenderTarget } from '../../graphics/render-target.js';
import { Texture } from '../../graphics/texture.js';
import { VertexBuffer } from '../../graphics/vertex-buffer.js';
import { VertexFormat } from '../../graphics/vertex-format.js';

import {
    BLEND_NORMAL,
    EMITTERSHAPE_BOX,
    PARTICLEMODE_GPU,
    PARTICLEORIENTATION_SCREEN, PARTICLEORIENTATION_WORLD,
    PARTICLESORT_NONE
} from '../../scene/constants.js';
import { Material } from '../../scene/materials/material.js';
import { Mesh } from '../../scene/mesh.js';
import { MeshInstance } from '../../scene/mesh-instance.js';

import { ParticleCPUUpdater } from './cpu-updater.js';
import { ParticleGPUUpdater } from './gpu-updater.js';

const particleVerts = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1]
];

function _createTexture(device, width, height, pixelData, format = PIXELFORMAT_RGBA32F, mult8Bit, filter) {

    var mipFilter = FILTER_NEAREST;
    if (filter && format === PIXELFORMAT_R8_G8_B8_A8)
        mipFilter = FILTER_LINEAR;

    var texture = new Texture(device, {
        width: width,
        height: height,
        format: format,
        cubemap: false,
        mipmaps: false,
        minFilter: mipFilter,
        magFilter: mipFilter,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE
    });
    texture.name = "PSTexture";

    var pixels = texture.lock();

    if (format === PIXELFORMAT_R8_G8_B8_A8) {
        var temp = new Uint8Array(pixelData.length);
        for (var i = 0; i < pixelData.length; i++) {
            temp[i] = pixelData[i] * mult8Bit * 255;
        }
        pixelData = temp;
    }

    pixels.set(pixelData);

    texture.unlock();

    return texture;
}

function saturate(x) {
    return Math.max(Math.min(x, 1), 0);
}

var default0Curve = new Curve([0, 0, 1, 0]);
var default1Curve = new Curve([0, 1, 1, 1]);
var default0Curve3 = new CurveSet([0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]);
var default1Curve3 = new CurveSet([0, 1, 1, 1], [0, 1, 1, 1], [0, 1, 1, 1]);

var particleTexHeight = 2;
var particleTexChannels = 4; // there is a duplicate in cpu updater

var extentsInnerRatioUniform = new Float32Array(3);
var spawnMatrix = new Mat4();

var tmpVec3 = new Vec3();
var bMin = new Vec3();
var bMax = new Vec3();

var setPropertyTarget;
var setPropertyOptions;

function setProperty(pName, defaultVal) {
    if (setPropertyOptions[pName] !== undefined && setPropertyOptions[pName] !== null) {
        setPropertyTarget[pName] = setPropertyOptions[pName];
    } else {
        setPropertyTarget[pName] = defaultVal;
    }
}

function pack3NFloats(a, b, c) {
    var packed = ((a * 255) << 16) | ((b * 255) << 8) | (c * 255);
    return (packed) / (1 << 24);
}

function packTextureXYZ_NXYZ(qXYZ, qXYZ2) {
    var num = qXYZ.length / 3;
    var colors = new Array(num * 4);
    for (var i = 0; i < num; i++) {
        colors[i * 4] = qXYZ[i * 3];
        colors[i * 4 + 1] = qXYZ[i * 3 + 1];
        colors[i * 4 + 2] = qXYZ[i * 3 + 2];

        colors[i * 4 + 3] = pack3NFloats(qXYZ2[i * 3], qXYZ2[i * 3 + 1], qXYZ2[i * 3 + 2]);
    }
    return colors;
}

function packTextureRGBA(qRGB, qA) {
    var colors = new Array(qA.length * 4);
    for (var i = 0; i < qA.length; i++) {
        colors[i * 4] = qRGB[i * 3];
        colors[i * 4 + 1] = qRGB[i * 3 + 1];
        colors[i * 4 + 2] = qRGB[i * 3 + 2];

        colors[i * 4 + 3] = qA[i];
    }
    return colors;
}

function packTexture5Floats(qA, qB, qC, qD, qE) {
    var colors = new Array(qA.length * 4);
    for (var i = 0; i < qA.length; i++) {
        colors[i * 4] = qA[i];
        colors[i * 4 + 1] = qB[i];
        colors[i * 4 + 2] = 0;

        colors[i * 4 + 3] = pack3NFloats(qC[i], qD[i], qE[i]);
    }
    return colors;
}

function packTexture2Floats(qA, qB) {
    var colors = new Array(qA.length * 4);
    for (var i = 0; i < qA.length; i++) {
        colors[i * 4] = qA[i];
        colors[i * 4 + 1] = qB[i];
        colors[i * 4 + 2] = 0;
        colors[i * 4 + 3] = 0;
    }
    return colors;
}

function calcEndTime(emitter) {
    var interval = (Math.max(emitter.rate, emitter.rate2) * emitter.numParticles + emitter.lifetime);
    return Date.now() + interval * 1000;
}

function subGraph(A, B) {
    var r = new Float32Array(A.length);
    for (var i = 0; i < A.length; i++) {
        r[i] = A[i] - B[i];
    }
    return r;
}

function maxUnsignedGraphValue(A, outUMax) {
    var i, j;
    var chans = outUMax.length;
    var values = A.length / chans;
    for (i = 0; i < values; i++) {
        for (j = 0; j < chans; j++) {
            var a = Math.abs(A[i * chans + j]);
            outUMax[j] = Math.max(outUMax[j], a);
        }
    }
}

function normalizeGraph(A, uMax) {
    var chans = uMax.length;
    var i, j;
    var values = A.length / chans;
    for (i = 0; i < values; i++) {
        for (j = 0; j < chans; j++) {
            A[i * chans + j] /= (uMax[j] === 0 ? 1 : uMax[j]);
            A[i * chans + j] *= 0.5;
            A[i * chans + j] += 0.5;
        }
    }
}

function divGraphFrom2Curves(curve1, curve2, outUMax) {
    var sub = subGraph(curve2, curve1);
    maxUnsignedGraphValue(sub, outUMax);
    normalizeGraph(sub, outUMax);
    return sub;
}

class ParticleEmitter {
    constructor(graphicsDevice, options) {
        this.graphicsDevice = graphicsDevice;
        var gd = graphicsDevice;
        var precision = 32;
        this.precision = precision;

        this._addTimeTime = 0;


        if (!ParticleEmitter.DEFAULT_PARAM_TEXTURE) {
            // White radial gradient
            var resolution = 16;
            var centerPoint = resolution * 0.5 + 0.5;
            var dtex = new Float32Array(resolution * resolution * 4);
            var x, y, xgrad, ygrad, p, c;
            for (y = 0; y < resolution; y++) {
                for (x = 0; x < resolution; x++) {
                    xgrad = (x + 1) - centerPoint;
                    ygrad = (y + 1) - centerPoint;
                    c = saturate((1 - saturate(Math.sqrt(xgrad * xgrad + ygrad * ygrad) / resolution)) - 0.5);
                    p = y * resolution + x;
                    dtex[p * 4] =     1;
                    dtex[p * 4 + 1] = 1;
                    dtex[p * 4 + 2] = 1;
                    dtex[p * 4 + 3] = c;
                }
            }
            ParticleEmitter.DEFAULT_PARAM_TEXTURE = _createTexture(gd, resolution, resolution, dtex, PIXELFORMAT_R8_G8_B8_A8, 1.0, true);
            ParticleEmitter.DEFAULT_PARAM_TEXTURE.minFilter = FILTER_LINEAR;
            ParticleEmitter.DEFAULT_PARAM_TEXTURE.magFilter = FILTER_LINEAR;
        }

        // Global system parameters
        setPropertyTarget = this;
        setPropertyOptions = options;
        setProperty("numParticles", 1);                          // Amount of particles allocated (max particles = max GL texture width at this moment)

        if (this.numParticles > graphicsDevice.maxTextureSize) {
            console.warn("WARNING: can't create more than " + graphicsDevice.maxTextureSize + " particles on this device.");
            this.numParticles = graphicsDevice.maxTextureSize;
        }

        setProperty("rate", 1);                                  // Emission rate
        setProperty("rate2", this.rate);
        setProperty("lifetime", 50);                             // Particle lifetime
        setProperty("emitterExtents", new Vec3(0, 0, 0));        // Spawn point divergence
        setProperty("emitterExtentsInner", new Vec3(0, 0, 0));   // Volume inside emitterExtents to exclude from regeneration
        setProperty("emitterRadius", 0);
        setProperty("emitterRadiusInner", 0);                       // Same as ExtentsInner but for spherical volume
        setProperty("emitterShape", EMITTERSHAPE_BOX);
        setProperty("initialVelocity", 1);
        setProperty("wrap", false);
        setProperty("localSpace", false);
        setProperty("screenSpace", false);
        setProperty("wrapBounds", null);
        setProperty("colorMap", ParticleEmitter.DEFAULT_PARAM_TEXTURE);
        setProperty("normalMap", null);
        setProperty("loop", true);
        setProperty("preWarm", false);
        setProperty("sort", PARTICLESORT_NONE); // Sorting mode: 0 = none, 1 = by distance, 2 = by life, 3 = by -life;  Forces CPU mode if not 0
        setProperty("mode", PARTICLEMODE_GPU);
        setProperty("scene", null);
        setProperty("lighting", false);
        setProperty("halfLambert", false);
        setProperty("intensity", 1.0);
        setProperty("stretch", 0.0);
        setProperty("alignToMotion", false);
        setProperty("depthSoftening", 0);
        setProperty("mesh", null);                              // Mesh to be used as particle. Vertex buffer is supposed to hold vertex position in first 3 floats of each vertex
                                                                // Leave undefined to use simple quads
        setProperty("particleNormal", new Vec3(0, 1, 0));
        setProperty("orientation", PARTICLEORIENTATION_SCREEN);

        setProperty("depthWrite", false);
        setProperty("noFog", false);
        setProperty("blendType", BLEND_NORMAL);
        setProperty("node", null);
        setProperty("startAngle", 0);
        setProperty("startAngle2", this.startAngle);

        setProperty("animTilesX", 1);
        setProperty("animTilesY", 1);
        setProperty("animStartFrame", 0);
        setProperty("animNumFrames", 1);
        setProperty("animNumAnimations", 1);
        setProperty("animIndex", 0);
        setProperty("randomizeAnimIndex", false);
        setProperty("animSpeed", 1);
        setProperty("animLoop", true);

        this._gpuUpdater = new ParticleGPUUpdater(this, gd);
        this._cpuUpdater = new ParticleCPUUpdater(this);

        this.constantLightCube = gd.scope.resolve("lightCube[0]");
        this.emitterPosUniform = new Float32Array(3);
        this.wrapBoundsUniform = new Float32Array(3);
        this.emitterScaleUniform = new Float32Array([1, 1, 1]);

        // Time-dependent parameters
        setProperty("colorGraph", default1Curve3);
        setProperty("colorGraph2", this.colorGraph);

        setProperty("scaleGraph", default1Curve);
        setProperty("scaleGraph2", this.scaleGraph);

        setProperty("alphaGraph", default1Curve);
        setProperty("alphaGraph2", this.alphaGraph);

        setProperty("localVelocityGraph", default0Curve3);
        setProperty("localVelocityGraph2", this.localVelocityGraph);

        setProperty("velocityGraph", default0Curve3);
        setProperty("velocityGraph2", this.velocityGraph);

        setProperty("rotationSpeedGraph", default0Curve);
        setProperty("rotationSpeedGraph2", this.rotationSpeedGraph);

        setProperty("radialSpeedGraph", default0Curve);
        setProperty("radialSpeedGraph2", this.radialSpeedGraph);

        this.lightCube = new Float32Array(6 * 3);
        this.lightCubeDir = new Array(6);
        this.lightCubeDir[0] = new Vec3(-1, 0, 0);
        this.lightCubeDir[1] = new Vec3(1, 0, 0);
        this.lightCubeDir[2] = new Vec3(0, -1, 0);
        this.lightCubeDir[3] = new Vec3(0, 1, 0);
        this.lightCubeDir[4] = new Vec3(0, 0, -1);
        this.lightCubeDir[5] = new Vec3(0, 0, 1);

        this.animTilesParams = new Float32Array(2);
        this.animParams = new Float32Array(4);
        this.animIndexParams = new Float32Array(2);

        this.internalTex0 = null;
        this.internalTex1 = null;
        this.internalTex2 = null;
        this.colorParam = null;

        this.vbToSort = null;
        this.vbOld = null;
        this.particleDistance = null;

        this.camera = null;

        this.swapTex = false;
        this.useMesh = true;
        this.useCpu = false;

        this.pack8 = true;
        this.localBounds = new BoundingBox();
        this.worldBoundsNoTrail = new BoundingBox();
        this.worldBoundsTrail = [new BoundingBox(), new BoundingBox()];
        this.worldBounds = new BoundingBox();

        this.worldBoundsSize = new Vec3();

        this.prevWorldBoundsSize = new Vec3();
        this.prevWorldBoundsCenter = new Vec3();
        this.prevEmitterExtents = this.emitterExtents;
        this.prevEmitterRadius = this.emitterRadius;
        this.worldBoundsMul = new Vec3();
        this.worldBoundsAdd = new Vec3();
        this.timeToSwitchBounds = 0;
        // this.prevPos = new Vec3();

        this.shaderParticleUpdateRespawn = null;
        this.shaderParticleUpdateNoRespawn = null;
        this.shaderParticleUpdateOnStop = null;

        this.numParticleVerts = 0;
        this.numParticleIndices = 0;

        this.material = null;
        this.meshInstance = null;
        this.drawOrder = 0;

        this.seed = Math.random();

        this.fixedTimeStep = 1.0 / 60;
        this.maxSubSteps = 10;
        this.simTime = 0;
        this.simTimeTotal = 0;

        this.beenReset = false;

        this._layer = null;

        this.rebuild();
    }

    onChangeCamera() {
        this.regenShader();
        this.resetMaterial();
    }

    calculateBoundsMad() {
        this.worldBoundsMul.x = 1.0 / this.worldBoundsSize.x;
        this.worldBoundsMul.y = 1.0 / this.worldBoundsSize.y;
        this.worldBoundsMul.z = 1.0 / this.worldBoundsSize.z;

        this.worldBoundsAdd.copy(this.worldBounds.center).mul(this.worldBoundsMul).mulScalar(-1);
        this.worldBoundsAdd.x += 0.5;
        this.worldBoundsAdd.y += 0.5;
        this.worldBoundsAdd.z += 0.5;
    }

    calculateWorldBounds() {
        if (!this.node) return;

        this.prevWorldBoundsSize.copy(this.worldBoundsSize);
        this.prevWorldBoundsCenter.copy(this.worldBounds.center);

        if (!this.useCpu) {
            var recalculateLocalBounds = false;
            if (this.emitterShape === EMITTERSHAPE_BOX) {
                recalculateLocalBounds = !this.emitterExtents.equals(this.prevEmitterExtents);
            } else {
                recalculateLocalBounds = !(this.emitterRadius === this.prevEmitterRadius);
            }
            if (recalculateLocalBounds) {
                this.calculateLocalBounds();
            }
        }


        var nodeWT = this.node.getWorldTransform();
        if (this.localSpace) {
            this.worldBoundsNoTrail.copy(this.localBounds);
        } else {
            this.worldBoundsNoTrail.setFromTransformedAabb(this.localBounds, nodeWT);
        }

        this.worldBoundsTrail[0].add(this.worldBoundsNoTrail);
        this.worldBoundsTrail[1].add(this.worldBoundsNoTrail);

        var now = this.simTimeTotal;
        if (now >= this.timeToSwitchBounds) {
            this.worldBoundsTrail[0].copy(this.worldBoundsTrail[1]);
            this.worldBoundsTrail[1].copy(this.worldBoundsNoTrail);
            this.timeToSwitchBounds = now + this.lifetime;
        }

        this.worldBounds.copy(this.worldBoundsTrail[0]);

        this.worldBoundsSize.copy(this.worldBounds.halfExtents).mulScalar(2);

        if (this.localSpace) {
            this.meshInstance.aabb.setFromTransformedAabb(this.worldBounds, nodeWT);
            this.meshInstance.mesh.aabb.setFromTransformedAabb(this.worldBounds, nodeWT);
        } else {
            this.meshInstance.aabb.copy(this.worldBounds);
            this.meshInstance.mesh.aabb.copy(this.worldBounds);
        }
        this.meshInstance._aabbVer = 1 - this.meshInstance._aabbVer;

        if (this.pack8) this.calculateBoundsMad();
    }

    resetWorldBounds() {
        if (!this.node) return;

        this.worldBoundsNoTrail.setFromTransformedAabb(
            this.localBounds, this.localSpace ? Mat4.IDENTITY : this.node.getWorldTransform());

        this.worldBoundsTrail[0].copy(this.worldBoundsNoTrail);
        this.worldBoundsTrail[1].copy(this.worldBoundsNoTrail);

        this.worldBounds.copy(this.worldBoundsTrail[0]);
        this.worldBoundsSize.copy(this.worldBounds.halfExtents).mulScalar(2);

        this.prevWorldBoundsSize.copy(this.worldBoundsSize);
        this.prevWorldBoundsCenter.copy(this.worldBounds.center);

        this.simTimeTotal = 0;
        this.timeToSwitchBounds = 0;
    }

    calculateLocalBounds() {
        var minx = Number.MAX_VALUE;
        var miny = Number.MAX_VALUE;
        var minz = Number.MAX_VALUE;
        var maxx = -Number.MAX_VALUE;
        var maxy = -Number.MAX_VALUE;
        var maxz = -Number.MAX_VALUE;
        var maxR = 0;
        var maxScale = 0;
        var stepWeight = this.lifetime / this.precision;
        var wVels = [this.qVelocity, this.qVelocity2];
        var lVels = [this.qLocalVelocity, this.qLocalVelocity2];
        var accumX = [0, 0];
        var accumY = [0, 0];
        var accumZ = [0, 0];
        var accumR = [0, 0];
        var accumW = [0, 0];
        var i, j;
        var index;
        var x, y, z;
        for (i = 0; i < this.precision + 1; i++) { // take extra step to prevent position glitches
            index = Math.min(i, this.precision - 1);
            for (j = 0; j < 2; j++) {
                x = lVels[j][index * 3 + 0] * stepWeight + accumX[j];
                y = lVels[j][index * 3 + 1] * stepWeight + accumY[j];
                z = lVels[j][index * 3 + 2] * stepWeight + accumZ[j];

                minx = Math.min(x, minx);
                miny = Math.min(y, miny);
                minz = Math.min(z, minz);
                maxx = Math.max(x, maxx);
                maxy = Math.max(y, maxy);
                maxz = Math.max(z, maxz);

                accumX[j] = x;
                accumY[j] = y;
                accumZ[j] = z;
            }
            for (j = 0; j < 2; j++) {
                accumW[j] += stepWeight * Math.sqrt(
                    wVels[j][index * 3 + 0] * wVels[j][index * 3 + 0] +
                    wVels[j][index * 3 + 1] * wVels[j][index * 3 + 1] +
                    wVels[j][index * 3 + 2] * wVels[j][index * 3 + 2]);
            }

            accumR[0] += this.qRadialSpeed[index] * stepWeight;
            accumR[1] += this.qRadialSpeed2[index] * stepWeight;
            maxR = Math.max(maxR, Math.max(Math.abs(accumR[0]), Math.abs(accumR[1])));

            maxScale = Math.max(maxScale, this.qScale[index]);
        }

        if (this.emitterShape === EMITTERSHAPE_BOX) {
            x = this.emitterExtents.x * 0.5;
            y = this.emitterExtents.y * 0.5;
            z = this.emitterExtents.z * 0.5;
        } else {
            x = this.emitterRadius;
            y = this.emitterRadius;
            z = this.emitterRadius;
        }

        var w = Math.max(accumW[0], accumW[1]);
        bMin.x = minx - maxScale - x - maxR - w;
        bMin.y = miny - maxScale - y - maxR - w;
        bMin.z = minz - maxScale - z - maxR - w;
        bMax.x = maxx + maxScale + x + maxR + w;
        bMax.y = maxy + maxScale + y + maxR + w;
        bMax.z = maxz + maxScale + z + maxR + w;
        this.localBounds.setMinMax(bMin, bMax);
    }

    rebuild() {
        var i;
        var gd = this.graphicsDevice;

        if (this.colorMap === null) this.colorMap = ParticleEmitter.DEFAULT_PARAM_TEXTURE;

        this.spawnBounds = this.emitterShape === EMITTERSHAPE_BOX ? this.emitterExtents : this.emitterRadius;

        this.useCpu = this.useCpu || this.sort > PARTICLESORT_NONE ||  // force CPU if desirable by user or sorting is enabled
        gd.maxVertexTextures <= 1 || // force CPU if can't use enough vertex textures
        gd.fragmentUniformsCount < 64 || // force CPU if can't use many uniforms; TODO: change to more realistic value (this one is iphone's)
        gd.forceCpuParticles ||
        !gd.extTextureFloat; // no float texture extension

        this._destroyResources();

        this.pack8 = (this.pack8 || !gd.textureFloatRenderable) && !this.useCpu;

        particleTexHeight = (this.useCpu || this.pack8) ? 4 : 2;

        this.useMesh = false;
        if (this.mesh) {
            var totalVertCount = this.numParticles * this.mesh.vertexBuffer.numVertices;
            if (totalVertCount > 65535) {
                console.warn("WARNING: particle system can't render mesh particles because numParticles * numVertices is more than 65k. Reverting to quad particles.");
            } else {
                this.useMesh = true;
            }
        }

        this.numParticlesPot = math.nextPowerOfTwo(this.numParticles);
        this.rebuildGraphs();
        this.calculateLocalBounds();
        this.resetWorldBounds();

        if (this.node) {
            // this.prevPos.copy(this.node.getPosition());
            this.worldBounds.setFromTransformedAabb(
                this.localBounds, this.localSpace ? Mat4.IDENTITY : this.node.getWorldTransform());

            this.worldBoundsTrail[0].copy(this.worldBounds);
            this.worldBoundsTrail[1].copy(this.worldBounds);

            this.worldBoundsSize.copy(this.worldBounds.halfExtents).mulScalar(2);
            this.prevWorldBoundsSize.copy(this.worldBoundsSize);
            this.prevWorldBoundsCenter.copy(this.worldBounds.center);
            if (this.pack8) this.calculateBoundsMad();
        }

        // Dynamic simulation data
        this.vbToSort = new Array(this.numParticles);
        for (var iSort = 0; iSort < this.numParticles; iSort++) this.vbToSort[iSort] = [0, 0];
        this.particleDistance = new Float32Array(this.numParticles);

        this._gpuUpdater.randomize();

        this.particleTex = new Float32Array(this.numParticlesPot * particleTexHeight * particleTexChannels);
        var emitterPos = (this.node === null || this.localSpace) ? Vec3.ZERO : this.node.getPosition();
        if (this.emitterShape === EMITTERSHAPE_BOX) {
            if (this.node === null || this.localSpace) {
                spawnMatrix.setTRS(Vec3.ZERO, Quat.IDENTITY, this.spawnBounds);
            } else {
                spawnMatrix.setTRS(Vec3.ZERO, this.node.getRotation(), tmpVec3.copy(this.spawnBounds).mul(this.node.localScale));
            }
            extentsInnerRatioUniform[0] = this.emitterExtents.x !== 0 ? this.emitterExtentsInner.x / this.emitterExtents.x : 0;
            extentsInnerRatioUniform[1] = this.emitterExtents.y !== 0 ? this.emitterExtentsInner.y / this.emitterExtents.y : 0;
            extentsInnerRatioUniform[2] = this.emitterExtents.z !== 0 ? this.emitterExtentsInner.z / this.emitterExtents.z : 0;
        }
        for (i = 0; i < this.numParticles; i++) {
            this._cpuUpdater.calcSpawnPosition(this.particleTex, spawnMatrix, extentsInnerRatioUniform, emitterPos, i);
            if (this.useCpu) this.particleTex[i * particleTexChannels + 3 + this.numParticlesPot * 2 * particleTexChannels] = 1; // hide/show
        }

        this.particleTexStart = new Float32Array(this.numParticlesPot * particleTexHeight * particleTexChannels);
        for (i = 0; i < this.particleTexStart.length; i++) this.particleTexStart[i] = this.particleTex[i];

        if (!this.useCpu) {
            if (this.pack8) {
                this.particleTexIN = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTex, PIXELFORMAT_R8_G8_B8_A8, 1, false);
                this.particleTexOUT = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTex, PIXELFORMAT_R8_G8_B8_A8, 1, false);
                this.particleTexStart = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTexStart, PIXELFORMAT_R8_G8_B8_A8, 1, false);
            } else {
                this.particleTexIN = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTex);
                this.particleTexOUT = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTex);
                this.particleTexStart = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTexStart);
            }

            this.rtParticleTexIN = new RenderTarget({
                colorBuffer: this.particleTexIN,
                depth: false
            });
            this.rtParticleTexOUT = new RenderTarget({
                colorBuffer: this.particleTexOUT,
                depth: false
            });
            this.swapTex = false;
        }

        var shaderCodeStart = (this.localSpace ? '#define LOCAL_SPACE\n' : '') + shaderChunks.particleUpdaterInitPS +
        (this.pack8 ? (shaderChunks.particleInputRgba8PS + shaderChunks.particleOutputRgba8PS) :
            (shaderChunks.particleInputFloatPS + shaderChunks.particleOutputFloatPS)) +
        (this.emitterShape === EMITTERSHAPE_BOX ? shaderChunks.particleUpdaterAABBPS : shaderChunks.particleUpdaterSpherePS) +
        shaderChunks.particleUpdaterStartPS;
        var shaderCodeRespawn = shaderCodeStart + shaderChunks.particleUpdaterRespawnPS + shaderChunks.particleUpdaterEndPS;
        var shaderCodeNoRespawn = shaderCodeStart + shaderChunks.particleUpdaterNoRespawnPS + shaderChunks.particleUpdaterEndPS;
        var shaderCodeOnStop = shaderCodeStart + shaderChunks.particleUpdaterOnStopPS + shaderChunks.particleUpdaterEndPS;

        // Note: createShaderFromCode can return a shader from the cache (not a new shader) so we *should not* delete these shaders
        // when the particle emitter is destroyed
        var params = this.emitterShape + "" + this.pack8 + "" + this.localSpace;
        this.shaderParticleUpdateRespawn = createShaderFromCode(gd, shaderChunks.fullscreenQuadVS, shaderCodeRespawn, "fsQuad0" + params);
        this.shaderParticleUpdateNoRespawn = createShaderFromCode(gd, shaderChunks.fullscreenQuadVS, shaderCodeNoRespawn, "fsQuad1" + params);
        this.shaderParticleUpdateOnStop = createShaderFromCode(gd, shaderChunks.fullscreenQuadVS, shaderCodeOnStop, "fsQuad2" + params);

        this.numParticleVerts = this.useMesh ? this.mesh.vertexBuffer.numVertices : 4;
        this.numParticleIndices = this.useMesh ? this.mesh.indexBuffer[0].numIndices : 6;
        this._allocate(this.numParticles);

        var mesh = new Mesh(gd);
        mesh.vertexBuffer = this.vertexBuffer;
        mesh.indexBuffer[0] = this.indexBuffer;
        mesh.primitive[0].type = PRIMITIVE_TRIANGLES;
        mesh.primitive[0].base = 0;
        mesh.primitive[0].count = (this.numParticles * this.numParticleIndices);
        mesh.primitive[0].indexed = true;

        this.material = new Material();
        this.material.name = this.node.name;
        this.material.cull = CULLFACE_NONE;
        this.material.alphaWrite = false;
        this.material.blend = true;
        this.material.blendType = this.blendType;

        this.material.depthWrite = this.depthWrite;
        this.material.emitter = this;

        this.regenShader();
        this.resetMaterial();

        var wasVisible = this.meshInstance ? this.meshInstance.visible : true;
        this.meshInstance = new MeshInstance(mesh, this.material, this.node);
        this.meshInstance.pick = false;
        this.meshInstance.updateKey(); // shouldn't be here?
        this.meshInstance.cull = true;
        this.meshInstance._noDepthDrawGl1 = true;
        if (this.localSpace) {
            this.meshInstance.aabb.setFromTransformedAabb(this.worldBounds, this.node.getWorldTransform());
        } else {
            this.meshInstance.aabb.copy(this.worldBounds);
        }
        this.meshInstance._updateAabb = false;
        this.meshInstance.visible = wasVisible;

        this._initializeTextures();

        this.resetTime();

        this.addTime(0, false); // fill dynamic textures and constants with initial data
        if (this.preWarm) this.prewarm(this.lifetime);
    }

    _isAnimated() {
        return this.animNumFrames >= 1 &&
               (this.animTilesX > 1 || this.animTilesY > 1) &&
               (this.colorMap && this.colorMap !== ParticleEmitter.DEFAULT_PARAM_TEXTURE || this.normalMap);
    }

    rebuildGraphs() {
        var precision = this.precision;
        var gd = this.graphicsDevice;
        var i;

        this.qLocalVelocity = this.localVelocityGraph.quantize(precision);
        this.qVelocity = this.velocityGraph.quantize(precision);
        this.qColor =         this.colorGraph.quantizeClamped(precision, 0, 1);
        this.qRotSpeed =      this.rotationSpeedGraph.quantize(precision);
        this.qScale =         this.scaleGraph.quantize(precision);
        this.qAlpha =         this.alphaGraph.quantize(precision);
        this.qRadialSpeed =   this.radialSpeedGraph.quantize(precision);

        this.qLocalVelocity2 = this.localVelocityGraph2.quantize(precision);
        this.qVelocity2 =      this.velocityGraph2.quantize(precision);
        this.qColor2 =         this.colorGraph2.quantizeClamped(precision, 0, 1);
        this.qRotSpeed2 =      this.rotationSpeedGraph2.quantize(precision);
        this.qScale2 =         this.scaleGraph2.quantize(precision);
        this.qAlpha2 =         this.alphaGraph2.quantize(precision);
        this.qRadialSpeed2 =   this.radialSpeedGraph2.quantize(precision);

        for (i = 0; i < precision; i++) {
            this.qRotSpeed[i] *= math.DEG_TO_RAD;
            this.qRotSpeed2[i] *= math.DEG_TO_RAD;
        }

        this.localVelocityUMax = new Float32Array(3);
        this.velocityUMax = new Float32Array(3);
        this.colorUMax = new Float32Array(3);
        this.rotSpeedUMax = [0];
        this.scaleUMax =    [0];
        this.alphaUMax =    [0];
        this.radialSpeedUMax = [0];
        this.qLocalVelocityDiv = divGraphFrom2Curves(this.qLocalVelocity, this.qLocalVelocity2, this.localVelocityUMax);
        this.qVelocityDiv =      divGraphFrom2Curves(this.qVelocity, this.qVelocity2, this.velocityUMax);
        this.qColorDiv =         divGraphFrom2Curves(this.qColor, this.qColor2, this.colorUMax);
        this.qRotSpeedDiv =      divGraphFrom2Curves(this.qRotSpeed, this.qRotSpeed2, this.rotSpeedUMax);
        this.qScaleDiv =         divGraphFrom2Curves(this.qScale, this.qScale2, this.scaleUMax);
        this.qAlphaDiv =         divGraphFrom2Curves(this.qAlpha, this.qAlpha2, this.alphaUMax);
        this.qRadialSpeedDiv =   divGraphFrom2Curves(this.qRadialSpeed, this.qRadialSpeed2, this.radialSpeedUMax);

        if (this.pack8) {
            var umax = [0, 0, 0];
            maxUnsignedGraphValue(this.qVelocity, umax);
            var umax2 = [0, 0, 0];
            maxUnsignedGraphValue(this.qVelocity2, umax2);

            var lumax = [0, 0, 0];
            maxUnsignedGraphValue(this.qLocalVelocity, lumax);
            var lumax2 = [0, 0, 0];
            maxUnsignedGraphValue(this.qLocalVelocity2, lumax2);

            var rumax = [0];
            maxUnsignedGraphValue(this.qRadialSpeed, rumax);
            var rumax2 = [0];
            maxUnsignedGraphValue(this.qRadialSpeed2, rumax2);

            var maxVel = Math.max(umax[0], umax2[0]);
            maxVel = Math.max(maxVel, umax[1]);
            maxVel = Math.max(maxVel, umax2[1]);
            maxVel = Math.max(maxVel, umax[2]);
            maxVel = Math.max(maxVel, umax2[2]);

            var lmaxVel = Math.max(lumax[0], lumax2[0]);
            lmaxVel = Math.max(lmaxVel, lumax[1]);
            lmaxVel = Math.max(lmaxVel, lumax2[1]);
            lmaxVel = Math.max(lmaxVel, lumax[2]);
            lmaxVel = Math.max(lmaxVel, lumax2[2]);

            var maxRad = Math.max(rumax[0], rumax2[0]);

            this.maxVel = maxVel + lmaxVel + maxRad;
        }


        if (!this.useCpu) {
            this.internalTex0 = _createTexture(gd, precision, 1, packTextureXYZ_NXYZ(this.qLocalVelocity, this.qLocalVelocityDiv));
            this.internalTex1 = _createTexture(gd, precision, 1, packTextureXYZ_NXYZ(this.qVelocity, this.qVelocityDiv));
            this.internalTex2 = _createTexture(gd, precision, 1, packTexture5Floats(this.qRotSpeed, this.qScale, this.qScaleDiv, this.qRotSpeedDiv, this.qAlphaDiv));
            this.internalTex3 = _createTexture(gd, precision, 1, packTexture2Floats(this.qRadialSpeed, this.qRadialSpeedDiv));
        }
        this.colorParam = _createTexture(gd, precision, 1, packTextureRGBA(this.qColor, this.qAlpha), PIXELFORMAT_R8_G8_B8_A8, 1.0, true);
    }

    _initializeTextures() {
        if (this.colorMap) {
            this.material.setParameter('colorMap', this.colorMap);
            if (this.lighting && this.normalMap) {
                this.material.setParameter('normalMap', this.normalMap);
            }
        }
    }

    regenShader() {
        var programLib = this.graphicsDevice.getProgramLibrary();
        var hasNormal = (this.normalMap !== null);
        this.normalOption = 0;
        if (this.lighting) {
            this.normalOption = hasNormal ? 2 : 1;
        }
        // updateShader is also called by pc.Scene when all shaders need to be updated
        this.material.updateShader = function () {

            // The app works like this:
            // 1. Emitter init
            // 2. Update. No camera is assigned to emitters
            // 3. Render; activeCamera = camera; shader init
            // 4. Update. activeCamera is set to emitters
            // -----
            // The problem with 1st frame render is that we init the shader without having any camera set to emitter -
            // so wrong shader is being compiled.
            // To fix it, we need to check activeCamera!=emitter.camera in shader init too
            if (this.emitter.scene) {
                if (this.emitter.camera !== this.emitter.scene._activeCamera) {
                    this.emitter.camera = this.emitter.scene._activeCamera;
                    this.emitter.onChangeCamera();
                }
            }

            // set by Editor if running inside editor
            var inTools = this.emitter.inTools;

            var shader = programLib.getProgram("particle", {
                useCpu: this.emitter.useCpu,
                normal: this.emitter.normalOption,
                halflambert: this.emitter.halfLambert,
                stretch: this.emitter.stretch,
                alignToMotion: this.emitter.alignToMotion,
                soft: this.emitter.depthSoftening,
                mesh: this.emitter.useMesh,
                gamma: this.emitter.scene ? this.emitter.scene.gammaCorrection : 0,
                toneMap: this.emitter.scene ? this.emitter.scene.toneMapping : 0,
                fog: (this.emitter.scene && !this.emitter.noFog) ? this.emitter.scene.fog : "none",
                wrap: this.emitter.wrap && this.emitter.wrapBounds,
                localSpace: this.emitter.localSpace,

                // in Editor, screen space particles (children of 2D Screen) are still rendered in 3d space
                screenSpace: inTools ? false : this.emitter.screenSpace,

                blend: this.blendType,
                animTex: this.emitter._isAnimated(),
                animTexLoop: this.emitter.animLoop,
                pack8: this.emitter.pack8,
                customFace: this.emitter.orientation !== PARTICLEORIENTATION_SCREEN
            });
            this.shader = shader;
        };
        this.material.updateShader();
    }

    resetMaterial() {
        var material = this.material;

        material.setParameter('stretch', this.stretch);
        if (this._isAnimated()) {
            material.setParameter('animTexTilesParams', this.animTilesParams);
            material.setParameter('animTexParams', this.animParams);
            material.setParameter('animTexIndexParams', this.animIndexParams);
        }
        material.setParameter('colorMult', this.intensity);
        if (!this.useCpu) {
            material.setParameter('internalTex0', this.internalTex0);
            material.setParameter('internalTex1', this.internalTex1);
            material.setParameter('internalTex2', this.internalTex2);
            material.setParameter('internalTex3', this.internalTex3);
        }
        material.setParameter('colorParam', this.colorParam);

        material.setParameter('numParticles', this.numParticles);
        material.setParameter('numParticlesPot', this.numParticlesPot);
        material.setParameter('lifetime', this.lifetime);
        material.setParameter('rate', this.rate);
        material.setParameter('rateDiv', this.rate2 - this.rate);
        material.setParameter('seed', this.seed);
        material.setParameter('scaleDivMult', this.scaleUMax[0]);
        material.setParameter('alphaDivMult', this.alphaUMax[0]);
        material.setParameter('radialSpeedDivMult', this.radialSpeedUMax[0]);
        material.setParameter("graphNumSamples", this.precision);
        material.setParameter("graphSampleSize", 1.0 / this.precision);
        material.setParameter("emitterScale", new Float32Array([1, 1, 1]));

        if (this.pack8) {
            this._gpuUpdater._setInputBounds();
            material.setParameter("inBoundsSize", this._gpuUpdater.inBoundsSizeUniform);
            material.setParameter("inBoundsCenter", this._gpuUpdater.inBoundsCenterUniform);
            material.setParameter("maxVel", this.maxVel);
        }

        if (this.wrap && this.wrapBounds) {
            this.wrapBoundsUniform[0] = this.wrapBounds.x;
            this.wrapBoundsUniform[1] = this.wrapBounds.y;
            this.wrapBoundsUniform[2] = this.wrapBounds.z;
            material.setParameter('wrapBounds', this.wrapBoundsUniform);
        }

        if (this.colorMap) {
            material.setParameter('colorMap', this.colorMap);
        }

        if (this.lighting) {
            if (this.normalMap) {
                material.setParameter('normalMap', this.normalMap);
            }
        }
        if (this.depthSoftening > 0) {
            material.setParameter('softening', 1.0 / (this.depthSoftening * this.depthSoftening * 100)); // remap to more perceptually linear
        }
        if (this.stretch > 0.0) material.cull = CULLFACE_NONE;

        this._compParticleFaceParams();
    }

    _compParticleFaceParams() {
        var tangent, binormal;
        if (this.orientation === PARTICLEORIENTATION_SCREEN) {
            tangent = new Float32Array([1, 0, 0]);
            binormal = new Float32Array([0, 0, 1]);
        } else {
            var n;
            if (this.orientation === PARTICLEORIENTATION_WORLD) {
                n = this.particleNormal.normalize();
            } else {
                var emitterMat = this.node === null ?
                    Mat4.IDENTITY : this.node.getWorldTransform();
                n = emitterMat.transformVector(this.particleNormal).normalize();
            }
            var t = new Vec3(1, 0, 0);
            if (Math.abs(t.dot(n)) === 1)
                t.set(0, 0, 1);
            var b = new Vec3().cross(n, t).normalize();
            t.cross(b, n).normalize();
            tangent = new Float32Array([t.x, t.y, t.z]);
            binormal = new Float32Array([b.x, b.y, b.z]);
        }
        this.material.setParameter("faceTangent", tangent);
        this.material.setParameter("faceBinorm", binormal);
    }

    // Declares vertex format, creates VB and IB
    _allocate(numParticles) {
        var psysVertCount = numParticles * this.numParticleVerts;
        var psysIndexCount = numParticles * this.numParticleIndices;
        var elements, particleFormat;
        var i;

        if ((this.vertexBuffer === undefined) || (this.vertexBuffer.getNumVertices() !== psysVertCount)) {
            // Create the particle vertex format
            if (!this.useCpu) {
                // GPU: XYZ = quad vertex position; W = INT: particle ID, FRAC: random factor
                elements = [{
                    semantic: SEMANTIC_ATTR0,
                    components: 4,
                    type: TYPE_FLOAT32
                }];
                if (this.useMesh) {
                    elements.push({
                        semantic: SEMANTIC_ATTR1,
                        components: 2,
                        type: TYPE_FLOAT32
                    });
                }
                particleFormat = new VertexFormat(this.graphicsDevice, elements);

                this.vertexBuffer = new VertexBuffer(this.graphicsDevice, particleFormat, psysVertCount, BUFFER_DYNAMIC);
                this.indexBuffer = new IndexBuffer(this.graphicsDevice, INDEXFORMAT_UINT16, psysIndexCount);
            } else {
                elements = [{
                    semantic: SEMANTIC_ATTR0,
                    components: 4,
                    type: TYPE_FLOAT32
                }, {
                    semantic: SEMANTIC_ATTR1,
                    components: 4,
                    type: TYPE_FLOAT32
                }, {
                    semantic: SEMANTIC_ATTR2,
                    components: 4,
                    type: TYPE_FLOAT32
                }, {
                    semantic: SEMANTIC_ATTR3,
                    components: 1,
                    type: TYPE_FLOAT32
                }, {
                    semantic: SEMANTIC_ATTR4,
                    components: this.useMesh ? 4 : 2,
                    type: TYPE_FLOAT32
                }];
                particleFormat = new VertexFormat(this.graphicsDevice, elements);

                this.vertexBuffer = new VertexBuffer(this.graphicsDevice, particleFormat, psysVertCount, BUFFER_DYNAMIC);
                this.indexBuffer = new IndexBuffer(this.graphicsDevice, INDEXFORMAT_UINT16, psysIndexCount);
            }

            // Fill the vertex buffer
            var data = new Float32Array(this.vertexBuffer.lock());
            var meshData, stride, texCoordOffset;
            if (this.useMesh) {
                meshData = new Float32Array(this.mesh.vertexBuffer.lock());
                stride = meshData.length / this.mesh.vertexBuffer.numVertices;
                for (var elem = 0; elem < this.mesh.vertexBuffer.format.elements.length; elem++) {
                    if (this.mesh.vertexBuffer.format.elements[elem].name === SEMANTIC_TEXCOORD0) {
                        texCoordOffset = this.mesh.vertexBuffer.format.elements[elem].offset / 4;
                        break;
                    }
                }
            }

            var id;
            for (i = 0; i < psysVertCount; i++) {
                id = Math.floor(i / this.numParticleVerts);
                if (!this.useMesh) {
                    var vertID = i % 4;
                    data[i * 4] = particleVerts[vertID][0];
                    data[i * 4 + 1] = particleVerts[vertID][1];
                    data[i * 4 + 2] = 0;
                    data[i * 4 + 3] = id;
                } else {
                    var vert = i % this.numParticleVerts;
                    data[i * 6] = meshData[vert * stride];
                    data[i * 6 + 1] = meshData[vert * stride + 1];
                    data[i * 6 + 2] = meshData[vert * stride + 2];
                    data[i * 6 + 3] = id;
                    data[i * 6 + 4] = meshData[vert * stride + texCoordOffset + 0];
                    data[i * 6 + 5] = meshData[vert * stride + texCoordOffset + 1];
                }
            }

            if (this.useCpu) {
                this.vbCPU = new Float32Array(data);
                this.vbOld = new Float32Array(this.vbCPU.length);
            }
            this.vertexBuffer.unlock();
            if (this.useMesh) {
                this.mesh.vertexBuffer.unlock();
            }


            // Fill the index buffer
            var dst = 0;
            var indices = new Uint16Array(this.indexBuffer.lock());
            if (this.useMesh) meshData = new Uint16Array(this.mesh.indexBuffer[0].lock());
            for (i = 0; i < numParticles; i++) {
                if (!this.useMesh) {
                    var baseIndex = i * 4;
                    indices[dst++] = baseIndex;
                    indices[dst++] = baseIndex + 1;
                    indices[dst++] = baseIndex + 2;
                    indices[dst++] = baseIndex;
                    indices[dst++] = baseIndex + 2;
                    indices[dst++] = baseIndex + 3;
                } else {
                    for (var j = 0; j < this.numParticleIndices; j++) {
                        indices[i * this.numParticleIndices + j] = meshData[j] + i * this.numParticleVerts;
                    }
                }
            }
            this.indexBuffer.unlock();
            if (this.useMesh) this.mesh.indexBuffer[0].unlock();
        }
    }

    reset() {
        this.beenReset = true;
        this.seed = Math.random();
        this.material.setParameter('seed', this.seed);
        if (this.useCpu) {
            for (var i = 0; i < this.particleTexStart.length; i++) {
                this.particleTex[i] = this.particleTexStart[i];
            }
        } else {
            this._initializeTextures();
        }
        this.resetWorldBounds();
        this.resetTime();
        var origLoop =  this.loop;
        this.loop = true;
        this.addTime(0, false);
        this.loop = origLoop;
        if (this.preWarm) {
            this.prewarm(this.lifetime);
        }
    }

    prewarm(time) {
        var lifetimeFraction = time / this.lifetime;
        var iterations = Math.min(Math.floor(lifetimeFraction * this.precision), this.precision);
        var stepDelta = time / iterations;
        for (var i = 0; i < iterations; i++) {
            this.addTime(stepDelta, false);
        }
    }

    resetTime() {
        this.endTime = calcEndTime(this);
    }

    finishFrame() {
        if (this.useCpu) this.vertexBuffer.unlock();
    }

    addTime(delta, isOnStop) {
        var device = this.graphicsDevice;

        // #if _PROFILER
        var startTime = now();
        // #endif

        this.simTimeTotal += delta;

        this.calculateWorldBounds();

        if (this._isAnimated()) {
            var tilesParams = this.animTilesParams;
            tilesParams[0] = 1.0 / this.animTilesX; // animTexTilesParams.x
            tilesParams[1] = 1.0 / this.animTilesY; // animTexTilesParams.y

            var params = this.animParams;
            params[0] = this.animStartFrame; // animTexParams.x
            params[1] = this.animNumFrames * this.animSpeed; // animTexParams.y
            params[2] = this.animNumFrames - 1; // animTexParams.z
            params[3] = this.animNumAnimations - 1; // animTexParams.w

            var animIndexParams = this.animIndexParams;
            animIndexParams[0] = this.animIndex; // animTexIndexParams.x
            animIndexParams[1] = this.randomizeAnimIndex; // animTexIndexParams.y
        }

        if (this.scene) {
            if (this.camera !== this.scene._activeCamera) {
                this.camera = this.scene._activeCamera;
                this.onChangeCamera();
            }
        }

        if (this.emitterShape === EMITTERSHAPE_BOX) {
            extentsInnerRatioUniform[0] = this.emitterExtents.x !== 0 ? this.emitterExtentsInner.x / this.emitterExtents.x : 0;
            extentsInnerRatioUniform[1] = this.emitterExtents.y !== 0 ? this.emitterExtentsInner.y / this.emitterExtents.y : 0;
            extentsInnerRatioUniform[2] = this.emitterExtents.z !== 0 ? this.emitterExtentsInner.z / this.emitterExtents.z : 0;
            if (this.meshInstance.node === null) {
                spawnMatrix.setTRS(Vec3.ZERO, Quat.IDENTITY, this.emitterExtents);
            } else {
                spawnMatrix.setTRS(Vec3.ZERO, this.meshInstance.node.getRotation(), tmpVec3.copy(this.emitterExtents).mul(this.meshInstance.node.localScale));
            }
        }

        var emitterPos;
        var emitterScale = this.meshInstance.node === null ? Vec3.ONE : this.meshInstance.node.localScale;
        this.emitterScaleUniform[0] = emitterScale.x;
        this.emitterScaleUniform[1] = emitterScale.y;
        this.emitterScaleUniform[2] = emitterScale.z;
        this.material.setParameter("emitterScale", this.emitterScaleUniform);
        if (this.localSpace && this.meshInstance.node) {
            emitterPos = this.meshInstance.node.getPosition();
            this.emitterPosUniform[0] = emitterPos.x;
            this.emitterPosUniform[1] = emitterPos.y;
            this.emitterPosUniform[2] = emitterPos.z;
            this.material.setParameter("emitterPos", this.emitterPosUniform);
        }

        this._compParticleFaceParams();

        if (!this.useCpu) {
            this._gpuUpdater.update(device, spawnMatrix, extentsInnerRatioUniform, delta, isOnStop);
        } else {
            var data = new Float32Array(this.vertexBuffer.lock());
            this._cpuUpdater.update(data, this.vbToSort, this.particleTex, spawnMatrix, extentsInnerRatioUniform, emitterPos, delta, isOnStop);
            // this.vertexBuffer.unlock();
        }

        if (!this.loop) {
            if (Date.now() > this.endTime) {
                if (this.onFinished) this.onFinished();
                this.meshInstance.visible = false;
            }
        }

        if (this.meshInstance) {
            this.meshInstance.drawOrder = this.drawOrder;
        }

        // #if _PROFILER
        this._addTimeTime += now() - startTime;
        // #endif
    }

    _destroyResources() {
        if (this.particleTexIN) {
            this.particleTexIN.destroy();
            this.particleTexIN = null;
        }

        if (this.particleTexOUT) {
            this.particleTexOUT.destroy();
            this.particleTexOUT = null;
        }

        if (this.particleTexStart && this.particleTexStart.destroy) {
            this.particleTexStart.destroy();
            this.particleTexStart = null;
        }

        if (this.rtParticleTexIN) {
            this.rtParticleTexIN.destroy();
            this.rtParticleTexIN = null;
        }

        if (this.rtParticleTexOUT) {
            this.rtParticleTexOUT.destroy();
            this.rtParticleTexOUT = null;
        }

        if (this.internalTex0) {
            this.internalTex0.destroy();
            this.internalTex0 = null;
        }

        if (this.internalTex1) {
            this.internalTex1.destroy();
            this.internalTex1 = null;
        }

        if (this.internalTex2) {
            this.internalTex2.destroy();
            this.internalTex2 = null;
        }

        if (this.internalTex3) {
            this.internalTex3.destroy();
            this.internalTex3 = null;
        }

        if (this.colorParam) {
            this.colorParam.destroy();
            this.colorParam = null;
        }

        if (this.vertexBuffer) {
            this.vertexBuffer.destroy();
            this.vertexBuffer = undefined; // we are testing if vb is undefined in some code, no idea why
        }

        if (this.indexBuffer) {
            this.indexBuffer.destroy();
            this.indexBuffer = undefined;
        }

        if (this.material) {
            this.material.destroy();
            this.material = null;
        }

        // note: shaders should not be destroyed as they could be shared between emitters
    }

    destroy() {
        this.camera = null;

        this._destroyResources();
    }
}

export { ParticleEmitter };
