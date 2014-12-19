pc.extend(pc.shaderChunks, (function () {
    'use strict';

    return {
        defaultGamma: pc.shaderChunks.gamma1_0PS,
        defaultTonemapping: pc.shaderChunks.tonemappingLinearPS
    };
}()));

