import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { Color } from '../../../src/core/math/color.js';
import { Entity } from '../../../src/framework/entity.js';
import { FRESNEL_NONE } from '../../../src/scene/constants.js';
import { LitMaterial } from '../../../src/scene/materials/lit-material.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// The lit shader chunks tint the ambient lighting by litArgs_ambient, which is white unless the
// front end sets it - the front end of a StandardMaterial sets the ambient color of the material.
// Under `npm run test:webgpu` the WGSL of each shader is compiled by Dawn, and an error fails the test.
describe('Lit shader ambient tint', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        const camera = new Entity('camera');
        camera.addComponent('camera');
        camera.setPosition(0, 0, 8);
        app.root.addChild(camera);

        const light = new Entity('light');
        light.addComponent('light', { type: 'directional' });
        app.root.addChild(light);
    });

    afterEach(function () {
        sinon.restore();
        app.destroy();
        jsdomTeardown();
    });

    const addBox = (material, x) => {
        material.update();
        const entity = new Entity();
        entity.addComponent('render', { type: 'box', material });
        entity.setPosition(x, 0, 0);
        app.root.addChild(entity);
        return entity.render.meshInstances[0];
    };

    // the forward shader of a mesh instance, the one combining the lighting
    const forwardShader = (meshInstance) => {
        const shaders = Array.from(meshInstance._shaderCache.values()).map(instance => instance.shader);
        const shader = shaders.find(s => s.definition.fshader.includes('combineColor'));
        expect(shader).to.exist;
        expect(shader.failed).to.equal(false);
        return shader;
    };

    // a LitMaterial front end, with an optional specular setup and extra code
    const litMaterial = (specular = false, extraGLSL = '', extraWGSL = '') => {
        const material = new LitMaterial();
        material.shaderChunkGLSL = `
            #include "litShaderCorePS"
            void evaluateFrontend() {
                litArgs_albedo = vec3(0.5);
                litArgs_opacity = 1.0;
                litArgs_worldNormal = dVertexNormalW;
                ${specular ? 'litArgs_specularity = vec3(0.5); litArgs_specularityFactor = 1.0; litArgs_gloss = 0.5;' : ''}
                ${extraGLSL}
            }`;
        material.shaderChunkWGSL = `
            #include "litShaderCorePS"
            fn evaluateFrontend() {
                litArgs_albedo = vec3f(0.5);
                litArgs_opacity = 1.0;
                litArgs_worldNormal = dVertexNormalW;
                ${specular ? 'litArgs_specularity = vec3f(0.5); litArgs_specularityFactor = 1.0; litArgs_gloss = 0.5;' : ''}
                ${extraWGSL}
            }`;
        return material;
    };

    it('tints the ambient lighting of a StandardMaterial by its ambient color, read by its front end', function () {
        const material = new StandardMaterial();
        material.ambient = new Color(1, 0.5, 0.25);
        const box = addBox(material, 0);
        app.render();

        const source = forwardShader(box).definition.fshader;
        expect(source).to.match(/litArgs_ambient = \S*material_ambient;/);
        expect(material._layout.uniformBufferFormat.get('material_ambient')).to.exist;
    });

    it('draws a LitMaterial with an untinted ambient, reading no uniform of a StandardMaterial', function () {
        const warn = sinon.spy(Debug, 'warnOnce');
        addBox(new StandardMaterial(), -1);
        const lit = addBox(litMaterial(), 1);
        app.render();

        const source = forwardShader(lit).definition.fshader;
        expect(source).to.contain('litArgs_ambient');
        expect(source).not.to.contain('material_ambient');
        const unset = warn.args.filter(args => String(args[0]).startsWith('Value was not set'));
        expect(unset.map(args => args[0])).to.deep.equal([]);
    });

    it('tints the ambient lighting of a LitMaterial by its front end', function () {
        const lit = addBox(litMaterial(false, 'litArgs_ambient = vec3(1.0, 0.0, 0.0);', 'litArgs_ambient = vec3f(1.0, 0.0, 0.0);'), 0);
        app.render();

        expect(forwardShader(lit).definition.fshader).to.match(/litArgs_ambient = vec3f?\(1\.0, 0\.0, 0\.0\);/);
    });

    it('tints the legacy ambient lighting of a LitMaterial without a Fresnel model', function () {
        const material = litMaterial(true);
        material.fresnelModel = FRESNEL_NONE;
        material.hasSpecular = true;
        const lit = addBox(material, 0);
        app.render();

        // the legacy combine replaces the albedo of the ambient lighting by the tint
        expect(forwardShader(lit).definition.fshader).to.match(/\(dDiffuseLight - \S*light_globalAmbient\) \* albedo \+ litArgs_ambient \* \S*light_globalAmbient/);
    });
});
