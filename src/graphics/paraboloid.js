import { math } from '../math/math.js';
import { Vec4 } from '../math/vec4.js';

import { createShaderFromCode } from './program-lib/utils.js';
import { drawQuadWithShader } from './simple-post-effect.js';
import { shaderChunks } from './program-lib/chunks/chunks.js';
import { RenderTarget } from './render-target.js';
import { Texture } from './texture.js';

const dpMult = 2.0;

function paraboloidFromCubemap(device, sourceCubemap, fixSeamsAmount, dontFlipX) {
    const seamsCode = sourceCubemap.fixCubemapSeams ? shaderChunks.fixCubemapSeamsStretchPS : shaderChunks.fixCubemapSeamsNonePS;
    const shader = createShaderFromCode(device,
                                        shaderChunks.fullscreenQuadVS,
                                        seamsCode + shaderChunks.genParaboloidPS,
                                        "genParaboloid");
    const constantTexSource = device.scope.resolve("source");
    const constantParams = device.scope.resolve("params");
    const params = new Float32Array(4);
    let size = sourceCubemap.width;
    const format = sourceCubemap.format;

    size = Math.max(size, 8) * dpMult;

    const tex = new Texture(device, {
        type: sourceCubemap.type,
        format: format,
        width: size * 2,
        height: size,
        mipmaps: false
    });
    tex.name = 'paraboloid';

    const targ = new RenderTarget({
        colorBuffer: tex,
        depth: false
    });

    params[0] = fixSeamsAmount;
    params[1] = dontFlipX ? -1.0 : 1.0;
    constantTexSource.setValue(sourceCubemap);
    constantParams.setValue(params);
    drawQuadWithShader(device, targ, shader);

    return tex;
}

function getDpAtlasRect(rect, mip) {

    rect.x = math.clamp(mip - 2.0, 0, 1) * 0.5;

    const t = mip - rect.x * 6.0;
    const i = 1.0 - rect.x;
    rect.y = Math.min(t * 0.5, 0.75) * i + rect.x;

    rect.z = (1.0 - math.clamp(t, 0, 1) * 0.5) * i;
    rect.w = rect.z * 0.5;

    return 1.0 / rect.z;
}

function generateDpAtlas(device, sixCubemaps, dontFlipX) {
    let dp;
    const rect = new Vec4();
    const params = new Float32Array(4);
    const size = sixCubemaps[0].width * 2 * dpMult;

    const shader = createShaderFromCode(device,
                                        shaderChunks.fullscreenQuadVS,
                                        shaderChunks.dpAtlasQuadPS,
                                        "dpAtlasQuad");
    const constantTexSource = device.scope.resolve("source");
    const constantParams = device.scope.resolve("params");

    const tex = new Texture(device, {
        type: sixCubemaps[0].type,
        format: sixCubemaps[0].format,
        width: size,
        height: size,
        mipmaps: false
    });
    tex.name = 'paraboloid';
    const targ = new RenderTarget({
        colorBuffer: tex,
        depth: false
    });

    const borderSize = 2; // 1 pixel from each side
    const mip0Width = size;
    const scaleFactor = (mip0Width + borderSize) / mip0Width - 1;
    let scaleAmount;
    for (let i = 0; i < 6; i++) {
        dp = paraboloidFromCubemap(device, sixCubemaps[i], i, dontFlipX);
        constantTexSource.setValue(dp);
        scaleAmount = getDpAtlasRect(rect, i);
        params[0] = scaleAmount * scaleFactor;
        params[1] = params[0] * 2;
        params[0] += 1;
        params[1] += 1;
        constantParams.setValue(params);
        rect.x *= size;
        rect.y *= size;
        rect.z *= size;
        rect.w *= size;
        drawQuadWithShader(device, targ, shader, rect);
    }

    return tex;
}

export { paraboloidFromCubemap, generateDpAtlas };
