import { expect } from 'chai';
import sinon from 'sinon';

import { Entity } from '../../../src/framework/entity.js';
import { FRESNEL_NONE, LIGHTSHAPE_DISK, LIGHTSHAPE_RECT, LIGHTSHAPE_SPHERE } from '../../../src/scene/constants.js';
import { LitMaterial } from '../../../src/scene/materials/lit-material.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// The clear coat specular of area lights is evaluated with the LTC matrix of the clear coat gloss
// and normal (ccLTCUV), not the one of the base specular layer (dLTCUV). It uses the reflectance of
// the clear coat, as its other lights do, and its strength scales all of its light when combined.
describe('Lit shader clear coat of area lights', function () {

    let app;
    let consoleError;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        consoleError = sinon.spy(console, 'error');

        const camera = new Entity('camera');
        camera.addComponent('camera');
        camera.setPosition(0, 0, 8);
        app.root.addChild(camera);
    });

    afterEach(function () {
        sinon.restore();
        app.destroy();
        jsdomTeardown();
    });

    const addLight = (shape) => {
        const entity = new Entity('light');
        entity.addComponent('light', { type: 'spot', shape });
        app.root.addChild(entity);
    };

    // renders a frame and returns the forward shader of a box with the material, the one combining
    // the lighting
    const materialShader = (material) => {
        const entity = new Entity();
        entity.addComponent('render', { type: 'box', material });
        app.root.addChild(entity);
        const meshInstance = entity.render.meshInstances[0];

        app.render();
        const shaders = Array.from(meshInstance._shaderCache.values(), entry => entry.shader);
        const shader = shaders.find(s => s.definition.fshader.includes('combineColor'));
        expect(shader).to.exist;
        expect(shader.failed).to.equal(false);
        expect(consoleError.called, consoleError.args.join('\n')).to.equal(false);
        return shader.definition.fshader;
    };

    // the forward shader of a standard material with the clear coat
    const forwardShader = (clearCoat) => {
        const material = new StandardMaterial();
        material.clearCoat = clearCoat;
        material.update();
        return materialShader(material);
    };

    // a lit material with a clear coat and no Fresnel model, which the standard material replaces by
    // the Schlick model
    const litNoFresnelShader = () => {
        const material = new LitMaterial();
        material.hasSpecular = true;
        material.hasClearCoat = true;
        material.fresnelModel = FRESNEL_NONE;
        material.shaderChunkGLSL = `
            #include "litShaderCorePS"
            void evaluateFrontend() {
                litArgs_albedo = vec3(0.5);
                litArgs_opacity = 1.0;
                litArgs_worldNormal = dVertexNormalW;
                litArgs_specularity = vec3(0.04);
                litArgs_gloss = 0.5;
                litArgs_clearcoat_specularity = 0.25;
                litArgs_clearcoat_gloss = 0.9;
                litArgs_clearcoat_worldNormal = dVertexNormalW;
            }`;
        material.shaderChunkWGSL = `
            #include "litShaderCorePS"
            fn evaluateFrontend() {
                litArgs_albedo = vec3f(0.5);
                litArgs_opacity = 1.0;
                litArgs_worldNormal = dVertexNormalW;
                litArgs_specularity = vec3f(0.04);
                litArgs_gloss = 0.5;
                litArgs_clearcoat_specularity = 0.25;
                litArgs_clearcoat_gloss = 0.9;
                litArgs_clearcoat_worldNormal = dVertexNormalW;
            }`;
        material.update();
        return materialShader(material);
    };

    // the clear coat specular functions use the clear coat LTC matrix
    const expectClearcoatLTC = (source) => {
        expect(source).to.contain('calcRectLightSpecular(worldNormal, viewDir, ccLTCUV)');
        expect(source).to.contain('calcDiskLightSpecular(worldNormal, viewDir, ccLTCUV)');
    };

    // the area lights use the given reflectance of the clear coat (GLSL or WGSL declaration), and its
    // strength is not replaced by 1 after them, so that it scales all of the clear coat when combined
    const expectClearcoatStrength = (source, reflectance) => {
        expect(source).to.match(new RegExp(`ccLTCReflectance(: f32)? = ${reflectance.replace('.', '\\.')};`));
        expect(source).to.contain('litArgs_clearcoat_worldNormal, ccLTCReflectance);');
        expect(source).not.to.match(/litArgs_clearcoat_specularity = 1/);
    };

    it('uses the clear coat LTC matrix for clustered area lights', function () {
        app.scene.clusteredLightingEnabled = true;
        app.scene.lighting.areaLightsEnabled = true;
        addLight(LIGHTSHAPE_RECT);
        const source = forwardShader(1);

        // the area light lobe loop evaluates the clear coat lobe with its own LTC matrix
        expect(source).to.contain('getLTCLightInvMat(ccLTCUV)');
        expect(source).to.contain('lobeInvMat = areaClearcoatInvMat;');
        expect(source).not.to.contain('LightSpecular(clearcoat_worldNormal');
    });

    it('uses the clear coat LTC matrix for area lights of every shape', function () {
        // WebGPU clusters every local light
        if (app.graphicsDevice.isWebGPU) {
            this.skip();
        }
        app.scene.clusteredLightingEnabled = false;
        addLight(LIGHTSHAPE_RECT);
        addLight(LIGHTSHAPE_DISK);
        addLight(LIGHTSHAPE_SPHERE);
        const source = forwardShader(1);

        expect(source).to.contain('getRectLightSpecularCC(litArgs_clearcoat_worldNormal');
        expect(source).to.contain('getDiskLightSpecularCC(litArgs_clearcoat_worldNormal');
        expect(source).to.contain('getSphereLightSpecularCC(litArgs_clearcoat_worldNormal');
        expect(source).not.to.contain('LightSpecular(litArgs_clearcoat_worldNormal');
        expectClearcoatLTC(source);
    });

    it('applies the clear coat strength with clustered area lights', function () {
        app.scene.clusteredLightingEnabled = true;
        app.scene.lighting.areaLightsEnabled = true;
        addLight(LIGHTSHAPE_RECT);
        expectClearcoatStrength(forwardShader(0.25), '0.04');
    });

    it('applies the clear coat strength with area lights', function () {
        // WebGPU clusters every local light
        if (app.graphicsDevice.isWebGPU) {
            this.skip();
        }
        app.scene.clusteredLightingEnabled = false;
        addLight(LIGHTSHAPE_RECT);
        expectClearcoatStrength(forwardShader(0.25), '0.04');
    });

    it('reflects area lights by the clear coat without Fresnel when the material has no Fresnel model', function () {
        app.scene.clusteredLightingEnabled = true;
        app.scene.lighting.areaLightsEnabled = true;
        addLight(LIGHTSHAPE_RECT);
        expectClearcoatStrength(litNoFresnelShader(), '1.0');
    });

    it('leaves the clear coat LTC matrix out without clear coat', function () {
        app.scene.clusteredLightingEnabled = true;
        app.scene.lighting.areaLightsEnabled = true;
        addLight(LIGHTSHAPE_RECT);
        const source = forwardShader(0);

        expect(source).not.to.contain('ccLTCUV');
    });
});
