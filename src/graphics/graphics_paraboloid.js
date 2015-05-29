pc.extend(pc, (function () {
    'use strict';

    function paraboloidFromCubemap(device, sourceCubemap, fullMipChain, xx) {
        var chunks = pc.shaderChunks;
        var shader = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS,
            (sourceCubemap.fixCubemapSeams? chunks.fixCubemapSeamsStretchPS : chunks.fixCubemapSeamsNonePS) + chunks.genParaboloidPS, "genParaboloid");
        var constantTexSource = device.scope.resolve("source");
        var constantParams = device.scope.resolve("params");
        var params = new pc.Vec4();
        var size = sourceCubemap.width;
        var rgbmSource = sourceCubemap.rgbm;
        var format = sourceCubemap.format;

        if (fullMipChain && format!==PIXELFORMAT_R8_G8_B8_A8) {
            console.error("WebGL can't read non RGBA8 textures");
            return;
        }

        size = Math.max(size, 8);

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

        params.x = xx;
        params.y = 1.0 / tex.width;
        params.z = 1.0 / tex.height;
        constantTexSource.setValue(sourceCubemap);
        constantParams.setValue(params.data);
        pc.drawQuadWithShader(device, targ, shader);

        if (fullMipChain) {
            var numMips = Math.round(Math.log2(size) + 1);
            for(var i=1; i<numMips; i++) {

            }
        }

        return tex;
    }

    function downsampleParaboloid(device, source) {
        var chunks = pc.shaderChunks;
        var shader = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, chunks.blurParaboloidPS, "blurParaboloid");
        var constantTexSource = device.scope.resolve("source");
        var constantParams = device.scope.resolve("params");
        var params = new pc.Vec4();
        var rgbmSource = source.rgbm;
        var format = source.format;

        var tex = new pc.gfx.Texture(device, {
            rgbm: rgbmSource,
            format: format,
            width: source.width / 2,
            height: source.height / 2,
            autoMipmap: false
        });
        tex.minFilter = pc.FILTER_LINEAR;
        tex.magFilter = pc.FILTER_LINEAR;
        tex.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        tex.addressV = pc.ADDRESS_CLAMP_TO_EDGE;

        var targ = new pc.RenderTarget(device, tex, {
            depth: false
        });

        params.x = 1.0 / source.height;
        constantTexSource.setValue(source);
        constantParams.setValue(params.data);
        pc.drawQuadWithShader(device, targ, shader);

        return tex;
    }

    return {
        paraboloidFromCubemap: paraboloidFromCubemap,
        downsampleParaboloid: downsampleParaboloid
    };
}()));

