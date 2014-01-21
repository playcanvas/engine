pc.extend(pc.scene, function () {

    var position = new pc.Vec3();
    var velocity = new pc.Vec3();
    var acceleration = new pc.Vec3();
    var colorMult = new pc.Vec4();

    var particleVerts = [
        [-0.5, -0.5],
        [ 0.5, -0.5],
        [ 0.5,  0.5],
        [-0.5,  0.5]
    ];

    var plusMinus = function(range) {
        return (Math.random() - 0.5) * range * 2;
    };

    var plusMinusVector3 = function(range) {
        var v = new pc.Vec3();
        v.set(plusMinus(range.x), plusMinus(range.y), plusMinus(range.z));
        return v;
    };

    var plusMinusVector4 = function(range) {
        var v = new pc.Vec4();
        v.set(plusMinus(range.x), plusMinus(range.y), plusMinus(range.z), plusMinus(range.w));
        return v;
    };

    var _createTexture = function (device, width, height, pixelData) {
        var texture = new pc.gfx.Texture(device, {
            width: width,
            height: height,
            format: pc.gfx.PIXELFORMAT_R8_G8_B8_A8,
            cubemap: false,
            autoMipmap: true
        });
        var pixels = texture.lock();

        pixels.set(pixelData);

        texture.unlock();

        texture.addressU = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
        texture.addressV = pc.gfx.ADDRESS_CLAMP_TO_EDGE;
        texture.minFilter = pc.gfx.FILTER_LINEAR;
        texture.magFilter = pc.gfx.FILTER_LINEAR;

        return texture;
    };

    var ParticleEmitter = function ParticleEmitter(graphicsDevice, options) {
        this.graphicsDevice = graphicsDevice;

        // The number of particles to emit.
        this.numParticles = typeof options.numParticles !== 'undefined' ? options.numParticles : 1;
        // The number of frames in the particle texture.
        this.numFrames = typeof options.numFrames !== 'undefined' ? options.numFrames : 1;
        // The frame duration at which to animate the particle texture in seconds per frame.
        this.frameDuration = typeof options.frameDuration !== 'undefined' ? options.frameDuration : 1;
        // The initial frame to display for a particular particle.
        this.frameStart = typeof options.frameStart !== 'undefined' ? options.frameStart : 0;
        // The frame start range.
        this.frameStartRange = typeof options.frameStartRange !== 'undefined' ? options.frameStartRange : 0;
        // The life time of the entire particle system.
        // To make a particle system be continuous set this to match the lifeTime.
        this.timeRange = typeof options.timeRange !== 'undefined' ? options.timeRange : 99999999;
        // The startTime of a particle.
        this.startTime = typeof options.startTime !== 'undefined' ? options.startTime : null;
        // The lifeTime of a particle.
        this.lifeTime = typeof options.lifeTime !== 'undefined' ? options.lifeTime : 1;
        // The lifeTime range.
        this.lifeTimeRange = typeof options.lifeTimeRange !== 'undefined' ? options.lifeTimeRange : 0;
        // The starting size of a particle.
        this.startSize = typeof options.startSize !== 'undefined' ? options.startSize : 1;
        // The starting size range.
        this.startSizeRange = typeof options.startSizeRange !== 'undefined' ? options.startSizeRange : 0;
        // The ending size of a particle.
        this.endSize = typeof options.endSize !== 'undefined' ? options.endSize : 1;
        // The ending size range.
        this.endSizeRange = typeof options.endSizeRange !== 'undefined' ? options.endSizeRange : 0;
        // The starting position of a particle in local space.
        this.position = typeof options.position !== 'undefined' ? options.position : new pc.Vec3(0, 0, 0);
        // The starting position range.
        this.positionRange = typeof options.positionRange !== 'undefined' ? options.positionRange : new pc.Vec3(0, 0, 0);
        // The velocity of a paritcle in local space.
        this.velocity = typeof options.velocity !== 'undefined' ? options.velocity : new pc.Vec3(0, 0, 0);
        // The velocity range.
        this.velocityRange = typeof options.velocityRange !== 'undefined' ? options.velocityRange : new pc.Vec3(0, 0, 0);
        // The acceleration of a particle in local space.
        this.acceleration = typeof options.acceleration !== 'undefined' ? options.acceleration : new pc.Vec3(0, 0, 0);
        // The accleration range.
        this.accelerationRange = typeof options.accelerationRange !== 'undefined' ? options.accelerationRange : new pc.Vec3(0, 0, 0);
        // The starting spin value for a particle in radians.
        this.spinStart = typeof options.spinStart !== 'undefined' ? options.spinStart : 0;
        // The spin start range.
        this.spinStartRange = typeof options.spinStartRange !== 'undefined' ? options.spinStartRange : 0;
        // The spin speed of a particle in radians.
        this.spinSpeed = typeof options.spinSpeed !== 'undefined' ? options.spinSpeed : 0;
        // The spin speed range.
        this.spinSpeedRange = typeof options.spinSpeedRange !== 'undefined' ? options.spinSpeedRange : 0;
        // The color multiplier of a particle.
        this.colorMult = typeof options.colorMult !== 'undefined' ? options.colorMult : new pc.Vec4(1, 1, 1, 1);
        // The color multiplier range.
        this.colorMultRange = typeof options.colorMultRange !== 'undefined' ? options.colorMultRange : new pc.Vec4(0, 0, 0, 0);
        // The velocity of all paritcles in world space.
        this.worldVelocity = typeof options.worldVelocity !== 'undefined' ? options.worldVelocity : new pc.Vec3(0, 0, 0);
        // The acceleration of all paritcles in world space.
        this.worldAcceleration = typeof options.worldAcceleration !== 'undefined' ? options.worldAcceleration : new pc.Vec3(0, 0, 0);
        // Whether these particles are oriented in 2d or 3d. true = 2d, false = 3d.
        this.billboard = typeof options.billboard !== 'undefined' ? options.billboard : true;
        // The orientation of a particle. This is only used if billboard is false.
        this.orientation = typeof options.orientation !== 'undefined' ? options.orientation : new pc.Vec4(0, 0, 0, 1);

        this.dynamic = typeof options.dynamic !== 'undefined' ? options.dynamic : false;

        // Just for dynamic systems
        this.birthIndex = 0;
        this.maxParticles = 1000;

        // Create default maps
        var pixels = [];
        var vals = [0, 0.2, 0.7, 1.0, 1.0, 0.7, 0.2, 0.0];
        for (var y = 0; y < 8; y++) {
            for (var x = 0; x < 8; x++) {
                var pixelComponent = vals[x] * vals[y] * 255.0;
                pixels.push(pixelComponent, pixelComponent, pixelComponent, pixelComponent);
            }
        }

        this.colorMap = _createTexture(graphicsDevice, 8, 8, pixels);
        this.opacityMap = _createTexture(graphicsDevice, 1, 1, [255,255,255,255]);
        this.rampMap = _createTexture(graphicsDevice, 2, 1, [255,255,255,255,255,255,255,0]);

        this.allocate(this.numParticles);
        this.generate(0, this.numParticles);

        var mesh = new pc.scene.Mesh();
        mesh.vertexBuffer = this.vertexBuffer;
        mesh.indexBuffer[0] = this.indexBuffer;
        mesh.primitive[0].type = pc.gfx.PRIMITIVE_TRIANGLES;
        mesh.primitive[0].base = 0;
        mesh.primitive[0].count = this.indexBuffer.getNumIndices();
        mesh.primitive[0].indexed = true;

        var material = new pc.scene.Material();
        var programLib = this.graphicsDevice.getProgramLibrary();
        var shader = programLib.getProgram("particle", {
            billboard: this.billboard
        });
        material.setShader(shader);
        material.setParameter('particle_worldVelocity', this.worldVelocity.data);
        material.setParameter('particle_worldAcceleration', this.worldAcceleration.data);
        material.setParameter('particle_numFrames', this.numFrames);
        material.setParameter('particle_frameDuration', this.frameDuration);
        material.setParameter('particle_timeRange', this.timeRange);
        material.setParameter('particle_timeOffset', 0);
        material.setParameter('texture_colorMap', this.colorMap);
        material.setParameter('texture_opacityMap', this.opacityMap);
        material.setParameter('texture_rampMap', this.rampMap);
        material.cullMode = pc.gfx.CULLFACE_NONE;
        material.blend = true;
        material.blendSrc = pc.gfx.BLENDMODE_SRC_ALPHA;
        material.blendDst = pc.gfx.BLENDMODE_ONE;
        material.depthWrite = false;

        this.meshInstance = new pc.scene.MeshInstance(null, mesh, material);
        this.meshInstance.layer = pc.scene.LAYER_FX;
        this.meshInstance.updateKey();
        
        this.time = 0;
    };

    ParticleEmitter.prototype = {
        allocate: function (numParticles) {
            if ((this.vertexBuffer === undefined) || (this.vertexBuffer.getNumVertices() !== numParticles * 4)) {
                // Create the particle vertex format
                var elements = [
                    { semantic: pc.gfx.SEMANTIC_ATTR0, components: 4, type: pc.gfx.ELEMENTTYPE_FLOAT32 },
                    { semantic: pc.gfx.SEMANTIC_ATTR1, components: 4, type: pc.gfx.ELEMENTTYPE_FLOAT32 },
                    { semantic: pc.gfx.SEMANTIC_ATTR2, components: 4, type: pc.gfx.ELEMENTTYPE_FLOAT32 },
                    { semantic: pc.gfx.SEMANTIC_ATTR3, components: 4, type: pc.gfx.ELEMENTTYPE_FLOAT32 },
                    { semantic: pc.gfx.SEMANTIC_ATTR4, components: 4, type: pc.gfx.ELEMENTTYPE_FLOAT32 },
                    { semantic: pc.gfx.SEMANTIC_ATTR5, components: 4, type: pc.gfx.ELEMENTTYPE_FLOAT32 }
                ];
                if (!this.billboard) {
                    elements.push(
                        { semantic: pc.gfx.SEMANTIC_ATTR6, components: 4, type: pc.gfx.ELEMENTTYPE_FLOAT32 }
                    );
                }
                var particleFormat = new pc.gfx.VertexFormat(this.graphicsDevice, elements);

                this.vertexBuffer = new pc.gfx.VertexBuffer(this.graphicsDevice, particleFormat, 4 * numParticles, pc.gfx.BUFFER_DYNAMIC);

                // Create a index buffer
                this.indexBuffer = new pc.gfx.IndexBuffer(this.graphicsDevice, pc.gfx.INDEXFORMAT_UINT16, 6 * numParticles);

                // Fill the index buffer
                var dst = 0;
                var indices = new Uint16Array(this.indexBuffer.lock());
                for (var i = 0; i < numParticles; i++) {
                    var baseIndex = i * 4;
                    indices[dst++] = baseIndex;
                    indices[dst++] = baseIndex + 1;
                    indices[dst++] = baseIndex + 2;
                    indices[dst++] = baseIndex;
                    indices[dst++] = baseIndex + 2;
                    indices[dst++] = baseIndex + 3;
                }
                this.indexBuffer.unlock();
            }
        },

        generate: function (base, count) {
            var data = new Float32Array(this.vertexBuffer.lock());
            var vsize = this.billboard ? 6 * 4 : 7 * 4;

            for (var p = base; p < count; p++) {
                var lifeTime = this.lifeTime;
                var startTime = (p * lifeTime / count);
                var frameStart = this.frameStart + plusMinus(this.frameStartRange);
                position.add2(this.position, plusMinusVector3(this.positionRange));
                velocity.add2(this.velocity, plusMinusVector3(this.velocityRange));
                acceleration.add2(this.acceleration, plusMinusVector3(this.accelerationRange));
                colorMult.add2(this.colorMult, plusMinusVector4(this.colorMultRange));
                var spinStart = this.spinStart + plusMinus(this.spinStartRange);
                var spinSpeed = this.spinSpeed + plusMinus(this.spinSpeedRange);
                var startSize = this.startSize + plusMinus(this.startSizeRange);
                var endSize = this.endSize + plusMinus(this.endSizeRange);
                var orientation = this.orientation;

                for (var corner = 0; corner < 4; corner++) {
                    var i = (p * 4 + corner) * vsize;

                    // ATTR0
                    data[i + 0]  = particleVerts[corner][0];
                    data[i + 1]  = particleVerts[corner][1];
                    data[i + 2]  = lifeTime;
                    data[i + 3]  = frameStart;

                    // ATTR1
                    data[i + 4]  = position.x;
                    data[i + 5]  = position.y;
                    data[i + 6]  = position.z;
                    data[i + 7]  = startTime;

                    // ATTR2
                    data[i + 8]  = velocity.x;
                    data[i + 9]  = velocity.y;
                    data[i + 10] = velocity.z;
                    data[i + 11] = startSize;

                    // ATTR3
                    data[i + 12] = acceleration.x;
                    data[i + 13] = acceleration.y;
                    data[i + 14] = acceleration.z;
                    data[i + 15] = endSize;

                    // ATTR4
                    data[i + 16] = spinStart;
                    data[i + 17] = spinSpeed;
                    data[i + 18] = 0;
                    data[i + 19] = 0;

                    // ATTR5
                    data[i + 20] = colorMult.x;
                    data[i + 21] = colorMult.y;
                    data[i + 22] = colorMult.z;
                    data[i + 23] = colorMult.w;

                    if (!this.billboard) {
                        // ATTR6
                        data[i + 24] = orientation.x;
                        data[i + 25] = orientation.y;
                        data[i + 26] = orientation.z;
                        data[i + 27] = orientation.w;
                    }
                }
            }
            this.vertexBuffer.unlock();
        },

        addTime: function (delta) {
            this.time += delta;
            this.meshInstance.material.setParameter('particle_time', this.time);

            if (this.dynamic) {
                this.generate(this.birthIndex + this.numParticles, this.numParticles)
                this.birthIndex += this.numParticles;
            }
        },

        setColorRamp: function (pixels) {
            for (var i = 0; i < pixels.length; i++) {
                pixels[i] = Math.floor(pixels[i] * 255);
            }
            this.rampMap = _createTexture(this.graphicsDevice, pixels.length / 4, 1, pixels);
            this.meshInstance.material.setParameter('texture_rampMap', this.rampMap);
        },

        setColorMap: function (colorMap) {
            this.colorMap = colorMap;
            this.meshInstance.material.setParameter('texture_colorMap', this.colorMap);
        },

        setOpacityMap: function (opacityMap) {
            this.opacityMap = opacityMap;
            this.meshInstance.material.setParameter('texture_opacityMap', this.opacityMap);
        }
    };

    return {
        ParticleEmitter: ParticleEmitter
    }; 
}());