import { expect } from 'chai';
import { restore, spy } from 'sinon';

import { SEMANTIC_POSITION, SEMANTIC_TEXCOORD0, TYPE_FLOAT32 } from '../../../src/platform/graphics/constants.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { VertexFormat } from '../../../src/platform/graphics/vertex-format.js';
import { CameraShaderParams } from '../../../src/scene/camera-shader-params.js';
import {
    BLEND_NONE, BLEND_NORMAL, SHADER_FORWARD, SHADER_PREPASS, SHADERDEF_UV0, TONEMAP_ACES
} from '../../../src/scene/constants.js';
import { LightList } from '../../../src/scene/lighting/light-list.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { ShaderPass } from '../../../src/scene/shader-pass.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// In the outline pass of the OutlineRenderer, the lit shader outputs the outline color instead of
// the lit result, so the standard material renders with the minimal shader of the depth and shadow
// passes, and does not compile a full forward shader per material.
describe('Standard material in the outline pass', function () {

    let app;
    let outlinePass;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        // allocated as by CameraComponent#setShaderPass('pcOutline')
        outlinePass = ShaderPass.get(app.graphicsDevice).allocate('pcOutline', { isForward: true }).index;
    });

    afterEach(function () {
        restore();
        app.destroy();
        jsdomTeardown();
    });

    const createMaterial = (setup) => {
        const material = new StandardMaterial();
        setup?.(material);
        material.update();
        return material;
    };

    const createTexture = () => new Texture(app.graphicsDevice, { width: 4, height: 4 });

    /**
     * @param {StandardMaterial} material - The material.
     * @param {number} pass - The shader pass.
     * @returns {{ shader: object, options: object }} The shader variant of the material for the
     * pass, and a copy of the options it was generated with.
     */
    const getVariant = (material, pass) => {
        const device = app.graphicsDevice;
        let options = null;

        // the options object is shared by the variants, so the values are copied
        material.onUpdateShader = (opts) => {
            options = {
                lights: opts.litOptions.lights.length,
                clusteredLightingEnabled: opts.litOptions.clusteredLightingEnabled,
                blendType: opts.litOptions.blendType,
                alphaTest: opts.litOptions.alphaTest,
                toneMapping: opts.defines.get('TONEMAP'),
                diffuseMap: opts.diffuseMap,
                opacityMap: opts.opacityMap
            };
            return opts;
        };

        const cameraShaderParams = new CameraShaderParams();
        cameraShaderParams.toneMapping = TONEMAP_ACES;

        const shader = material.getShaderVariant({
            device,
            scene: app.scene,
            objDefs: SHADERDEF_UV0,
            pass,
            cameraShaderParams,
            viewUniformFormat: app.renderer.getViewUniformFormat(false, new LightList()),
            vertexFormat: new VertexFormat(device, [
                { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 },
                { semantic: SEMANTIC_TEXCOORD0, components: 2, type: TYPE_FLOAT32 }
            ])
        });

        return { shader, options };
    };

    it('evaluates only the opacity, without lighting and tone mapping', function () {
        const material = createMaterial((m) => {
            m.diffuseMap = createTexture();
            m.blendType = BLEND_NORMAL;
            m.opacity = 0.5;
        });

        const { options } = getVariant(material, outlinePass);

        expect(options.diffuseMap).to.not.equal(true);
        expect(options.lights).to.equal(0);
        expect(options.clusteredLightingEnabled).to.equal(false);
        expect(options.toneMapping).to.equal('NONE');

        // the opacity is only alpha tested, the pass outputs an alpha of 1
        expect(options.blendType).to.equal(BLEND_NONE);

        // the forward pass is unchanged
        const forward = getVariant(material, SHADER_FORWARD).options;
        expect(forward.diffuseMap).to.equal(true);
        expect(forward.toneMapping).to.equal('ACES');
    });

    it('keeps the alpha test of the material', function () {
        const material = createMaterial((m) => {
            m.opacityMap = createTexture();
            m.alphaTest = 0.5;
        });

        const { options } = getVariant(material, outlinePass);

        expect(options.alphaTest).to.equal(true);
        expect(options.opacityMap).to.equal(true);
    });

    it('shares the shader between materials with different surfaces', function () {
        // the shader is processed against the layout of the material, so the materials use the
        // same textures, and differ in the properties the pass skips
        const metal = createMaterial((m) => {
            m.useMetalness = true;
            m.emissive.set(1, 0, 0);
            m.enableGGXSpecular = true;
        });
        const plain = createMaterial();

        expect(getVariant(metal, outlinePass).shader).to.equal(getVariant(plain, outlinePass).shader);
        expect(getVariant(metal, SHADER_FORWARD).shader).to.not.equal(getVariant(plain, SHADER_FORWARD).shader);
    });

    it('does not include the clustered lighting', function () {
        const material = createMaterial((m) => {
            m.diffuseMap = createTexture();
        });
        expect(app.scene.clusteredLightingEnabled).to.equal(true);

        const consoleError = spy(console, 'error');
        const { shader } = getVariant(material, outlinePass);

        expect(consoleError.called).to.equal(false);
        expect(shader.definition.fshader).to.not.contain('addClusteredLights');
        expect(getVariant(material, SHADER_FORWARD).shader.definition.fshader).to.contain('addClusteredLights');
    });

    it('does not change the options of the other minimal passes', function () {
        const create = () => createMaterial((m) => {
            m.blendType = BLEND_NORMAL;
        });
        const before = getVariant(create(), SHADER_PREPASS).options;

        getVariant(create(), outlinePass);

        expect(getVariant(create(), SHADER_PREPASS).options).to.deep.equal(before);
        expect(before.blendType).to.equal(BLEND_NORMAL);
    });
});
