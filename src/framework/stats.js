/**
 * @private
 * @constructor
 * @name pc.ApplicationStats
 * @param {pc.GraphicsDevice} device The graphics device.
 */
pc.ApplicationStats = function (device) {
    this.frame = {
        fps: 0,
        ms: 0,
        dt: 0,

        updateStart: 0,
        updateTime: 0,
        renderStart: 0,
        renderTime: 0,
        physicsStart: 0,
        physicsTime: 0,
        cullTime: 0,
        sortTime: 0,
        skinTime: 0,
        morphTime: 0,
        instancingTime: 0, // deprecated

        triangles: 0,
        otherPrimitives: 0,
        shaders: 0,
        materials: 0,
        cameras: 0,
        shadowMapUpdates: 0,
        shadowMapTime: 0,
        depthMapTime: 0, // deprecated
        forwardTime: 0,

        _timeToCountFrames: 0,
        _fpsAccum: 0
    };

    this.drawCalls = {
        forward: 0,
        depth: 0, // deprecated
        shadow: 0,
        immediate: 0, // deprecated
        misc: 0, // everything that is not forward/depth/shadow (post effect quads etc)
        total: 0, // total = forward + depth + shadow + misc

        // Some of forward/depth/shadow/misc draw calls:
        skinned: 0,
        instanced: 0, // deprecated

        removedByInstancing: 0 // deprecated
    };

    this.misc = {
        renderTargetCreationTime: 0
    };

    this.particles = {
        updatesPerFrame: 0, _updatesPerFrame: 0,
        frameTime: 0, _frameTime: 0
    };

    this.vram = device._vram;
    this.shaders = device._shaderStats;

    Object.defineProperty(this.vram, 'totalUsed', {
        get: function () {
            return this.tex + this.vb + this.ib;
        }
    });

    Object.defineProperty(this, 'scene', {
        get: function () {
            return pc.Application._currentApplication.scene._stats;
        }
    });

    Object.defineProperty(this, 'lightmapper', {
        get: function () {
            return pc.Application._currentApplication.lightmapper._stats;
        }
    });

    Object.defineProperty(this, 'batcher', {
        get: function () {
            return pc.Application._currentApplication.batcher._stats;
        }
    });

    pc.events.attach(this);
};
