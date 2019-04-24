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
        this.constantLightCube = gd.scope.resolve("lightCube[0]");
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

    // This shouldn't change emitter state, only read from it
    ParticleGPUUpdater.prototype.update = function (device, spawnMatrix, extentsInnerRatioUniform, delta, isOnStop) {
        device.setBlending(false);
        device.setColorWrite(true, true, true, true);
        device.setCullMode(pc.CULLFACE_NONE);
        device.setDepthTest(false);
        device.setDepthWrite(false);

        this.frameRandomUniform[0] = Math.random();
        this.frameRandomUniform[1] = Math.random();
        this.frameRandomUniform[2] = Math.random();

        this.constantGraphSampleSize.setValue(1.0 / this._emitter.precision);
        this.constantGraphNumSamples.setValue(this._emitter.precision);
        this.constantNumParticles.setValue(this._emitter.numParticles);
        this.constantNumParticlesPot.setValue(this._emitter.numParticlesPot);
        this.constantInternalTex0.setValue(this._emitter.internalTex0);
        this.constantInternalTex1.setValue(this._emitter.internalTex1);
        this.constantInternalTex2.setValue(this._emitter.internalTex2);
        this.constantInternalTex3.setValue(this._emitter.internalTex3);

        var node = this._emitter.meshInstance.node;
        var emitterScale = node === null ? pc.Vec3.ONE : node.localScale;

        if (this._emitter.pack8) {
            this.worldBoundsMulUniform[0] = this._emitter.worldBoundsMul.x;
            this.worldBoundsMulUniform[1] = this._emitter.worldBoundsMul.y;
            this.worldBoundsMulUniform[2] = this._emitter.worldBoundsMul.z;
            this.constantOutBoundsMul.setValue(this.worldBoundsMulUniform);
            this.worldBoundsAddUniform[0] = this._emitter.worldBoundsAdd.x;
            this.worldBoundsAddUniform[1] = this._emitter.worldBoundsAdd.y;
            this.worldBoundsAddUniform[2] = this._emitter.worldBoundsAdd.z;
            this.constantOutBoundsAdd.setValue(this.worldBoundsAddUniform);

            this._setInputBounds();

            var maxVel = this._emitter.maxVel * Math.max(Math.max(emitterScale.x, emitterScale.y), emitterScale.z);
            maxVel = Math.max(maxVel, 1);
            this.constantMaxVel.setValue(maxVel);
        }

        var emitterPos = (node === null || this._emitter.localSpace) ? pc.Vec3.ZERO : node.getPosition();
        var emitterMatrix = node === null ? pc.Mat4.IDENTITY : node.getWorldTransform();
        if (this._emitter.emitterShape === pc.EMITTERSHAPE_BOX) {
            mat4ToMat3(spawnMatrix, spawnMatrix3);
            this.constantSpawnBounds.setValue(spawnMatrix3.data);
            this.constantSpawnPosInnerRatio.setValue(extentsInnerRatioUniform);
        } else {
            this.constantSpawnBoundsSphere.setValue(this._emitter.emitterRadius);
            this.constantSpawnBoundsSphereInnerRatio.setValue(this._emitter.emitterRadiusInner / this._emitter.emitterRadius);
        }
        this.constantInitialVelocity.setValue(this._emitter.initialVelocity);

        mat4ToMat3(emitterMatrix, emitterMatrix3);
        emitterMatrix.invertTo3x3(emitterMatrix3Inv);
        this.emitterPosUniform[0] = emitterPos.x;
        this.emitterPosUniform[1] = emitterPos.y;
        this.emitterPosUniform[2] = emitterPos.z;
        this.constantEmitterPos.setValue(this.emitterPosUniform);
        this.constantFrameRandom.setValue(this.frameRandomUniform);
        this.constantDelta.setValue(delta);
        this.constantRate.setValue(this._emitter.rate);
        this.constantRateDiv.setValue(this._emitter.rate2 - this._emitter.rate);
        this.constantStartAngle.setValue(this._emitter.startAngle * pc.math.DEG_TO_RAD);
        this.constantStartAngle2.setValue(this._emitter.startAngle2 * pc.math.DEG_TO_RAD);

        this.constantSeed.setValue(this._emitter.seed);
        this.constantLifetime.setValue(this._emitter.lifetime);
        this.emitterScaleUniform[0] = emitterScale.x;
        this.emitterScaleUniform[1] = emitterScale.y;
        this.emitterScaleUniform[2] = emitterScale.z;
        this.constantEmitterScale.setValue(this.emitterScaleUniform);
        this.constantEmitterMatrix.setValue(emitterMatrix3.data);
        this.constantEmitterMatrixInv.setValue(emitterMatrix3Inv.data);

        this.constantLocalVelocityDivMult.setValue(this._emitter.localVelocityUMax);
        this.constantVelocityDivMult.setValue(this._emitter.velocityUMax);
        this.constantRotSpeedDivMult.setValue(this._emitter.rotSpeedUMax[0]);

        var texIN = this._emitter.swapTex ? this._emitter.particleTexOUT : this._emitter.particleTexIN;
        texIN = this._emitter.beenReset ? this._emitter.particleTexStart : texIN;
        var texOUT = this._emitter.swapTex ? this._emitter.particleTexIN : this._emitter.particleTexOUT;
        this.constantParticleTexIN.setValue(texIN);
        if (!isOnStop) {
            pc.drawQuadWithShader(
                device,
                this._emitter.swapTex ? this._emitter.rtParticleTexIN : this._emitter.rtParticleTexOUT,
                this._emitter.loop ? this._emitter.shaderParticleUpdateRespawn : this._emitter.shaderParticleUpdateNoRespawn);
        } else {
            pc.drawQuadWithShader(
                device,
                this._emitter.swapTex ? this._emitter.rtParticleTexIN : this._emitter.rtParticleTexOUT,
                this._emitter.shaderParticleUpdateOnStop);
        }
        this.constantParticleTexOUT.setValue(texOUT);

        this._emitter.material.setParameter("particleTexOUT", texIN);// OUT);
        this._emitter.material.setParameter("particleTexIN", texOUT);// IN);
        this._emitter.beenReset = false;

        this._emitter.swapTex = !this._emitter.swapTex;

        device.setDepthTest(true);
        device.setDepthWrite(true);

        this._emitter.prevWorldBoundsSize.copy(this.worldBoundsSize);
        this._emitter.prevWorldBoundsCenter.copy(this.worldBounds.center);
        if (this._emitter.pack8)
            this._setInputBounds();
    };

    return {
        ParticleGPUUpdater: ParticleGPUUpdater
    };
}());
