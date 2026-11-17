import { expect } from 'chai';

import { Application } from '../../../src/framework/application.js';
import {
    SEMANTIC_POSITION, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL, TYPE_FLOAT32
} from '../../../src/platform/graphics/constants.js';
import { NullGraphicsDevice } from '../../../src/platform/graphics/null/null-graphics-device.js';
import { VertexFormat } from '../../../src/platform/graphics/vertex-format.js';
import { CameraShaderParams } from '../../../src/scene/camera-shader-params.js';
import { SHADER_FORWARD } from '../../../src/scene/constants.js';
import { LightList } from '../../../src/scene/lighting/light-list.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { setTestShaderLanguage } from '../../device.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// The engine generates its shaders in the language of the device. The null device defaults to GLSL,
// and tests can switch it to WGSL to check the shaders generated for WebGPU.
describe('NullGraphicsDevice shader language', function () {

    let app;

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    /**
     * @returns {NullGraphicsDevice} The device of a new application.
     */
    const createDevice = () => {
        jsdomSetup();
        const canvas = document.createElement('canvas');
        const graphicsDevice = new NullGraphicsDevice(canvas);
        app = new Application(canvas, { graphicsDevice });
        return graphicsDevice;
    };

    /**
     * @param {NullGraphicsDevice} device - The device.
     * @returns {import('../../../src/platform/graphics/shader.js').Shader} The forward pass shader
     * of a standard material.
     */
    const getForwardShader = (device) => {
        const material = new StandardMaterial();
        material.update();
        return material.getShaderVariant({
            device,
            scene: app.scene,
            objDefs: 0,
            pass: SHADER_FORWARD,
            cameraShaderParams: new CameraShaderParams(),
            viewUniformFormat: app.renderer.getViewUniformFormat(false, new LightList()),
            vertexFormat: new VertexFormat(device, [
                { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 }
            ])
        });
    };

    it('generates GLSL by default', function () {
        const device = createDevice();
        expect(device.shaderLanguage).to.equal(SHADERLANGUAGE_GLSL);
        expect(getForwardShader(device).definition.shaderLanguage).to.equal(SHADERLANGUAGE_GLSL);
    });

    it('generates WGSL when set to WGSL', function () {
        const device = createDevice();
        setTestShaderLanguage(device, SHADERLANGUAGE_WGSL);
        expect(device.shaderLanguage).to.equal(SHADERLANGUAGE_WGSL);

        const definition = getForwardShader(device).definition;
        expect(definition.shaderLanguage).to.equal(SHADERLANGUAGE_WGSL);
        expect(definition.fshader).to.include('@fragment');
        expect(definition.vshader).to.include('@vertex');
    });
});
