import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { Entity } from '../../../src/framework/entity.js';
import { LitMaterialOptionsBuilder } from '../../../src/scene/materials/lit-material-options-builder.js';
import { LitMaterial } from '../../../src/scene/materials/lit-material.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { LitShaderOptions } from '../../../src/scene/shader-lib/programs/lit-shader-options.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// The lit shader chunks disperse the refraction by litArgs_dispersion, set by the front end - the
// front end of a StandardMaterial sets the dispersion of the material.
// Under `npm run test:webgpu` the WGSL of each shader is compiled by Dawn, and an error fails the test.
describe('Lit shader dispersion', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

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

    const addBox = (material) => {
        material.update();
        const entity = new Entity();
        entity.addComponent('render', { type: 'box', material });
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

    it('disperses the refraction of a StandardMaterial by its dispersion, read by its front end', function () {
        // the dispersion only applies to the dynamic refraction
        const material = new StandardMaterial();
        material.refraction = 0.5;
        material.useDynamicRefraction = true;
        material.dispersion = 1;
        const box = addBox(material);
        app.render();

        const source = forwardShader(box).definition.fshader;
        expect(source).to.match(/litArgs_dispersion = \S*material_dispersion;/);
        expect(material._layout.uniformBufferFormat.get('material_dispersion')).to.exist;
    });

    it('enables the dispersion of a LitMaterial whose front end provides it', function () {
        const material = new LitMaterial();
        const options = new LitShaderOptions();
        LitMaterialOptionsBuilder.updateMaterialOptions(options, material);
        expect(options.dispersion).to.equal(false);

        material.hasDispersion = true;
        LitMaterialOptionsBuilder.updateMaterialOptions(options, material);
        expect(options.dispersion).to.equal(true);
    });

    it('draws a LitMaterial with dispersion, reading no uniform of a StandardMaterial', function () {
        const warn = sinon.spy(Debug, 'warnOnce');
        const material = new LitMaterial();
        material.hasDispersion = true;
        material.shaderChunkGLSL = `
            #include "litShaderCorePS"
            void evaluateFrontend() {
                litArgs_albedo = vec3(0.5);
                litArgs_opacity = 1.0;
                litArgs_worldNormal = dVertexNormalW;
                litArgs_dispersion = 0.5;
            }`;
        material.shaderChunkWGSL = `
            #include "litShaderCorePS"
            fn evaluateFrontend() {
                litArgs_albedo = vec3f(0.5);
                litArgs_opacity = 1.0;
                litArgs_worldNormal = dVertexNormalW;
                litArgs_dispersion = 0.5;
            }`;
        const box = addBox(material);
        app.render();

        const source = forwardShader(box).definition.fshader;
        expect(source).not.to.contain('material_dispersion');
        const unset = warn.args.filter(args => String(args[0]).startsWith('Value was not set'));
        expect(unset.map(args => args[0])).to.deep.equal([]);
    });
});
