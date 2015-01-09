pc.extend(pc, (function () {
    'use strict';

    function prefilterCubemap(device, sourceCubemap, method, samples, options, chromeFix) {
        var chunks = pc.shaderChunks;
        var shader = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, chunks.rgbmPS +
            chunks.prefilterCubemapPS.
                replace(/\$METHOD/g, method===0? "cos" : "phong").
                replace(/\$NUMSAMPLES/g, samples),
            "prefilter" + method + "" + samples);
        var constantTexSource = device.scope.resolve("source");
        var constantParams = device.scope.resolve("params");
        var params = new pc.Vec4();
        var size = sourceCubemap.width;
        var rgbmSource = sourceCubemap.rgbm;
        var format = sourceCubemap.format;

        var cmapsList = [[], options.filteredFixed, options.filteredRGBM, options.filteredFixedRGBM];
        var gloss = method===0? [0.9, 0.85, 0.7, 0.4, 0.25] : [512, 128, 32, 8, 2]; // TODO: calc more correct values depending on mip
        var mipSize = [64, 32, 16, 8, 4]; // TODO: make non-static?
        var mips = 5;
        var targ;
        var i, face, pass;

        // Initialize textures
        for(i=0; i<mips; i++) {
            for(pass=0; pass<cmapsList.length; pass++) {
                if (cmapsList[pass]!=null) {
                    cmapsList[pass][i] = new pc.gfx.Texture(device, {
                        cubemap: true,
                        rgbm: pass<2? rgbmSource : true,
                        format: pass<2? format : pc.PIXELFORMAT_R8_G8_B8_A8,
                        fixCubemapSeams: pass===1 || pass===3,
                        width: mipSize[i],
                        height: mipSize[i],
                        autoMipmap: false
                    });
                    cmapsList[pass][i].minFilter = pc.FILTER_LINEAR;
                    cmapsList[pass][i].magFilter = pc.FILTER_LINEAR;
                    cmapsList[pass][i].addressU = pc.ADDRESS_CLAMP_TO_EDGE;
                    cmapsList[pass][i].addressV = pc.ADDRESS_CLAMP_TO_EDGE;
                }
            }
        }

        // Filter
        // Pass 0: just filter
        // Pass 1: filter + edge fixup
        // Pass 2: filter + encode to RGBM
        // Pass 3: filter + edge fixup + encode to RGBM
        for(pass=0; pass<cmapsList.length; pass++) {
            if (cmapsList[pass]!=null) {
                if (pass>1 && rgbmSource) {
                    // already RGBM
                    cmapsList[pass] = cmapsList[pass - 2];
                    continue;
                }
                for(i=0; i<mips; i++) {
                    for(face=0; face<6; face++) {
                        targ = new pc.RenderTarget(device, cmapsList[pass][i], { // TODO: less excessive allocations
                            face: face,
                            depth: false
                        });
                        params.x = face;
                        params.y = gloss[i];
                        params.z = mipSize[i];
                        params.w = pass;
                        constantTexSource.setValue(i===0? sourceCubemap : cmapsList[0][i - 1]);
                        constantParams.setValue(params.data);

                        if (chromeFix) {
                            // https://code.google.com/p/chromium/issues/detail?id=447419
                            // Workaround: wait a little
                            var endTime = Date.now() + 10;
                            while(Date.now() < endTime);
                        }
                        pc.drawQuadWithShader(device, targ, shader);
                    }
                }
            }
        }

        options.filtered = cmapsList[0];

    }

    return {
        prefilterCubemap: prefilterCubemap
    };
}()));

