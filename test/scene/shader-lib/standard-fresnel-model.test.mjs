import { expect } from 'chai';
import { spy } from 'sinon';

import {
    SEMANTIC_NORMAL, SEMANTIC_POSITION, TYPE_FLOAT32
} from '../../../src/platform/graphics/constants.js';
import { VertexFormat } from '../../../src/platform/graphics/vertex-format.js';
import { CameraShaderParams } from '../../../src/scene/camera-shader-params.js';
import {
    FRESNEL_NONE, FRESNEL_SCHLICK, LIGHTTYPE_DIRECTIONAL, SHADER_FORWARD, SHADOW_PCF3_32F
} from '../../../src/scene/constants.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { standard } from '../../../src/scene/shader-lib/programs/standard.js';
import { ShaderPass } from '../../../src/scene/shader-pass.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// The standard material does not support FRESNEL_NONE, and uses the Schlick model in its place.
// The options the shader is generated from are shared by all materials, so the substitution must
// happen before their key is generated - a value changed after it would change the key of the next
// shader generated with the same options.
describe('Standard material fresnel model', function () {

    let app;
    let generateKey;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        // the clustered lighting shader chunks are registered by the renderer, which does not run
        // in these tests - disable clustered lighting so they are not required
        app.scene.clusteredLightingEnabled = false;

        generateKey = spy(standard, 'generateKey');
    });

    afterEach(function () {
        generateKey.restore();
        app.destroy();
        app = null;
        jsdomTeardown();
    });

    /**
     * @param {StandardMaterial} material - The material.
     * @param {number} pass - The shader pass.
     * @returns {import('../../../src/platform/graphics/shader.js').Shader} The shader variant.
     */
    const getShader = (material, pass) => {
        const device = app.graphicsDevice;
        return material.getShaderVariant({
            device,
            scene: app.scene,
            objDefs: 0,
            pass,
            cameraShaderParams: new CameraShaderParams(),
            vertexFormat: new VertexFormat(device, [
                { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 },
                { semantic: SEMANTIC_NORMAL, components: 3, type: TYPE_FLOAT32 }
            ])
        });
    };

    /**
     * @returns {StandardMaterial} A material with the default properties.
     */
    const createMaterial = () => {
        const material = new StandardMaterial();
        material.update();
        return material;
    };

    it('generates the same key for identical materials in a minimal pass', function () {

        // allocated as by the ShadowRenderer for a directional light
        const shadowPass = ShaderPass.get(app.graphicsDevice).allocate('ShadowPass_0_0', {
            isShadow: true,
            lightType: LIGHTTYPE_DIRECTIONAL,
            shadowType: SHADOW_PCF3_32F
        }).index;

        // the minimal options do not set the fresnel model, so they hold the default of the lit
        // options, as they do before the first shader is generated with them
        standard.optionsContextMin.litOptions.fresnelModel = FRESNEL_NONE;

        getShader(createMaterial(), shadowPass);
        getShader(createMaterial(), shadowPass);

        expect(generateKey.callCount).to.equal(2);
        expect(generateKey.returnValues[1]).to.equal(generateKey.returnValues[0]);
    });

    it('renders FRESNEL_NONE with the Schlick model', function () {
        const none = createMaterial();
        none.fresnelModel = FRESNEL_NONE;
        none.update();

        const schlick = createMaterial();
        schlick.fresnelModel = FRESNEL_SCHLICK;
        schlick.update();

        expect(getShader(none, SHADER_FORWARD)).to.equal(getShader(schlick, SHADER_FORWARD));
    });
});
