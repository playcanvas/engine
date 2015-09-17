pc.extend(pc.Application.prototype, function () {

    var stats = {
        timing: {
            pageStart: 0,
            dom: 0,
            appStart: 0
        },

        frame: {
            fps: 0,
            ms: 0,
            dt: 0,
            triangles: 0,
            otherPrimitives: 0,
            //textures: 0,
            //renderTargets: 0,
            shaders: 0,
            materials: 0,
            cameras: 0,
            //lights: 0,
            shadowMapUpdates: 0,

            _timeToCountFrames: 0,
            _fpsAccum: 0
        },

        drawCalls: {
            forward: 32,
            depth: 32,
            shadow: 32,
            skinned: 8, // all skinned draw calls from forward/depth/shadow passes
            misc: 32, // everything that is not forward/depth/shadow (post effect quads etc)
            total: 128
        }
    };

    return {
        stats: stats,
    };
}());
