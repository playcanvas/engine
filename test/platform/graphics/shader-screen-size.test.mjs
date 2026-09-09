import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { SEMANTIC_POSITION } from '../../../src/platform/graphics/constants.js';
import { ShaderProcessorGLSL } from '../../../src/platform/graphics/shader-processor-glsl.js';
import { ShaderProcessorOptions } from '../../../src/platform/graphics/shader-processor-options.js';
import { WebglShaderProcessorGLSL } from '../../../src/platform/graphics/webgl/webgl-shader-processor-glsl.js';
import { WebgpuShaderProcessorWGSL } from '../../../src/platform/graphics/webgpu/webgpu-shader-processor-wgsl.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

const warning = 'Shader uniform uScreenSize is deprecated. Use screen_size instead.';

// Both names appear in both stages to exercise declaration merging as well as buffer assignment.
const glslSource = legacy => `
    uniform vec4 screen_size;
    ${legacy ? 'uniform vec4 uScreenSize;' : ''}
    void main() {
        gl_Position = screen_size ${legacy ? '+ uScreenSize' : ''};
    }
`;

const wgslSource = (legacy, vertex) => `
    uniform screen_size: vec4f;
    ${legacy ? 'uniform uScreenSize: vec4f;' : ''}
    @${vertex ? 'vertex' : 'fragment'}
    fn ${vertex ? 'vertexMain(input: VertexInput) -> VertexOutput' : 'fragmentMain(input: FragmentInput) -> FragmentOutput'} {
        var output: ${vertex ? 'VertexOutput' : 'FragmentOutput'};
        output.${vertex ? 'position' : 'color'} = uniform.screen_size ${legacy ? '+ uniform.uScreenSize' : ''};
        return output;
    }
`;

describe('Screen size shader uniform compatibility', function () {
    let app;
    let warn;
    let previouslyLogged;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        app.renderer.initViewUniformFormat(false);
        previouslyLogged = Debug._loggedMessages.delete(warning);
        warn = sinon.stub(console, 'warn');
    });

    afterEach(function () {
        warn.restore();
        Debug._loggedMessages.delete(warning);
        if (previouslyLogged) Debug._loggedMessages.add(warning);
        app.destroy();
        jsdomTeardown();
    });

    it('supplies both scope names from the same storage, including after resizing', function () {
        const device = app.graphicsDevice;
        for (const [width, height] of [[640, 480], [320, 240]]) {
            device.resizeCanvas(width, height);
            app.renderer.setSceneConstants();
            const current = device.scope.resolve('screen_size').value;
            expect(device.scope.resolve('uScreenSize').value).to.equal(current);
            expect(Array.from(current)).to.deep.equal(Array.from(new Float32Array([width, height, 1 / width, 1 / height])));
        }
        expect(app.renderer.viewUniformFormat.get('screen_size')).to.exist;
        expect(app.renderer.viewUniformFormat.get('uScreenSize')).not.to.exist;
        expect(warn.called).to.equal(false);
    });

    [
        ['WebGL2', WebglShaderProcessorGLSL, false],
        ['GLSL for WebGPU', ShaderProcessorGLSL, false],
        ['WGSL', WebgpuShaderProcessorWGSL, true]
    ].forEach(([name, processor, wgsl]) => {
        [false, true].forEach((legacy) => {
            it(`${name} routes ${legacy ? 'mixed legacy and current uniforms and warns once' : 'the current uniform without warnings'}`, function () {
                const definition = {
                    attributes: { vertex_position: SEMANTIC_POSITION },
                    vshader: wgsl ? wgslSource(legacy, true) : glslSource(legacy),
                    fshader: wgsl ? wgslSource(legacy, false) : glslSource(legacy).replace('gl_Position', 'gl_FragColor'),
                    processingOptions: new ShaderProcessorOptions(app.renderer.viewUniformFormat)
                };
                const shader = { failed: false, name: 'screen-size-test' };
                const result = processor.run(app.graphicsDevice, definition, shader);
                // Reprocessing another variant must not repeat the deprecation warning.
                processor.run(app.graphicsDevice, definition, shader);
                expect(shader.failed).to.equal(false);
                expect(result.vshader).to.contain('screen_size');
                expect(result.fshader).to.contain('screen_size');
                if (processor === WebglShaderProcessorGLSL) {
                    expect(result.vshader).not.to.contain('uniform vec4 screen_size;');
                    expect(result.vshader.includes('uniform vec4 uScreenSize;')).to.equal(legacy);
                } else {
                    expect(result.meshUniformBufferFormat.get('screen_size')).not.to.exist;
                    expect(!!result.meshUniformBufferFormat.get('uScreenSize')).to.equal(legacy);
                    if (wgsl) {
                        expect(result.vshader).to.contain('ub_view.screen_size');
                        if (legacy) expect(result.vshader).to.contain('ub_mesh_ub.uScreenSize');
                    }
                }
                expect(warn.callCount).to.equal(legacy ? 1 : 0);
                if (legacy) expect(warn.firstCall.args[0]).to.equal(`DEPRECATED: ${warning}`);
            });
        });
    });
});
