pc.extend(pc, (function () {
    'use strict';

    function paraboloidFromCubemap(device, sourceCubemap) {
        var chunks = pc.shaderChunks;
        var shader = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, chunks.genParaboloidPS, "genParaboloid");
        var constantTexSource = device.scope.resolve("source");
        var size = sourceCubemap.width;
        var rgbmSource = sourceCubemap.rgbm;
        var format = sourceCubemap.format;

        var tex = new pc.gfx.Texture(device, {
            rgbm: rgbmSource,
            format: format,
            width: size * 2,
            height: size,
            autoMipmap: false
        });
        tex.minFilter = pc.FILTER_LINEAR;
        tex.magFilter = pc.FILTER_LINEAR;
        tex.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        tex.addressV = pc.ADDRESS_CLAMP_TO_EDGE;

        var targ = new pc.RenderTarget(device, tex, {
            depth: false
        });

        constantTexSource.setValue(sourceCubemap);
        pc.drawQuadWithShader(device, targ, shader);

        return tex;
    }

    return {
        paraboloidFromCubemap: paraboloidFromCubemap
    };
}()));

