import { math } from '../../core/math/math.js';
import { Mat3 } from '../../core/math/mat3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';

import { CULLFACE_NONE } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { DepthState } from '../../platform/graphics/depth-state.js';

import { drawQuadWithShader } from '../graphics/quad-render-utils.js';

import { EMITTERSHAPE_BOX } from '../constants.js';

const spawnMatrix3 = new Mat3();
const emitterMatrix3 = new Mat3();
const emitterMatrix3Inv = new Mat3();

// Wraps GPU particles render state and setup from ParticleEmitter
class ParticleGPUUpdater {
    constructor(emitter, gd) {
        this._emitter = emitter;

        this.frameRandomUniform = new Float32Array(3);
        this.emitterPosUniform = new Float32Array(3);
        this.emitterScaleUniform = new Float32Array([1, 1, 1]);
        this.worldBoundsMulUniform = new Float32Array(3);
        this.worldBoundsAddUniform = new Float32Array(3);
        this.inBoundsSizeUniform = new Float32Array(3);
        this.inBoundsCenterUniform = new Float32Array(3);

        this.constantParticleTexIN = gd.scope.resolve('particleTexIN');
        this.constantParticleTexOUT = gd.scope.resolve('particleTexOUT');
        this.constantEmitterPos = gd.scope.resolve('emitterPos');
        this.constantEmitterScale = gd.scope.resolve('emitterScale');
        this.constantSpawnBounds = gd.scope.resolve('spawnBounds');
        this.constantSpawnPosInnerRatio = gd.scope.resolve('spawnPosInnerRatio');
        this.constantSpawnBoundsSphere = gd.scope.resolve('spawnBoundsSphere');
        this.constantSpawnBoundsSphereInnerRatio = gd.scope.resolve('spawnBoundsSphereInnerRatio');
        this.constantInitialVelocity = gd.scope.resolve('initialVelocity');
        this.constantFrameRandom = gd.scope.resolve('frameRandom');
        this.constantDelta = gd.scope.resolve('delta');
        this.constantRate = gd.scope.resolve('rate');
        this.constantRateDiv = gd.scope.resolve('rateDiv');
        this.constantLifetime = gd.scope.resolve('lifetime');
        this.constantGraphSampleSize = gd.scope.resolve('graphSampleSize');
        this.constantGraphNumSamples = gd.scope.resolve('graphNumSamples');
        this.constantInternalTex0 = gd.scope.resolve('internalTex0');
        this.constantInternalTex1 = gd.scope.resolve('internalTex1');
        this.constantInternalTex2 = gd.scope.resolve('internalTex2');
        this.constantInternalTex3 = gd.scope.resolve('internalTex3');
        this.constantEmitterMatrix = gd.scope.resolve('emitterMatrix');
        this.constantEmitterMatrixInv = gd.scope.resolve('emitterMatrixInv');
        this.constantNumParticles = gd.scope.resolve('numParticles');
        this.constantNumParticlesPot = gd.scope.resolve('numParticlesPot');
        this.constantLocalVelocityDivMult = gd.scope.resolve('localVelocityDivMult');
        this.constantVelocityDivMult = gd.scope.resolve('velocityDivMult');
        this.constantRotSpeedDivMult = gd.scope.resolve('rotSpeedDivMult');
        this.constantSeed = gd.scope.resolve('seed');
        this.constantStartAngle = gd.scope.resolve('startAngle');
        this.constantStartAngle2 = gd.scope.resolve('startAngle2');
        this.constantOutBoundsMul = gd.scope.resolve('outBoundsMul');
        this.constantOutBoundsAdd = gd.scope.resolve('outBoundsAdd');
        this.constantInBoundsSize = gd.scope.resolve('inBoundsSize');
        this.constantInBoundsCenter = gd.scope.resolve('inBoundsCenter');
        this.constantMaxVel = gd.scope.resolve('maxVel');
        this.constantFaceTangent = gd.scope.resolve('faceTangent');
        this.constantFaceBinorm = gd.scope.resolve('faceBinorm');
    }

    _setInputBounds() {
        this.inBoundsSizeUniform[0] = this._emitter.prevWorldBoundsSize.x;
        this.inBoundsSizeUniform[1] = this._emitter.prevWorldBoundsSize.y;
        this.inBoundsSizeUniform[2] = this._emitter.prevWorldBoundsSize.z;
        this.constantInBoundsSize.setValue(this.inBoundsSizeUniform);
        this.inBoundsCenterUniform[0] = this._emitter.prevWorldBoundsCenter.x;
        this.inBoundsCenterUniform[1] = this._emitter.prevWorldBoundsCenter.y;
        this.inBoundsCenterUniform[2] = this._emitter.prevWorldBoundsCenter.z;
        this.constantInBoundsCenter.setValue(this.inBoundsCenterUniform);
    }

    randomize() {
        this.frameRandomUniform[0] = Math.random();
        this.frameRandomUniform[1] = Math.random();
        this.frameRandomUniform[2] = Math.random();
    }

    // This shouldn't change emitter state, only read from it
    update(device, spawnMatrix, extentsInnerRatioUniform, delta, isOnStop) {

        DebugGraphics.pushGpuMarker(device, 'ParticleGPU');

        const emitter = this._emitter;

        device.setBlendState(BlendState.NOBLEND);
        device.setDepthState(DepthState.NODEPTH);
        device.setCullMode(CULLFACE_NONE);

        this.randomize();

        this.constantGraphSampleSize.setValue(1.0 / emitter.precision);
        this.constantGraphNumSamples.setValue(emitter.precision);
        this.constantNumParticles.setValue(emitter.numParticles);
        this.constantNumParticlesPot.setValue(emitter.numParticlesPot);
        this.constantInternalTex0.setValue(emitter.internalTex0);
        this.constantInternalTex1.setValue(emitter.internalTex1);
        this.constantInternalTex2.setValue(emitter.internalTex2);
        this.constantInternalTex3.setValue(emitter.internalTex3);

        const node = emitter.meshInstance.node;
        const emitterScale = node === null ? Vec3.ONE : node.localScale;

        if (emitter.pack8) {
            this.worldBoundsMulUniform[0] = emitter.worldBoundsMul.x;
            this.worldBoundsMulUniform[1] = emitter.worldBoundsMul.y;
            this.worldBoundsMulUniform[2] = emitter.worldBoundsMul.z;
            this.constantOutBoundsMul.setValue(this.worldBoundsMulUniform);
            this.worldBoundsAddUniform[0] = emitter.worldBoundsAdd.x;
            this.worldBoundsAddUniform[1] = emitter.worldBoundsAdd.y;
            this.worldBoundsAddUniform[2] = emitter.worldBoundsAdd.z;
            this.constantOutBoundsAdd.setValue(this.worldBoundsAddUniform);

            this._setInputBounds();

            let maxVel = emitter.maxVel * Math.max(Math.max(emitterScale.x, emitterScale.y), emitterScale.z);
            maxVel = Math.max(maxVel, 1);
            this.constantMaxVel.setValue(maxVel);
        }

        const emitterPos = (node === null || emitter.localSpace) ? Vec3.ZERO : node.getPosition();
        const emitterMatrix = node === null ? Mat4.IDENTITY : node.getWorldTransform();
        if (emitter.emitterShape === EMITTERSHAPE_BOX) {
            spawnMatrix3.setFromMat4(spawnMatrix);
            this.constantSpawnBounds.setValue(spawnMatrix3.data);
            this.constantSpawnPosInnerRatio.setValue(extentsInnerRatioUniform);
        } else {
            this.constantSpawnBoundsSphere.setValue(emitter.emitterRadius);
            this.constantSpawnBoundsSphereInnerRatio.setValue((emitter.emitterRadius === 0) ? 0 : emitter.emitterRadiusInner / emitter.emitterRadius);
        }
        this.constantInitialVelocity.setValue(emitter.initialVelocity);

        emitterMatrix3.setFromMat4(emitterMatrix);
        emitterMatrix3Inv.invertMat4(emitterMatrix);
        this.emitterPosUniform[0] = emitterPos.x;
        this.emitterPosUniform[1] = emitterPos.y;
        this.emitterPosUniform[2] = emitterPos.z;
        this.constantEmitterPos.setValue(this.emitterPosUniform);
        this.constantFrameRandom.setValue(this.frameRandomUniform);
        this.constantDelta.setValue(delta);
        this.constantRate.setValue(emitter.rate);
        this.constantRateDiv.setValue(emitter.rate2 - emitter.rate);
        this.constantStartAngle.setValue(emitter.startAngle * math.DEG_TO_RAD);
        this.constantStartAngle2.setValue(emitter.startAngle2 * math.DEG_TO_RAD);

        this.constantSeed.setValue(emitter.seed);
        this.constantLifetime.setValue(emitter.lifetime);
        this.emitterScaleUniform[0] = emitterScale.x;
        this.emitterScaleUniform[1] = emitterScale.y;
        this.emitterScaleUniform[2] = emitterScale.z;
        this.constantEmitterScale.setValue(this.emitterScaleUniform);
        this.constantEmitterMatrix.setValue(emitterMatrix3.data);
        this.constantEmitterMatrixInv.setValue(emitterMatrix3Inv.data);

        this.constantLocalVelocityDivMult.setValue(emitter.localVelocityUMax);
        this.constantVelocityDivMult.setValue(emitter.velocityUMax);
        this.constantRotSpeedDivMult.setValue(emitter.rotSpeedUMax[0]);

        let texIN = emitter.swapTex ? emitter.particleTexOUT : emitter.particleTexIN;
        texIN = emitter.beenReset ? emitter.particleTexStart : texIN;
        const texOUT = emitter.swapTex ? emitter.particleTexIN : emitter.particleTexOUT;
        this.constantParticleTexIN.setValue(texIN);
        drawQuadWithShader(
            device,
            emitter.swapTex ? emitter.rtParticleTexIN : emitter.rtParticleTexOUT,
            !isOnStop ?
                (emitter.loop ? emitter.shaderParticleUpdateRespawn : emitter.shaderParticleUpdateNoRespawn) :
                emitter.shaderParticleUpdateOnStop);

        // this.constantParticleTexOUT.setValue(texOUT);

        emitter.material.setParameter('particleTexOUT', texIN);// OUT);
        emitter.material.setParameter('particleTexIN', texOUT);// IN);
        emitter.beenReset = false;

        emitter.swapTex = !emitter.swapTex;

        emitter.prevWorldBoundsSize.copy(emitter.worldBoundsSize);
        emitter.prevWorldBoundsCenter.copy(emitter.worldBounds.center);
        if (emitter.pack8)
            this._setInputBounds();

        DebugGraphics.popGpuMarker(device);
    }
}

export { ParticleGPUUpdater };
