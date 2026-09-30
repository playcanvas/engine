import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// Dynamic refraction scales the refraction by the scale of the model matrix, which the vertex shader
// passes to the fragment shader, so that the fragment shader does not read the matrix_model uniform.
// On WebGPU the matrices of a mesh instance are then only in the mesh instance storage. Under
// `npm run test:webgpu` the WGSL of each shader is compiled by Dawn, and an error fails the test.
describe('Dynamic refraction model scale', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        const camera = new Entity('camera');
        camera.addComponent('camera');
        camera.setPosition(0, 0, 5);
        app.root.addChild(camera);
    });

    afterEach(function () {
        app.destroy();
        jsdomTeardown();
    });

    const forwardShaderOf = (material) => {
        const entity = new Entity('box');
        entity.addComponent('render', { type: 'box', material });
        entity.setLocalScale(1, 2, 3);
        app.root.addChild(entity);
        app.render();

        const shaders = Array.from(entity.render.meshInstances[0]._shaderCache.values()).map(instance => instance.shader);
        const forward = shaders.find(shader => shader.label.includes('forward'));
        expect(forward, 'forward shader').to.exist;
        expect(forward.failed, forward.label).to.equal(false);
        return forward;
    };

    it('passes the scale of the model matrix from the vertex shader', function () {
        const material = new StandardMaterial();
        material.refraction = 0.5;
        material.useDynamicRefraction = true;
        material.update();

        const shader = forwardShaderOf(material);
        const { vshader, fshader } = shader.definition;
        expect(vshader).to.contain('vModelScale');
        expect(fshader).to.contain('vModelScale');
        expect(fshader).not.to.contain('matrix_model');

        // on WebGPU the draw needs no mesh uniforms
        if (app.graphicsDevice.supportsMeshInstanceStorage) {
            expect(shader.usesMeshInstanceStorage).to.equal(true);
            expect(shader.meshUniformBufferEmpty).to.equal(true);
        }
    });

    it('passes no model scale without dynamic refraction', function () {
        const material = new StandardMaterial();
        material.refraction = 0.5;
        material.update();

        expect(forwardShaderOf(material).definition.vshader).not.to.contain('vModelScale');
    });
});
