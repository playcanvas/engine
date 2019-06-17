// Mr F
Object.assign(pc, function () {
    var particleVerts = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1]
    ];

    var _createTexture = function (device, width, height, pixelData, format, mult8Bit, filter) {
        if (!format) format = pc.PIXELFORMAT_RGBA32F;

        var mipFilter = pc.FILTER_NEAREST;
        if (filter && format === pc.PIXELFORMAT_R8_G8_B8_A8)
            mipFilter = pc.FILTER_LINEAR;

        var texture = new pc.Texture(device, {
            width: width,
            height: height,
            format: format,
            cubemap: false,
            mipmaps: false,
            minFilter: mipFilter,
            magFilter: mipFilter,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE
        });
        texture.name = "PSTexture";

        var pixels = texture.lock();

        if (format === pc.PIXELFORMAT_R8_G8_B8_A8) {
            var temp = new Uint8Array(pixelData.length);
            for (var i = 0; i < pixelData.length; i++) {
                temp[i] = pixelData[i] * mult8Bit * 255;
            }
            pixelData = temp;
        }

        pixels.set(pixelData);

        texture.unlock();

        return texture;
    };

    function saturate(x) {
        return Math.max(Math.min(x, 1), 0);
    }

    var default0Curve = new pc.Curve([0, 0, 1, 0]);
    var default1Curve = new pc.Curve([0, 1, 1, 1]);
    var default0Curve3 = new pc.CurveSet([0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]);
    var default1Curve3 = new pc.CurveSet([0, 1, 1, 1], [0, 1, 1, 1], [0, 1, 1, 1]);

    var particleTexHeight = 2;
    var particleTexChannels = 4; // there is a duplicate in cpu updater

    var extentsInnerRatioUniform = new Float32Array(3);
    var spawnMatrix = new pc.Mat4();

    var tmpVec3 = new pc.Vec3();
    var bMin = new pc.Vec3();
    var bMax = new pc.Vec3();

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

    var ParticleEmitter = function (graphicsDevice, options) {
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
            ParticleEmitter.DEFAULT_PARAM_TEXTURE = _createTexture(gd, resolution, resolution, dtex, pc.PIXELFORMAT_R8_G8_B8_A8, 1.0, true);
            ParticleEmitter.DEFAULT_PARAM_TEXTURE.minFilter = pc.FILTER_LINEAR;
            ParticleEmitter.DEFAULT_PARAM_TEXTURE.magFilter = pc.FILTER_LINEAR;
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
        setProperty("emitterExtents", new pc.Vec3(0, 0, 0));        // Spawn point divergence
        setProperty("emitterExtentsInner", new pc.Vec3(0, 0, 0));   // Volume inside emitterExtents to exclude from reneration
        setProperty("emitterRadius", 0);
        setProperty("emitterRadiusInner", 0);                       // Same as ExtentsInner but for spherical volume
        setProperty("emitterShape", pc.EMITTERSHAPE_BOX);
        setProperty("initialVelocity", 1);
        setProperty("wrap", false);
        setProperty("localSpace", false);
        setProperty("wrapBounds", null);
        setProperty("colorMap", ParticleEmitter.DEFAULT_PARAM_TEXTURE);
        setProperty("normalMap", null);
        setProperty("loop", true);
        setProperty("preWarm", false);
        setProperty("sort", pc.PARTICLESORT_NONE); // Sorting mode: 0 = none, 1 = by distance, 2 = by life, 3 = by -life;  Forces CPU mode if not 0
        setProperty("mode", pc.PARTICLEMODE_GPU);
        setProperty("scene", null);
        setProperty("lighting", false);
        setProperty("halfLambert", false);
        setProperty("intensity", 1.0);
        setProperty("stretch", 0.0);
        setProperty("alignToMotion", false);
        setProperty("depthSoftening", 0);
        setProperty("mesh", null);                              // Mesh to be used as particle. Vertex buffer is supposed to hold vertex position in first 3 floats of each vertex
                                                                // Leave undefined to use simple quads
        setProperty("particleNormal", new pc.Vec3(0, 1, 0));
        setProperty("orientation", pc.PARTICLEORIENTATION_SCREEN);

        setProperty("depthWrite", false);
        setProperty("noFog", false);
        setProperty("blendType", pc.BLEND_NORMAL);
        setProperty("node", null);
        setProperty("startAngle", 0);
        setProperty("startAngle2", this.startAngle);

        setProperty("animTilesX", 1);
        setProperty("animTilesY", 1);
        setProperty("animNumFrames", 1);
        setProperty("animSpeed", 1);
        setProperty("animLoop", true);

        this._gpuUpdater = new pc.ParticleGPUUpdater(this, gd);
        this._cpuUpdater = new pc.ParticleCPUUpdater(this);

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
        this.lightCubeDir[0] = new pc.Vec3(-1, 0, 0);
        this.lightCubeDir[1] = new pc.Vec3(1, 0, 0);
        this.lightCubeDir[2] = new pc.Vec3(0, -1, 0);
        this.lightCubeDir[3] = new pc.Vec3(0, 1, 0);
        this.lightCubeDir[4] = new pc.Vec3(0, 0, -1);
        this.lightCubeDir[5] = new pc.Vec3(0, 0, 1);

        this.animParams = new Float32Array(4);

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
        this.localBounds = new pc.BoundingBox();
        this.worldBoundsNoTrail = new pc.BoundingBox();
        this.worldBoundsTrail = [new pc.BoundingBox(), new pc.BoundingBox()];
        this.worldBounds = new pc.BoundingBox();

        this.worldBoundsSize = new pc.Vec3();

        this.prevWorldBoundsSize = new pc.Vec3();
        this.prevWorldBoundsCenter = new pc.Vec3();
        this.worldBoundsMul = new pc.Vec3();
        this.worldBoundsAdd = new pc.Vec3();
        this.timeToSwitchBounds = 0;
        // this.prevPos = new pc.Vec3();

        this.shaderParticleUpdateRespawn = null;
        this.shaderParticleUpdateNoRespawn = null;
        this.shaderParticleUpdateOnStop = null;

        this.numParticleVerts = 0;
        this.numParticleIndices = 0;

        this.material = null;
        this.meshInstance = null;

        this.seed = 0;

        this.fixedTimeStep = 1.0 / 60;
        this.maxSubSteps = 10;
        this.simTime = 0;
        this.simTimeTotal = 0;

        this.beenReset = false;

        this._layer = null;

        this.rebuild();
    };

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

    Object.assign(ParticleEmitter.prototype, {

        onChangeCamera: function () {
            this.regenShader();
            this.resetMaterial();
        },

        calculateBoundsMad: function () {
            this.worldBoundsMul.x = 1.0 / this.worldBoundsSize.x;
            this.worldBoundsMul.y = 1.0 / this.worldBoundsSize.y;
            this.worldBoundsMul.z = 1.0 / this.worldBoundsSize.z;

            this.worldBoundsAdd.copy(this.worldBounds.center).mul(this.worldBoundsMul).scale(-1);
            this.worldBoundsAdd.x += 0.5;
            this.worldBoundsAdd.y += 0.5;
            this.worldBoundsAdd.z += 0.5;
        },

        calculateWorldBounds: function () {
            if (!this.node) return;

            this.prevWorldBoundsSize.copy(this.worldBoundsSize);
            this.prevWorldBoundsCenter.copy(this.worldBounds.center);

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

            this.worldBoundsSize.copy(this.worldBounds.halfExtents).scale(2);

            if (this.localSpace) {
                this.meshInstance.aabb.setFromTransformedAabb(this.worldBounds, nodeWT);
                this.meshInstance.mesh.aabb.setFromTransformedAabb(this.worldBounds, nodeWT);
            } else {
                this.meshInstance.aabb.copy(this.worldBounds);
                this.meshInstance.mesh.aabb.copy(this.worldBounds);
            }
            this.meshInstance._aabbVer = 1 - this.meshInstance._aabbVer;

            if (this.pack8) this.calculateBoundsMad();
        },

        resetWorldBounds: function () {
            if (!this.node) return;

            this.worldBoundsNoTrail.setFromTransformedAabb(
                this.localBounds, this.localSpace ? pc.Mat4.IDENTITY : this.node.getWorldTransform());

            this.worldBoundsTrail[0].copy(this.worldBoundsNoTrail);
            this.worldBoundsTrail[1].copy(this.worldBoundsNoTrail);

            this.worldBounds.copy(this.worldBoundsTrail[0]);
            this.worldBoundsSize.copy(this.worldBounds.halfExtents).scale(2);

            this.prevWorldBoundsSize.copy(this.worldBoundsSize);
            this.prevWorldBoundsCenter.copy(this.worldBounds.center);

            this.simTimeTotal = 0;
            this.timeToSwitchBounds = 0;
        },

        calculateLocalBounds: function () {
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

            if (this.emitterShape === pc.EMITTERSHAPE_BOX) {
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
        },

        rebuild: function () {
            var i;
            var gd = this.graphicsDevice;

            if (this.colorMap === null) this.colorMap = ParticleEmitter.DEFAULT_PARAM_TEXTURE;

            this.spawnBounds = this.emitterShape === pc.EMITTERSHAPE_BOX ? this.emitterExtents : this.emitterRadius;

            this.useCpu = this.useCpu || this.sort > pc.PARTICLESORT_NONE ||  // force CPU if desirable by user or sorting is enabled
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

            this.numParticlesPot = pc.math.nextPowerOfTwo(this.numParticles);
            this.rebuildGraphs();
            this.calculateLocalBounds();
            this.resetWorldBounds();

            if (this.node) {
                // this.prevPos.copy(this.node.getPosition());
                this.worldBounds.setFromTransformedAabb(
                    this.localBounds, this.localSpace ? pc.Mat4.IDENTITY : this.node.getWorldTransform());

                this.worldBoundsTrail[0].copy(this.worldBounds);
                this.worldBoundsTrail[1].copy(this.worldBounds);

                this.worldBoundsSize.copy(this.worldBounds.halfExtents).scale(2);
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
            var emitterPos = (this.node === null || this.localSpace) ? pc.Vec3.ZERO : this.node.getPosition();
            if (this.emitterShape === pc.EMITTERSHAPE_BOX) {
                if (this.node === null || this.localSpace){
                    spawnMatrix.setTRS(pc.Vec3.ZERO, pc.Quat.IDENTITY, this.spawnBounds);
                } else {
                    spawnMatrix.setTRS(pc.Vec3.ZERO, this.node.getRotation(), tmpVec3.copy(this.spawnBounds).mul(this.node.localScale));
                }
                extentsInnerRatioUniform[0] = this.emitterExtents.x != 0 ? this.emitterExtentsInner.x / this.emitterExtents.x : 0;
                extentsInnerRatioUniform[1] = this.emitterExtents.y != 0 ? this.emitterExtentsInner.y / this.emitterExtents.y : 0;
                extentsInnerRatioUniform[2] = this.emitterExtents.z != 0 ? this.emitterExtentsInner.z / this.emitterExtents.z : 0;
            }
            for (i = 0; i < this.numParticles; i++) {
                this._cpuUpdater.calcSpawnPosition(this.particleTex, spawnMatrix, extentsInnerRatioUniform, emitterPos, i);
                if (this.useCpu) this.particleTex[i * particleTexChannels + 3 + this.numParticlesPot * 2 * particleTexChannels] = 1; // hide/show
            }

            this.particleTexStart = new Float32Array(this.numParticlesPot * particleTexHeight * particleTexChannels);
            for (i = 0; i < this.particleTexStart.length; i++) this.particleTexStart[i] = this.particleTex[i];

            if (!this.useCpu) {
                if (this.pack8) {
                    this.particleTexIN = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTex, pc.PIXELFORMAT_R8_G8_B8_A8, 1, false);
                    this.particleTexOUT = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTex, pc.PIXELFORMAT_R8_G8_B8_A8, 1, false);
                    this.particleTexStart = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTexStart, pc.PIXELFORMAT_R8_G8_B8_A8, 1, false);
                } else {
                    this.particleTexIN = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTex);
                    this.particleTexOUT = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTex);
                    this.particleTexStart = _createTexture(gd, this.numParticlesPot, particleTexHeight, this.particleTexStart);
                }

                this.rtParticleTexIN = new pc.RenderTarget(gd, this.particleTexIN, {
                    depth: false
                });
                this.rtParticleTexOUT = new pc.RenderTarget(gd, this.particleTexOUT, {
                    depth: false
                });
                this.swapTex = false;
            }

            var chunks = pc.shaderChunks;
            var shaderCodeStart = (this.localSpace ? '#define LOCAL_SPACE\n' : '') + chunks.particleUpdaterInitPS +
            (this.pack8 ? (chunks.particleInputRgba8PS + chunks.particleOutputRgba8PS) :
                (chunks.particleInputFloatPS + chunks.particleOutputFloatPS)) +
            (this.emitterShape === pc.EMITTERSHAPE_BOX ? chunks.particleUpdaterAABBPS : chunks.particleUpdaterSpherePS) +
            chunks.particleUpdaterStartPS;
            var shaderCodeRespawn = shaderCodeStart + chunks.particleUpdaterRespawnPS + chunks.particleUpdaterEndPS;
            var shaderCodeNoRespawn = shaderCodeStart + chunks.particleUpdaterNoRespawnPS + chunks.particleUpdaterEndPS;
            var shaderCodeOnStop = shaderCodeStart + chunks.particleUpdaterOnStopPS + chunks.particleUpdaterEndPS;


            // Note: createShaderFromCode can return a shader from the cache (not a new shader) so we *should not* delete these shaders
            // when the particle emitter is destroyed
            this.shaderParticleUpdateRespawn = chunks.createShaderFromCode(gd, chunks.fullscreenQuadVS, shaderCodeRespawn, "fsQuad0" + this.emitterShape + "" + this.pack8);
            this.shaderParticleUpdateNoRespawn = chunks.createShaderFromCode(gd, chunks.fullscreenQuadVS, shaderCodeNoRespawn, "fsQuad1" + this.emitterShape + "" + this.pack8);
            this.shaderParticleUpdateOnStop = chunks.createShaderFromCode(gd, chunks.fullscreenQuadVS, shaderCodeOnStop, "fsQuad2" + this.emitterShape + "" + this.pack8);

            this.numParticleVerts = this.useMesh ? this.mesh.vertexBuffer.numVertices : 4;
            this.numParticleIndices = this.useMesh ? this.mesh.indexBuffer[0].numIndices : 6;
            this._allocate(this.numParticles);

            var mesh = new pc.Mesh();
            mesh.vertexBuffer = this.vertexBuffer;
            mesh.indexBuffer[0] = this.indexBuffer;
            mesh.primitive[0].type = pc.PRIMITIVE_TRIANGLES;
            mesh.primitive[0].base = 0;
            mesh.primitive[0].count = (this.numParticles * this.numParticleIndices);
            mesh.primitive[0].indexed = true;

            this.material = new pc.Material();
            this.material.name = this.node.name;
            this.material.cull = pc.CULLFACE_NONE;
            this.material.alphaWrite = false;
            this.material.blend = true;
            this.material.blendType = this.blendType;

            this.material.depthWrite = this.depthWrite;
            this.material.emitter = this;

            this.regenShader();
            this.resetMaterial();

            var wasVisible = this.meshInstance ? this.meshInstance.visible : true;
            this.meshInstance = new pc.MeshInstance(this.node, mesh, this.material);
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
        },

        _isAnimated: function () {
            return this.animNumFrames >= 1 &&
                   (this.animTilesX > 1 || this.animTilesY > 1) &&
                   (this.colorMap && this.colorMap !== ParticleEmitter.DEFAULT_PARAM_TEXTURE || this.normalMap);
        },

        rebuildGraphs: function () {
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
                this.qRotSpeed[i] *= pc.math.DEG_TO_RAD;
                this.qRotSpeed2[i] *= pc.math.DEG_TO_RAD;
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
            this.colorParam = _createTexture(gd, precision, 1, packTextureRGBA(this.qColor, this.qAlpha), pc.PIXELFORMAT_R8_G8_B8_A8, 1.0, true);
        },

        _initializeTextures: function () {
            if (this.colorMap) {
                this.material.setParameter('colorMap', this.colorMap);
                if (this.lighting && this.normalMap) {
                    this.material.setParameter('normalMap', this.normalMap);
                }
            }
        },

        regenShader: function () {
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
                    if (this.emitter.camera != this.emitter.scene._activeCamera) {
                        this.emitter.camera = this.emitter.scene._activeCamera;
                        this.emitter.onChangeCamera();
                    }
                }

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
                    blend: this.blendType,
                    animTex: this.emitter._isAnimated(),
                    animTexLoop: this.emitter.animLoop,
                    pack8: this.emitter.pack8,
                    customFace: this.emitter.orientation != pc.PARTICLEORIENTATION_SCREEN
                });
                this.shader = shader;
            };
            this.material.updateShader();
        },

        resetMaterial: function () {
            var material = this.material;

            material.setParameter('stretch', this.stretch);
            if (this._isAnimated()) {
                material.setParameter('animTexParams', this.animParams);
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
            if (this.stretch > 0.0) material.cull = pc.CULLFACE_NONE;

            this._compParticleFaceParams();
        },

        _compParticleFaceParams: function () {
            var tangent, binormal;
            if (this.orientation == pc.PARTICLEORIENTATION_SCREEN) {
                tangent = new Float32Array([1, 0, 0]);
                binormal = new Float32Array([0, 0, 1]);
            } else {
                var n;
                if (this.orientation == pc.PARTICLEORIENTATION_WORLD) {
                    n = this.particleNormal.normalize();
                } else {
                    var emitterMat = this.node === null ?
                        pc.Mat4.IDENTITY : this.node.getWorldTransform();
                    n = emitterMat.transformVector(this.particleNormal).normalize();
                }
                var t = new pc.Vec3(1, 0, 0);
                if (Math.abs(t.dot(n)) == 1)
                    t.set(0, 0, 1);
                var b = new pc.Vec3().cross(n, t).normalize();
                t.cross(b, n).normalize();
                tangent = new Float32Array([t.x, t.y, t.z]);
                binormal = new Float32Array([b.x, b.y, b.z]);
            }
            this.material.setParameter("faceTangent", tangent);
            this.material.setParameter("faceBinorm", binormal);
        },


        // Declares vertex format, creates VB and IB
        _allocate: function (numParticles) {
            var psysVertCount = numParticles * this.numParticleVerts;
            var psysIndexCount = numParticles * this.numParticleIndices;
            var elements, particleFormat;
            var i;

            if ((this.vertexBuffer === undefined) || (this.vertexBuffer.getNumVertices() !== psysVertCount)) {
                // Create the particle vertex format
                if (!this.useCpu) {
                    // GPU: XYZ = quad vertex position; W = INT: particle ID, FRAC: random factor
                    elements = [{
                        semantic: pc.SEMANTIC_ATTR0,
                        components: 4,
                        type: pc.TYPE_FLOAT32
                    }];
                    if (this.useMesh) {
                        elements.push({
                            semantic: pc.SEMANTIC_ATTR1,
                            components: 2,
                            type: pc.TYPE_FLOAT32
                        });
                    }
                    particleFormat = new pc.VertexFormat(this.graphicsDevice, elements);

                    this.vertexBuffer = new pc.VertexBuffer(this.graphicsDevice, particleFormat, psysVertCount, pc.BUFFER_DYNAMIC);
                    this.indexBuffer = new pc.IndexBuffer(this.graphicsDevice, pc.INDEXFORMAT_UINT16, psysIndexCount);
                } else {
                    elements = [{
                        semantic: pc.SEMANTIC_ATTR0,
                        components: 4,
                        type: pc.TYPE_FLOAT32
                    }, {
                        semantic: pc.SEMANTIC_ATTR1,
                        components: 4,
                        type: pc.TYPE_FLOAT32
                    }, {
                        semantic: pc.SEMANTIC_ATTR2,
                        components: 4,
                        type: pc.TYPE_FLOAT32
                    }, {
                        semantic: pc.SEMANTIC_ATTR3,
                        components: this.useMesh ? 4 : 2,
                        type: pc.TYPE_FLOAT32
                    }];
                    particleFormat = new pc.VertexFormat(this.graphicsDevice, elements);

                    this.vertexBuffer = new pc.VertexBuffer(this.graphicsDevice, particleFormat, psysVertCount, pc.BUFFER_DYNAMIC);
                    this.indexBuffer = new pc.IndexBuffer(this.graphicsDevice, pc.INDEXFORMAT_UINT16, psysIndexCount);
                }

                // Fill the vertex buffer
                var data = new Float32Array(this.vertexBuffer.lock());
                var meshData, stride, texCoordOffset;
                if (this.useMesh) {
                    meshData = new Float32Array(this.mesh.vertexBuffer.lock());
                    stride = meshData.length / this.mesh.vertexBuffer.numVertices;
                    for (var elem = 0; elem < this.mesh.vertexBuffer.format.elements.length; elem++) {
                        if (this.mesh.vertexBuffer.format.elements[elem].name === pc.SEMANTIC_TEXCOORD0) {
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
        },

        reset: function () {
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
        },

        prewarm: function (time) {
            var lifetimeFraction = time / this.lifetime;
            var iterations = Math.min(Math.floor(lifetimeFraction * this.precision), this.precision);
            var stepDelta = time / iterations;
            for (var i = 0; i < iterations; i++) {
                this.addTime(stepDelta, false);
            }
        },

        resetTime: function () {
            this.endTime = calcEndTime(this);
        },

        finishFrame: function () {
            if (this.useCpu) this.vertexBuffer.unlock();
        },

        addTime: function (delta, isOnStop) {
            var device = this.graphicsDevice;

            // #ifdef PROFILER
            var startTime = pc.now();
            // #endif

            this.simTimeTotal += delta;

            this.calculateWorldBounds();

            if (this._isAnimated()) {
                var params = this.animParams;
                params[0] = 1.0 / this.animTilesX;
                params[1] = 1.0 / this.animTilesY;
                params[2] = this.animNumFrames * this.animSpeed;
                params[3] = this.animNumFrames - 1;
            }

            if (this.scene) {
                if (this.camera != this.scene._activeCamera) {
                    this.camera = this.scene._activeCamera;
                    this.onChangeCamera();
                }
            }

            if (this.emitterShape === pc.EMITTERSHAPE_BOX) {
                extentsInnerRatioUniform[0] = this.emitterExtents.x != 0 ? this.emitterExtentsInner.x / this.emitterExtents.x : 0;
                extentsInnerRatioUniform[1] = this.emitterExtents.y != 0 ? this.emitterExtentsInner.y / this.emitterExtents.y : 0;
                extentsInnerRatioUniform[2] = this.emitterExtents.z != 0 ? this.emitterExtentsInner.z / this.emitterExtents.z : 0;
                if (this.meshInstance.node === null){
                    spawnMatrix.setTRS(pc.Vec3.ZERO, pc.Quat.IDENTITY, this.emitterExtents);
                } else {
                    spawnMatrix.setTRS(pc.Vec3.ZERO, this.meshInstance.node.getRotation(), tmpVec3.copy(this.emitterExtents).mul(this.meshInstance.node.localScale));
                }
            }

            var emitterPos;
            var emitterScale = this.meshInstance.node === null ? pc.Vec3.ONE : this.meshInstance.node.localScale;
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

            // #ifdef PROFILER
            this._addTimeTime += pc.now() - startTime;
            // #endif
        },

        _destroyResources: function () {
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
        },

        destroy: function () {
            this.camera = null;

            this._destroyResources();
        }
    });

    return {
        ParticleEmitter: ParticleEmitter
    };
}());
