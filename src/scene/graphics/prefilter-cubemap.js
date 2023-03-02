import { Debug } from '../../core/debug.js';
import { Vec3 } from '../../core/math/vec3.js';

import {
    PIXELFORMAT_RGBA8, TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBM
} from '../../platform/graphics/constants.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { drawQuadWithShader } from './quad-render-utils.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { BlendState } from '../../platform/graphics/blend-state.js';

// https://seblagarde.wordpress.com/2012/06/10/amd-cubemapgen-for-physically-based-rendering/
function areaElement(x, y) {
    return Math.atan2(x * y, Math.sqrt(x * x + y * y + 1));
}

function texelCoordSolidAngle(u, v, size) {
    // Scale up to [-1, 1] range (inclusive), offset by 0.5 to point to texel center.
    let _u = (2.0 * (u + 0.5) / size) - 1.0;
    let _v = (2.0 * (v + 0.5) / size) - 1.0;

    // fixSeams
    _u *= 1.0 - 1.0 / size;
    _v *= 1.0 - 1.0 / size;

    const invResolution = 1.0 / size;

    // U and V are the -1..1 texture coordinate on the current face.
    // Get projected area for this texel
    const x0 = _u - invResolution;
    const y0 = _v - invResolution;
    const x1 = _u + invResolution;
    const y1 = _v + invResolution;
    let solidAngle = areaElement(x0, y0) - areaElement(x0, y1) - areaElement(x1, y0) + areaElement(x1, y1);

    // fixSeams cut
    if ((u === 0 && v === 0) || (u === size - 1 && v === 0) || (u === 0 && v === size - 1) || (u === size - 1 && v === size - 1)) {
        solidAngle /= 3;
    } else if (u === 0 || v === 0 || u === size - 1 || v === size - 1) {
        solidAngle *= 0.5;
    }

    return solidAngle;
}

function shFromCubemap(device, source, dontFlipX) {
    if (source.format !== PIXELFORMAT_RGBA8) {
        Debug.error("ERROR: SH: cubemap must be RGBA8");
        return null;
    }
    if (!source._levels[0] || !source._levels[0][0]) {
        Debug.error("ERROR: SH: cubemap must be synced to CPU");
        return null;
    }

    const cubeSize = source.width;

    if (!source._levels[0][0].length) {
        // Cubemap is not composed of arrays
        if (source._levels[0][0] instanceof HTMLImageElement) {
            // Cubemap is made of imgs - convert to arrays
            const shader = createShaderFromCode(device,
                                                shaderChunks.fullscreenQuadVS,
                                                shaderChunks.fullscreenQuadPS,
                                                "fsQuadSimple");
            const constantTexSource = device.scope.resolve("source");
            for (let face = 0; face < 6; face++) {
                const img = source._levels[0][face];

                const tex = new Texture(device, {
                    name: 'prefiltered-cube',
                    cubemap: false,
                    type: TEXTURETYPE_DEFAULT,
                    format: source.format,
                    width: cubeSize,
                    height: cubeSize,
                    mipmaps: false
                });
                tex._levels[0] = img;
                tex.upload();

                const tex2 = new Texture(device, {
                    name: 'prefiltered-cube',
                    cubemap: false,
                    type: TEXTURETYPE_DEFAULT,
                    format: source.format,
                    width: cubeSize,
                    height: cubeSize,
                    mipmaps: false
                });

                const targ = new RenderTarget({
                    colorBuffer: tex2,
                    depth: false
                });
                constantTexSource.setValue(tex);
                device.setBlendState(BlendState.DEFAULT);
                drawQuadWithShader(device, targ, shader);

                const gl = device.gl;
                gl.bindFramebuffer(gl.FRAMEBUFFER, targ.impl._glFrameBuffer);

                const pixels = new Uint8Array(cubeSize * cubeSize * 4);
                gl.readPixels(0, 0, tex.width, tex.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

                source._levels[0][face] = pixels;
            }
        } else {
            Debug.error("ERROR: SH: cubemap must be composed of arrays or images");
            return null;
        }
    }

    const dirs = [];
    for (let y = 0; y < cubeSize; y++) {
        for (let x = 0; x < cubeSize; x++) {
            const u = (x / (cubeSize - 1)) * 2 - 1;
            const v = (y / (cubeSize - 1)) * 2 - 1;
            dirs[y * cubeSize + x] = new Vec3(u, v, 1.0).normalize();
        }
    }

    const sh = new Float32Array(9 * 3);
    const coef1 = 0;
    const coef2 = 1 * 3;
    const coef3 = 2 * 3;
    const coef4 = 3 * 3;
    const coef5 = 4 * 3;
    const coef6 = 5 * 3;
    const coef7 = 6 * 3;
    const coef8 = 7 * 3;
    const coef9 = 8 * 3;

    const nx = 0;
    const px = 1;
    const ny = 2;
    const py = 3;
    const nz = 4;
    const pz = 5;

    let accum = 0;

    for (let face = 0; face < 6; face++) {
        for (let y = 0; y < cubeSize; y++) {
            for (let x = 0; x < cubeSize; x++) {

                const addr = y * cubeSize + x;
                const weight = texelCoordSolidAngle(x, y, cubeSize);

                // http://home.comcast.net/~tom_forsyth/blog.wiki.html#[[Spherical%20Harmonics%20in%20Actual%20Games%20notes]]
                const weight1 = weight * 4 / 17;
                const weight2 = weight * 8 / 17;
                const weight3 = weight * 15 / 17;
                const weight4 = weight * 5 / 68;
                const weight5 = weight * 15 / 68;

                const dir = dirs[addr];

                let dx, dy, dz;
                if (face === nx) {
                    dx = dir.z;
                    dy = -dir.y;
                    dz = -dir.x;
                } else if (face === px) {
                    dx = -dir.z;
                    dy = -dir.y;
                    dz = dir.x;
                } else if (face === ny) {
                    dx = dir.x;
                    dy = dir.z;
                    dz = dir.y;
                } else if (face === py) {
                    dx = dir.x;
                    dy = -dir.z;
                    dz = -dir.y;
                } else if (face === nz) {
                    dx = dir.x;
                    dy = -dir.y;
                    dz = dir.z;
                } else if (face === pz) {
                    dx = -dir.x;
                    dy = -dir.y;
                    dz = -dir.z;
                }

                if (!dontFlipX) dx = -dx; // flip original cubemap x instead of doing it at runtime

                const a = source._levels[0][face][addr * 4 + 3] / 255.0;

                for (let c = 0; c < 3; c++) {
                    let value =  source._levels[0][face][addr * 4 + c] / 255.0;
                    if (source.type === TEXTURETYPE_RGBM) {
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

    for (let c = 0; c < sh.length; c++) {
        sh[c] *= 4 * Math.PI / accum;
    }

    return sh;
}

export { shFromCubemap };
