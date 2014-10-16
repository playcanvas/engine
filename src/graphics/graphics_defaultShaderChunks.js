pc.extend(pc.gfx.shaderChunks, (function () {
    return {
        defaultGamma: pc.gfx.shaderChunks.gamma1_0PS,
        defaultSpecular: pc.gfx.shaderChunks.lightSpecularPhongPS,
        defaultFresnel: ""
    };
}()));

