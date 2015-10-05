// Mr F
pc.extend(pc, function() {
    var particleVerts = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1]
    ];

    var _createTexture = function(device, width, height, pixelData, format, mult8Bit) {
        if (!format) format = pc.PIXELFORMAT_RGBA32F;
        var texture = new pc.Texture(device, {
            width: width,
            height: height,
            format: format,
            cubemap: false,
            autoMipmap: false
        });
        texture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
        texture.minFilter = pc.FILTER_NEAREST;
        texture.magFilter = pc.FILTER_NEAREST;

        var pixels = texture.lock();

        if (format == pc.PIXELFORMAT_R8_G8_B8_A8) {
            texture.minFilter = pc.FILTER_LINEAR;
            texture.magFilter = pc.FILTER_LINEAR;

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

    function glMod(x, y) {
        return x - y * Math.floor(x / y);
    }

    function tex1D(arr, u, chans, outArr, test) {
        var a, b, c;

        if ((chans === undefined) || (chans < 2)) {
            u *= arr.length - 1;
            a = arr[Math.floor(u)];
            b = arr[Math.ceil(u)];
            c = u % 1;
            return pc.math.lerp(a, b, c);
        }

        u *= arr.length / chans - 1;
        if (!outArr) outArr = [];
        for (var i = 0; i < chans; i++) {
            a = arr[Math.floor(u) * chans + i];
            b = arr[Math.ceil(u) * chans + i];
            c = u % 1;
            outArr[i] = pc.math.lerp(a, b, c);
        }
        return outArr;
    }

    var default0Curve = new pc.Curve([0, 0, 1, 0]);
    var default1Curve = new pc.Curve([0, 1, 1, 1]);
    var default0Curve3 = new pc.CurveSet([0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]);
    var default1Curve3 = new pc.CurveSet([0, 1, 1, 1], [0, 1, 1, 1], [0, 1, 1, 1]);

    var defaultParamTex = null;

    var velocityVec = new pc.Vec3();
    var localVelocityVec = new pc.Vec3();
    var velocityVec2 = new pc.Vec3();
    var localVelocityVec2 = new pc.Vec3();
    var rndFactor3Vec = new pc.Vec3();
    var particlePosPrev = new pc.Vec3();
    var particlePos = new pc.Vec3();
    var particleFinalPos = new pc.Vec3();
    var moveDirVec = new pc.Vec3();
    var rotMat = new pc.Mat4();
    var spawnMatrix3 = new pc.Mat3();
    var emitterMatrix3 = new pc.Mat3();
    var uniformScale = 1;
    var nonUniformScale;
    var spawnMatrix = new pc.Mat4();
    var randomPos = new pc.Vec3();
    var randomPosTformed = new pc.Vec3();
    var tmpVec3 = new pc.Vec3();
    var velocityV = new pc.Vec3();

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

    function syncToCpu(device, targ) {
        var tex = targ._colorBuffer;
        var pixels = new Uint8Array(tex.width * tex.height * 4);
        var gl = device.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, targ._glFrameBuffer);
        gl.readPixels(0, 0, tex.width, tex.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        if (!tex._levels) tex._levels = [];
        tex._levels[0] = pixels;
    }

    var ParticleEmitter = function (graphicsDevice, options) {
        this.graphicsDevice = graphicsDevice;
        var gd = graphicsDevice;
        var precision = 32;
        this.precision = precision;

        if (!defaultParamTex) {
            // 1x1 white opaque
            //defaultParamTex = _createTexture(gd, 1, 1, [1,1,1,1], pc.PIXELFORMAT_R8_G8_B8_A8, 1.0);

            // white radial gradient
            var resolution = 16;
            var centerPoint = resolution * 0.5 + 0.5;
            var dtex = new Float32Array(resolution * resolution * 4);
            var x, y, xgrad, ygrad, p, c;
            for (y = 0; y < resolution; y++) {
                for(x = 0; x < resolution; x++) {
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
            defaultParamTex = _createTexture(gd, resolution, resolution, dtex, pc.PIXELFORMAT_R8_G8_B8_A8, 1.0);
            defaultParamTex.minFilter = pc.FILTER_LINEAR;
            defaultParamTex.magFilter = pc.FILTER_LINEAR;
        }

        // Global system parameters
        setPropertyTarget = this;
        setPropertyOptions = options;
        setProperty("numParticles", 1);                          // Amount of particles allocated (max particles = max GL texture width at this moment)
        setProperty("rate", 1);                                  // Emission rate
        setProperty("rate2", this.rate);
        setProperty("lifetime", 50);                             // Particle lifetime
        setProperty("emitterExtents", new pc.Vec3(0, 0, 0));        // Spawn point divergence
        setProperty("emitterRadius", 0);
        setProperty("emitterShape", pc.EMITTERSHAPE_BOX);
        setProperty("initialVelocity", 1);
        setProperty("wrap", false);
        setProperty("wrapBounds", null);
        setProperty("colorMap", defaultParamTex);
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
        setProperty("mesh", null);                               // Mesh to be used as particle. Vertex buffer is supposed to hold vertex position in first 3 floats of each vertex
                                                                 // Leave undefined to use simple quads
        setProperty("depthWrite", false);
        setProperty("blendType", pc.BLEND_NORMAL);
        setProperty("node", null);
        setProperty("startAngle", 0);
        setProperty("startAngle2", this.startAngle);

        setProperty("animTilesX", 1);
        setProperty("animTilesY", 1);
        setProperty("animNumFrames", 1);
        setProperty("animSpeed", 1);
        setProperty("animLoop", true);

        this.frameRandom = new pc.Vec3(0, 0, 0);

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

        // Particle updater constants
        this.constantParticleTexIN = gd.scope.resolve("particleTexIN");
        this.constantParticleTexOUT = gd.scope.resolve("particleTexOUT");
        this.constantEmitterPos = gd.scope.resolve("emitterPos");
        this.constantEmitterScale = gd.scope.resolve("emitterScale");
        this.constantSpawnBounds = gd.scope.resolve("spawnBounds");
        this.constantSpawnBoundsSphere = gd.scope.resolve("spawnBoundsSphere");
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
        this.constantEmitterMatrix = gd.scope.resolve("emitterMatrix");
        this.constantNumParticles = gd.scope.resolve("numParticles");
        this.constantNumParticlesPot = gd.scope.resolve("numParticlesPot");
        this.constantLocalVelocityDivMult = gd.scope.resolve("localVelocityDivMult");
        this.constantVelocityDivMult = gd.scope.resolve("velocityDivMult");
        this.constantRotSpeedDivMult = gd.scope.resolve("rotSpeedDivMult");
        this.constantSeed = gd.scope.resolve("seed");
        this.constantStartAngle = gd.scope.resolve("startAngle");
        this.constantStartAngle2 = gd.scope.resolve("startAngle2");

        this.lightCube = new Float32Array(6 * 3);
        this.lightCubeDir = new Array(6);
        this.lightCubeDir[0] = new pc.Vec3(-1, 0, 0);
        this.lightCubeDir[1] = new pc.Vec3(1, 0, 0);
        this.lightCubeDir[2] = new pc.Vec3(0, -1, 0);
        this.lightCubeDir[3] = new pc.Vec3(0, 1, 0);
        this.lightCubeDir[4] = new pc.Vec3(0, 0, -1);
        this.lightCubeDir[5] = new pc.Vec3(0, 0, 1);

        this.animParams = new pc.Vec4();

        this.internalTex0 = null;
        this.internalTex1 = null;
        this.internalTex2 = null;
        this.internalTex3 = null;

        this.vbToSort = null;
        this.vbOld = null;
        this.particleDistance = null;

        this.camera = null;

        this.swapTex = false;
        this.useMesh = true;
        this.useCpu = false;

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

        this.beenReset = false;

        this.rebuild();
    };

    function calcEndTime(emitter) {
        var interval = (Math.max(emitter.rate, emitter.rate2) * emitter.numParticles + emitter.lifetime);
        return Date.now() + interval * 1000;
    }

    function subGraph(A, B) {
        var r = new Float32Array(A.length);
        for(var i=0; i<A.length; i++) {
            r[i] = A[i] - B[i];
        }
        return r;
    }

    function maxUnsignedGraphValue(A, outUMax) {
        var i, j;
        var chans = outUMax.length;
        var values = A.length / chans;
        for(i=0; i<values; i++) {
            for(j=0; j<chans; j++) {
                var a = Math.abs(A[i * chans + j]);
                outUMax[j] = Math.max(outUMax[j], a);
            }
        }
    }

    function normalizeGraph(A, uMax) {
        var chans = uMax.length;
        var i, j;
        var values = A.length / chans;
        for(i=0; i<values; i++) {
            for(j=0; j<chans; j++) {
                A[i * chans + j] /= uMax[j];
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

    ParticleEmitter.prototype = {

        onChangeCamera: function() {
            if (this.depthSoftening > 0) {
                if (this.camera) {
                    this.camera.requestDepthMap();
                }
            }
            this.regenShader();
            this.resetMaterial();
        },

        rebuild: function() {
            var i, len;
            var precision = this.precision;
            var gd = this.graphicsDevice;

            this.spawnBounds = this.emitterShape === pc.EMITTERSHAPE_BOX? this.emitterExtents : this.emitterRadius;

            this.useCpu = this.useCpu || this.sort > pc.PARTICLESORT_NONE ||  // force CPU if desirable by user or sorting is enabled
            (!(gd.extTextureFloat && gd.maxVertexTextures >= 1 && gd.extTextureFloatRenderable)) || // force CPU if either no float textures or can't use enough vertex textures
            gd.fragmentUniformsCount < 100; // force CPU if can't use many uniforms; TODO: change to more realistic value
            this.vertexBuffer = undefined; // force regen VB

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

            // Dynamic simulation data
            this.vbToSort = new Array(this.numParticles);
            this.particleDistance = new Float32Array(this.numParticles);

            this.frameRandom.x = Math.random();
            this.frameRandom.y = Math.random();
            this.frameRandom.z = Math.random();

            this.particleTex = new Float32Array(this.numParticlesPot * 4 * 4);
            var emitterPos = this.node === null ? pc.Vec3.ZERO : this.node.getPosition();
            if (this.emitterShape === pc.EMITTERSHAPE_BOX) {
                if (this.node === null){
                    spawnMatrix.setTRS(pc.Vec3.ZERO, pc.Quat.IDENTITY, this.spawnBounds);
                } else {
                    spawnMatrix.setTRS(pc.Vec3.ZERO, this.node.getRotation(), tmpVec3.copy(this.spawnBounds).mul(this.node.getLocalScale()));
                }
            }
            for (i = 0; i < this.numParticles; i++) {
                this.calcSpawnPosition(emitterPos, i);
                this.particleTex[i * 4 + 3 + this.numParticlesPot * 2 * 4] = 1; // hide/show
            }

            this.particleTexStart = new Float32Array(this.numParticlesPot * 4 * 4);
            for (i = 0; i < this.particleTexStart.length; i++) this.particleTexStart[i] = this.particleTex[i];

            if (!this.useCpu) {
                this.particleTexIN = _createTexture(gd, this.numParticlesPot, 4, this.particleTex);
                this.particleTexOUT = _createTexture(gd, this.numParticlesPot, 4, this.particleTex);
                this.particleTexStart = _createTexture(gd, this.numParticlesPot, 4, this.particleTexStart);

                this.rtParticleTexIN = new pc.RenderTarget(gd, this.particleTexIN, {
                    depth: false
                });
                this.rtParticleTexOUT = new pc.RenderTarget(gd, this.particleTexOUT, {
                    depth: false
                });
                this.swapTex = false;
            }

            var chunks = pc.shaderChunks;
            var shaderCodeStart = chunks.particleUpdaterInitPS +
            (this.emitterShape===pc.EMITTERSHAPE_BOX? chunks.particleUpdaterAABBPS : chunks.particleUpdaterSpherePS) +
            chunks.particleUpdaterStartPS;
            var shaderCodeRespawn = shaderCodeStart + chunks.particleUpdaterRespawnPS + chunks.particleUpdaterEndPS;
            var shaderCodeNoRespawn = shaderCodeStart + chunks.particleUpdaterNoRespawnPS + chunks.particleUpdaterEndPS;
            var shaderCodeOnStop = shaderCodeStart + chunks.particleUpdaterOnStopPS + chunks.particleUpdaterEndPS;

            this.shaderParticleUpdateRespawn = chunks.createShaderFromCode(gd, chunks.fullscreenQuadVS, shaderCodeRespawn, "fsQuad0");
            this.shaderParticleUpdateNoRespawn = chunks.createShaderFromCode(gd, chunks.fullscreenQuadVS, shaderCodeNoRespawn, "fsQuad1");
            this.shaderParticleUpdateOnStop = chunks.createShaderFromCode(gd, chunks.fullscreenQuadVS, shaderCodeOnStop, "fsQuad2");

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
            this.material.cullMode = pc.CULLFACE_NONE;
            this.material.alphaWrite = false;
            this.material.blend = true;

            // Premultiplied alpha. We can use it for both additive and alpha-transparent blending.
            //this.material.blendSrc = pc.BLENDMODE_ONE;
            //this.material.blendDst = pc.BLENDMODE_ONE_MINUS_SRC_ALPHA;
            this.material.blendType = this.blendType;

            this.material.depthWrite = this.depthWrite;
            this.material.emitter = this;

            this.regenShader();
            this.resetMaterial();

            this.meshInstance = new pc.MeshInstance(this.node, mesh, this.material);
            this.meshInstance.updateKey(); // shouldn't be here?
            this.meshInstance.drawToDepth = false;

            this._initializeTextures();

            this.addTime(0); // fill dynamic textures and constants with initial data
            if (this.preWarm) this.prewarm(this.lifetime);

            this.resetTime();
        },

        _isAnimated: function () {
            return this.animNumFrames >= 1 &&
                   (this.animTilesX > 1 || this.animTilesY > 1) &&
                   (this.colorMap && this.colorMap !== defaultParamTex || this.normalMap);
        },

        calcSpawnPosition: function(emitterPos, i) {
            var rX = Math.random();
            var rY = Math.random();
            var rZ = Math.random();
            var rW = Math.random();
            this.particleTex[i * 4 + 0 + this.numParticlesPot * 2 * 4] = rX;
            this.particleTex[i * 4 + 1 + this.numParticlesPot * 2 * 4] = rY;
            this.particleTex[i * 4 + 2 + this.numParticlesPot * 2 * 4] = rZ;
            //this.particleTex[i * 4 + 3 + this.numParticlesPot * 2 * 4] = 1; // hide/show

            randomPos.data[0] = rX - 0.5;
            randomPos.data[1] = rY - 0.5;
            randomPos.data[2] = rZ - 0.5;

            if (this.emitterShape === pc.EMITTERSHAPE_BOX) {
                randomPosTformed.copy(emitterPos).add( spawnMatrix.transformPoint(randomPos) );
            } else {
                randomPos.normalize();
                randomPosTformed.copy(emitterPos).add( randomPos.scale(rW * this.spawnBounds) );
            }

            this.particleTex[i * 4] =     randomPosTformed.data[0];
            this.particleTex[i * 4 + 1] = randomPosTformed.data[1];
            this.particleTex[i * 4 + 2] = randomPosTformed.data[2];
            this.particleTex[i * 4 + 3] = pc.math.lerp(this.startAngle * pc.math.DEG_TO_RAD, this.startAngle2 * pc.math.DEG_TO_RAD, rX);//this.particleNoize[i]);

            var particleRate = pc.math.lerp(this.rate, this.rate2, rX);
            var startSpawnTime = -particleRate * i;
            this.particleTex[i * 4 + 3 + this.numParticlesPot * 4] = startSpawnTime;
        },

        rebuildGraphs: function() {
            var precision = this.precision;
            var gd = this.graphicsDevice;
            var i;

            this.qLocalVelocity = this.localVelocityGraph.quantize(precision);
            this.qVelocity = this.velocityGraph.quantize(precision);
            this.qColor =         this.colorGraph.quantize(precision);
            this.qRotSpeed =      this.rotationSpeedGraph.quantize(precision);
            this.qScale =         this.scaleGraph.quantize(precision);
            this.qAlpha =         this.alphaGraph.quantize(precision);

            this.qLocalVelocity2 = this.localVelocityGraph2.quantize(precision);
            this.qVelocity2 = this.velocityGraph2.quantize(precision);
            this.qColor2 =         this.colorGraph2.quantize(precision);
            this.qRotSpeed2 =      this.rotationSpeedGraph2.quantize(precision);
            this.qScale2 =         this.scaleGraph2.quantize(precision);
            this.qAlpha2 =         this.alphaGraph2.quantize(precision);

            for(i=0; i<precision; i++) {
                this.qRotSpeed[i] *= pc.math.DEG_TO_RAD;
                this.qRotSpeed2[i] *= pc.math.DEG_TO_RAD;
            }

            this.localVelocityUMax = new pc.Vec3(0,0,0);
            this.velocityUMax = new pc.Vec3(0,0,0);
            this.colorUMax =         new pc.Vec3(0,0,0);
            this.rotSpeedUMax = [0];
            this.scaleUMax =    [0];
            this.alphaUMax =    [0];
            this.qLocalVelocityDiv = divGraphFrom2Curves(this.qLocalVelocity, this.qLocalVelocity2, this.localVelocityUMax.data);
            this.qVelocityDiv =      divGraphFrom2Curves(this.qVelocity, this.qVelocity2, this.velocityUMax.data);
            this.qColorDiv =         divGraphFrom2Curves(this.qColor, this.qColor2, this.colorUMax.data);
            this.qRotSpeedDiv =      divGraphFrom2Curves(this.qRotSpeed, this.qRotSpeed2, this.rotSpeedUMax);
            this.qScaleDiv =         divGraphFrom2Curves(this.qScale, this.qScale2, this.scaleUMax);
            this.qAlphaDiv =         divGraphFrom2Curves(this.qAlpha, this.qAlpha2, this.alphaUMax);

            if (!this.useCpu) {
                this.internalTex0 = _createTexture(gd, precision, 1, packTextureXYZ_NXYZ(this.qLocalVelocity, this.qLocalVelocityDiv));
                this.internalTex1 = _createTexture(gd, precision, 1, packTextureXYZ_NXYZ(this.qVelocity, this.qVelocityDiv));
                this.internalTex2 = _createTexture(gd, precision, 1, packTexture5Floats(this.qRotSpeed, this.qScale, this.qScaleDiv, this.qRotSpeedDiv, this.qAlphaDiv));
            }
            this.internalTex3 = _createTexture(gd, precision, 1, packTextureRGBA(this.qColor, this.qAlpha), pc.PIXELFORMAT_R8_G8_B8_A8, 1.0);
        },

        _initializeTextures: function () {
            if (this.colorMap) {
                this.material.setParameter('colorMap', this.colorMap);
                if (this.lighting && this.normalMap) {
                    this.material.setParameter('normalMap', this.normalMap);
                }
            }
        },

        regenShader: function() {
            var programLib = this.graphicsDevice.getProgramLibrary();
            var hasNormal = (this.normalMap != null);
            this.normalOption = 0;
            if (this.lighting) {
                this.normalOption = hasNormal ? 2 : 1;
            }
            // updateShader is also called by pc.Scene when all shaders need to be updated
            this.material.updateShader = function() {

                /* The app works like this:
                 1. Emitter init
                 2. Update. No camera is assigned to emitters
                 3. Render; activeCamera = camera; shader init
                 4. Update. activeCamera is set to emitters
                 -----
                 The problem with 1st frame render is that we init the shader without having any camera set to emitter -
                 so wrong shader is being compiled.
                 To fix it, we need to check activeCamera!=emitter.camera in shader init too
                 */
                if(this.emitter.scene) {
                    if(this.emitter.camera != this.emitter.scene._activeCamera) {
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
                    fog: this.emitter.scene ? this.emitter.scene.fog : "none",
                    wrap: this.emitter.wrap && this.emitter.wrapBounds,
                    blend: this.blendType,
                    animTex: this.emitter._isAnimated(),
                    animTexLoop: this.emitter.animLoop
                });
                this.setShader(shader);
            };
            this.material.updateShader();
        },

        resetMaterial: function() {
            var material = this.material;
            var gd = this.graphicsDevice;

            material.setParameter('stretch', this.stretch);
            if (this._isAnimated()) {
                material.setParameter('animTexParams', this.animParams.data);
            }
            material.setParameter('colorMult', this.intensity);
            if (!this.useCpu) {
                material.setParameter('internalTex0', this.internalTex0);
                material.setParameter('internalTex1', this.internalTex1);
                material.setParameter('internalTex2', this.internalTex2);
            }
            material.setParameter('internalTex3', this.internalTex3);

            material.setParameter('numParticles', this.numParticles);
            material.setParameter('numParticlesPot', this.numParticlesPot);
            material.setParameter('lifetime', this.lifetime);
            material.setParameter('rate', this.rate);
            material.setParameter('rateDiv', this.rate2 - this.rate);
            material.setParameter('seed', this.seed);
            material.setParameter('scaleDivMult', this.scaleUMax[0]);
            material.setParameter('alphaDivMult', this.alphaUMax[0]);
            material.setParameter("graphNumSamples", this.precision);
            material.setParameter("graphSampleSize", 1.0 / this.precision);
            material.setParameter("emitterScale", pc.Vec3.ONE.data);

            if (this.wrap && this.wrapBounds) {
                material.setParameter('wrapBounds', this.wrapBounds.data);
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
        },


        // Declares vertex format, creates VB and IB
        _allocate: function(numParticles) {
            var psysVertCount = numParticles * this.numParticleVerts;
            var psysIndexCount = numParticles * this.numParticleIndices;
            var elements, particleFormat;
            var i;

            if ((this.vertexBuffer === undefined) || (this.vertexBuffer.getNumVertices() !== psysVertCount)) {
                // Create the particle vertex format
                if (!this.useCpu) {
                    elements = [{
                            semantic: pc.SEMANTIC_ATTR0,
                            components: 4,
                            type: pc.ELEMENTTYPE_FLOAT32
                        } // GPU: XYZ = quad vertex position; W = INT: particle ID, FRAC: random factor
                    ];
                    particleFormat = new pc.VertexFormat(this.graphicsDevice, elements);

                    this.vertexBuffer = new pc.VertexBuffer(this.graphicsDevice, particleFormat, psysVertCount, pc.BUFFER_DYNAMIC);
                    this.indexBuffer = new pc.IndexBuffer(this.graphicsDevice, pc.INDEXFORMAT_UINT16, psysIndexCount);
                } else {
                    elements = [{
                        semantic: pc.SEMANTIC_ATTR0,
                        components: 4,
                        type: pc.ELEMENTTYPE_FLOAT32
                    }, {
                        semantic: pc.SEMANTIC_ATTR1,
                        components: 4,
                        type: pc.ELEMENTTYPE_FLOAT32
                    }, {
                        semantic: pc.SEMANTIC_ATTR2,
                        components: 4,
                        type: pc.ELEMENTTYPE_FLOAT32
                    }, {
                        semantic: pc.SEMANTIC_ATTR3,
                        components: 2,
                        type: pc.ELEMENTTYPE_FLOAT32
                    }];
                    particleFormat = new pc.VertexFormat(this.graphicsDevice, elements);

                    this.vertexBuffer = new pc.VertexBuffer(this.graphicsDevice, particleFormat, psysVertCount, pc.BUFFER_DYNAMIC);
                    this.indexBuffer = new pc.IndexBuffer(this.graphicsDevice, pc.INDEXFORMAT_UINT16, psysIndexCount);
                }

                // Fill the vertex buffer
                var data = new Float32Array(this.vertexBuffer.lock());
                var meshData, stride;
                if (this.useMesh) {
                    meshData = new Float32Array(this.mesh.vertexBuffer.lock());
                    stride = meshData.length / this.mesh.vertexBuffer.numVertices;
                }

                var rnd;
                for (i = 0; i < psysVertCount; i++) {
                    id = Math.floor(i / this.numParticleVerts);
                    if (i % this.numParticleVerts === 0) rnd = this.particleTex[i * 4 + 0 + this.numParticlesPot * 2 * 4];

                    if (!this.useMesh) {
                        var vertID = i % 4;
                        data[i * 4] = particleVerts[vertID][0];
                        data[i * 4 + 1] = particleVerts[vertID][1];
                        data[i * 4 + 2] = 0;
                    } else {
                        var vert = i % this.numParticleVerts;
                        data[i * 4] = meshData[vert * stride];
                        data[i * 4 + 1] = meshData[vert * stride + 1];
                        data[i * 4 + 2] = meshData[vert * stride + 2];
                    }

                    data[i * 4 + 3] = id;
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
                indices = new Uint16Array(this.indexBuffer.lock());
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

        reset: function() {
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
            this.resetTime();
            var origLoop =  this.loop;
            this.loop = true;
            this.addTime(0);
            this.loop = origLoop;
            if (this.preWarm) {
                this.prewarm(this.lifetime);
            }
        },

        prewarm: function(time) {
            var lifetimeFraction = time / this.lifetime;
            var iterations = Math.min(Math.floor(lifetimeFraction * this.precision), this.precision);
            var stepDelta = time / iterations;
            for (var i=0; i<iterations; i++) {
                this.addTime(stepDelta);
            }
        },

        resetTime: function() {
            this.endTime = calcEndTime(this);
        },

        onEnableDepth: function() {
            if (this.depthSoftening > 0 && this.camera) {
                this.camera.requestDepthMap();
            }
        },

        onDisableDepth: function() {
            if (this.depthSoftening > 0 && this.camera) {
                this.camera.releaseDepthMap();
            }
        },

        addTime: function(delta, isOnStop) {
            var i, j;
            var device = this.graphicsDevice;

            if (this._isAnimated()) {
                var params = this.animParams;
                params.x = 1.0 / this.animTilesX;
                params.y = 1.0 / this.animTilesY;
                params.z = this.animNumFrames * this.animSpeed;
                params.w = this.animNumFrames - 1;
            }

            // Bake ambient and directional lighting into one ambient cube
            // TODO: only do if lighting changed
            if (this.lighting) {
                if (!this.scene) {
                    console.error("There is no scene defined for lighting particles");
                    return;
                }

                for (i = 0; i < 6; i++) {
                    this.lightCube[i * 3] = this.scene.ambientLight.r;
                    this.lightCube[i * 3 + 1] = this.scene.ambientLight.g;
                    this.lightCube[i * 3 + 2] = this.scene.ambientLight.b;
                }

                var dirs = this.scene._globalLights;
                for (i = 0; i < dirs.length; i++) {
                    for (var c = 0; c < 6; c++) {
                        var weight = Math.max(this.lightCubeDir[c].dot(dirs[i]._direction), 0) * dirs[i]._intensity;
                        this.lightCube[c * 3] += dirs[i]._color.r * weight;
                        this.lightCube[c * 3 + 1] += dirs[i]._color.g * weight;
                        this.lightCube[c * 3 + 2] += dirs[i]._color.b * weight;
                    }
                }
                this.constantLightCube.setValue(this.lightCube);
            }

            if (this.scene) {
                if (this.camera!=this.scene._activeCamera) {
                    this.camera = this.scene._activeCamera;
                    this.onChangeCamera();
                }
            }

            if (this.emitterShape === pc.EMITTERSHAPE_BOX) {
                if (this.meshInstance.node === null){
                    spawnMatrix.setTRS(pc.Vec3.ZERO, pc.Quat.IDENTITY, this.emitterExtents);
                } else {
                    spawnMatrix.setTRS(pc.Vec3.ZERO, this.meshInstance.node.getRotation(), tmpVec3.copy(this.emitterExtents).mul(this.meshInstance.node.getLocalScale()));
                }
            }

            var emitterScale = this.meshInstance.node === null ? pc.Vec3.ONE.data : this.meshInstance.node.getLocalScale().data;
            this.material.setParameter("emitterScale", emitterScale);

            if (!this.useCpu) {
                device.setBlending(false);
                device.setColorWrite(true, true, true, true);
                device.setCullMode(pc.CULLFACE_NONE);
                device.setDepthTest(false);
                device.setDepthWrite(false);

                this.frameRandom.x = Math.random();
                this.frameRandom.y = Math.random();
                this.frameRandom.z = Math.random();

                this.constantGraphSampleSize.setValue(1.0 / this.precision);
                this.constantGraphNumSamples.setValue(this.precision);
                this.constantNumParticles.setValue(this.numParticles);
                this.constantNumParticlesPot.setValue(this.numParticlesPot);
                this.constantInternalTex0.setValue(this.internalTex0);
                this.constantInternalTex1.setValue(this.internalTex1);
                this.constantInternalTex2.setValue(this.internalTex2);

                var emitterPos = this.meshInstance.node === null ? pc.Vec3.ZERO.data : this.meshInstance.node.getPosition().data;
                var emitterMatrix = this.meshInstance.node === null ? pc.Mat4.IDENTITY : this.meshInstance.node.getWorldTransform();
                if (this.emitterShape === pc.EMITTERSHAPE_BOX) {
                    mat4ToMat3(spawnMatrix, spawnMatrix3);
                    this.constantSpawnBounds.setValue(spawnMatrix3.data);
                } else {
                    this.constantSpawnBoundsSphere.setValue(this.emitterRadius);
                }
                this.constantInitialVelocity.setValue(this.initialVelocity);

                mat4ToMat3(emitterMatrix, emitterMatrix3);
                this.constantEmitterPos.setValue(emitterPos);
                this.constantFrameRandom.setValue(this.frameRandom.data);
                this.constantDelta.setValue(delta);
                this.constantRate.setValue(this.rate);
                this.constantRateDiv.setValue(this.rate2 - this.rate);
                this.constantStartAngle.setValue(this.startAngle * pc.math.DEG_TO_RAD);
                this.constantStartAngle2.setValue(this.startAngle2 * pc.math.DEG_TO_RAD);

                this.constantSeed.setValue(this.seed);
                this.constantLifetime.setValue(this.lifetime);
                this.constantEmitterScale.setValue(emitterScale);
                this.constantEmitterMatrix.setValue(emitterMatrix3.data);

                this.constantLocalVelocityDivMult.setValue(this.localVelocityUMax.data);
                this.constantVelocityDivMult.setValue(this.velocityUMax.data);
                this.constantRotSpeedDivMult.setValue(this.rotSpeedUMax[0]);

                var texIN = this.swapTex ? this.particleTexOUT : this.particleTexIN;
                texIN = this.beenReset? this.particleTexStart : texIN;
                var texOUT = this.swapTex ? this.particleTexIN : this.particleTexOUT;
                this.constantParticleTexIN.setValue(texIN);
                if (!isOnStop) {
                    pc.drawQuadWithShader(device, this.swapTex ? this.rtParticleTexIN : this.rtParticleTexOUT, this.loop ? this.shaderParticleUpdateRespawn : this.shaderParticleUpdateNoRespawn);
                } else {
                    pc.drawQuadWithShader(device, this.swapTex ? this.rtParticleTexIN : this.rtParticleTexOUT, this.shaderParticleUpdateOnStop);
                }
                this.constantParticleTexOUT.setValue(texOUT);

                this.material.setParameter("particleTexOUT", texOUT);
                this.material.setParameter("particleTexIN", texIN);
                this.beenReset = false;

                this.swapTex = !this.swapTex;

                device.setDepthTest(true);
                device.setDepthWrite(true);
            } else {
                var data = new Float32Array(this.vertexBuffer.lock());
                if (this.meshInstance.node) {
                    var fullMat = this.meshInstance.node.worldTransform;
                    for (j = 0; j < 12; j++) {
                        rotMat.data[j] = fullMat.data[j];
                    }
                    nonUniformScale = this.meshInstance.node.getLocalScale();
                    uniformScale = Math.max(Math.max(nonUniformScale.x, nonUniformScale.y), nonUniformScale.z);
                }

                // Particle updater emulation
                var emitterPos = this.meshInstance.node === null ? pc.Vec3.ZERO : this.meshInstance.node.getPosition();
                var posCam = this.camera ? this.camera._node.getPosition() : pc.Vec3.ZERO;

                var vertSize = 14;
                for (i = 0; i < this.numParticles; i++) {
                    var id = Math.floor(this.vbCPU[i * this.numParticleVerts * 4 + 3]);

                    var rndFactor = this.particleTex[id * 4 + 0 + this.numParticlesPot * 2 * 4];
                    rndFactor3Vec.x = rndFactor;
                    rndFactor3Vec.y = this.particleTex[id * 4 + 1 + this.numParticlesPot * 2 * 4];
                    rndFactor3Vec.z = this.particleTex[id * 4 + 2 + this.numParticlesPot * 2 * 4];

                    var particleRate = pc.math.lerp(this.rate, this.rate2, rndFactor);
                    var particleLifetime = this.lifetime;
                    var startSpawnTime = -particleRate * id;

                    var life = this.particleTex[id * 4 + 3 + this.numParticlesPot * 4] + delta;
                    var nlife = saturate(life / particleLifetime);

                    var scale = 0;
                    var alphaDiv = 0;
                    var angle = 0;
                    var len;
                    var interpolation;
                    var particleEnabled = life > 0.0 && life < particleLifetime;

                    if (particleEnabled) {
                        localVelocityVec.data =  tex1D(this.qLocalVelocity, nlife, 3, localVelocityVec.data);
                        localVelocityVec2.data = tex1D(this.qLocalVelocity2, nlife, 3, localVelocityVec2.data);
                        velocityVec.data =       tex1D(this.qVelocity, nlife, 3, velocityVec.data);
                        velocityVec2.data =      tex1D(this.qVelocity2, nlife, 3, velocityVec2.data);
                        var rotSpeed =           tex1D(this.qRotSpeed, nlife);
                        var rotSpeed2 =          tex1D(this.qRotSpeed2, nlife);
                        scale =                  tex1D(this.qScale, nlife);
                        var scale2 =             tex1D(this.qScale2, nlife);
                        var alpha =              tex1D(this.qAlpha, nlife);
                        var alpha2 =             tex1D(this.qAlpha2, nlife);

                        localVelocityVec.x = pc.math.lerp(localVelocityVec.x, localVelocityVec2.x, rndFactor3Vec.x);
                        localVelocityVec.y = pc.math.lerp(localVelocityVec.y, localVelocityVec2.y, rndFactor3Vec.y);
                        localVelocityVec.z = pc.math.lerp(localVelocityVec.z, localVelocityVec2.z, rndFactor3Vec.z);

                        if (this.initialVelocity > 0) {
                            if (this.emitterShape === pc.EMITTERSHAPE_SPHERE) {
                                randomPos.copy(rndFactor3Vec).scale(2).sub(pc.Vec3.ONE).normalize();
                                localVelocityVec.add(randomPos.scale(this.initialVelocity));
                            } else {
                                localVelocityVec.add(pc.Vec3.FORWARD.scale(this.initialVelocity));
                            }
                        }

                        velocityVec.x = pc.math.lerp(velocityVec.x, velocityVec2.x, rndFactor3Vec.x);
                        velocityVec.y = pc.math.lerp(velocityVec.y, velocityVec2.y, rndFactor3Vec.y);
                        velocityVec.z = pc.math.lerp(velocityVec.z, velocityVec2.z, rndFactor3Vec.z);

                        rotSpeed = pc.math.lerp(rotSpeed, rotSpeed2, rndFactor3Vec.y);
                        scale = pc.math.lerp(scale, scale2, (rndFactor * 10000.0) % 1.0) * uniformScale;
                        alphaDiv = (alpha2 - alpha) * ((rndFactor * 1000.0) % 1.0);

                        if (this.meshInstance.node) {
                            rotMat.transformPoint(localVelocityVec, localVelocityVec);
                        }
                        localVelocityVec.add(velocityVec.mul(nonUniformScale));
                        moveDirVec.copy(localVelocityVec);

                        particlePosPrev.x = this.particleTex[id * 4];
                        particlePosPrev.y = this.particleTex[id * 4 + 1];
                        particlePosPrev.z = this.particleTex[id * 4 + 2];
                        particlePos.copy(particlePosPrev).add(localVelocityVec.scale(delta));
                        particleFinalPos.copy(particlePos);

                        this.particleTex[id * 4] =      particleFinalPos.x;
                        this.particleTex[id * 4 + 1] =  particleFinalPos.y;
                        this.particleTex[id * 4 + 2] =  particleFinalPos.z;
                        this.particleTex[id * 4 + 3] += rotSpeed * delta;

                        if (this.wrap && this.wrapBounds) {
                            particleFinalPos.sub(emitterPos);
                            particleFinalPos.x = glMod(particleFinalPos.x, this.wrapBounds.x) - this.wrapBounds.x * 0.5;
                            particleFinalPos.y = glMod(particleFinalPos.y, this.wrapBounds.y) - this.wrapBounds.y * 0.5;
                            particleFinalPos.z = glMod(particleFinalPos.z, this.wrapBounds.z) - this.wrapBounds.z * 0.5;
                            particleFinalPos.add(emitterPos);
                        }

                        if (this.sort > 0) {
                            if (this.sort === 1) {
                                tmpVec3.copy(particleFinalPos).sub(posCam);
                                this.particleDistance[id] = -(tmpVec3.x * tmpVec3.x + tmpVec3.y * tmpVec3.y + tmpVec3.z * tmpVec3.z);
                            } else if (this.sort === 2) {
                                this.particleDistance[id] = life;
                            } else if (this.sort === 3) {
                                this.particleDistance[id] = -life;
                            }
                        }
                    } else {
                        this.calcSpawnPosition(emitterPos, id);
                    }

                    if (isOnStop) {
                        if (life < 0) {
                            this.particleTex[id * 4 + 3 + this.numParticlesPot * 2 * 4] = -1;
                        }
                    } else {
                        if (life >= particleLifetime) {
                            // respawn particle by moving it's life back to zero.
                            // OR below zero, if there are still unspawned particles to be emitted before this one.
                            // such thing happens when you have an enormous amount of particles with short lifetime.
                            life -= Math.max(particleLifetime, (this.numParticles - 1) * particleRate);

                            // dead particles in a single-shot system continue their paths, but marked as invisible.
                            // it is necessary for keeping correct separation between particles, based on emission rate.
                            // dying again in a looped system they will become visible on next respawn.
                            this.particleTex[id * 4 + 3 + this.numParticlesPot * 2 * 4] = this.loop? 1 : -1;
                        }
                        if (life < 0 && this.loop) {
                            this.particleTex[id * 4 + 3 + this.numParticlesPot * 2 * 4] = 1;
                        }
                    }
                    if (this.particleTex[id * 4 + 3 + this.numParticlesPot * 2 * 4] < 0) particleEnabled = false;
                    this.particleTex[id * 4 + 3 + this.numParticlesPot * 4] = life;

                    for (var v = 0; v < this.numParticleVerts; v++) {
                        var quadX = this.vbCPU[i * this.numParticleVerts * 4 + v * 4];
                        var quadY = this.vbCPU[i * this.numParticleVerts * 4 + v * 4 + 1];
                        var quadZ = this.vbCPU[i * this.numParticleVerts * 4 + v * 4 + 2];
                        if (!particleEnabled) {
                            quadX = quadY = quadZ = 0;
                        }

                        var w = i * this.numParticleVerts * vertSize + v * vertSize;
                        data[w] = particleFinalPos.x;
                        data[w + 1] = particleFinalPos.y;
                        data[w + 2] = particleFinalPos.z;
                        data[w + 3] = nlife;
                        data[w + 4] = this.alignToMotion? angle : this.particleTex[id * 4 + 3];
                        data[w + 5] = scale;
                        data[w + 6] = alphaDiv;
                        data[w+7] =   moveDirVec.x;
                        data[w + 8] = quadX;
                        data[w + 9] = quadY;
                        data[w + 10] = quadZ;
                        data[w + 11] = moveDirVec.y;
                        data[w + 12] = moveDirVec.z;
                        // 13 is particle id
                    }
                }

                // Particle sorting
                // TODO: optimize
                if (this.sort > pc.PARTICLESORT_NONE && this.camera) {
                    for (i = 0; i < this.numParticles; i++) {
                        this.vbToSort[i] = [i, Math.floor(this.vbCPU[i * this.numParticleVerts * 4 + 3])]; // particle id
                    }
                    for (i = 0; i < this.vbCPU.length; i++) {
                        this.vbOld[i] = this.vbCPU[i];
                    }

                    var particleDistance = this.particleDistance;
                    this.vbToSort.sort(function(a, b) {
                        return particleDistance[a[1]] - particleDistance[b[1]];
                    });

                    for (i = 0; i < this.numParticles; i++) {
                        var start = this.vbToSort[i][0];
                        for (var corner = 0; corner < this.numParticleVerts; corner++) {
                            for (j = 0; j < 4; j++) {
                                this.vbCPU[i * this.numParticleVerts * 4 + corner * 4 + j] = this.vbOld[start * this.numParticleVerts * 4 + corner * 4 + j];
                            }
                        }
                    }
                }

                this.vertexBuffer.unlock();
            }

            if (!this.loop) {
                if (this.onFinished) {
                    if (Date.now() > this.endTime) {
                        this.onFinished();
                    }
                }
            }
        }
    };

    return {
        ParticleEmitter: ParticleEmitter
    };
}());
