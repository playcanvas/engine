import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { Entity } from '../../../src/framework/entity.js';
import { BINDGROUP_VIEW, SEMANTIC_POSITION } from '../../../src/platform/graphics/constants.js';
import { ShaderProcessorGLSL } from '../../../src/platform/graphics/shader-processor-glsl.js';
import { ShaderProcessorOptions } from '../../../src/platform/graphics/shader-processor-options.js';
import { WebglShaderProcessorGLSL } from '../../../src/platform/graphics/webgl/webgl-shader-processor-glsl.js';
import { WebgpuShaderProcessorWGSL } from '../../../src/platform/graphics/webgpu/webgpu-shader-processor-wgsl.js';
import { LightList } from '../../../src/scene/lighting/light-list.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// The uniforms of the lights of a pass are constant for the pass, so they travel in the view
// uniform buffer, uploaded once per pass, instead of in the per-draw mesh uniform buffer. The
// format of that buffer follows the light layout of the pass, and the shader processors route
// every light uniform a shader declares into it.

// light0_color and the cascade palette are provided by the view uniform buffer, uMeshValue stays
// a mesh uniform
const glslSource = `
    uniform vec3 light0_color;
    uniform mat4 light0_shadowMatrixPalette[4];
    uniform float uMeshValue;
    void main() {
        gl_Position = light0_shadowMatrixPalette[1] * vec4(light0_color, uMeshValue);
    }
`;

const wgslSource = vertex => `
    uniform light0_color: vec3f;
    uniform light0_shadowMatrixPalette: array<mat4x4f, 4>;
    uniform uMeshValue: f32;
    @${vertex ? 'vertex' : 'fragment'}
    fn ${vertex ? 'vertexMain(input: VertexInput) -> VertexOutput' : 'fragmentMain(input: FragmentInput) -> FragmentOutput'} {
        var output: ${vertex ? 'VertexOutput' : 'FragmentOutput'};
        output.${vertex ? 'position' : 'color'} = uniform.light0_shadowMatrixPalette[1] * vec4f(uniform.light0_color, uniform.uMeshValue);
        return output;
    }
`;

describe('View uniform format with lights', function () {

    let app;

    const addLight = (name, options) => {
        const entity = new Entity(name);
        entity.addComponent('light', options);
        app.root.addChild(entity);
        return entity.light.light;
    };

    const listOf = (lights, clustered) => {
        const list = new LightList();
        list.update(lights, clustered);
        return list;
    };

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app.destroy();
        jsdomTeardown();
    });

    it('carries the uniforms of each light at its slot, the shadow ones only for a caster', function () {
        const caster = addLight('caster', { type: 'directional', castShadows: true });
        const plain = addLight('plain', { type: 'directional' });
        const list = listOf([plain, caster], true);
        const casterSlot = list.slots.indexOf(caster);
        const plainSlot = list.slots.indexOf(plain);
        expect(casterSlot).to.be.at.least(0);
        expect(plainSlot).to.be.at.least(0);

        const format = app.renderer.getViewUniformFormat(true, list);
        expect(format.get('matrix_viewProjection')).to.exist;
        expect(format.get('light_globalAmbient')).to.exist;
        expect(format.get(`light${casterSlot}_color`)).to.exist;
        expect(format.get(`light${casterSlot}_direction`)).to.exist;
        expect(format.get(`light${casterSlot}_shadowMatrix`)).to.exist;
        expect(format.get(`light${casterSlot}_shadowParams`)).to.exist;
        expect(format.get(`light${plainSlot}_color`)).to.exist;
        expect(format.get(`light${plainSlot}_shadowMatrix`)).not.to.exist;
        expect(format.get(`light${plainSlot}_shadowParams`)).not.to.exist;
        expect(format.get('light2_color')).not.to.exist;
    });

    it('finds an array uniform by its declared name and by its scope name', function () {
        const caster = addLight('caster', { type: 'directional', castShadows: true });
        const format = app.renderer.getViewUniformFormat(true, listOf([caster], true));

        const palette = format.get('light0_shadowMatrixPalette');
        expect(palette).to.exist;
        expect(palette.count).to.equal(4);
        expect(format.get('light0_shadowMatrixPalette[0]')).to.equal(palette);
    });

    it('gives local lights their uniforms only when clustered lighting is disabled', function () {
        const omni = addLight('omni', { type: 'omni', castShadows: true });
        const spot = addLight('spot', { type: 'spot' });
        const lights = [omni, spot];

        const clustered = app.renderer.getViewUniformFormat(true, listOf(lights, true));
        // no slot light - light_globalAmbient is a scene constant that is always present
        expect(clustered.uniforms.some(u => /^light\d+_/.test(u.name))).to.equal(false);

        const list = listOf(lights, false);
        const omniSlot = list.slots.indexOf(omni);
        const spotSlot = list.slots.indexOf(spot);
        const format = app.renderer.getViewUniformFormat(false, list);
        expect(format.get(`light${omniSlot}_position`)).to.exist;
        expect(format.get(`light${omniSlot}_radius`)).to.exist;
        expect(format.get(`light${omniSlot}_shadowParams`)).to.exist;
        // omni shadows do not use the shadow matrix
        expect(format.get(`light${omniSlot}_shadowMatrix`)).not.to.exist;
        expect(format.get(`light${spotSlot}_direction`)).to.exist;
        expect(format.get(`light${spotSlot}_innerConeAngle`)).to.exist;
        expect(format.get(`light${spotSlot}_outerConeAngle`)).to.exist;
        expect(format.get(`light${spotSlot}_shadowParams`)).not.to.exist;
    });

    it('keeps one set of slot uniforms per slot index, whatever the layout', function () {
        const a = addLight('a', { type: 'directional' });
        const b = addLight('b', { type: 'directional', castShadows: true });

        const slot0 = app.renderer.getLightSlotUniforms(0);
        expect(slot0.color.name).to.equal('light0_color');
        expect(slot0.shadowMatrixPalette.name).to.equal('light0_shadowMatrixPalette[0]');

        // two layouts, two formats, the same slot instances behind them
        app.renderer.getViewUniformFormat(true, listOf([a], true));
        app.renderer.getViewUniformFormat(true, listOf([a, b], true));
        expect(app.renderer.getLightSlotUniforms(0)).to.equal(slot0);
        expect(app.renderer._lightSlotUniforms).to.have.lengthOf(2);

        // and the dispatch writes through the same instances
        const list = listOf([a, b], true);
        app.renderer.dispatchLights(list, new Entity().addComponent('camera').camera);
        expect(slot0.color.value).to.equal(list.slots[0]._colorLinear);
        expect(app.renderer.getLightSlotUniforms(1).color.value).to.equal(list.slots[1]._colorLinear);
    });

    it('is cached by the light layout and the clustered lighting mode', function () {
        const a = addLight('a', { type: 'directional' });
        const b = addLight('b', { type: 'directional', castShadows: true });

        const first = app.renderer.getViewUniformFormat(true, listOf([a], true));
        expect(app.renderer.getViewUniformFormat(true, listOf([a], true))).to.equal(first);
        expect(app.renderer.getViewUniformFormat(true, listOf([a, b], true))).not.to.equal(first);

        // clustered lighting adds its parameters, so the two modes are distinct formats
        const nonClustered = app.renderer.getViewUniformFormat(false, listOf([a], false));
        expect(nonClustered).not.to.equal(first);
        expect(first.get('clusterMaxCells')).to.exist;
        expect(nonClustered.get('clusterMaxCells')).not.to.exist;
    });

    describe('shader processing', function () {

        let processingOptions;

        beforeEach(function () {
            const caster = addLight('caster', { type: 'directional', castShadows: true });
            processingOptions = new ShaderProcessorOptions(app.renderer.getViewUniformFormat(true, listOf([caster], true)));
        });

        it('warns when a shader declares a light uniform the view format does not carry', function () {
            const message = 'Light uniform \'light1_color\' is not part of the view uniform buffer format and is uploaded per draw. Add it to LightSlotUniforms#appendFormats.';
            Debug._loggedMessages.delete(message);
            const warn = sinon.stub(console, 'warn');
            try {
                const definition = {
                    attributes: { vertex_position: SEMANTIC_POSITION },
                    vshader: glslSource.replace(/light0_/g, 'light1_'),
                    fshader: glslSource.replace(/light0_/g, 'light1_').replace('gl_Position', 'gl_FragColor'),
                    processingOptions
                };
                const shader = { failed: false, name: 'view-lights-test' };
                const result = ShaderProcessorGLSL.run(app.graphicsDevice, definition, shader);
                expect(result.meshUniformBufferFormat.get('light1_color')).to.exist;
                expect(warn.calledWith(message)).to.equal(true);
            } finally {
                warn.restore();
                Debug._loggedMessages.delete(message);
            }
        });

        it('reports the light uniforms as provided by the view bind group, arrays included', function () {
            expect(processingOptions.getUniformBindGroup('light0_color')).to.equal(BINDGROUP_VIEW);
            expect(processingOptions.getUniformBindGroup('light0_shadowMatrixPalette')).to.equal(BINDGROUP_VIEW);
            expect(processingOptions.getUniformBindGroup('light1_color')).to.equal(-1);
            expect(processingOptions.getUniformBindGroup('uMeshValue')).to.equal(-1);
        });

        it('WGSL reads the light uniforms from the view block and keeps the rest in the mesh block', function () {
            const definition = {
                attributes: { vertex_position: SEMANTIC_POSITION },
                vshader: wgslSource(true),
                fshader: wgslSource(false),
                processingOptions
            };
            const shader = { failed: false, name: 'view-lights-test' };
            const result = WebgpuShaderProcessorWGSL.run(app.graphicsDevice, definition, shader);
            expect(shader.failed).to.equal(false);
            expect(result.vshader).to.contain('ub_view.light0_color');
            expect(result.vshader).to.contain('ub_view.light0_shadowMatrixPalette[1]');
            expect(result.vshader).to.contain('ub_mesh_ub.uMeshValue');
            expect(result.meshUniformBufferFormat.get('light0_color')).not.to.exist;
            expect(result.meshUniformBufferFormat.get('light0_shadowMatrixPalette')).not.to.exist;
            expect(result.meshUniformBufferFormat.get('uMeshValue')).to.exist;
        });

        it('GLSL for WebGPU declares the light uniforms in the view block only', function () {
            const definition = {
                attributes: { vertex_position: SEMANTIC_POSITION },
                vshader: glslSource,
                fshader: glslSource.replace('gl_Position', 'gl_FragColor'),
                processingOptions
            };
            const shader = { failed: false, name: 'view-lights-test' };
            const result = ShaderProcessorGLSL.run(app.graphicsDevice, definition, shader);
            expect(shader.failed).to.equal(false);
            expect(result.vshader).to.contain(`layout(set = ${BINDGROUP_VIEW}, binding = 0, std140) uniform ub_view {`);
            expect(result.vshader).to.contain('mat4 light0_shadowMatrixPalette[4];');
            expect(result.vshader).not.to.contain('uniform vec3 light0_color;');
            expect(result.meshUniformBufferFormat.get('light0_color')).not.to.exist;
            expect(result.meshUniformBufferFormat.get('light0_shadowMatrixPalette')).not.to.exist;
            expect(result.meshUniformBufferFormat.get('uMeshValue')).to.exist;
        });

        it('WebGL2 declares the light uniforms in the view block and keeps the rest individual', function () {
            const definition = {
                attributes: { vertex_position: SEMANTIC_POSITION },
                vshader: glslSource,
                fshader: glslSource.replace('gl_Position', 'gl_FragColor'),
                processingOptions
            };
            const shader = { failed: false, name: 'view-lights-test' };
            const result = WebglShaderProcessorGLSL.run(app.graphicsDevice, definition, shader);
            expect(shader.failed).to.equal(false);
            expect(result.vshader).to.contain('layout(std140) uniform ub_view {');
            expect(result.vshader).to.contain('mat4 light0_shadowMatrixPalette[4];');
            expect(result.vshader).not.to.contain('uniform vec3 light0_color;');
            expect(result.vshader).not.to.contain('uniform mat4 light0_shadowMatrixPalette[4];');
            expect(result.vshader).to.contain('uniform float uMeshValue;');
        });
    });
});
