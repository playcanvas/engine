Object.assign(pc, function () {
    var spawnMatrix3 = new pc.Mat3();
    var emitterMatrix3 = new pc.Mat3();
    var emitterMatrix3Inv = new pc.Mat3();

    function mat4ToMat3(mat4, mat3) {
        mat3.data[0] = mat4.data[0];
        mat3.data[1] = mat4.data[1];
        mat3.data[2] = mat4.data[2];

        mat3.data[3] = mat4.data[4];
        mat3.data[4] = mat4.data[5];
        mat3.data[5] = mat4.data[6];

        mat3.data[6] = mat4.data[8];
        mat3.data[7] = mat4.data[9];
        mat3.data[8] = mat4.data[10];
    }

    // Wraps GPU particles render state and setup from ParticleEmitter
    var ParticleGPUUpdater = function (emitter, gd) {
        this._emitter = emitter;

        this.frameRandomUniform = new Float32Array(3);
        this.emitterPosUniform = new Float32Array(3);
        this.emitterScaleUniform = new Float32Array([1, 1, 1]);
        this.worldBoundsMulUniform = new Float32Array(3);
        this.worldBoundsAddUniform = new Float32Array(3);
        this.inBoundsSizeUniform = new Float32Array(3);
        this.inBoundsCenterUniform = new Float32Array(3);

        this.constantParticleTexIN = gd.scope.resolve("particleTexIN");
        this.constantParticleTexOUT = gd.scope.resolve("particleTexOUT");
        this.constantEmitterPos = gd.scope.resolve("emitterPos");
        this.constantEmitterScale = gd.scope.resolve("emitterScale");
        this.constantSpawnBounds = gd.scope.resolve("spawnBounds");
        this.constantSpawnPosInnerRatio = gd.scope.resolve("spawnPosInnerRatio");
        this.constantSpawnBoundsSphere = gd.scope.resolve("spawnBoundsSphere");
        this.constantSpawnBoundsSphereInnerRatio = gd.scope.resolve("spawnBoundsSphereInnerRatio");
        this.constantInitialVelocity = gd.scope.resolve("initialVelocity");
        this.constantFrameRandom = gd.scope.resolve("frameRandom");
        this.constantDelta = gd.scope.resolve("delta");
        this.constantRate = gd.scope.resolve("rate");
        this.constantRateDiv = gd.scope.resolve("rateDiv");
        this.constantLifetime = gd.scope.resolve("lifetime");
        this.constantGraphSampleSize = gd.scope.resolve("graphSampleSize");
        this.constantGraphNumSamples = gd.scope.resolve("graphNumSamples");
        this.constantInternalTex0 = gd.scope.resolve("internalTex0");
        this.constantInternalTex1 = gd.scope.resolve("internalTex1");
        this.constantInternalTex2 = gd.scope.resolve("internalTex2");
        this.constantInternalTex3 = gd.scope.resolve("internalTex3");
        this.constantEmitterMatrix = gd.scope.resolve("emitterMatrix");
        this.constantEmitterMatrixInv = gd.scope.resolve("emitterMatrixInv");
        this.constantNumParticles = gd.scope.resolve("numParticles");
        this.constantNumParticlesPot = gd.scope.resolve("numParticlesPot");
        this.constantLocalVelocityDivMult = gd.scope.resolve("localVelocityDivMult");
        this.constantVelocityDivMult = gd.scope.resolve("velocityDivMult");
        this.constantRotSpeedDivMult = gd.scope.resolve("rotSpeedDivMult");
        this.constantSeed = gd.scope.resolve("seed");
        this.constantStartAngle = gd.scope.resolve("startAngle");
        this.constantStartAngle2 = gd.scope.resolve("startAngle2");
        this.constantOutBoundsMul = gd.scope.resolve("outBoundsMul");
        this.constantOutBoundsAdd = gd.scope.resolve("outBoundsAdd");
        this.constantInBoundsSize = gd.scope.resolve("inBoundsSize");
        this.constantInBoundsCenter = gd.scope.resolve("inBoundsCenter");
        this.constantMaxVel = gd.scope.resolve("maxVel");
        this.constantFaceTangent = gd.scope.resolve("faceTangent");
        this.constantFaceBinorm = gd.scope.resolve("faceBinorm");
    };

    ParticleGPUUpdater.prototype._setInputBounds = function () {
        this.inBoundsSizeUniform[0] = this._emitter.prevWorldBoundsSize.x;
        this.inBoundsSizeUniform[1] = this._emitter.prevWorldBoundsSize.y;
        this.inBoundsSizeUniform[2] = this._emitter.prevWorldBoundsSize.z;
        this.constantInBoundsSize.setValue(this.inBoundsSizeUniform);
        this.inBoundsCenterUniform[0] = this._emitter.prevWorldBoundsCenter.x;
        this.inBoundsCenterUniform[1] = this._emitter.prevWorldBoundsCenter.y;
        this.inBoundsCenterUniform[2] = this._emitter.prevWorldBoundsCenter.z;
        this.constantInBoundsCenter.setValue(this.inBoundsCenterUniform);
    };

    ParticleGPUUpdater.prototype.randomize = function () {
        this.frameRandomUniform[0] = Math.random();
        this.frameRandomUniform[1] = Math.random();
        this.frameRandomUniform[2] = Math.random();
    };

    // This shouldn't change emitter state, only read from it
    ParticleGPUUpdater.prototype.update = function (device, spawnMatrix, extentsInnerRatioUniform, delta, isOnStop) {
        var emitter = this._emitter;

        device.setBlending(false);
        device.setColorWrite(true, true, true, true);
        device.setCullMode(pc.CULLFACE_NONE);
        device.setDepthTest(false);
        device.setDepthWrite(false);

        this.randomize();

        this.constantGraphSampleSize.setValue(1.0 / emitter.precision);
        this.constantGraphNumSamples.setValue(emitter.precision);
        this.constantNumParticles.setValue(emitter.numParticles);
        this.constantNumParticlesPot.setValue(emitter.numParticlesPot);
        this.constantInternalTex0.setValue(emitter.internalTex0);
        this.constantInternalTex1.setValue(emitter.internalTex1);
        this.constantInternalTex2.setValue(emitter.internalTex2);
        this.constantInternalTex3.setValue(emitter.internalTex3);

        var node = emitter.meshInstance.node;
        var emitterScale = node === null ? pc.Vec3.ONE : node.localScale;

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

            var maxVel = emitter.maxVel * Math.max(Math.max(emitterScale.x, emitterScale.y), emitterScale.z);
            maxVel = Math.max(maxVel, 1);
            this.constantMaxVel.setValue(maxVel);
        }

        var emitterPos = (node === null || emitter.localSpace) ? pc.Vec3.ZERO : node.getPosition();
        var emitterMatrix = node === null ? pc.Mat4.IDENTITY : node.getWorldTransform();
        if (emitter.emitterShape === pc.EMITTERSHAPE_BOX) {
            mat4ToMat3(spawnMatrix, spawnMatrix3);
            this.constantSpawnBounds.setValue(spawnMatrix3.data);
            this.constantSpawnPosInnerRatio.setValue(extentsInnerRatioUniform);
        } else {
            this.constantSpawnBoundsSphere.setValue(emitter.emitterRadius);
            this.constantSpawnBoundsSphereInnerRatio.setValue((emitter.emitterRadius === 0) ? 0 : emitter.emitterRadiusInner / emitter.emitterRadius);
        }
        this.constantInitialVelocity.setValue(emitter.initialVelocity);

        mat4ToMat3(emitterMatrix, emitterMatrix3);
        emitterMatrix.invertTo3x3(emitterMatrix3Inv);
        this.emitterPosUniform[0] = emitterPos.x;
        this.emitterPosUniform[1] = emitterPos.y;
        this.emitterPosUniform[2] = emitterPos.z;
        this.constantEmitterPos.setValue(this.emitterPosUniform);
        this.constantFrameRandom.setValue(this.frameRandomUniform);
        this.constantDelta.setValue(delta);
        this.constantRate.setValue(emitter.rate);
        this.constantRateDiv.setValue(emitter.rate2 - emitter.rate);
        this.constantStartAngle.setValue(emitter.startAngle * pc.math.DEG_TO_RAD);
        this.constantStartAngle2.setValue(emitter.startAngle2 * pc.math.DEG_TO_RAD);

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

        var texIN = emitter.swapTex ? emitter.particleTexOUT : emitter.particleTexIN;
        texIN = emitter.beenReset ? emitter.particleTexStart : texIN;
        var texOUT = emitter.swapTex ? emitter.particleTexIN : emitter.particleTexOUT;
        this.constantParticleTexIN.setValue(texIN);
        pc.drawQuadWithShader(
            device,
            emitter.swapTex ? emitter.rtParticleTexIN : emitter.rtParticleTexOUT,
            !isOnStop ?
                (emitter.loop ? emitter.shaderParticleUpdateRespawn : emitter.shaderParticleUpdateNoRespawn) :
                emitter.shaderParticleUpdateOnStop);

        // this.constantParticleTexOUT.setValue(texOUT);

        emitter.material.setParameter("particleTexOUT", texIN);// OUT);
        emitter.material.setParameter("particleTexIN", texOUT);// IN);
        emitter.beenReset = false;

        emitter.swapTex = !emitter.swapTex;

        device.setDepthTest(true);
        device.setDepthWrite(true);

        emitter.prevWorldBoundsSize.copy(emitter.worldBoundsSize);
        emitter.prevWorldBoundsCenter.copy(emitter.worldBounds.center);
        if (emitter.pack8)
            this._setInputBounds();
    };

    return {
        ParticleGPUUpdater: ParticleGPUUpdater
    };
}());
