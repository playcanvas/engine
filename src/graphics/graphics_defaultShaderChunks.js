pc.extend(pc.gfx.shaderChunks, (function () {
    'use strict';

    return {
        defaultGamma: pc.gfx.shaderChunks.gamma1_0PS,
        defaultTonemapping: pc.gfx.shaderChunks.tonemappingLinearPS
    };
}()));

