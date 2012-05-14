pc.extend(pc.scene, function () {

    var now = new Date();
    var start = new Date();

    var getTime = function () {
        return (now.getTime() - base.getTime()) / 1000.0;
    }

    var particleVerts = [
        [-0.5, -0.5],
        [ 0.5, -0.5],
        [ 0.5,  0.5],
        [-0.5,  0.5]
    ];

    var plusMinus = function(range) {
        return (Math.random() - 0.5) * range * 2;
    };

    var ParticleEmitter = function ParticleEmitter(numParticles) {
        this.config = {
            // The number of particles to emit.
            numParticles: 1,
            // The number of frames in the particle texture.
            numFrames: 1,
            // The frame duration at which to animate the particle texture in seconds per
            // frame.
            frameDuration: 1,
            // The initial frame to display for a particular particle.
            frameStart: 0,
            // The frame start range.
            frameStartRange: 0,
            // The life time of the entire particle system.
            // To make a particle system be continuous set this to match the lifeTime.
            timeRange: 99999999,
            // The startTime of a particle.
            startTime: null,
            // TODO: Describe what happens if this is not set. I still have some
            //     work to do there.
            // The lifeTime of a particle.
            lifeTime: 1,
            // The lifeTime range.
            lifeTimeRange: 0,
            // The starting size of a particle.
            startSize: 1,
            // The starting size range.
            startSizeRange: 0,
            // The ending size of a particle.
            endSize: 1,
            // The ending size range.
            endSizeRange: 0,
            // The starting position of a particle in local space.
            position: [0, 0, 0],
            // The starting position range.
            positionRange: [0, 0, 0],
            // The velocity of a paritcle in local space.
            velocity: [0, 0, 0],
            // The velocity range.
            velocityRange: [0, 0, 0],
            // The acceleration of a particle in local space.
            acceleration: [0, 0, 0],
            // The accleration range.
            accelerationRange: [0, 0, 0],
            // The starting spin value for a particle in radians.
            spinStart: 0,
            // The spin start range.
            spinStartRange: 0,
            // The spin speed of a particle in radians.
            spinSpeed: 0,
            // The spin speed range.
            spinSpeedRange: 0,
            // The color multiplier of a particle.
            colorMult: [1, 1, 1, 1],
            // The color multiplier range.
            colorMultRange: [0, 0, 0, 0],
            // The velocity of all paritcles in world space.
            worldVelocity: [0, 0, 0],
            // The acceleration of all paritcles in world space.
            worldAcceleration: [0, 0, 0],
            // Whether these particles are oriented in 2d or 3d. true = 2d, false = 3d.
            billboard: true,
            // The orientation of a particle. This is only used if billboard is false.
            orientation: [0, 0, 0, 1]
        };
        
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

        var vertexBuffer = new pc.gfx.VertexBuffer(particleFormat, 4 * numParticles);

        var iterator = new pc.gfx.VertexIterator(vertexBuffer);
        for (var p = 0; p < numParticles; p++) {
            var lifeTime = this.config.lifeTime;
            var frameStart = this.config.frameStart + plusMinus(this.config.frameStartRange);
            var pPosition = pc.math.vec3.create();
            o3djs.math.addVector(parameters.position, plusMinusVector(parameters.positionRange));

            for (var corner = 0; corner < 4; corner++) {
                var e = iterator.element;
                e["particle_uvLifeTimeFrameStart"].set(particleVerts[corner][0], particleVerts[corner][0], lifeTime, frameStart);
                e["particle_positionStartTime"].set(position[0], position[1], position[2], startTime);
                e["particle_velocityStartSize"].set(velocityStart[0], velocityStart[1], velocityStart[2], startSize);
                e["particle_accelerationEndSize"].set(accelerationEnd[0], accelerationEnd[1], accelerationEnd[2], endSize);
                e["particle_spinStartSpinSpeed"].set(spinStart, spinSpeed, 0.0, 0.0);
                e["particle_colorMult"].set(0.9, 0.9, 0.0);
                iterator.next();
            }
        }
        iterator.end();

        // Create a index buffer
        var indexBuffer = new pc.gfx.IndexBuffer(pc.gfx.IndexFormat.UINT16, 6 * numParticles);

        // Fill the index buffer
        var dst = 0;
        var indices = new Uint16Array(indexBuffer.lock());
        for (var i = 0; i < numParticles; i++) {
            var baseIndex = i * 4;
            indices[dst++] = baseIndex;
            indices[dst++] = baseIndex + 1;
            indices[dst++] = baseIndex + 2;
            indices[dst++] = baseIndex;
            indices[dst++] = baseIndex + 2;
            indices[dst++] = baseIndex + 3;
        }
        indexBuffer.unlock()
        
        var _createTexture = function (width, height, pixelData) {
            var texture = new pc.gfx.Texture2D(width, height, pc.gfx.TextureFormat.RGBA);
            texture.allocate();
            texture.lock().set(pixelData);
            texture.unlock();
            texture.setAddressMode(pc.gfx.TextureAddress.CLAMP_TO_EDGE, pc.gfx.TextureAddress.CLAMP_TO_EDGE);
            texture.setFilterMode(pc.gfx.TextureFilter.LINEAR, pc.gfx.TextureFilter.LINEAR);
            return texture;
        };

        var pixels = [];
        var vals = [0, 0.2, 0.7, 1.0, 1.0, 0.7, 0.2, 0.0];
        for (var y = 0; y < 8; y++) {
            for (var x = 0; x < 8; x++) {
                var pixelComponent = vals[x] * vals[y] * 255.0;
                pixels.push(pixelComponent, pixelComponent, pixelComponent, pixelComponent);
            }
        }
        var colorMap = _createTexture(8, 8, pixels);
        var rampMap = _createTexture(2, 1, [255,255,255,255,255,255,255,0]);

        this.resources = {
            program: program,
            indexBuffer: indexBuffer,
            vertexBuffer: vertexBuffer,
            colorMap: colorMap,
            rampMap: rampMap
        };
    }

    ParticleEmitter = pc.inherits(ParticleEmitter, pc.scene.GraphNode);

    ParticleEmitter.prototype.dispatch = function () {
        var res = this.resources;

        var device = pc.gfx.Device.getCurrent();
        // Set vertex shader uniforms
        device.scope.resolve("particle_velocity").setValue(this.config.worldVelocity);
        device.scope.resolve("particle_acceleration").setValue(this.config.worldAcceleration);
        device.scope.resolve("particle_numFrames").setValue(this.config.numFrames);
        device.scope.resolve("particle_frameDuration").setValue(this.config.frameDuration);
        device.scope.resolve("particle_time").setValue(getTime());
        device.scope.resolve("particle_timeRange").setValue(this.config.timeRange);
        device.scope.resolve("particle_timeOffset").setValue(0.0);

        // Set fragment shader uniforms
        device.scope.resolve("texture_colorMap").setValue(res.colorMap);
        device.scope.resolve("texture_rampMap").setValue(res.rampMap);

        // Set the shader program
        device.setProgram(res.program);

        // Set the index buffer
        device.setIndexBuffer(res.indexBuffer);

        // Set the vertex buffer
        device.setVertexBuffer(res.vertexBuffer, 0);

        // Now draw the triangle
        device.draw({
            type: pc.gfx.PrimType.TRIANGLES,
            base: 0,
            count: res.indexBuffer.getNumIndices(),
            indexed: true
        });
    };

    return {
        ParticleEmitter: ParticleEmitter
    }; 
}());