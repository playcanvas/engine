// Mr F
pc.extend(pc.scene, function() {
    // TODO: carrying graphicsDevice everywhere around isn't good, should be able to globally address it

    var particleVerts = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1]
    ];

    var _createTexture = function(device, width, height, pixelData, is8Bit, mult8Bit) {
        var texture = new pc.gfx.Texture(device, {
            width: width,
            height: height,
            format: (is8Bit === true ? pc.gfx.PIXELFORMAT_R8_G8_B8_A8 : pc.gfx.PIXELFORMAT_RGBA32F),
            cubemap: false,
            autoMipmap: false
        });
        var pixels = texture.lock();

        if (is8Bit) {
            var temp = new Uint8Array(pixelData.length);
            for (var i = 0; i < pixelData.length; i++) {
                temp[i] = pixelData[i] * mult8Bit * 255;
            }
            pixelData = temp;
        }

        pixels.set(pixelData);

        texture.unlock();

        texture.addressU = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
        texture.addressV = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
        texture.minFilter = pc.gfx.FILTER_NEAREST;
        texture.magFilter = pc.gfx.FILTER_NEAREST;

        return texture;
    };


    function saturate(x) {
        return Math.max(Math.min(x, 1), 0);
    }

    function glMod(x, y) {
        return x - y * Math.floor(x / y);
    }

    function tex1D(arr, u, chans, outArr, test) {
        if ((chans === undefined) || (chans < 2)) {
            u *= arr.length - 1;
            var A = arr[Math.floor(u)];
            var B = arr[Math.ceil(u)];
            var C = u % 1;
            return pc.math.lerp(A, B, C);
        }

        u *= arr.length / chans - 1;
        if (!outArr) outArr = [];
        for (var i = 0; i < chans; i++) {
            var A = arr[Math.floor(u) * chans + i];
            var B = arr[Math.ceil(u) * chans + i];
            var C = u % 1;
            outArr[i] = pc.math.lerp(A, B, C);
        }
        return outArr;
    }

    var default0Curve = new pc.Curve([0, 0, 1, 0]);
    var default1Curve = new pc.Curve([0, 1, 1, 1]);
    var default0Curve3 = new pc.CurveSet([0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]);
    var default1Curve3 = new pc.CurveSet([0, 1, 1, 1], [0, 1, 1, 1], [0, 1, 1, 1]);

    var defaultParamTex = null;

    var localOffsetVec = new pc.Vec3();
    var worldOffsetVec = new pc.Vec3();
    var rotMat = new pc.Mat4();

    var setPropertyTarget;
    var setPropertyOptions;

    function setProperty(pName, defaultVal) {
        if (setPropertyOptions[pName] !== undefined && setPropertyOptions[pName] !== null) {
            setPropertyTarget[pName] = setPropertyOptions[pName];
        } else {
            setPropertyTarget[pName] = defaultVal;
        }
    };

    function pack3NFloats(a, b, c) {
        var packed = ((a * 255) << 16) | ((b * 255) << 8) | (c * 255);
        return (packed) / (1 << 24);
    }

    function packTextureXYZ_N3(qXYZ, qA, qB, qC) {
        var colors = new Array(qA.length * 4);
        for (var i = 0; i < qA.length; i++) {
            colors[i * 4] = qXYZ[i * 3];
            colors[i * 4 + 1] = qXYZ[i * 3 + 1];
            colors[i * 4 + 2] = qXYZ[i * 3 + 2];

            colors[i * 4 + 3] = pack3NFloats(qA[i], qB[i], qC[i]);
        }
        return colors;
    }

    function packTextureXYZ_N3_Array(qXYZ, qXYZ2) {
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

    function packTexture2_N3_Array(qA, qB, qXYZ) {
        var colors = new Array(qA.length * 4);
        for (var i = 0; i < qA.length; i++) {
            colors[i * 4] = qA[i];
            colors[i * 4 + 1] = qB[i];
            colors[i * 4 + 2] = 0;

            colors[i * 4 + 3] = pack3NFloats(qXYZ[i * 3], qXYZ[i * 3 + 1], qXYZ[i * 3 + 2]);
        }
        return colors;
    }


    function createOffscreenTarget(gd, camera) {
        var rect = camera.rect;

        var width = Math.floor(rect.z * gd.width);
        var height = Math.floor(rect.w * gd.height);

        var colorBuffer = new pc.gfx.Texture(gd, {
            format: pc.gfx.PIXELFORMAT_R8_G8_B8_A8,
            width: width,
            height: height
        });

        colorBuffer.minFilter = pc.gfx.FILTER_NEAREST;
        colorBuffer.magFilter = pc.gfx.FILTER_NEAREST;
        colorBuffer.addressU = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
        colorBuffer.addressV = pc.gfx.ADDRESS_CLAMP_TO_EDGE;

        return new pc.gfx.RenderTarget(gd, colorBuffer, {
            depth: true
        });
    }


    var ParticleEmitter2 = function (graphicsDevice, options) {
        this.graphicsDevice = graphicsDevice;
        var gd = graphicsDevice;
        var precision = 32;
        this.precision = precision;

        // Global system parameters
        setPropertyTarget = this;
        setPropertyOptions = options;
        setProperty("numParticles", 1);                          // Amount of particles allocated (max particles = max GL texture width at this moment)
        setProperty("rate", 1);                                  // Emission rate
        setProperty("lifetime", 50);                             // Particle lifetime
        setProperty("spawnBounds", new pc.Vec3(0, 0, 0));        // Spawn point divergence
        setProperty("wrap", false);
        setProperty("wrapBounds", null);
        // setProperty("wind", new pc.Vec3(0, 0, 0));               // Wind velocity
        setProperty("smoothness", 4);                            // Blurring width for graphs
        setProperty("colorMap", null);
        setProperty("normalMap", null);
        setProperty("oneShot", false);
        setProperty("speedDiv", 0.0); // Randomizes particle simulation speed [0-1] per frame
        setProperty("constantSpeedDiv", 0.0); // Randomizes particle simulation speed [0-1] (one value during whole particle life)
        setProperty("sort", pc.scene.PARTICLES_SORT_NONE); // Sorting mode: 0 = none, 1 = by distance, 2 = by life, 3 = by -life;  Forces CPU mode if not 0
        setProperty("mode", this.sort > pc.scene.PARTICLES_SORT_NONE ? "CPU" : "GPU");
        setProperty("camera", null);
        setProperty("scene", null);
        setProperty("lighting", false);
        setProperty("halfLambert", false);
        setProperty("stretch", 0.0);
        setProperty("depthSoftening", 0);
        setProperty("maxEmissionTime", 15);
        setProperty("mesh", null);                               // Mesh to be used as particle. Vertex buffer is supposed to hold vertex position in first 3 floats of each vertex
                                                                 // Leave undefined to use simple quads
        setProperty("gammaCorrect", true);
        setProperty("depthTest", false);
        this.mode = (this.mode === "CPU" ? pc.scene.PARTICLES_MODE_CPU : pc.scene.PARTICLES_MODE_GPU);

        if (!(gd.extTextureFloat && (gd.maxVertexTextures >= 4))) {
            this.mode = pc.scene.PARTICLES_MODE_CPU;
        }

        this.frameRandom = new pc.Vec3(0, 0, 0);

        // Time-dependent parameters
        setProperty("localOffsetGraph", default0Curve3);
        setProperty("offsetGraph", default0Curve3);
        setProperty("colorGraph", default1Curve3);
        setProperty("localPosDivGraph", default0Curve3);
        setProperty("posDivGraph", default0Curve3);
        setProperty("angleGraph", default0Curve);
        setProperty("scaleGraph", default1Curve);
        setProperty("alphaGraph", default1Curve);
        setProperty("scaleDivGraph", default0Curve);
        setProperty("angleDivGraph", default0Curve);
        setProperty("alphaDivGraph", default0Curve);

        // Particle updater constants
        this.constantTexLifeAndSourcePosIN = gd.scope.resolve("texLifeAndSourcePosIN");
        this.constantTexLifeAndSourcePosOUT = gd.scope.resolve("texLifeAndSourcePosOUT");
        this.constantEmitterPos = gd.scope.resolve("emitterPos");
        this.constantSpawnBounds = gd.scope.resolve("spawnBounds");
        this.constantFrameRandom = gd.scope.resolve("frameRandom");
        this.constantDelta = gd.scope.resolve("delta");
        this.constantRate = gd.scope.resolve("rate");
        this.constantLifetime = gd.scope.resolve("lifetime");
        this.constantDeltaRnd = gd.scope.resolve("deltaRandomness");
        this.constantDeltaRndStatic = gd.scope.resolve("deltaRandomnessStatic");
        this.constantLightCube = gd.scope.resolve("lightCube[0]");

        this.lightCube = new Float32Array(6 * 3);
        this.lightCubeDir = new Array(6);

        this.qLocalOffset = null;
        this.qWorldOffset = null;
        this.qColor = null;
        this.qPosDiv = null;
        this.qPosWorldDiv = null;

        this.qAngle = null;
        this.qScale = null;
        this.qAlpha = null;
        this.qScaleDiv = null;
        this.qAngleDiv = null;
        this.qAlphaDiv = null;

        this.colorMult = 1;

        this.internalTex0 = null;
        this.internalTex1 = null;
        this.internalTex2 = null;
        this.internalTex3 = null;

        this.lifeAndSourcePos = null;

        this.vbToSort = null;
        this.vbOld = null
        this.particleDistance = null;
        this.particleNoize = null;

        this.texLifeAndSourcePosIN = null;
        this.texLifeAndSourcePosOUT = null;
        this.texLifeAndSourcePosStart = null;

        this.rtLifeAndSourcePosIN = null;
        this.rtLifeAndSourcePosOUT = null;
        this.swapTex = false;

        this.shaderParticleUpdateRespawn = null;
        this.shaderParticleUpdateNoRespawn = null;

        this.numParticleVerts = 0;
        this.numParticleIndices = 0;

        this.material = null;
        this.meshInstance = null;

        this.rebuild();
    };

    function calcEndTime(emitter) {
        var interval = (emitter.rate * emitter.numParticles + emitter.lifetime + emitter.lifetime / (1 - emitter.constantSpeedDiv));
        interval = Math.min(interval, emitter.maxEmissionTime);
        return Date.now() + interval * 1000;
    }

    ParticleEmitter2.prototype = {
        rebuild: function() {
            var precision = this.precision;
            var gd = this.graphicsDevice;

            if (this.depthSoftening > 0) {
                if (this.camera) {
                    if ((this.camera.camera.camera._depthTarget === undefined) || (this.camera.camera.camera._depthTarget === null)) {
                        this.camera.camera.camera._depthTarget = createOffscreenTarget(this.graphicsDevice, this.camera.camera);
                        this.camera.camera._depthTarget = this.camera.camera.camera._depthTarget;
                        this.camera._depthTarget = this.camera.camera.camera._depthTarget;
                    }
                }
            }

            if (this.lighting) {
                // this.lightCube = new Float32Array(6 * 3);

                // this.lightCubeDir = new Array(6);
                this.lightCubeDir[0] = new pc.Vec3(-1, 0, 0);
                this.lightCubeDir[1] = new pc.Vec3(1, 0, 0);
                this.lightCubeDir[2] = new pc.Vec3(0, -1, 0);
                this.lightCubeDir[3] = new pc.Vec3(0, 1, 0);
                this.lightCubeDir[4] = new pc.Vec3(0, 0, -1);
                this.lightCubeDir[5] = new pc.Vec3(0, 0, 1);
            }

            this.qLocalOffset = this.localOffsetGraph.quantize(precision, this.smoothness);
            this.qWorldOffset = this.offsetGraph.quantize(precision, this.smoothness);
            this.qColor = this.colorGraph.quantize(precision, this.smoothness);
            this.qPosDiv = this.localPosDivGraph.quantize(precision, this.smoothness);
            this.qPosWorldDiv = this.posDivGraph.quantize(precision, this.smoothness);

            this.qAngle = this.angleGraph.quantize(precision, this.smoothness);

            // convert to radians
            for (var i=0, len = this.qAngle.length, qAngle = this.qAngle; i<len; i++) {
                qAngle[i] *= pc.math.DEG_TO_RAD;
            }

            this.qAngleDiv = this.angleDivGraph.quantize(precision, this.smoothness);

            // convert to radians
            for (var i=0, len = this.qAngleDiv.length, qAngleDiv = this.qAngleDiv; i<len; i++) {
                qAngleDiv[i] *= pc.math.DEG_TO_RAD;
            }

            this.qScale = this.scaleGraph.quantize(precision, this.smoothness);
            this.qAlpha = this.alphaGraph.quantize(precision, this.smoothness);
            this.qScaleDiv = this.scaleDivGraph.quantize(precision, this.smoothness);


            this.qAlphaDiv = this.alphaDivGraph.quantize(precision, this.smoothness);

            this.colorMult = 1;
            for (var i = 0; i < this.qColor.length; i++) {
                this.colorMult = Math.max(this.colorMult, this.qColor[i]);
            }

            if (this.mode === pc.scene.PARTICLES_MODE_GPU) {
                this.internalTex0 = _createTexture(gd, precision, 1, packTextureXYZ_N3(this.qLocalOffset, this.qScaleDiv, this.qAngleDiv, this.qAlphaDiv));
                this.internalTex1 = _createTexture(gd, precision, 1, packTextureXYZ_N3_Array(this.qWorldOffset, this.qPosDiv));
                this.internalTex2 = _createTexture(gd, precision, 1, packTexture2_N3_Array(this.qAngle, this.qScale, this.qPosWorldDiv));
            }
            this.internalTex3 = _createTexture(gd, precision, 1, packTextureRGBA(this.qColor, this.qAlpha), true, 1.0 / this.colorMult);


            // Dynamic simulation data
            this.lifeAndSourcePos = new Float32Array(this.numParticles * 4);
            for (var i = 0; i < this.numParticles; i++) {
                this.lifeAndSourcePos[i * 4] = this.spawnBounds.x * (Math.random() * 2 - 1);
                this.lifeAndSourcePos[i * 4 + 1] = this.spawnBounds.y * (Math.random() * 2 - 1);
                this.lifeAndSourcePos[i * 4 + 2] = this.spawnBounds.z * (Math.random() * 2 - 1);
                this.lifeAndSourcePos[i * 4 + 3] = -this.rate * i;
            }
            this.lifeAndSourcePosStart = new Float32Array(this.numParticles * 4);
            for (var i = 0; i < this.lifeAndSourcePosStart.length; i++) this.lifeAndSourcePosStart[i] = this.lifeAndSourcePos[i];

            if (this.mode === pc.scene.PARTICLES_MODE_CPU) {
                this.vbToSort = new Array(this.numParticles);
                this.vbOld = new Float32Array(this.numParticles * 4 * 4);
                this.particleDistance = new Float32Array(this.numParticles);
                this.particleNoize = new Float32Array(this.numParticles);
                for (var i = 0; i < this.numParticles; i++) {
                    this.particleNoize[i] = Math.random();
                }
            }

            if (this.mode === pc.scene.PARTICLES_MODE_GPU) {
                this.texLifeAndSourcePosIN = _createTexture(gd, this.numParticles, 1, this.lifeAndSourcePos);
                this.texLifeAndSourcePosOUT = _createTexture(gd, this.numParticles, 1, this.lifeAndSourcePos);
                this.texLifeAndSourcePosStart = _createTexture(gd, this.numParticles, 1, this.lifeAndSourcePosStart);

                this.rtLifeAndSourcePosIN = new pc.gfx.RenderTarget(gd, this.texLifeAndSourcePosIN, {
                    depth: false
                });
                this.rtLifeAndSourcePosOUT = new pc.gfx.RenderTarget(gd, this.texLifeAndSourcePosOUT, {
                    depth: false
                });
                this.swapTex = false;
            }

            var chunks = pc.gfx.shaderChunks;
            var shaderCodeRespawn = chunks.particleUpdaterStartPS;
            shaderCodeRespawn += chunks.particleUpdaterRespawnPS;
            shaderCodeRespawn += chunks.particleUpdaterEndPS;

            var shaderCodeNoRespawn = chunks.particleUpdaterStartPS;
            shaderCodeNoRespawn += chunks.particleUpdaterEndPS;

            this.shaderParticleUpdateRespawn = chunks.createShaderFromCode(gd, chunks.fullscreenQuadVS, shaderCodeRespawn, "fsQuad" + false);
            this.shaderParticleUpdateNoRespawn = chunks.createShaderFromCode(gd, chunks.fullscreenQuadVS, shaderCodeNoRespawn, "fsQuad" + true);

            this.numParticleVerts = this.mesh === null ? 4 : this.mesh.vertexBuffer.numVertices;
            this.numParticleIndices = this.mesh === null ? 6 : this.mesh.indexBuffer[0].numIndices;
            this._allocate(this.numParticles);

            var mesh = new pc.scene.Mesh();
            mesh.vertexBuffer = this.vertexBuffer;
            mesh.indexBuffer[0] = this.indexBuffer;
            mesh.primitive[0].type = pc.gfx.PRIMITIVE_TRIANGLES;
            mesh.primitive[0].base = 0;
            mesh.primitive[0].count = (this.numParticles * this.numParticleIndices);
            mesh.primitive[0].indexed = true;

            var hasNormal = (this.normalMap != null);

            var programLib = this.graphicsDevice.getProgramLibrary();
            var normalOption = 0;
            if (this.lighting) {
                normalOption = hasNormal ? 2 : 1;
            }
            var isMesh = this.mesh != null;
            var shader = programLib.getProgram("particle2", {
                mode: this.mode,
                normal: normalOption,
                halflambert: this.halfLambert,
                stretch: this.stretch,
                soft: this.depthSoftening,
                mesh: isMesh,
                srgb: this.gammaCorrect,
                wrap: this.wrap && this.wrapBounds
            });
            this.material = new pc.scene.Material();
            this.material.setShader(shader);

            this.material.cullMode = pc.gfx.CULLFACE_NONE;
            this.material.blend = true;

            // Premultiplied alpha. We can use it for both additive and alpha-transparent blending.
            this.material.blendSrc = pc.gfx.BLENDMODE_ONE;
            this.material.blendDst = pc.gfx.BLENDMODE_ONE_MINUS_SRC_ALPHA;

            this.material.depthWrite = this.depthTest;

            this.resetMaterial();


            this.meshInstance = new pc.scene.MeshInstance(null, mesh, this.material);
            this.meshInstance.layer = pc.scene.LAYER_SKYBOX; //LAYER_FX;
            this.meshInstance.updateKey(); // shouldn't be here?

            this._initializeTextures();

            this.addTime(0); // fill dynamic textures and constants with initial data

            this.resetTime();
        },

        _initializeTextures: function () {
            if (this.colorMap) {
                this.material.setParameter('colorMap', this.colorMap);
                if (this.lighting && this.normalMap) {
                    this.material.setParameter('normalMap', this.normalMap);
                }
            }
        },

        resetMaterial: function() {
            var material = this.material;
            var gd = this.graphicsDevice;

            material.setParameter('stretch', this.stretch);
            material.setParameter('colorMult', this.colorMult);
            if (this.mode === pc.scene.PARTICLES_MODE_GPU) {
                material.setParameter('internalTex0', this.internalTex0);
                material.setParameter('internalTex1', this.internalTex1);
                material.setParameter('internalTex2', this.internalTex2);
                material.setParameter('texLifeAndSourcePosOUT', this.texLifeAndSourcePosOUT);
            }
            material.setParameter('internalTex3', this.internalTex3);

            material.setParameter('numParticles', this.numParticles);
            material.setParameter('lifetime', this.lifetime);
            material.setParameter('graphSampleSize', 1.0 / this.precision);
            material.setParameter('graphNumSamples', this.precision);

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
                material.setParameter('uDepthMap', this.camera.camera._depthTarget.colorBuffer);
                material.setParameter('screenSize', new pc.Vec4(gd.width, gd.height, 1.0 / gd.width, 1.0 / gd.height).data);
                material.setParameter('softening', this.depthSoftening);
            }
            if (this.stretch > 0.0) material.cull = pc.gfx.CULLFACE_NONE;
        },


        // Declares vertex format, creates VB and IB
        _allocate: function(numParticles) {
            var psysVertCount = numParticles * this.numParticleVerts;
            var psysIndexCount = numParticles * this.numParticleIndices;

            if ((this.vertexBuffer === undefined) || (this.vertexBuffer.getNumVertices() !== psysVertCount)) {
                // Create the particle vertex format
                if (this.mode === pc.scene.PARTICLES_MODE_GPU) {
                    var elements = [{
                            semantic: pc.gfx.SEMANTIC_ATTR0,
                            components: 4,
                            type: pc.gfx.ELEMENTTYPE_FLOAT32
                        } // GPU: XYZ = quad vertex position; W = INT: particle ID, FRAC: random factor
                    ];
                    var particleFormat = new pc.gfx.VertexFormat(this.graphicsDevice, elements);

                    this.vertexBuffer = new pc.gfx.VertexBuffer(this.graphicsDevice, particleFormat, psysVertCount, pc.gfx.BUFFER_DYNAMIC);
                    this.indexBuffer = new pc.gfx.IndexBuffer(this.graphicsDevice, pc.gfx.INDEXFORMAT_UINT16, psysIndexCount);
                } else {
                    var elements = [{
                        semantic: pc.gfx.SEMANTIC_ATTR0,
                        components: 4,
                        type: pc.gfx.ELEMENTTYPE_FLOAT32
                    }, {
                        semantic: pc.gfx.SEMANTIC_ATTR1,
                        components: 4,
                        type: pc.gfx.ELEMENTTYPE_FLOAT32
                    }, {
                        semantic: pc.gfx.SEMANTIC_ATTR2,
                        components: 4,
                        type: pc.gfx.ELEMENTTYPE_FLOAT32
                    }];
                    var particleFormat = new pc.gfx.VertexFormat(this.graphicsDevice, elements);

                    this.vertexBuffer = new pc.gfx.VertexBuffer(this.graphicsDevice, particleFormat, psysVertCount, pc.gfx.BUFFER_DYNAMIC);
                    this.indexBuffer = new pc.gfx.IndexBuffer(this.graphicsDevice, pc.gfx.INDEXFORMAT_UINT16, psysIndexCount);
                }

                // Fill the vertex buffer
                var data = new Float32Array(this.vertexBuffer.lock());
                var meshData, stride;
                if (this.mesh) {
                    meshData = new Float32Array(this.mesh.vertexBuffer.lock());
                    stride = meshData.length / this.mesh.vertexBuffer.numVertices;
                }

                var rnd;
                for (var i = 0; i < psysVertCount; i++) {
                    if (i % this.numParticleVerts === 0) rnd = Math.random();
                    var id = Math.floor(i / this.numParticleVerts);

                    if (!this.mesh) {
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

                    data[i * 4 + 3] = id + rnd;
                }

                if (this.mode === pc.scene.PARTICLES_MODE_CPU) {
                    this.vbCPU = new Float32Array(data);
                }
                this.vertexBuffer.unlock();
                if (this.mesh) {
                    this.mesh.vertexBuffer.unlock();
                }


                // Fill the index buffer
                var dst = 0;
                var indices = new Uint16Array(this.indexBuffer.lock());
                if (this.mesh) meshData = new Uint16Array(this.mesh.indexBuffer[0].lock());
                for (var i = 0; i < numParticles; i++) {
                    if (!this.mesh) {
                        var baseIndex = i * 4;
                        indices[dst++] = baseIndex;
                        indices[dst++] = baseIndex + 1;
                        indices[dst++] = baseIndex + 2;
                        indices[dst++] = baseIndex;
                        indices[dst++] = baseIndex + 2;
                        indices[dst++] = baseIndex + 3;
                    } else {
                        for (var j = 0; j < this.numParticleIndices; j++) {
                            indices[i * this.numParticleIndices + j] = meshData[j] + i * this.numParticleVerts
                        }
                    }
                }
                this.indexBuffer.unlock();
                if (this.mesh) this.mesh.indexBuffer[0].unlock();
            }
        },

        reset: function() {
            if (this.mode === pc.scene.PARTICLES_MODE_CPU) {
                for (var i = 0; i < this.lifeAndSourcePosStart.length; i++) this.lifeAndSourcePos[i] = this.lifeAndSourcePosStart[i];
            } else {
                this._initializeTextures();
                this.swapTex = false;
                var oldTexIN = this.texLifeAndSourcePosIN;
                this.texLifeAndSourcePosIN = this.texLifeAndSourcePosStart;
                this.addTime(0);
                this.texLifeAndSourcePosIN = oldTexIN;
            }
            this.resetTime();
        },

        resetTime: function() {
            this.endTime = calcEndTime(this);
        },

        addTime: function(delta) {
            var device = this.graphicsDevice;
            device.setBlending(false);
            device.setColorWrite(true, true, true, true);
            device.setCullMode(pc.gfx.CULLFACE_NONE);
            device.setDepthTest(false);
            device.setDepthWrite(false);

            // Bake ambient and directional lighting into one ambient cube
            // TODO: only do if lighting changed
            if (this.lighting) {
                if (!this.scene) {
                    console.error("There is no scene defined for lighting particles");
                    return;
                }

                for (var i = 0; i < 6; i++) {
                    this.lightCube[i * 3] = this.scene.ambientLight.r;
                    this.lightCube[i * 3 + 1] = this.scene.ambientLight.g;
                    this.lightCube[i * 3 + 2] = this.scene.ambientLight.b;
                }

                var dirs = this.scene._globalLights;
                for (var i = 0; i < dirs.length; i++) {
                    for (var c = 0; c < 6; c++) {
                        var weight = Math.max(this.lightCubeDir[c].dot(dirs[i]._direction), 0);
                        this.lightCube[c * 3] += dirs[i]._color.r * weight;
                        this.lightCube[c * 3 + 1] += dirs[i]._color.g * weight;
                        this.lightCube[c * 3 + 2] += dirs[i]._color.b * weight;
                    }
                }
                this.constantLightCube.setValue(this.lightCube);
            }

            if (this.mode === pc.scene.PARTICLES_MODE_GPU) {
                this.frameRandom.x = Math.random();
                this.frameRandom.y = Math.random();
                this.frameRandom.z = Math.random();

                //return;
                this.constantEmitterPos.setValue(this.meshInstance.node === null ? (new pc.Vec3(0, 0, 0)).data : this.meshInstance.node.getPosition().data);
                this.constantSpawnBounds.setValue(this.spawnBounds.data);
                this.constantFrameRandom.setValue(this.frameRandom.data);
                this.constantDelta.setValue(delta);
                this.constantRate.setValue(this.rate);
                this.constantLifetime.setValue(this.lifetime);
                this.constantDeltaRnd.setValue(this.speedDiv);
                this.constantDeltaRndStatic.setValue(this.constantSpeedDiv);

                this.constantTexLifeAndSourcePosIN.setValue(this.swapTex ? this.texLifeAndSourcePosOUT : this.texLifeAndSourcePosIN);
                pc.gfx.drawQuadWithShader(device, this.swapTex ? this.rtLifeAndSourcePosIN : this.rtLifeAndSourcePosOUT, this.oneShot ? this.shaderParticleUpdateNoRespawn : this.shaderParticleUpdateRespawn);

                this.constantTexLifeAndSourcePosOUT.setValue(this.swapTex ? this.texLifeAndSourcePosIN : this.texLifeAndSourcePosOUT);
                this.swapTex = !this.swapTex;
            } else {
                // Particle updater emulation
                var emitterPos = this.meshInstance.node === null ? (new pc.Vec3(0, 0, 0)).data : this.meshInstance.node.getPosition().data;
                for (var i = 0; i < this.numParticles; i++) {
                    if (this.lifeAndSourcePos[i * 4 + 3] <= 0) {
                        this.lifeAndSourcePos[i * 4] = emitterPos[0] + this.spawnBounds.x * this.particleNoize[i];
                        this.lifeAndSourcePos[i * 4 + 1] = emitterPos[1] + this.spawnBounds.y * ((this.particleNoize[i] * 10) % 1);
                        this.lifeAndSourcePos[i * 4 + 2] = emitterPos[2] + this.spawnBounds.z * ((this.particleNoize[i] * 100) % 1);
                    }
                    var x = i * (this.lifeAndSourcePos[i * 4 + 3] + this.lifeAndSourcePos[i * 4 + 0] + this.lifeAndSourcePos[i * 4 + 1] + this.lifeAndSourcePos[i * 4 + 2] + 1.0) * 1000.0;
                    x = (x % 13.0) * (x % 123.0);
                    var dx = (x % 0.01);
                    var noize = saturate(0.1 + dx * 100.0);
                    this.lifeAndSourcePos[i * 4 + 3] += delta * pc.math.lerp(1.0 - this.speedDiv, 1.0, noize) * pc.math.lerp(1.0 - this.constantSpeedDiv, 1.0, this.particleNoize[i]);

                    if (!this.oneShot) {
                        if (this.lifeAndSourcePos[i * 4 + 3] > this.lifetime) {
                            this.lifeAndSourcePos[i * 4 + 3] = -this.rate + (this.lifeAndSourcePos[i * 4 + 3] - this.lifetime);
                        }
                    }
                }

                var data = new Float32Array(this.vertexBuffer.lock());
                if (this.meshInstance.node) {
                    var fullMat = this.meshInstance.node.worldTransform;
                    for (var j = 0; j < 12; j++) rotMat.data[j] = fullMat.data[j];
                }


                // Particle sorting
                // TODO: optimize
                var posCam;
                posCam = this.camera.position.data;
                if (this.sort > pc.scene.PARTICLES_SORT_NONE) {
                    if (!this.camera) {
                        console.error("There is no camera for particle sorting");
                        return;
                    }

                    for (var i = 0; i < this.numParticles; i++) {
                        this.vbToSort[i] = [i, Math.floor(this.vbCPU[i * this.numParticleVerts * 4 + 3])]; // particle id
                    }
                    for (var i = 0; i < this.numParticles * this.numParticleVerts * 4; i++) {
                        this.vbOld[i] = this.vbCPU[i];
                    }

                    var particleDistance = this.particleDistance;
                    this.vbToSort.sort(function(a, b) {
                        return particleDistance[a[1]] - particleDistance[b[1]];
                    });

                    for (var i = 0; i < this.numParticles; i++) {
                        var start = this.vbToSort[i][0];
                        for (var corner = 0; corner < this.numParticleVerts; corner++) {
                            for (var j = 0; j < 4; j++) {
                                this.vbCPU[i * this.numParticleVerts * 4 + corner * 4 + j] = this.vbOld[start * this.numParticleVerts * 4 + corner * 4 + j];
                            }
                        }
                    }
                }


                // Particle VS emulation
                for (var i = 0; i < this.numParticles; i++) {
                    var particleEnabled = true;
                    var particlePosX = 0.0;
                    var particlePosY = 0.0;
                    var particlePosZ = 0.0;
                    var particlePosPastX = 0.0;
                    var particlePosPastY = 0.0;
                    var particlePosPastZ = 0.0;
                    var origParticlePosX = 0.0;
                    var origParticlePosY = 0.0;
                    var origParticlePosZ = 0.0;
                    var particlePosMovedX = 0.0;
                    var particlePosMovedY = 0.0;
                    var particlePosMovedZ = 0.0;
                    var angle = 0.0;
                    var scale = 0.0;
                    var alphaRnd = 0.0;
                    var rndFactor = 0.0;
                    var sgn = 0.0;


                    var id = Math.floor(this.vbCPU[i * this.numParticleVerts * 4 + 3]);
                    var life = Math.max(this.lifeAndSourcePos[id * 4 + 3], 0) / this.lifetime;

                    if (this.lifeAndSourcePos[id * 4 + 3] < 0) particleEnabled = false;

                    if (particleEnabled) {
                        rndFactor = this.vbCPU[i * this.numParticleVerts * 4 + 3] % 1.0;

                        var rndFactor3X = rndFactor;
                        var rndFactor3Y = (rndFactor * 10) % 1;
                        var rndFactor3Z = (rndFactor * 100) % 1;

                        var sourcePosX = this.lifeAndSourcePos[id * 4];
                        var sourcePosY = this.lifeAndSourcePos[id * 4 + 1];
                        var sourcePosZ = this.lifeAndSourcePos[id * 4 + 2];


                        localOffsetVec.data = tex1D(this.qLocalOffset, life, 3, localOffsetVec.data);
                        var localOffset = localOffsetVec.data;
                        var posDivergence = tex1D(this.qPosDiv, life, 3);
                        var scaleRnd = tex1D(this.qScaleDiv, life);
                        var angleRnd = tex1D(this.qAngleDiv, life);
                        alphaRnd = tex1D(this.qAlphaDiv, life);

                        worldOffsetVec.data = tex1D(this.qWorldOffset, life, 3, worldOffsetVec.data, i === 0 ? 1 : 0);
                        var worldOffset = worldOffsetVec.data;
                        var posWorldDivergence = tex1D(this.qPosWorldDiv, life, 3);
                        angle = tex1D(this.qAngle, life);
                        scale = tex1D(this.qScale, life);

                        var divergentLocalOffsetX = pc.math.lerp(localOffset[0], -localOffset[0], rndFactor3X);
                        var divergentLocalOffsetY = pc.math.lerp(localOffset[1], -localOffset[1], rndFactor3Y);
                        var divergentLocalOffsetZ = pc.math.lerp(localOffset[2], -localOffset[2], rndFactor3Z);
                        localOffset[0] = pc.math.lerp(localOffset[0], divergentLocalOffsetX, posDivergence[0]);
                        localOffset[1] = pc.math.lerp(localOffset[1], divergentLocalOffsetY, posDivergence[1]);
                        localOffset[2] = pc.math.lerp(localOffset[2], divergentLocalOffsetZ, posDivergence[2]);

                        var divergentWorldOffsetX = pc.math.lerp(worldOffset[0], -worldOffset[0], rndFactor3X);
                        var divergentWorldOffsetY = pc.math.lerp(worldOffset[1], -worldOffset[1], rndFactor3Y);
                        var divergentWorldOffsetZ = pc.math.lerp(worldOffset[2], -worldOffset[2], rndFactor3Z);
                        worldOffset[0] = pc.math.lerp(worldOffset[0], divergentWorldOffsetX, posWorldDivergence[0]);
                        worldOffset[1] = pc.math.lerp(worldOffset[1], divergentWorldOffsetY, posWorldDivergence[1]);
                        worldOffset[2] = pc.math.lerp(worldOffset[2], divergentWorldOffsetZ, posWorldDivergence[2]);

                        angle = pc.math.lerp(angle, angle + 90 * rndFactor, angleRnd);
                        scale = pc.math.lerp(scale, scale * rndFactor, scaleRnd);

                        if (this.meshInstance.node) {
                            rotMat.transformPoint(localOffsetVec, localOffsetVec);
                        }

                        particlePosX = sourcePosX + localOffset[0] + worldOffset[0];
                        particlePosY = sourcePosY + localOffset[1] + worldOffset[1];
                        particlePosZ = sourcePosZ + localOffset[2] + worldOffset[2];

                        if (this.wrap && this.wrapBounds) {
                            origParticlePosX = particlePosX;
                            origParticlePosY = particlePosY;
                            origParticlePosZ = particlePosZ;
                            particlePosX -= posCam[0];
                            particlePosY -= posCam[1];
                            particlePosZ -= posCam[2];
                            particlePosX = glMod(particlePosX, this.wrapBounds.x * 2.0) - this.wrapBounds.x;
                            particlePosY = glMod(particlePosY, this.wrapBounds.y * 2.0) - this.wrapBounds.y;
                            particlePosZ = glMod(particlePosZ, this.wrapBounds.z * 2.0) - this.wrapBounds.z;
                            particlePosX += posCam[0];
                            particlePosY += posCam[1];
                            particlePosZ += posCam[2];
                            particlePosMovedX = particlePosX - origParticlePosX;
                            particlePosMovedY = particlePosY - origParticlePosY;
                            particlePosMovedZ = particlePosZ - origParticlePosZ;
                        }

                        if (this.sort === 1) {
                            this.particleDistance[id] = particlePosX * posCam[0] + particlePosY * posCam[1] + particlePosZ * posCam[2];
                        } else if (this.sort === 2) {
                            this.particleDistance[id] = life;
                        } else if (this.sort === 3) {
                            this.particleDistance[id] = -life;
                        }


                        if (this.stretch > 0.0) {
                            life = Math.max(life - (1.0 / this.precision) * this.stretch, 0.0);
                            localOffsetVec.data = tex1D(this.qLocalOffset, life, 3, localOffsetVec.data);
                            var localOffset = localOffsetVec.data;
                            var posDivergence = tex1D(this.qPosDiv, life, 3);

                            worldOffsetVec.data = tex1D(this.qWorldOffset, life, 3, worldOffsetVec.data, i == 0 ? 1 : 0);
                            worldOffset = worldOffsetVec.data;
                            posWorldDivergence = tex1D(this.qPosWorldDiv, life, 3);

                            divergentLocalOffsetX = pc.math.lerp(localOffset[0], -localOffset[0], rndFactor3X);
                            divergentLocalOffsetY = pc.math.lerp(localOffset[1], -localOffset[1], rndFactor3Y);
                            divergentLocalOffsetZ = pc.math.lerp(localOffset[2], -localOffset[2], rndFactor3Z);
                            localOffset[0] = pc.math.lerp(localOffset[0], divergentLocalOffsetX, posDivergence[0]);
                            localOffset[1] = pc.math.lerp(localOffset[1], divergentLocalOffsetY, posDivergence[1]);
                            localOffset[2] = pc.math.lerp(localOffset[2], divergentLocalOffsetZ, posDivergence[2]);

                            divergentWorldOffsetX = pc.math.lerp(worldOffset[0], -worldOffset[0], rndFactor3X);
                            divergentWorldOffsetY = pc.math.lerp(worldOffset[1], -worldOffset[1], rndFactor3Y);
                            divergentWorldOffsetZ = pc.math.lerp(worldOffset[2], -worldOffset[2], rndFactor3Z);
                            worldOffset[0] = pc.math.lerp(worldOffset[0], divergentWorldOffsetX, posWorldDivergence[0]);
                            worldOffset[1] = pc.math.lerp(worldOffset[1], divergentWorldOffsetY, posWorldDivergence[1]);
                            worldOffset[2] = pc.math.lerp(worldOffset[2], divergentWorldOffsetZ, posWorldDivergence[2]);

                            if (this.meshInstance.node) {
                                rotMat.transformPoint(localOffsetVec, localOffsetVec);
                            }

                            particlePosPastX = sourcePosX + localOffset[0] + worldOffset[0];
                            particlePosPastY = sourcePosY + localOffset[1] + worldOffset[1];
                            particlePosPastZ = sourcePosZ + localOffset[2] + worldOffset[2];
                            particlePosPastX += particlePosMovedX;
                            particlePosPastY += particlePosMovedY;
                            particlePosPastZ += particlePosMovedZ;

                            var moveDirX = particlePosX - particlePosPastX;
                            var moveDirY = particlePosY - particlePosPastY;
                            var moveDirZ = particlePosZ - particlePosPastZ;

                            sgn = (moveDirX > 0.0 ? 1.0 : -1.0) * (moveDirY > 0.0 ? 1.0 : -1.0) * (moveDirZ > 0.0 ? 1.0 : -1.0);
                        }
                    }


                    for (var v = 0; v < this.numParticleVerts; v++) {
                        var quadX = this.vbCPU[i * this.numParticleVerts * 4 + v * 4];
                        var quadY = this.vbCPU[i * this.numParticleVerts * 4 + v * 4 + 1];
                        var quadZ = this.vbCPU[i * this.numParticleVerts * 4 + v * 4 + 2];
                        if (!particleEnabled) {
                            quadX = quadY = quadZ = 0;
                        } else {
                            if (this.stretch > 0.0) {
                                var interpolation = quadY * 0.5 + 0.5;
                                //particlePosX = sgn > 0.0 ? pc.math.lerp(particlePosPastX, particlePosX, interpolation) : pc.math.lerp(particlePosX, particlePosPastX, interpolation);
                                //particlePosY = sgn > 0.0 ? pc.math.lerp(particlePosPastY, particlePosY, interpolation) : pc.math.lerp(particlePosY, particlePosPastY, interpolation);
                                //particlePosZ = sgn > 0.0 ? pc.math.lerp(particlePosPastZ, particlePosZ, interpolation) : pc.math.lerp(particlePosZ, particlePosPastZ, interpolation);

                                particlePosX = pc.math.lerp(particlePosX, particlePosPastX, interpolation);
                                particlePosY = pc.math.lerp(particlePosY, particlePosPastY, interpolation);
                                particlePosZ = pc.math.lerp(particlePosZ, particlePosPastZ, interpolation);
                            }
                        }

                        var w = i * this.numParticleVerts * 12 + v * 12;

                        data[w] = particlePosX;
                        data[w + 1] = particlePosY;
                        data[w + 2] = particlePosZ;
                        data[w + 3] = life;
                        data[w + 4] = angle;
                        data[w + 5] = scale;
                        data[w + 6] = alphaRnd * (((rndFactor * 1000.0) % 1) * 2.0 - 1.0);
                        //data[w+7] =   (quadX*0.5+0.5) + (quadY*0.5+0.5) * 0.1;
                        data[w + 8] = quadX;
                        data[w + 9] = quadY;
                        data[w + 10] = quadZ;
                    }
                }

                this.vertexBuffer.unlock();
            }

            if (this.oneShot) {
                if (this.onFinished) {
                    if (Date.now() > this.endTime) {
                        this.onFinished();
                    }
                }
            }

            device.setDepthTest(true);
            device.setDepthWrite(true);
        }
    };

    return {
        ParticleEmitter2: ParticleEmitter2,
        PARTICLES_SORT_NONE: 0,
        PARTICLES_SORT_DISTANCE: 1,
        PARTICLES_SORT_NEWER_FIRST: 2,
        PARTICLES_SORT_OLDER_FIRST: 3,
        PARTICLES_MODE_GPU: 0,
        PARTICLES_MODE_CPU: 1
    };
}());
