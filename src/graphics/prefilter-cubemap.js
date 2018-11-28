Object.assign(pc, (function () {
    'use strict';

    function syncToCpu(device, targ, face) {
        var tex = targ._colorBuffer;
        if (tex.format != pc.PIXELFORMAT_R8_G8_B8_A8) return;
        var pixels = new Uint8Array(tex.width * tex.height * 4);
        var gl = device.gl;
        device.setFramebuffer(targ._glFrameBuffer);
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

        if (cpuSync && !sourceCubemap._levels[0]) {
            console.error("ERROR: prefilter: cubemap must have _levels");
            return;
        }

        var chunks = pc.shaderChunks;
        var rgbmSource = sourceCubemap.rgbm;
        var shader = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, chunks.rgbmPS +
            chunks.prefilterCubemapPS
                .replace(/\$METHOD/g, method === 0 ? "cos" : "phong")
                .replace(/\$NUMSAMPLES/g, samples)
                .replace(/\$textureCube/g, rgbmSource ? "textureCubeRGBM" : "textureCube"),
                                                 "prefilter" + method + "" + samples + "" + rgbmSource);
        var shader2 = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, chunks.outputCubemapPS, "outputCubemap");
        var constantTexSource = device.scope.resolve("source");
        var constantParams = device.scope.resolve("params");
        var params = new pc.Vec4();
        var size = sourceCubemap.width;
        var format = sourceCubemap.format;

        var cmapsList = [[], options.filteredFixed, options.filteredRgbm, options.filteredFixedRgbm];
        var gloss = method === 0 ? [0.9, 0.85, 0.7, 0.4, 0.25] : [512, 128, 32, 8, 2]; // TODO: calc more correct values depending on mip
        var mipSize = [64, 32, 16, 8, 4]; // TODO: make non-static?
        var numMips = 5;
        var targ;
        var i, face, pass;

        var rgbFormat = format === pc.PIXELFORMAT_R8_G8_B8;
        var isImg = false;
        var nextCubemap, cubemap;
        if (cpuSync) {
            isImg = sourceCubemap._levels[0][0] instanceof HTMLImageElement;
        }
        if ((rgbFormat || isImg) && cpuSync) {
            // WebGL can't read non-RGBA pixels
            format = pc.PIXELFORMAT_R8_G8_B8_A8;
            nextCubemap = new pc.Texture(device, {
                cubemap: true,
                rgbm: rgbmSource,
                format: format,
                width: size,
                height: size,
                mipmaps: false
            });
            nextCubemap.name = 'prefiltered-cube';
            for (face = 0; face < 6; face++) {
                targ = new pc.RenderTarget(device, nextCubemap, {
                    face: face,
                    depth: false
                });
                params.x = face;
                params.y = 0;
                constantTexSource.setValue(sourceCubemap);
                constantParams.setValue(params.data);

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
            for (i = 0; i < steps; i++) {
                size = sourceCubemap.width * 0.5;
                var sampleGloss = method === 0 ? 1 : Math.pow(2, Math.round(Math.log2(gloss[0]) + (steps - i) * 2));
                nextCubemap = new pc.Texture(device, {
                    cubemap: true,
                    rgbm: rgbmSource,
                    format: format,
                    width: size,
                    height: size,
                    mipmaps: false
                });
                nextCubemap.name = 'prefiltered-cube';
                for (face = 0; face < 6; face++) {
                    targ = new pc.RenderTarget(device, nextCubemap, {
                        face: face,
                        depth: false
                    });
                    params.x = face;
                    params.y = sampleGloss;
                    params.z = size;
                    params.w = rgbmSource ? 3 : 0;
                    constantTexSource.setValue(sourceCubemap);
                    constantParams.setValue(params.data);

                    pc.drawQuadWithShader(device, targ, shader2);
                    if (i === steps - 1 && cpuSync) {
                        syncToCpu(device, targ, face);
                    }
                }
                sourceCubemap = nextCubemap;
            }
        }
        options.sourceCubemap = sourceCubemap;

        var sourceCubemapRgbm = null;
        if (!rgbmSource && options.filteredFixedRgbm) {
            nextCubemap = new pc.Texture(device, {
                cubemap: true,
                rgbm: true,
                format: pc.PIXELFORMAT_R8_G8_B8_A8,
                width: size,
                height: size,
                mipmaps: false
            });
            nextCubemap.name = 'prefiltered-cube';
            for (face = 0; face < 6; face++) {
                targ = new pc.RenderTarget(device, nextCubemap, {
                    face: face,
                    depth: false
                });
                params.x = face;
                params.w = 2;
                constantTexSource.setValue(sourceCubemap);
                constantParams.setValue(params.data);

                pc.drawQuadWithShader(device, targ, shader2);
                syncToCpu(device, targ, face);
            }
            sourceCubemapRgbm = nextCubemap;
        }

        var unblurredGloss = method === 0 ? 1 : 2048;
        var startPass = method === 0 ? 0 : -1; // do prepass for unblurred downsampled textures when using importance sampling
        cmapsList[startPass] = [];

        // Initialize textures
        for (i = 0; i < numMips; i++) {
            for (pass = startPass; pass < cmapsList.length; pass++) {
                if (cmapsList[pass] != null) {
                    cmapsList[pass][i] = new pc.Texture(device, {
                        cubemap: true,
                        rgbm: pass < 2 ? rgbmSource : true,
                        format: pass < 2 ? format : pc.PIXELFORMAT_R8_G8_B8_A8,
                        fixCubemapSeams: pass === 1 || pass === 3,
                        width: mipSize[i],
                        height: mipSize[i],
                        mipmaps: false
                    });
                    cmapsList[pass][i].name = 'prefiltered-cube';
                }
            }
        }

        // Filter
        // [Prepass]: just downsample
        // Pass 0: just filter
        // Pass 1: filter + edge fixup
        // Pass 2: filter + encode to RGBM
        // Pass 3: filter + edge fixup + encode to RGBM
        for (pass = startPass; pass < cmapsList.length; pass++) {
            if (cmapsList[pass] != null) {
                if (pass > 1 && rgbmSource) {
                    // already RGBM
                    cmapsList[pass] = cmapsList[pass - 2];
                    continue;
                }
                for (i = 0; i < numMips; i++) {
                    for (face = 0; face < 6; face++) {
                        targ = new pc.RenderTarget(device, cmapsList[pass][i], { // TODO: less excessive allocations
                            face: face,
                            depth: false
                        });
                        params.x = face;
                        params.y = pass < 0 ? unblurredGloss : gloss[i];
                        params.z = mipSize[i];
                        params.w = rgbmSource ? 3 : pass;
                        constantTexSource.setValue(i === 0 ? sourceCubemap :
                            method === 0 ? cmapsList[0][i - 1] : cmapsList[-1][i - 1]);
                        constantParams.setValue(params.data);

                        pc.drawQuadWithShader(device, targ, shader);
                        if (cpuSync) syncToCpu(device, targ, face);
                    }
                }
            }
        }

        options.filtered = cmapsList[0];

        var mips;
        if (cpuSync && options.singleFilteredFixed) {
            mips = [
                sourceCubemap,
                options.filteredFixed[0],
                options.filteredFixed[1],
                options.filteredFixed[2],
                options.filteredFixed[3],
                options.filteredFixed[4],
                options.filteredFixed[5]
            ];
            cubemap = new pc.Texture(device, {
                cubemap: true,
                rgbm: rgbmSource,
                fixCubemapSeams: true,
                format: format,
                width: 128,
                height: 128,
                addressU: pc.ADDRESS_CLAMP_TO_EDGE,
                addressV: pc.ADDRESS_CLAMP_TO_EDGE
            });
            cubemap.name = 'prefiltered-cube';
            for (i = 0; i < 6; i++)
                cubemap._levels[i] = mips[i]._levels[0];

            cubemap.upload();
            cubemap._prefilteredMips = true;
            options.singleFilteredFixed = cubemap;
        }

        if (cpuSync && options.singleFilteredFixedRgbm && options.filteredFixedRgbm) {
            mips = [
                sourceCubemapRgbm,
                options.filteredFixedRgbm[0],
                options.filteredFixedRgbm[1],
                options.filteredFixedRgbm[2],
                options.filteredFixedRgbm[3],
                options.filteredFixedRgbm[4],
                options.filteredFixedRgbm[5]
            ];
            cubemap = new pc.Texture(device, {
                cubemap: true,
                rgbm: true,
                fixCubemapSeams: true,
                format: pc.PIXELFORMAT_R8_G8_B8_A8,
                width: 128,
                height: 128,
                addressU: pc.ADDRESS_CLAMP_TO_EDGE,
                addressV: pc.ADDRESS_CLAMP_TO_EDGE
            });
            cubemap.name = 'prefiltered-cube';
            for (i = 0; i < 6; i++) {
                cubemap._levels[i] = mips[i]._levels[0];
            }
            cubemap.upload();
            cubemap._prefilteredMips = true;
            options.singleFilteredFixedRgbm = cubemap;
        }
    }

    // https://seblagarde.wordpress.com/2012/06/10/amd-cubemapgen-for-physically-based-rendering/
    function areaElement(x, y) {
        return Math.atan2(x * y, Math.sqrt(x * x + y * y + 1));
    }
    function texelCoordSolidAngle(u, v, size) {
        // Scale up to [-1, 1] range (inclusive), offset by 0.5 to point to texel center.
        var _u = (2.0 * (u + 0.5) / size ) - 1.0;
        var _v = (2.0 * (v + 0.5) / size ) - 1.0;

        // fixSeams
        _u *= 1.0 - 1.0 / size;
        _v *= 1.0 - 1.0 / size;

        var invResolution = 1.0 / size;

        // U and V are the -1..1 texture coordinate on the current face.
        // Get projected area for this texel
        var x0 = _u - invResolution;
        var y0 = _v - invResolution;
        var x1 = _u + invResolution;
        var y1 = _v + invResolution;
        var solidAngle = areaElement(x0, y0) - areaElement(x0, y1) - areaElement(x1, y0) + areaElement(x1, y1);

        // fixSeams cut
        if ((u === 0 && v === 0) || (u === size - 1 && v === 0) || (u === 0 && v === size - 1) || (u === size - 1 && v === size - 1)) {
            solidAngle /= 3;
        } else if (u === 0 || v === 0 || u === size - 1 || v === size - 1) {
            solidAngle *= 0.5;
        }

        return solidAngle;
    }

    function shFromCubemap(source, dontFlipX) {
        var face;
        var cubeSize = source.width;
        var x, y;

        if (source.format != pc.PIXELFORMAT_R8_G8_B8_A8) {
            console.error("ERROR: SH: cubemap must be RGBA8");
            return;
        }
        if (!source._levels[0]) {
            console.error("ERROR: SH: cubemap must be synced to CPU");
            return;
        }
        if (!source._levels[0][0].length) {
            // Cubemap is not composed of arrays
            if (source._levels[0][0] instanceof HTMLImageElement) {
                // Cubemap is made of imgs - convert to arrays
                var device = pc.Application.getApplication().graphicsDevice;
                var gl = device.gl;
                var chunks = pc.shaderChunks;
                var shader = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, chunks.fullscreenQuadPS, "fsQuadSimple");
                var constantTexSource = device.scope.resolve("source");
                for (face = 0; face < 6; face++) {
                    var img = source._levels[0][face];

                    var tex = new pc.Texture(device, {
                        cubemap: false,
                        rgbm: false,
                        format: source.format,
                        width: cubeSize,
                        height: cubeSize,
                        mipmaps: false
                    });
                    tex.name = 'prefiltered-cube';
                    tex._levels[0] = img;
                    tex.upload();

                    var tex2 = new pc.Texture(device, {
                        cubemap: false,
                        rgbm: false,
                        format: source.format,
                        width: cubeSize,
                        height: cubeSize,
                        mipmaps: false
                    });
                    tex2.name = 'prefiltered-cube';

                    var targ = new pc.RenderTarget(device, tex2, {
                        depth: false
                    });
                    constantTexSource.setValue(tex);
                    pc.drawQuadWithShader(device, targ, shader);

                    var pixels = new Uint8Array(cubeSize * cubeSize * 4);
                    gl.bindFramebuffer(gl.FRAMEBUFFER, targ._glFrameBuffer);
                    gl.readPixels(0, 0, tex.width, tex.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

                    source._levels[0][face] = pixels;
                }
            } else {
                console.error("ERROR: SH: cubemap must be composed of arrays or images");
                return;
            }
        }

        var dirs = [];
        for (y = 0; y < cubeSize; y++) {
            for (x = 0; x < cubeSize; x++) {
                var u = (x / (cubeSize - 1)) * 2 - 1;
                var v = (y / (cubeSize - 1)) * 2 - 1;
                dirs[y * cubeSize + x] = new pc.Vec3(u, v, 1.0).normalize();
            }
        }

        var sh = new Float32Array(9 * 3);
        var coef1 = 0;
        var coef2 = 1 * 3;
        var coef3 = 2 * 3;
        var coef4 = 3 * 3;
        var coef5 = 4 * 3;
        var coef6 = 5 * 3;
        var coef7 = 6 * 3;
        var coef8 = 7 * 3;
        var coef9 = 8 * 3;

        var nx = 0;
        var px = 1;
        var ny = 2;
        var py = 3;
        var nz = 4;
        var pz = 5;

        var addr, c, a, value, weight, dir, dx, dy, dz;
        var weight1, weight2, weight3, weight4, weight5;

        var accum = 0;
        for (face = 0; face < 6; face++) {
            for (y = 0; y < cubeSize; y++) {
                for (x = 0; x < cubeSize; x++) {

                    addr = y * cubeSize + x;
                    weight = texelCoordSolidAngle(x, y, cubeSize);

                    // http://home.comcast.net/~tom_forsyth/blog.wiki.html#[[Spherical%20Harmonics%20in%20Actual%20Games%20notes]]
                    weight1 = weight * 4 / 17;
                    weight2 = weight * 8 / 17;
                    weight3 = weight * 15 / 17;
                    weight4 = weight * 5 / 68;
                    weight5 = weight * 15 / 68;

                    dir = dirs[addr];
                    if (face == nx) {
                        dx = dir.z;
                        dy = -dir.y;
                        dz = -dir.x;
                    } else if (face == px) {
                        dx = -dir.z;
                        dy = -dir.y;
                        dz = dir.x;
                    } else if (face == ny) {
                        dx = dir.x;
                        dy = dir.z;
                        dz = dir.y;
                    } else if (face == py) {
                        dx = dir.x;
                        dy = -dir.z;
                        dz = -dir.y;
                    } else if (face == nz) {
                        dx = dir.x;
                        dy = -dir.y;
                        dz = dir.z;
                    } else if (face == pz) {
                        dx = -dir.x;
                        dy = -dir.y;
                        dz = -dir.z;
                    }

                    if (!dontFlipX) dx = -dx; // flip original cubemap x instead of doing it at runtime

                    a = source._levels[0][face][addr * 4 + 3] / 255.0;

                    for (c = 0; c < 3; c++) {
                        value =  source._levels[0][face][addr * 4 + c] / 255.0;
                        if (source.rgbm) {
                            value *= a * 8.0;
                            value *= value;
                        } else {
                            value = Math.pow(value, 2.2);
                        }

                        sh[coef1 + c] += value * weight1;
                        sh[coef2 + c] += value * weight2 * dx;
                        sh[coef3 + c] += value * weight2 * dy;
                        sh[coef4 + c] += value * weight2 * dz;

                        sh[coef5 + c] += value * weight3 * dx * dz;
                        sh[coef6 + c] += value * weight3 * dz * dy;
                        sh[coef7 + c] += value * weight3 * dy * dx;

                        sh[coef8 + c] += value * weight4 * (3.0 * dz * dz - 1.0);
                        sh[coef9 + c] += value * weight5 * (dx * dx - dy * dy);

                        accum += weight;
                    }
                }
            }
        }

        for (c = 0; c < sh.length; c++) {
            sh[c] *= 4 * Math.PI / accum;
        }

        return sh;
    }


    return {
        prefilterCubemap: prefilterCubemap,
        shFromCubemap: shFromCubemap
    };
}()));
