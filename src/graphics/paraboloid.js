Object.assign(pc, (function () {
    'use strict';

    var dpMult = 2.0;

    function paraboloidFromCubemap(device, sourceCubemap, fixSeamsAmount, dontFlipX) {
        var chunks = pc.shaderChunks;
        var shader = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS,
                                                 (sourceCubemap.fixCubemapSeams ? chunks.fixCubemapSeamsStretchPS : chunks.fixCubemapSeamsNonePS) + chunks.genParaboloidPS, "genParaboloid");
        var constantTexSource = device.scope.resolve("source");
        var constantParams = device.scope.resolve("params");
        var params = new pc.Vec4();
        var size = sourceCubemap.width;
        var rgbmSource = sourceCubemap.rgbm;
        var format = sourceCubemap.format;

        size = Math.max(size, 8) * dpMult;

        var tex = new pc.Texture(device, {
            rgbm: rgbmSource,
            format: format,
            width: size * 2,
            height: size,
            mipmaps: false
        });
        tex.name = 'paraboloid';

        var targ = new pc.RenderTarget(device, tex, {
            depth: false
        });

        params.x = fixSeamsAmount;
        params.y = dontFlipX ? -1.0 : 1.0;
        constantTexSource.setValue(sourceCubemap);
        constantParams.setValue(params.data);
        pc.drawQuadWithShader(device, targ, shader);

        return tex;
    }

    function getDpAtlasRect(rect, mip) {

        rect.x = pc.math.clamp(mip - 2.0, 0, 1) * 0.5;

        var t = mip - rect.x * 6.0;
        var i = 1.0 - rect.x;
        rect.y = Math.min(t * 0.5, 0.75) * i + rect.x;

        rect.z = (1.0 - pc.math.clamp(t, 0, 1) * 0.5) * i;
        rect.w = rect.z * 0.5;

        return 1.0 / rect.z;
    }

    function generateDpAtlas(device, sixCubemaps, dontFlipX) {
        var dp, rect;
        rect = new pc.Vec4();
        var params = new pc.Vec4();
        var size = sixCubemaps[0].width * 2 * dpMult;

        var chunks = pc.shaderChunks;
        var shader = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, chunks.dpAtlasQuadPS, "dpAtlasQuad");
        var constantTexSource = device.scope.resolve("source");
        var constantParams = device.scope.resolve("params");

        var tex = new pc.Texture(device, {
            rgbm: sixCubemaps[0].rgbm,
            format: sixCubemaps[0].format,
            width: size,
            height: size,
            mipmaps: false
        });
        tex.name = 'paraboloid';
        var targ = new pc.RenderTarget(device, tex, {
            depth: false
        });

        var borderSize = 2; // 1 pixel from each side
        var mip0Width = size;
        var scaleFactor = (mip0Width + borderSize) / mip0Width - 1;
        var scaleAmount;
        for (var i = 0; i < 6; i++) {
            dp = pc.paraboloidFromCubemap(device, sixCubemaps[i], i, dontFlipX);
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
        generateDpAtlas: generateDpAtlas
    };
}()));
