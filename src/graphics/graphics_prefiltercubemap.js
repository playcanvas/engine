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
            cubemap.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
            cubemap.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
            cubemap.upload();
            cubemap.minFilter = pc.FILTER_LINEAR_MIPMAP_LINEAR;
            cubemap.magFilter = pc.FILTER_LINEAR;
            cubemap._prefilteredMips = true;
            options.singleFilteredFixed = cubemap;
        }

        if (cpuSync && options.singleFilteredFixedRgbm && options.filteredFixedRgbm) {
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
            cubemap.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
            cubemap.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
            cubemap.upload();
            cubemap.minFilter = pc.FILTER_LINEAR_MIPMAP_LINEAR;
            cubemap.magFilter = pc.FILTER_LINEAR;
            cubemap._prefilteredMips = true;
            options.singleFilteredFixedRgbm = cubemap;
        }
    }

    function ambientCubeFromCubemap(source) {
        if (source.format!=pc.PIXELFORMAT_R8_G8_B8_A8) {
            console.error("ERROR: cubemap must be RGBA8");
            return;
        }
        if (!source._levels[0]) {
            console.error("ERROR: cubemap must be synced to CPU");
            return;
        }
        if (!source._levels[0][0].length) {
            console.error("ERROR: cubemap must be composed of arrays");
            return;
        }
        if (source._levels[0][0].length!==4*4*4) {
            console.error("ERROR: cubemap must have 4x4x4 bytes, has " + source._levels[0][0].length);
            return;
        }
        var cube = new Float32Array(6 * 3);
        var x;
        var y;
        var w = 4;
        var chans = 4;
        var c, a;
        var val;
        for(var face=0; face<6; face++) {
            var pixels = source._levels[0][face];
            for(y=1; y<=2; y++) {
                for(x=1; x<=2; x++) {
                    var addr = (y * w + x) * chans;
                    a = pixels[addr + 3] / 255.0;
                    for(c=0; c<3; c++) {
                        if (source.rgbm) {
                            val = (pixels[addr + c] / 255.0) * a * 8.0;
                            val *= val;
                            cube[face * 3 + c] += val;
                        } else {
                            val = pixels[addr + c] / 255.0;
                            cube[face * 3 + c] += val;
                        }
                    }
                }
            }
            cube[face * 3] /= 4;
            cube[face * 3 + 1] /= 4;
            cube[face * 3 + 2] /= 4;
        }

        return cube;
    }

    function AreaElement(x,y)
    {
        return Math.atan2(x * y, Math.sqrt(x * x + y * y + 1));
    }

    function TexelCoordSolidAngle(u, v, size)
    {
       //scale up to [-1, 1] range (inclusive), offset by 0.5 to point to texel center.
       var U = (2.0 * (u + 0.5) / size ) - 1.0;
       var V = (2.0 * (v + 0.5) / size ) - 1.0;

       // fixSeams
        U *= 1.0 - 1.0 / size;
        V *= 1.0 - 1.0 / size;

       var InvResolution = 1.0 / size;

        // U and V are the -1..1 texture coordinate on the current face.
        // Get projected area for this texel
        var x0 = U - InvResolution;
        var y0 = V - InvResolution;
        var x1 = U + InvResolution;
        var y1 = V + InvResolution;
        var SolidAngle = AreaElement(x0, y0) - AreaElement(x0, y1) - AreaElement(x1, y0) + AreaElement(x1, y1);

        // fixSeams cut
        if ((u==0 && v==0) || (u==size-1 && v==0) || (u==0 && v==size-1) || (u==size-1 && v==size-1)) {
            SolidAngle /= 3;
        }
        else if (u==0 || v==0 || u==size-1 || v==size-1) {
            SolidAngle *= 0.5;
        }

        return SolidAngle;
    }

    function shFromCubemap(source) {
        if (source.format!=pc.PIXELFORMAT_R8_G8_B8_A8) {
            console.error("ERROR: cubemap must be RGBA8");
            return;
        }
        if (!source._levels[0]) {
            console.error("ERROR: cubemap must be synced to CPU");
            return;
        }
        if (!source._levels[0][0].length) {
            console.error("ERROR: cubemap must be composed of arrays");
            return;
        }
        /*if (source._levels[0][0].length!==4*4*4) {
            console.error("ERROR: cubemap must have 4x4x4 bytes, has " + source._levels[0][0].length);
            return;
        }*/
        var cubeSize = source.width;

        /*var facenx = source._levels[0][0];
        var facepx = source._levels[0][1];
        var faceny = source._levels[0][2];
        var facepy = source._levels[0][3];
        var facenz = source._levels[0][4];
        var facepz = source._levels[0][5];*/

        var pixelNum2Dir = [-1.0, -0.5, 0.5, 1.0];
        //var pixelNum2Dir = [-0.75, -0.25, 0.25, 0.75]; // reev

        var dirs = [];
        for(y=0; y<cubeSize; y++) {
            for(x=0; x<cubeSize; x++) {
                var u = (x / (cubeSize-1)) * 2 - 1;
                var v = (y / (cubeSize-1)) * 2 - 1;
                dirs[y * cubeSize + x] = new pc.Vec3(u, v, 1.0).normalize();
                //new pc.Vec3(pixelNum2Dir[x], pixelNum2Dir[y], 1.0).normalize();
            }
        }

        var sh = new Float32Array(25 * 3);
        var coef1 = 0;
        var coef2 = 1 * 3;
        var coef3 = 2 * 3;
        var coef4 = 3 * 3;
        var coef5 = 4 * 3;
        var coef6 = 5 * 3;
        var coef7 = 6 * 3;
        var coef8 = 7 * 3;
        var coef9 = 8 * 3;

        var coef10 = 9 * 3;
        var coef11 = 10 * 3;
        var coef12 = 11 * 3;
        var coef13 = 12 * 3;
        var coef14 = 13 * 3;
        var coef15 = 14 * 3;
        var coef16 = 15 * 3;
        var coef17 = 16 * 3;
        var coef18 = 17 * 3;
        var coef19 = 18 * 3;
        var coef20 = 19 * 3;
        var coef21 = 20 * 3;
        var coef22 = 21 * 3;
        var coef23 = 22 * 3;
        var coef24 = 23 * 3;
        var coef25 = 24 * 3;

        var cube = new Float32Array(6 * 3);

        var nx = 0;
        var px = 1;
        var ny = 2;
        var py = 3;
        var nz = 4;
        var pz = 5;

        var x, y, addr, c, value, weight, dir, dx, dy, dz;
        var startY =    [0, 0, 0, 0, 1, 1];
        var endY =      [3, 3, 3, 3, 2, 2];
        var startX =    [0, 0, 1, 1, 1, 1];
        var endX =      [3, 3, 2, 2, 2, 2];
        var texelCount = [4*4, 4*4, 2*4, 2*4, 2*2, 2*2];
        var accum = 0;
        for(var face=0; face<6; face++) {
            //for(y=startY[face]; y<=endY[face]; y++) {
              //  for(x=startX[face]; x<=endX[face]; x++) {
            for(y=0; y<cubeSize; y++) {
                for(x=0; x<cubeSize; x++) {

                    addr = y * cubeSize + x;
                    /*weight = (x==0 || y==0 || x==3 || y==3)? 0.5 : 1; // half pixel vs full pixel
                    if (addr==0 || addr==3 || addr==12 || addr==15) weight = 1/3;
                    weight /= (1/3)*4 + 8*0.5 + 4;// 3*3*6;//4*4;//*6;*/
                    //weight = 1 / texelCount[face];
                    //weight /= 6;

                    //weight = 1 / (4*4 + 4*4 + 2*4 + 2*4 + 2*2 + 2*2);
                    //weight *= 3.14;

                    /*weight = 1/6; // face
                    weight /= 4; // quarter face
                    weight *= (x==0 || y==0 || x==3 || y==3)? (3*1)/(4*4) : (3*3)/(4*4); // half pixel vs full pixel
                    if (addr==0 || addr==3 || addr==12 || addr==15) weight = 1/(4*4);*/

                    weight = TexelCoordSolidAngle(x, y, cubeSize);

                    // reev
                    /*fU = (x / 3) * 2 - 1;
                    fV = (y / 3) * 2 - 1;
                    weight = 4.0 / ((1.0 + fU*fU + fV*fV) * Math.sqrt(1.0 + fU*fU + fV*fV));
                    weight1 = weight * 0.282095;//4/17;
                    weight2 = weight * 0.488603;//8/17;
                    weight3 = weight * 1.092548;//15/17;
                    weight4 = weight * 0.315392;//5/68;
                    weight5 = weight * 0.546274;//15/68;*/

                    weight1 = weight * 4/17;
                    weight2 = weight * 8/17;
                    weight3 = weight * 15/17;
                    weight4 = weight * 5/68;
                    weight5 = weight * 15/68;
                    weightC = weight * 2;

                    dir = dirs[addr]
                    if (face==nx) {
                        dx = dir.z;
                        dy = -dir.y;
                        dz = -dir.x;
                    } else if (face==px) {
                        dx = -dir.z;
                        dy = -dir.y;
                        dz = dir.x;
                    } else if (face==ny) {
                        dx = dir.x;
                        dy = dir.z;
                        dz = dir.y;
                    } else if (face==py) {
                        dx = dir.x;
                        dy = -dir.z;
                        dz = -dir.y;
                    } else if (face==nz) {
                        dx = dir.x;
                        dy = -dir.y;
                        dz = dir.z;
                    } else if (face==pz) {
                        dx = -dir.x;
                        dy = -dir.y;
                        dz = -dir.z;
                    }

                    /*source._levels[0][face][addr * 4 + 0] = (dx * 0.5 + 0.5) * 255;
                    source._levels[0][face][addr * 4 + 1] = (dy * 0.5 + 0.5) * 255;
                    source._levels[0][face][addr * 4 + 2] = (dz * 0.5 + 0.5) * 255;
                    source._levels[0][face][addr * 4 + 3] = (1.0 / 8.0) * 255;*/

                    /*source._levels[0][face][addr * 4 + 0] = source._levels[0][face][addr * 4 + 1] = source._levels[0][face][addr * 4 + 2] =
                    Math.max(dy * 255, 0.0);
                    source._levels[0][face][addr * 4 + 3] = (1.0 / 8.0) * 255;*/

                    var ndx = Math.max(-dx, 0.0);
                    var pdx = Math.max(dx, 0.0);
                    var ndy = Math.max(-dy, 0.0);
                    var pdy = Math.max(dy, 0.0);
                    var ndz = Math.max(-dz, 0.0);
                    var pdz = Math.max(dz, 0.0);

                    var a = source._levels[0][face][addr * 4 + 3] / 255.0;

                    for(c=0; c<3; c++) {
                        value =  source._levels[0][face][addr * 4 + c] / 255.0;
                        if (source.rgbm) {
                            value *= a * 8.0;
                            value *= value;
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

                        /*w = weight;

                        sh[coef1 + c] += value * w*0.28209479177387814;
                        sh[coef2 + c] += value * w*-0.4886025119029199 * dx * (2/3);
                        sh[coef3 + c] += value * w*-0.4886025119029199 * dy * (2/3);
                        sh[coef4 + c] += value * w*0.4886025119029199 * dz * (2/3);

                        sh[coef5 + c] += value * -w*1.0925484305920792 * dx * dz * (1/4);
                        sh[coef6 + c] += value * -w*1.0925484305920792 * dz * dy * (1/4);
                        sh[coef7 + c] += value * w*1.0925484305920792 * dy * dx * (1/4);
                        sh[coef8 + c] += value * w*0.31539156525252005 * (3.0 * dz * dz - 1.0) * (1/4);
                        sh[coef9 + c] += value * w*0.5462742152960396 * (dx * dx - dy * dy) * (1/4);

                        sh[coef10 + c] += value * w*0.5900435899266435 * (-3.0 * dx*dx * dy + dy*dy*dy) * 0;
                        sh[coef11 + c] += value * w*2.890611442640554 * dx * dy * dz * 0;
                        sh[coef12 + c] += value * -w*0.4570457994644658 * dy * (-1.0 + 5.0 * dz*dz) * 0;
                        sh[coef13 + c] += value * w*0.3731763325901154 * dz * (-3.0 + 5.0 * dz*dz) * 0;
                        sh[coef14 + c] += value * -w*0.4570457994644658 * dx * (-1.0 + 5.0 * dz*dz) * 0;
                        sh[coef15 + c] += value * w*1.445305721320277 * (dx*dx - dy*dy) * dz * 0;
                        sh[coef16 + c] += value * -w*0.5900435899266435 * (dx*dx*dx - 3.0 * dx * dy*dy) * 0;

                        sh[coef17 + c] += value * w*2.5033429417967046 * dx * dy * (dx*dx - dy*dy) * (-1/24);
                        sh[coef18 + c] += value * w*-1.7701307697799304 * (3.0 * dx*dx * dy - dy*dy*dy) * dz * (-1/24);
                        sh[coef19 + c] += value * w*0.9461746957575601 * dx * dy * (-1.0 + 7.0 * dz*dz) * (-1/24);
                        sh[coef20 + c] += value * w*-0.6690465435572892 * dy * dz * (-3.0 + 7.0 * dz*dz) * (-1/24);
                        sh[coef21 + c] += value * w*0.10578554691520431 * (3.0 - 30.0 * dz*dz + 35.0 * dz*dz*dz*dz) * (-1/24);
                        sh[coef22 + c] += value * w*-0.6690465435572892 * dx * dz * (-3.0 + 7.0 * dz*dz) * (-1/24);
                        sh[coef23 + c] += value * w*0.47308734787878004 * (dx*dx - dy*dy) * (-1.0 + 7.0 * dz*dz) * (-1/24);
                        sh[coef24 + c] += value * w*-1.7701307697799304 * (dx*dx*dx - 3.0 * dx * dy*dy) * dz * (-1/24);
                        sh[coef25 + c] += value * w*0.6258357354491761 * (dx*dx*dx*dx - 6.0 * dx*dx * dy*dy + dy*dy*dy*dy) * (-1/24);*/


                        cube[coef1 + c] += value * weightC * ndx*ndx;
                        cube[coef2 + c] += value * weightC * pdx*pdx;
                        cube[coef3 + c] += value * weightC * ndy*ndy;
                        cube[coef4 + c] += value * weightC * pdy*pdy;
                        cube[coef5 + c] += value * weightC * ndz*ndz;
                        cube[coef6 + c] += value * weightC * pdz*pdz;
                    }
                }
            }
        }

        for(c=0; c<sh.length; c++) {
            sh[c] *= 4 * Math.PI / accum;
        }

        // test
        /*for(var face=0; face<6; face++) {
            for(y=0; y<4; y++) {
                for(x=0; x<4; x++) {
                    addr = y * 4 + x;

                    dir = dirs[addr];
                    if (face==nx) {
                        dx = dir.z;
                        dy = -dir.y;
                        dz = -dir.x;
                    } else if (face==px) {
                        dx = -dir.z;
                        dy = -dir.y;
                        dz = dir.x;
                    } else if (face==ny) {
                        dx = dir.x;
                        dy = dir.z;
                        dz = dir.y;
                    } else if (face==py) {
                        dx = dir.x;
                        dy = -dir.z;
                        dz = -dir.y;
                    } else if (face==nz) {
                        dx = dir.x;
                        dy = -dir.y;
                        dz = dir.z;
                    } else if (face==pz) {
                        dx = -dir.x;
                        dy = -dir.y;
                        dz = -dir.z;
                    }

                    clr = [];
                    for(c=0; c<3; c++) {
                        clr[c] =
                        sh[coef1 + c] +
                        sh[coef2 + c] * dx +
                        sh[coef3 + c] * dy +
                        sh[coef4 + c] * dz +
                        sh[coef5 + c] * dx * dz +
                        sh[coef6 + c] * dz * dy +
                        sh[coef7 + c] * dy * dx +
                        sh[coef8 + c] * (3.0 * dz * dz - 1.0) +
                        sh[coef9 + c] * (dx * dx - dy * dy);
                    }

                    r = clr[0];
                    g = clr[1];
                    b = clr[2];
                    r = Math.sqrt(r) / 8;
                    g = Math.sqrt(g) / 8;
                    b = Math.sqrt(b) / 8;

                    a = Math.max(Math.max(r, g), Math.max(b, 1.0/255));
                    a = Math.min(a, 1.0);
                    a = Math.ceil(a * 255.0) / 255.0;

                    r = Math.min(r / a, 1.0);
                    g = Math.min(g / a, 1.0);
                    b = Math.min(b / a, 1.0);

                    source._levels[0][face][addr * 4 + 0] = r * 255;
                    source._levels[0][face][addr * 4 + 1] = g * 255;
                    source._levels[0][face][addr * 4 + 2] = b * 255;
                    source._levels[0][face][addr * 4 + 3] = a * 255;
                }
            }
        }*/


                    /*for(c=0; c<3; c++) {
                        value = 1;
                        weight = 1;//0.5;
                        weight1 = weight * 4/17;
                        weight2 = weight * 8/17;
                        weight3 = weight * 15/17;
                        weight4 = weight * 5/68;
                        weight5 = weight * 15/68;
                        dx = 1;
                        dy = 0;
                        dz = 0;

                        sh[coef1 + c] = value * weight1;
                        sh[coef2 + c] = value * weight2 * dx;
                        sh[coef3 + c] = value * weight2 * dy;
                        sh[coef4 + c] = value * weight2 * dz;

                        sh[coef5 + c] = value * weight3 * dx * dz;
                        sh[coef6 + c] = value * weight3 * dz * dy;
                        sh[coef7 + c] = value * weight3 * dy * dx;

                        sh[coef8 + c] = value * weight4 * (3.0 * dz * dz - 1.0);
                        sh[coef9 + c] = value * weight5 * (dx * dx - dy * dy);
                    }*/

        //source.upload();
        //return cube;
        return sh;

        /*var cube = ambientCubeFromCubemap(source);
        var nx = 0;
        var px = 1 * 3;
        var ny = 2 * 3;
        var py = 3 * 3;
        var nz = 4 * 3;
        var pz = 5 * 3;
        var r = 0;
        var g = 1;
        var b = 2;

        var c;
        for(c=r; c<=b; c++) {
            sh[coef1 + c] = cube[nx + c] + cube[px + c] + cube[ny + c] + cube[py + c] + cube[nz + c] + cube[pz + c];
            sh[coef1 + c] *= 4/17;

            sh[coef2 + c] = -cube[nx + c] + cube[px + c];
            sh[coef2 + c] *= 8/17;

            sh[coef3 + c] = -cube[ny + c] + cube[py + c];
            sh[coef3 + c] *= 8/17;

            sh[coef4 + c] = -cube[nz + c] + cube[pz + c];
            sh[coef4 + c] *= 8/17;
        }

        return sh;*/


        /*var chunks = pc.shaderChunks;
        var fixSeams = chunks.fixCubemapSeamsStretchPS;
        //var shaderC = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, fixSeams + chunks.genShFromCubemapConstPS, "genShC");
        //var shaderL = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, fixSeams + chunks.genShFromCubemapConstPS, "genShL");
        var shader = chunks.createShaderFromCode(device, chunks.fullscreenQuadVS, fixSeams + chunks.genShFromCubemapPS, "genSh");
        var constantTexSource = device.scope.resolve("source");
        var constantParams = device.scope.resolve("params");
        var params;
        var rgbmSource = source.rgbm;

        var cube = new Float32Array(7 * 4);

        var tex = new pc.gfx.Texture(device, {
            rgbm: rgbmSource,
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
            width: 32,
            height: 1,
            autoMipmap: false
        });
        tex.minFilter = pc.FILTER_NEAREST;
        tex.magFilter = pc.FILTER_NEAREST;
        tex.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        tex.addressV = pc.ADDRESS_CLAMP_TO_EDGE;

        var targ = new pc.RenderTarget(device, tex, {
            depth: false
        });

        constantTexSource.setValue(source);
        pc.drawQuadWithShader(device, targ, shader, new pc.Vec4(0,0,17,1));

        return tex;*/
    }


    return {
        prefilterCubemap: prefilterCubemap,
        ambientCubeFromCubemap: ambientCubeFromCubemap,
        shFromCubemap: shFromCubemap,

        TexelCoordSolidAngle: TexelCoordSolidAngle
    };
}()));

