pc.extend(pc, (function () {
    'use strict';

    var dpMult = 2.0;

    function paraboloidFromCubemap(device, sourceCubemap, fixSeamsAmount) {
        var chunks = pc.shaderChunks;
        var shader = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS,
            (sourceCubemap.fixCubemapSeams? chunks.fixCubemapSeamsStretchPS : chunks.fixCubemapSeamsNonePS) + chunks.genParaboloidPS, "genParaboloid");
        var constantTexSource = device.scope.resolve("source");
        var constantParams = device.scope.resolve("params");
        var params = new pc.Vec4();
        var size = sourceCubemap.width;
        var rgbmSource = sourceCubemap.rgbm;
        var format = sourceCubemap.format;

        size = Math.max(size, 8) * dpMult;

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

        params.x = fixSeamsAmount;
        params.y = 1.0 / tex.width;
        params.z = 1.0 / tex.height;
        constantTexSource.setValue(sourceCubemap);
        constantParams.setValue(params.data);
        pc.drawQuadWithShader(device, targ, shader);

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

    function getDpAtlasRect(rect, mip) {
        /*var mipGreaterThan1 = Math.min(mip, 1.0);
        var mipGreaterThan2 = pc.math.clamp(mip - 2.0, 0,1);
        var invMipGreaterThan1 = 1.0 - mipGreaterThan1;
        rect.z = (0.5 - 0.25 * mipGreaterThan2) + invMipGreaterThan1 * 0.5;
        rect.w = rect.z * 0.5;

        rect.x = mipGreaterThan2 * 0.5;

        var offsetY0 = (mip + 1.0) * 0.25 * mipGreaterThan1;
        var offsetY1 = (mip - 3.0) * 0.125 + 0.5;
        rect.y = pc.math.lerp(offsetY0, offsetY1, mipGreaterThan2);

        //return pc.math.lerp(2, 4, mipGreaterThan2) + pc.math.lerp(-1, 0, mipGreaterThan1);
        return (2.0 + 2.0 * mipGreaterThan2) - invMipGreaterThan1;*/

        rect.x = pc.math.clamp(mip - 2.0, 0,1) * 0.5;

        var t = mip - rect.x * 6.0;
        var i = 1.0 - rect.x;
        rect.y = Math.min(t * 0.5, 0.75) * i + rect.x;

        rect.z = (1.0 - pc.math.clamp(t, 0,1) * 0.5) * i;
        rect.w = rect.z * 0.5;

        return 1.0 / rect.z;
    }

    function generateDpAtlas(device, sixCubemaps) {
        var dp, rect;
        rect = new pc.Vec4();
        var params = new pc.Vec4();
        var size = sixCubemaps[0].width * 2 * dpMult;

        var chunks = pc.shaderChunks;
        var shader = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, chunks.genDpAtlasQuadPS, "genDpAtlasQuad");
        var constantTexSource = device.scope.resolve("source");
        var constantParams = device.scope.resolve("params");

        var tex = new pc.gfx.Texture(device, {
            rgbm: sixCubemaps[0].rgbm,
            format: sixCubemaps[0].format,
            width: size,
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

        var borderSize = 2; // 1 pixel from each side
        var mip0Width = size;
        var scaleFactor = (mip0Width + borderSize) / mip0Width - 1;
        var scaleAmount;
        for(var i=0; i<6; i++) {
            dp = pc.paraboloidFromCubemap(device, sixCubemaps[i], i);
            constantTexSource.setValue(dp);
            scaleAmount = getDpAtlasRect(rect, i);
            params.x = scaleAmount * scaleFactor;
            params.y = params.x * 2;
            params.x += 1;
            params.y += 1;
            constantParams.setValue(params.data);
            rect.x *= size;
            rect.y *= size;
            rect.z *= size;
            rect.w *= size;
            pc.drawQuadWithShader(device, targ, shader, rect);
        }

        return tex;
    }

    return {
        paraboloidFromCubemap: paraboloidFromCubemap,
        downsampleParaboloid: downsampleParaboloid,
        generateDpAtlas: generateDpAtlas
    };
}()));

