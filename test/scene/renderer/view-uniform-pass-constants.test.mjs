import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { Entity } from '../../../src/framework/entity.js';
import { SEMANTIC_POSITION } from '../../../src/platform/graphics/constants.js';
import { ShaderProcessorOptions } from '../../../src/platform/graphics/shader-processor-options.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { WebgpuShaderProcessorWGSL } from '../../../src/platform/graphics/webgpu/webgpu-shader-processor-wgsl.js';
import { DITHER_BAYER8, FOG_LINEAR, FOG_NONE, SHADOW_PCSS_32F } from '../../../src/scene/constants.js';
import { LightList } from '../../../src/scene/lighting/light-list.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// The uniforms a pass sets once - per camera, per layer or per shadow face - are part of its view
// uniform buffer, uploaded once per pass, rather than of the mesh uniform buffer of every draw.
describe('View uniform pass constants', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        const camera = new Entity('camera');
        camera.addComponent('camera');
        camera.setPosition(0, 2, 12);
        app.root.addChild(camera);
    });

    afterEach(function () {
        sinon.restore();
        app.destroy();
        jsdomTeardown();
    });

    const addLight = (type, options = {}) => {
        const entity = new Entity(type);
        entity.addComponent('light', { type, castShadows: true, range: 20, ...options });
        entity.setPosition(0, 4, 0);
        entity.setEulerAngles(45, 30, 0);
        app.root.addChild(entity);
    };

    const addBox = (material) => {
        const entity = new Entity('box');
        entity.addComponent('render', { type: 'box', material });
        app.root.addChild(entity);
        return entity.render.meshInstances[0];
    };

    // the WGSL declarations of the uniforms, read by a vertex shader
    const processWGSL = (viewUniformFormat, uniforms) => {
        const source = vertex => `
            ${uniforms.map(([name, type]) => `uniform ${name}: ${type};`).join('\n')}
            @${vertex ? 'vertex' : 'fragment'}
            fn ${vertex ? 'vertexMain(input: VertexInput) -> VertexOutput' : 'fragmentMain(input: FragmentInput) -> FragmentOutput'} {
                var output: ${vertex ? 'VertexOutput' : 'FragmentOutput'};
                ${vertex ? `output.position = vec4f(${uniforms.map(([name, type]) => (type === 'f32' ? `uniform.${name}` : `uniform.${name}.x`)).join(' + ')});` : 'output.color = vec4f(1.0);'}
                return output;
            }
        `;
        const definition = {
            attributes: { vertex_position: SEMANTIC_POSITION },
            vshader: source(true),
            fshader: source(false),
            processingOptions: new ShaderProcessorOptions(viewUniformFormat)
        };
        const shader = { failed: false, name: 'view-uniform-pass-constants' };
        const result = WebgpuShaderProcessorWGSL.run(app.graphicsDevice, definition, shader);
        expect(shader.failed).to.equal(false);
        return result;
    };

    it('reads the camera and fog uniforms of a forward pass from the view uniform buffer', function () {
        const format = app.renderer.getViewUniformFormat(false, new LightList());
        const uniforms = [['camera_params', 'vec4f'], ['blueNoiseJitter', 'vec4f'], ['tbnBasis', 'f32'], ['fog_color', 'vec3f'], ['fog_start', 'f32'], ['fog_end', 'f32'], ['fog_density', 'f32']];
        for (const [name] of uniforms) {
            expect(format.get(name), name).to.exist;
        }

        const result = processWGSL(format, uniforms);
        for (const [name] of uniforms) {
            expect(result.meshUniformBufferFormat.get(name), name).not.to.exist;
            expect(result.vshader, name).to.contain(`ub_view.${name}`);
        }
    });

    it('reads the per-face uniforms of a shadow pass from the view uniform buffer', function () {
        addLight('directional');
        app.render();

        const format = app.renderer.shadowRenderer.viewUniformFormat;
        const uniforms = [['camera_params', 'vec4f'], ['blueNoiseJitter', 'vec4f'], ['view_position', 'vec3f'], ['light_radius', 'f32'], ['textureBias', 'f32']];
        for (const [name] of uniforms) {
            expect(format.get(name), name).to.exist;
        }

        const result = processWGSL(format, uniforms);
        for (const [name] of uniforms) {
            expect(result.meshUniformBufferFormat.get(name), name).not.to.exist;
        }
    });

    it('sets every fog uniform whatever the fog type, so the view uniform buffer never reads an unset value', function () {
        const warn = sinon.spy(Debug, 'warnOnce');
        const scope = app.graphicsDevice.scope;

        app.scene.fog.type = FOG_NONE;
        app.scene.fog.start = 3;
        app.scene.fog.end = 30;
        app.scene.fog.density = 0.25;
        addLight('directional');
        addBox(new StandardMaterial());
        app.render();

        expect(scope.resolve('fog_start').value).to.equal(3);
        expect(scope.resolve('fog_end').value).to.equal(30);
        expect(scope.resolve('fog_density').value).to.equal(0.25);
        expect(scope.resolve('fog_color').value).to.exist;
        expect(scope.resolve('light_radius').value).to.equal(0);

        const unset = warn.args.filter(args => String(args[0]).startsWith('Value was not set'));
        expect(unset.map(args => args[0])).to.deep.equal([]);
    });

    it('sets a zero blue noise jitter for an XR camera, which does not jitter', function () {
        const camera = app.root.findByName('camera').camera.camera;
        camera.jitter = 1;
        camera._xrViews = [];
        const jitter = app.graphicsDevice.scope.resolve('blueNoiseJitter');
        jitter.setValue(new Float32Array([1, 2, 3, 4]));

        app.renderer.setCameraUniforms(camera, null);
        camera._xrViews = null;

        expect(Array.from(jitter.value)).to.deep.equal([0, 0, 0, 0]);
    });

    it('draws fogged, normal mapped, dithered and shadow casting mesh instances with only their matrices per draw', function () {

        // the shaders are processed on WebGPU
        if (!app.graphicsDevice.isWebGPU) {
            this.skip();
        }

        app.scene.fog.type = FOG_LINEAR;
        addLight('directional', { numCascades: 2, shadowDistance: 40 });
        addLight('omni');
        addLight('spot', { shadowType: SHADOW_PCSS_32F });
        const material = new StandardMaterial();
        material.normalMap = new Texture(app.graphicsDevice, { width: 4, height: 4 });
        material.opacity = 0.5;
        material.opacityDither = DITHER_BAYER8;
        material.opacityShadowDither = DITHER_BAYER8;
        material.update();
        const box = addBox(material);
        app.render();

        const shaders = Array.from(box._shaderCache.values()).map(instance => instance.shader);
        expect(shaders.length).to.be.at.least(4);
        for (const shader of shaders) {
            const names = shader.meshUniformBufferFormat.uniforms.map(uniform => uniform.name);
            const expected = shader.label.includes('forward') ? ['matrix_model', 'matrix_normal'] : ['matrix_model'];
            expect(names.sort(), shader.label).to.deep.equal(expected.sort());
        }
    });
});
