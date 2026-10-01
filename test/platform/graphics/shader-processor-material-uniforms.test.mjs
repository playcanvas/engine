import { expect } from 'chai';

import { BINDGROUP_MATERIAL, SEMANTIC_POSITION } from '../../../src/platform/graphics/constants.js';
import { ShaderProcessorGLSL } from '../../../src/platform/graphics/shader-processor-glsl.js';
import { ShaderProcessorOptions } from '../../../src/platform/graphics/shader-processor-options.js';
import { WebglShaderProcessorGLSL } from '../../../src/platform/graphics/webgl/webgl-shader-processor-glsl.js';
import { WebgpuShaderProcessorWGSL } from '../../../src/platform/graphics/webgpu/webgpu-shader-processor-wgsl.js';
import { LightList } from '../../../src/scene/lighting/light-list.js';
import { getMaterialLayout } from '../../../src/scene/materials/material-uniform-buffer-layout.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// material_diffuse is provided by the material uniform buffer, uMeshValue stays a mesh uniform
const glslSource = `
    uniform vec3 material_diffuse;
    uniform float uMeshValue;
    void main() {
        gl_Position = vec4(material_diffuse, uMeshValue);
    }
`;

const wgslSource = vertex => `
    uniform material_diffuse: vec3f;
    uniform uMeshValue: f32;
    @${vertex ? 'vertex' : 'fragment'}
    fn ${vertex ? 'vertexMain(input: VertexInput) -> VertexOutput' : 'fragmentMain(input: FragmentInput) -> FragmentOutput'} {
        var output: ${vertex ? 'VertexOutput' : 'FragmentOutput'};
        output.${vertex ? 'position' : 'color'} = vec4f(uniform.material_diffuse, uniform.uMeshValue);
        return output;
    }
`;

describe('Material uniform buffer shader processing', function () {

    let app;
    let processingOptions;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        processingOptions = new ShaderProcessorOptions(app.renderer.getViewUniformFormat(false, new LightList()));
        const layout = getMaterialLayout(app.graphicsDevice, new StandardMaterial().propertyDescriptors);
        processingOptions.uniformFormats[BINDGROUP_MATERIAL] = layout.uniformBufferFormat;
    });

    afterEach(function () {
        app.destroy();
        jsdomTeardown();
    });

    it('reports the bind group of a uniform', function () {
        expect(processingOptions.getUniformBindGroup('material_diffuse')).to.equal(BINDGROUP_MATERIAL);
        expect(processingOptions.getUniformBindGroup('matrix_viewProjection')).to.equal(0);
        expect(processingOptions.getUniformBindGroup('uMeshValue')).to.equal(-1);
        expect(processingOptions.hasUniform('material_diffuse')).to.equal(true);
        expect(processingOptions.hasUniform('uMeshValue')).to.equal(false);
    });

    it('WGSL declares the material block at the material bind group and references it', function () {
        const definition = {
            attributes: { vertex_position: SEMANTIC_POSITION },
            vshader: wgslSource(true),
            fshader: wgslSource(false),
            processingOptions
        };
        const shader = { failed: false, name: 'material-ub-test' };
        const result = WebgpuShaderProcessorWGSL.run(app.graphicsDevice, definition, shader);
        expect(shader.failed).to.equal(false);
        expect(result.vshader).to.contain(`@group(${BINDGROUP_MATERIAL}) @binding(0) var<uniform> ub_material`);
        expect(result.vshader).to.contain('ub_material.material_diffuse');
        expect(result.vshader).to.contain('ub_mesh_ub.uMeshValue');
        expect(result.fshader).to.contain('ub_material.material_diffuse');
        expect(result.meshUniformBufferFormat.get('material_diffuse')).not.to.exist;
        expect(result.meshUniformBufferFormat.get('uMeshValue')).to.exist;
    });

    it('GLSL for WebGPU declares the material block at the material bind group', function () {
        const definition = {
            attributes: { vertex_position: SEMANTIC_POSITION },
            vshader: glslSource,
            fshader: glslSource.replace('gl_Position', 'gl_FragColor'),
            processingOptions
        };
        const shader = { failed: false, name: 'material-ub-test' };
        const result = ShaderProcessorGLSL.run(app.graphicsDevice, definition, shader);
        expect(shader.failed).to.equal(false);
        expect(result.vshader).to.contain(`layout(set = ${BINDGROUP_MATERIAL}, binding = 0, std140) uniform ub_material {`);
        expect(result.vshader).to.contain('vec3 material_diffuse;');
        expect(result.meshUniformBufferFormat.get('material_diffuse')).not.to.exist;
        expect(result.meshUniformBufferFormat.get('uMeshValue')).to.exist;
    });

    it('WebGL2 declares the material block and keeps the other uniforms individual', function () {
        const definition = {
            attributes: { vertex_position: SEMANTIC_POSITION },
            vshader: glslSource,
            fshader: glslSource.replace('gl_Position', 'gl_FragColor'),
            processingOptions
        };
        const shader = { failed: false, name: 'material-ub-test' };
        const result = WebglShaderProcessorGLSL.run(app.graphicsDevice, definition, shader);
        expect(shader.failed).to.equal(false);
        expect(result.vshader).to.contain('layout(std140) uniform ub_material {');
        expect(result.vshader).to.contain('layout(std140) uniform ub_view {');
        expect(result.vshader).not.to.contain('uniform vec3 material_diffuse;');
        expect(result.vshader).to.contain('uniform float uMeshValue;');
    });

});
