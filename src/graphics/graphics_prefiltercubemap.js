pc.extend(pc, (function () {
    'use strict';

    function fixChrome() {
        // https://code.google.com/p/chromium/issues/detail?id=447419
        // Workaround: wait a little
        var endTime = Date.now() + 10;
        while(Date.now() < endTime);
    }

    function syncToCpu(device, targ, face) {
        var tex = targ._colorBuffer;
        if (tex.format!=pc.PIXELFORMAT_R8_G8_B8_A8) return;
        var pixels = new Uint8Array(tex.width * tex.height * 4);
        var gl = device.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, targ._glFrameBuffer);
        gl.readPixels(0, 0, tex.width, tex.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        if (!tex._levels) tex._levels = [];
        if (!tex._levels[0]) tex._levels[0] = [];
        tex._levels[0][face] = pixels;
    }

    function prefilterCubemap(options) {
        var device = options.device;
        var sourceCubemap = options.sourceCubemap;
        var method = options.method;
        var samples = options.samples;
        var cpuSync = options.cpuSync;
        var chromeFix = options.chromeFix;

        var chunks = pc.shaderChunks;
        var shader = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, chunks.rgbmPS +
            chunks.prefilterCubemapPS.
                replace(/\$METHOD/g, method===0? "cos" : "phong").
                replace(/\$NUMSAMPLES/g, samples),
            "prefilter" + method + "" + samples);
        var shader2 = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, chunks.outputCubemapPS);
        var constantTexSource = device.scope.resolve("source");
        var constantParams = device.scope.resolve("params");
        var params = new pc.Vec4();
        var size = sourceCubemap.width;
        var rgbmSource = sourceCubemap.rgbm;
        var format = sourceCubemap.format;

        var cmapsList = [[], options.filteredFixed, options.filteredRgbm, options.filteredFixedRgbm];
        var gloss = method===0? [0.9, 0.85, 0.7, 0.4, 0.25] : [512, 128, 32, 8, 2]; // TODO: calc more correct values depending on mip
        var mipSize = [64, 32, 16, 8, 4]; // TODO: make non-static?
        var mips = 5;
        var targ;
        var i, face, pass;

        var rgbFormat = format===pc.PIXELFORMAT_R8_G8_B8;
        if (rgbFormat && cpuSync) {
            // WebGL can't read non-RGBA pixels
            format = pc.PIXELFORMAT_R8_G8_B8_A8;
            var nextCubemap = new pc.gfx.Texture(device, {
                cubemap: true,
                rgbm: rgbmSource,
                format: format,
                width: size,
                height: size,
                autoMipmap: false
            });
            nextCubemap.minFilter = pc.FILTER_LINEAR;
            nextCubemap.magFilter = pc.FILTER_LINEAR;
            nextCubemap.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
            nextCubemap.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
            for(face=0; face<6; face++) {
                targ = new pc.RenderTarget(device, nextCubemap, {
                    face: face,
                    depth: false
                });
                params.x = face;
                params.y = 0;
                constantTexSource.setValue(sourceCubemap);
                constantParams.setValue(params.data);

                if (chromeFix) fixChrome();
                pc.drawQuadWithShader(device, targ, shader2);
                syncToCpu(device, targ, face);
            }
            sourceCubemap = nextCubemap;
        }

        if (size > 128) {
            // Downsample to 128 first
            var log128 = Math.round(Math.log2(128));
            var logSize = Math.round(Math.log2(size));
            var steps = logSize - log128;
            var nextCubemap;
            for(i=0; i<steps; i++) {
                size = sourceCubemap.width * 0.5;
                var sampleGloss = method===0? 1 : Math.pow(2, Math.round(Math.log2(gloss[0]) + (steps - i) * 2));
                nextCubemap = new pc.gfx.Texture(device, {
                    cubemap: true,
                    rgbm: rgbmSource,
                    format: format,
                    width: size,
                    height: size,
                    autoMipmap: false
                });
                nextCubemap.minFilter = pc.FILTER_LINEAR;
                nextCubemap.magFilter = pc.FILTER_LINEAR;
                nextCubemap.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
                nextCubemap.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
                for(face=0; face<6; face++) {
                    targ = new pc.RenderTarget(device, nextCubemap, {
                        face: face,
                        depth: false
                    });
                    params.x = face;
                    params.y = sampleGloss;
                    params.z = size;
                    params.w = 0;
                    constantTexSource.setValue(sourceCubemap);
                    constantParams.setValue(params.data);

                    if (chromeFix) fixChrome();
                    pc.drawQuadWithShader(device, targ, shader2);
                    if (i===steps-1 && cpuSync) {
                        syncToCpu(device, targ, face);
                    }
                }
                sourceCubemap = nextCubemap;
            }
        }
        options.sourceCubemap = sourceCubemap;

        var sourceCubemapRgbm = null;
        if (!rgbmSource && options.filteredFixedRgbm) {
            var nextCubemap = new pc.gfx.Texture(device, {
                cubemap: true,
                rgbm: true,
                format: pc.PIXELFORMAT_R8_G8_B8_A8,
                width: size,
                height: size,
                autoMipmap: false
            });
            nextCubemap.minFilter = pc.FILTER_LINEAR;
            nextCubemap.magFilter = pc.FILTER_LINEAR;
            nextCubemap.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
            nextCubemap.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
            for(face=0; face<6; face++) {
                targ = new pc.RenderTarget(device, nextCubemap, {
                    face: face,
                    depth: false
                });
                params.x = face;
                params.w = 2;
                constantTexSource.setValue(sourceCubemap);
                constantParams.setValue(params.data);

                if (chromeFix) fixChrome();
                pc.drawQuadWithShader(device, targ, shader2);
                syncToCpu(device, targ, face);
            }
            sourceCubemapRgbm = nextCubemap;
        }

        var unblurredGloss = method===0? 1 : 2048;
        var startPass = method===0? 0 : -1; // do prepass for unblurred downsampled textures when using importance sampling
        cmapsList[startPass] = [];

        // Initialize textures
        for(i=0; i<mips; i++) {
            for(pass=startPass; pass<cmapsList.length; pass++) {
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
        // [Prepass]: just downsample
        // Pass 0: just filter
        // Pass 1: filter + edge fixup
        // Pass 2: filter + encode to RGBM
        // Pass 3: filter + edge fixup + encode to RGBM
        for(pass=startPass; pass<cmapsList.length; pass++) {
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
                        params.y = pass<0? unblurredGloss : gloss[i];
                        params.z = mipSize[i];
                        params.w = pass;
                        constantTexSource.setValue(i===0? sourceCubemap :
                            method===0? cmapsList[0][i - 1] : cmapsList[-1][i - 1]);
                        constantParams.setValue(params.data);

                        if (chromeFix) fixChrome();
                        pc.drawQuadWithShader(device, targ, shader);
                        if (cpuSync) syncToCpu(device, targ, face);
                    }
                }
            }
        }

        options.filtered = cmapsList[0];

        if (cpuSync && options.singleFilteredFixed) {
            var mips = [sourceCubemap,
                        options.filteredFixed[0],
                        options.filteredFixed[1],
                        options.filteredFixed[2],
                        options.filteredFixed[3],
                        options.filteredFixed[4],
                        options.filteredFixed[5]];
            var cubemap = new pc.gfx.Texture(device, {
                cubemap: true,
                rgbm: rgbmSource,
                fixCubemapSeams: true,
                format: format,
                width: 128,
                height: 128,
                autoMipmap: false
            });
            for(i=0; i<6; i++) {
                cubemap._levels[i] = mips[i]._levels[0];
            }
            cubemap.upload();
            cubemap.minFilter = pc.FILTER_LINEAR_MIPMAP_LINEAR;
            cubemap.magFilter = pc.FILTER_LINEAR;
            cubemap._prefilteredMips = true;
            options.singleFilteredFixed = cubemap;
        }

        if (cpuSync && options.singlefilteredFixedRgbm && options.filteredFixedRgbm) {
            var mips = [
                        sourceCubemapRgbm,
                        options.filteredFixedRgbm[0],
                        options.filteredFixedRgbm[1],
                        options.filteredFixedRgbm[2],
                        options.filteredFixedRgbm[3],
                        options.filteredFixedRgbm[4],
                        options.filteredFixedRgbm[5]
                        ];
            var cubemap = new pc.gfx.Texture(device, {
                cubemap: true,
                rgbm: true,
                fixCubemapSeams: true,
                format: pc.PIXELFORMAT_R8_G8_B8_A8,
                width: 128,
                height: 128,
                autoMipmap: false
            });
            for(i=0; i<6; i++) {
                cubemap._levels[i] = mips[i]._levels[0];
            }
            cubemap.upload();
            cubemap.minFilter = pc.FILTER_LINEAR_MIPMAP_LINEAR;
            cubemap.magFilter = pc.FILTER_LINEAR;
            cubemap._prefilteredMips = true;
            options.singlefilteredFixedRgbm = cubemap;
        }
    }

    return {
        prefilterCubemap: prefilterCubemap
    };
}()));

