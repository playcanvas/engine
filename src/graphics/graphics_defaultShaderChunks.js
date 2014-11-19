pc.extend(pc.gfx.shaderChunks, (function () {
    return {
        defaultGamma: pc.gfx.shaderChunks.gamma1_0PS,
        defaultTonemapping: pc.gfx.shaderChunks.tonemappingNonePS,
        defaultSpecular: pc.gfx.shaderChunks.lightSpecularPhongPS,
        defaultFresnel: pc.gfx.shaderChunks.fresnelSimplePS
    };
}()));

