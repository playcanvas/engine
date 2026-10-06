import { expect } from 'chai';

import { SEMANTIC_POSITION, TYPE_FLOAT32 } from '../../../src/platform/graphics/constants.js';
import { VertexFormat } from '../../../src/platform/graphics/vertex-format.js';
import { CameraShaderParams } from '../../../src/scene/camera-shader-params.js';
import {
    LIGHTTYPE_DIRECTIONAL, SHADER_FORWARD, SHADER_PICK, SHADER_PREPASS, SHADOW_PCF3_32F, TONEMAP_ACES
} from '../../../src/scene/constants.js';
import { LightList } from '../../../src/scene/lighting/light-list.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { ShaderPass } from '../../../src/scene/shader-pass.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// The depth, shadow and picking passes render the standard material with the minimal options,
// which do not set the tone mapping, as these passes output no lit color.
describe('Standard material tone mapping in the minimal passes', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app.destroy();
        jsdomTeardown();
    });

    /**
     * @param {StandardMaterial} material - The material.
     * @param {number} pass - The shader pass.
     * @returns {string} The TONEMAP define of the shader variant of the material for the pass.
     */
    const getToneMapDefine = (material, pass) => {
        const device = app.graphicsDevice;
        let toneMapping;
        material.onUpdateShader = (options) => {
            toneMapping = options.defines.get('TONEMAP');
            return options;
        };

        const cameraShaderParams = new CameraShaderParams();
        cameraShaderParams.toneMapping = TONEMAP_ACES;

        material.getShaderVariant({
            device,
            scene: app.scene,
            objDefs: 0,
            pass,
            cameraShaderParams,
            viewUniformFormat: app.renderer.getViewUniformFormat(false, new LightList()),
            vertexFormat: new VertexFormat(device, [
                { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 }
            ])
        });

        return toneMapping;
    };

    it('does not tone map the prepass, shadow and picking passes', function () {
        const material = new StandardMaterial();
        material.update();

        // allocated as by the ShadowRenderer for a directional light
        const shadowPass = ShaderPass.get(app.graphicsDevice).allocate('ShadowPass_0_0', {
            isShadow: true,
            lightType: LIGHTTYPE_DIRECTIONAL,
            shadowType: SHADOW_PCF3_32F
        }).index;

        expect(getToneMapDefine(material, SHADER_PREPASS)).to.equal('NONE');
        expect(getToneMapDefine(material, shadowPass)).to.equal('NONE');
        expect(getToneMapDefine(material, SHADER_PICK)).to.equal('NONE');

        // the forward pass uses the tone mapping of the camera
        expect(getToneMapDefine(material, SHADER_FORWARD)).to.equal('ACES');
    });

});
