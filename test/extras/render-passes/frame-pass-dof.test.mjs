import { expect } from 'chai';

import { FramePassDof } from '../../../src/extras/render-passes/frame-pass-dof.js';
import { PIXELFORMAT_RGBA16F, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../../src/platform/graphics/constants.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { CameraShaderParams } from '../../../src/scene/camera-shader-params.js';
import { setProgramLibrary } from '../../../src/scene/shader-lib/get-program-library.js';
import { shaderChunksGLSL } from '../../../src/scene/shader-lib/glsl/collections/shader-chunks-glsl.js';
import { ProgramLibrary } from '../../../src/scene/shader-lib/program-library.js';
import { ShaderChunks } from '../../../src/scene/shader-lib/shader-chunks.js';
import { shaderChunksWGSL } from '../../../src/scene/shader-lib/wgsl/collections/shader-chunks-wgsl.js';
import { createGraphicsDevice } from '../../device.mjs';

describe('FramePassDof', function () {

    /** @type {import('../../../src/platform/graphics/graphics-device.js').GraphicsDevice} */
    let device;

    /** @type {FramePassDof} */
    let pass;

    /** @type {Texture} */
    let sceneTexture;

    /** @type {Texture} */
    let sceneTextureHalf;

    // the circle of confusion pass reads only the camera's shader parameters when it is created
    const cameraComponent = { shaderParams: new CameraShaderParams() };

    const createTexture = (name, width, height) => new Texture(device, {
        name,
        width,
        height,
        format: PIXELFORMAT_RGBA16F,
        mipmaps: false
    });

    // replaces the far pass' quad with one recording the texture its draw samples
    const recordFarDraw = () => {
        const draw = {};
        pass.farPass.quadRender = {
            render: () => {
                draw.texture = device.scope.resolve('sourceTexture').value;
            },
            destroy: () => {}
        };
        return draw;
    };

    beforeEach(function () {
        device = createGraphicsDevice({ width: 128, height: 128 });

        // the passes compile shaders, which an app would have set the device up for
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).add(shaderChunksGLSL);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).add(shaderChunksWGSL);
        setProgramLibrary(device, new ProgramLibrary(device));

        sceneTexture = createTexture('Scene', 64, 64);
        sceneTextureHalf = createTexture('SceneHalf', 32, 32);
    });

    afterEach(function () {
        pass?.destroy();
        pass = null;
        device?.destroy();
        device = null;
    });

    it('blurs the scene texture it is given when high quality', function () {
        pass = new FramePassDof(device, cameraComponent, sceneTexture, sceneTextureHalf, true, false);
        const draw = recordFarDraw();

        // with TAA enabled, the camera frame gives it the TAA output
        const taaTexture = createTexture('TaaHistory', 64, 64);
        pass.setSceneTexture(taaTexture);
        pass.farPass.execute();

        expect(draw.texture).to.equal(taaTexture);
    });

    it('keeps blurring the half resolution scene texture when low quality', function () {
        pass = new FramePassDof(device, cameraComponent, sceneTexture, sceneTextureHalf, false, false);
        const draw = recordFarDraw();

        // the camera frame keeps the half resolution texture up to date itself
        pass.setSceneTexture(createTexture('TaaHistory', 64, 64));
        pass.farPass.execute();

        expect(draw.texture).to.equal(sceneTextureHalf);
    });
});
