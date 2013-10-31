pc.extend(pc.scene, function () {

    var particleVerts = [
        [-0.5, -0.5],
        [ 0.5, -0.5],
        [ 0.5,  0.5],
        [-0.5,  0.5]
    ];

    var plusMinus = function(range) {
        return (Math.random() - 0.5) * range * 2;
    };

    var plusMinusVector = function(range) {
        var v = [];
        for (var ii = 0; ii < range.length; ++ii) {
            v.push(plusMinus(range[ii]));
        }
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
//        options = pc.extend(defaults, options);

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
        this.position = typeof options.position !== 'undefined' ? options.position : [0, 0, 0];
        // The starting position range.
        this.positionRange = typeof options.positionRange !== 'undefined' ? options.positionRange : [0, 0, 0];
        // The velocity of a paritcle in local space.
        this.velocity = typeof options.velocity !== 'undefined' ? options.velocity : [0, 0, 0];
        // The velocity range.
        this.velocityRange = typeof options.velocityRange !== 'undefined' ? options.velocityRange : [0, 0, 0];
        // The acceleration of a particle in local space.
        this.acceleration = typeof options.acceleration !== 'undefined' ? options.acceleration : [0, 0, 0];
        // The accleration range.
        this.accelerationRange = typeof options.accelerationRange !== 'undefined' ? options.accelerationRange : [0, 0, 0];
        // The starting spin value for a particle in radians.
        this.spinStart = typeof options.spinStart !== 'undefined' ? options.spinStart : 0;
        // The spin start range.
        this.spinStartRange = typeof options.spinStartRange !== 'undefined' ? options.spinStartRange : 0;
        // The spin speed of a particle in radians.
        this.spinSpeed = typeof options.spinSpeed !== 'undefined' ? options.spinSpeed : 0;
        // The spin speed range.
        this.spinSpeedRange = typeof options.spinSpeedRange !== 'undefined' ? options.spinSpeedRange : 0;
        // The color multiplier of a particle.
        this.colorMult = typeof options.colorMult !== 'undefined' ? options.colorMult : [1, 1, 1, 1];
        // The color multiplier range.
        this.colorMultRange = typeof options.colorMultRange !== 'undefined' ? options.colorMultRange : [0, 0, 0, 0];
        // The velocity of all paritcles in world space.
        this.worldVelocity = typeof options.worldVelocity !== 'undefined' ? options.worldVelocity : [0, 0, 0];
        // The acceleration of all paritcles in world space.
        this.worldAcceleration = typeof options.worldAcceleration !== 'undefined' ? options.worldAcceleration : [0, 0, 0];
        // Whether these particles are oriented in 2d or 3d. true = 2d, false = 3d.
        this.billboard = typeof options.billboard !== 'undefined' ? options.billboard : true;
        // The orientation of a particle. This is only used if billboard is false.
        this.orientation = typeof options.orientation !== 'undefined' ? options.orientation : [0, 0, 0, 1];

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
        this.rampMap = _createTexture(graphicsDevice, 2, 1, [255,255,255,255,255,255,255,0]);

        var programLib = this.graphicsDevice.getProgramLibrary();
        var program = programLib.getProgram("particle", {
            billboard: this.billboard
        });

        // Create the particle vertex format
        var elements = [
            { semantic: pc.gfx.SEMANTIC_ATTR0, components: 4, type: pc.gfx.ELEMENTTYPE_FLOAT32 },
            { semantic: pc.gfx.SEMANTIC_ATTR1, components: 4, type: pc.gfx.ELEMENTTYPE_FLOAT32 },
            { semantic: pc.gfx.SEMANTIC_ATTR2, components: 4, type: pc.gfx.ELEMENTTYPE_FLOAT32 },
            { semantic: pc.gfx.SEMANTIC_ATTR3, components: 4, type: pc.gfx.ELEMENTTYPE_FLOAT32 },
            { semantic: pc.gfx.SEMANTIC_ATTR4, components: 4, type: pc.gfx.ELEMENTTYPE_FLOAT32 },
            { semantic: pc.gfx.SEMANTIC_ATTR5, components: 4, type: pc.gfx.ELEMENTTYPE_FLOAT32 }
        ];
        if (!options.billboard) {
            elements.push(
                { semantic: pc.gfx.SEMANTIC_ATTR6, components: 4, type: pc.gfx.ELEMENTTYPE_FLOAT32 }
            );
        }
        var particleFormat = new pc.gfx.VertexFormat(this.graphicsDevice, elements);

        var vertexBuffer = new pc.gfx.VertexBuffer(this.graphicsDevice, particleFormat, 4 * this.numParticles);

        var position = pc.math.vec3.create();
        var velocity = pc.math.vec3.create();
        var acceleration = pc.math.vec3.create();

        var iterator = new pc.gfx.VertexIterator(vertexBuffer);
        for (var p = 0; p < this.numParticles; p++) {
            var lifeTime = this.lifeTime;
            var startTime = (p * lifeTime / this.numParticles);
            var frameStart = this.frameStart + plusMinus(this.frameStartRange);
            pc.math.vec3.add(this.position, plusMinusVector(this.positionRange), position);
            pc.math.vec3.add(this.velocity, plusMinusVector(this.velocityRange), velocity);
            pc.math.vec3.add(this.acceleration, plusMinusVector(this.accelerationRange), acceleration);
            var spinStart = this.spinStart + plusMinus(this.spinStartRange);
            var spinSpeed = this.spinSpeed + plusMinus(this.spinSpeedRange);
            var startSize = this.startSize + plusMinus(this.startSizeRange);
            var endSize = this.endSize + plusMinus(this.endSizeRange);
            var orientation = this.orientation;

            for (var corner = 0; corner < 4; corner++) {
                var e = iterator.element;
                e[pc.gfx.SEMANTIC_ATTR0].set(particleVerts[corner][0], particleVerts[corner][1], lifeTime, frameStart);
                e[pc.gfx.SEMANTIC_ATTR1].set(position[0], position[1], position[2], startTime);
                e[pc.gfx.SEMANTIC_ATTR2].set(velocity[0], velocity[1], velocity[2], startSize);
                e[pc.gfx.SEMANTIC_ATTR3].set(acceleration[0], acceleration[1], acceleration[2], endSize);
                e[pc.gfx.SEMANTIC_ATTR4].set(spinStart, spinSpeed, 0.0, 0.0);
                e[pc.gfx.SEMANTIC_ATTR5].set(1, 1, 1, 1);
                if (!options.billboard) {
                    e[pc.gfx.SEMANTIC_ATTR6].set(orientation[0], orientation[1], orientation[2], orientation[3]);
                }
                iterator.next();
            }
        }
        iterator.end();

        // Create a index buffer
        var indexBuffer = new pc.gfx.IndexBuffer(this.graphicsDevice, pc.gfx.INDEXFORMAT_UINT16, 6 * this.numParticles);

        // Fill the index buffer
        var dst = 0;
        var indices = new Uint16Array(indexBuffer.lock());
        for (var i = 0; i < this.numParticles; i++) {
            var baseIndex = i * 4;
            indices[dst++] = baseIndex;
            indices[dst++] = baseIndex + 1;
            indices[dst++] = baseIndex + 2;
            indices[dst++] = baseIndex;
            indices[dst++] = baseIndex + 2;
            indices[dst++] = baseIndex + 3;
        }
        indexBuffer.unlock();

        var mesh = new pc.scene.Mesh();
        mesh.vertexBuffer = vertexBuffer;
        mesh.indexBuffer[0] = indexBuffer;
        mesh.primitive[0].type = pc.gfx.PRIMITIVE_TRIANGLES;
        mesh.primitive[0].base = 0;
        mesh.primitive[0].count = indexBuffer.getNumIndices();
        mesh.primitive[0].indexed = true;

        var material = new pc.scene.Material();
        material.setProgram(program);
        material.setParameter('particle_worldVelocity', this.worldVelocity);
        material.setParameter('particle_worldAcceleration', this.worldAcceleration);
        material.setParameter('particle_numFrames', this.numFrames);
        material.setParameter('particle_frameDuration', this.frameDuration);
        material.setParameter('particle_timeRange', this.timeRange);
        material.setParameter('particle_timeOffset', 0);
        material.setParameter('texture_colorMap', this.colorMap);
        material.setParameter('texture_rampMap', this.rampMap);
        material.setState({
            cull: false,
            blend: true,
            blendModes: { srcBlend: pc.gfx.BLENDMODE_SRC_ALPHA, dstBlend: pc.gfx.BLENDMODE_ONE },
            depthWrite: false
        });

        this.meshInstance = new pc.scene.MeshInstance(null, mesh, material);
        this.meshInstance.layer = pc.scene.LAYER_FX;
        this.meshInstance.updateKey();
        
        this.time = 0;
    };

    ParticleEmitter.prototype = {
        addTime: function (delta) {
            this.time += delta;
            this.meshInstance.material.setParameter('particle_time', this.time);
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
        }
    };

    return {
        ParticleEmitter: ParticleEmitter
    }; 
}());