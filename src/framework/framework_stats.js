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
            shaders: 0,
            materials: 0,
            cameras: 0,
            shadowMapUpdates: 0,

            _timeToCountFrames: 0,
            _fpsAccum: 0
        },

        drawCalls: {
            forward: 0,
            depth: 0,
            shadow: 0,
            misc: 0, // everything that is not forward/depth/shadow (post effect quads etc)
            total: 0, // total = forward + depth + shadow + misc

            // Some of forward/depth/shadow/misc draw calls:
            skinned: 0,
            instanced: 0,

            removedByInstancing: 0
        }
    };

    return {
        stats: stats,
    };
}());
