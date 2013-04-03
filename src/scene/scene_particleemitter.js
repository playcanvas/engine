pc.extend(pc.scene, function () {

    var start = new Date();

    var getTime = function () {
        return (new Date().getTime() - start.getTime()) / 1000.0;
    };

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

    var _createTexture = function (width, height, pixelData) {
        var texture = new pc.gfx.Texture({
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

    var ParticleEmitter = function ParticleEmitter(numParticles) {
        // The number of particles to emit.
        this.numParticles = 1;
        // The number of frames in the particle texture.
        this.numFrames = 1;
        // The frame duration at which to animate the particle texture in seconds per
        // frame.
        this.frameDuration = 1;
        // The initial frame to display for a particular particle.
        this.frameStart = 0;
        // The frame start range.
        this.frameStartRange = 0;
        // The life time of the entire particle system.
        // To make a particle system be continuous set this to match the lifeTime.
        this.timeRange = 99999999;
        // The startTime of a particle.
        this.startTime = null;
        // The lifeTime of a particle.
        this.lifeTime = 1;
        // The lifeTime range.
        this.lifeTimeRange = 0;
        // The starting size of a particle.
        this.startSize = 1;
        // The starting size range.
        this.startSizeRange = 0;
        // The ending size of a particle.
        this.endSize = 1;
        // The ending size range.
        this.endSizeRange = 0;
        // The starting position of a particle in local space.
        this.position = [0, 0, 0];
        // The starting position range.
        this.positionRange = [0, 0, 0];
        // The velocity of a paritcle in local space.
        this.velocity = [0, 0, 0];
        // The velocity range.
        this.velocityRange = [0, 0, 0];
        // The acceleration of a particle in local space.
        this.acceleration = [0, 0, 0];
        // The accleration range.
        this.accelerationRange = [0, 0, 0];
        // The starting spin value for a particle in radians.
        this.spinStart = 0;
        // The spin start range.
        this.spinStartRange = 0;
        // The spin speed of a particle in radians.
        this.spinSpeed = 0;
        // The spin speed range.
        this.spinSpeedRange = 0;
        // The color multiplier of a particle.
        this.colorMult = [1, 1, 1, 1];
        // The color multiplier range.
        this.colorMultRange = [0, 0, 0, 0];
        // The velocity of all paritcles in world space.
        this.worldVelocity = [0, 0, 0];
        // The acceleration of all paritcles in world space.
        this.worldAcceleration = [0, 0, 0];
        // Whether these particles are oriented in 2d or 3d. true = 2d, false = 3d.
        this.billboard = true;
        // The orientation of a particle. This is only used if billboard is false.
        this.orientation = [0, 0, 0, 1];

        this.numParticles = 20;
        this.lifeTime = 2;
        this.timeRange = 2;
        this.startSize = 50;
        this.endSize = 90;
        this.velocity = [0, 60, 0];
        this.velocityRange = [15, 15, 15];
        this.worldAcceleration = [0, -20, 0];
        this.spinSpeedRange = 4;
        
        var device = pc.gfx.Device.getCurrent();
        var programLib = device.getProgramLibrary();
        var program = programLib.getProgram("particle");

        // Create the particle vertex format
        var particleFormat = new pc.gfx.VertexFormat();
        particleFormat.begin();
        particleFormat.addElement(new pc.gfx.VertexElement("particle_uvLifeTimeFrameStart", 4, pc.gfx.VertexElementType.FLOAT32));
        particleFormat.addElement(new pc.gfx.VertexElement("particle_positionStartTime", 4, pc.gfx.VertexElementType.FLOAT32));
        particleFormat.addElement(new pc.gfx.VertexElement("particle_velocityStartSize", 4, pc.gfx.VertexElementType.FLOAT32));
        particleFormat.addElement(new pc.gfx.VertexElement("particle_accelerationEndSize", 4, pc.gfx.VertexElementType.FLOAT32));
        particleFormat.addElement(new pc.gfx.VertexElement("particle_spinStartSpinSpeed", 4, pc.gfx.VertexElementType.FLOAT32));
        particleFormat.addElement(new pc.gfx.VertexElement("particle_colorMult", 4, pc.gfx.VertexElementType.FLOAT32));
        particleFormat.end();

        var vertexBuffer = new pc.gfx.VertexBuffer(particleFormat, 4 * this.numParticles);

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

            for (var corner = 0; corner < 4; corner++) {
                var e = iterator.element;
                e.particle_uvLifeTimeFrameStart.set(particleVerts[corner][0], particleVerts[corner][1], lifeTime, frameStart);
                e.particle_positionStartTime.set(position[0], position[1], position[2], startTime);
                e.particle_velocityStartSize.set(velocity[0], velocity[1], velocity[2], startSize);
                e.particle_accelerationEndSize.set(acceleration[0], acceleration[1], acceleration[2], endSize);
                e.particle_spinStartSpinSpeed.set(spinStart, spinSpeed, 0.0, 0.0);
                e.particle_colorMult.set(1, 1, 1, 1);
                iterator.next();
            }
        }
        iterator.end();

        // Create a index buffer
        var indexBuffer = new pc.gfx.IndexBuffer(pc.gfx.INDEXFORMAT_UINT16, 6 * this.numParticles);

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

        var pixels = [];
        var vals = [0, 0.2, 0.7, 1.0, 1.0, 0.7, 0.2, 0.0];
        for (var y = 0; y < 8; y++) {
            for (var x = 0; x < 8; x++) {
                var pixelComponent = vals[x] * vals[y] * 255.0;
                pixels.push(pixelComponent, pixelComponent, pixelComponent, pixelComponent);
            }
        }

        this.colorMap = _createTexture(8, 8, pixels);
        this.rampMap = _createTexture(2, 1, [255,255,255,255,255,255,255,0]);

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
    };

    ParticleEmitter.prototype = {
        update: function () {
            this.meshInstance.material.setParameter('particle_time', getTime());
        },

        setColorRamp: function (pixels) {
            for (var i = 0; i < pixels.length; i++) {
                pixels[i] = Math.floor(pixels[i] * 255);
            }
            this.rampMap = _createTexture(pixels.length / 4, 1, pixels);
            this.meshInstance.material.setParameter('texture_rampMap', this.rampMap);
        }
    };

    return {
        ParticleEmitter: ParticleEmitter
    }; 
}());