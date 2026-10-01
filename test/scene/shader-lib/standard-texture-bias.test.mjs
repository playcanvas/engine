import { expect } from 'chai';

import { Preprocessor } from '../../../src/core/preprocessor.js';
import { SEMANTIC_POSITION, SEMANTIC_TEXCOORD0, TYPE_FLOAT32 } from '../../../src/platform/graphics/constants.js';
import { ShaderProcessorGLSL } from '../../../src/platform/graphics/shader-processor-glsl.js';
import { ShaderProcessorOptions } from '../../../src/platform/graphics/shader-processor-options.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { VertexFormat } from '../../../src/platform/graphics/vertex-format.js';
import { WebglShaderProcessorGLSL } from '../../../src/platform/graphics/webgl/webgl-shader-processor-glsl.js';
import { WebgpuShaderProcessorWGSL } from '../../../src/platform/graphics/webgpu/webgpu-shader-processor-wgsl.js';
import { CameraShaderParams } from '../../../src/scene/camera-shader-params.js';
import { SHADER_FORWARD, SHADERDEF_UV0, SPRITE_RENDERMODE_SIMPLE, SPRITE_RENDERMODE_TILED } from '../../../src/scene/constants.js';
import { LightList } from '../../../src/scene/lighting/light-list.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import litShaderCoreWGSL from '../../../src/scene/shader-lib/wgsl/chunks/standard/frag/litShaderCore.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// textureBias is a global set once for the whole frame, so it is a view uniform. The standard
// textures sample with the {STD_TEXTURE_BIAS} token instead of the uniform directly, so that the
// tiled nine-slice mode can force the top mip without redeclaring textureBias - a redeclaration
// collides with the view block member, which is what kept it per draw before.
describe('Standard material texture bias', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app.destroy();
        jsdomTeardown();
    });

    /**
     * @param {number} nineSlicedMode - The nine-slice mode of the material.
     * @returns {{ generated: string, webgl: string, webgpu: string }} The generated fragment shader
     * of a textured standard material, and its processed forms for WebGL2 and for WebGPU (GLSL).
     */
    const fragmentShaders = (nineSlicedMode) => {
        const device = app.graphicsDevice;
        const material = new StandardMaterial();
        material.diffuseMap = new Texture(device, { name: 'diffuse', width: 4, height: 4 });
        material.nineSlicedMode = nineSlicedMode;
        material.update();

        const viewUniformFormat = app.renderer.getViewUniformFormat(false, new LightList());
        const shader = material.getShaderVariant({
            device,
            scene: app.scene,
            objDefs: SHADERDEF_UV0,
            pass: SHADER_FORWARD,
            cameraShaderParams: new CameraShaderParams(),
            viewUniformFormat,
            vertexFormat: new VertexFormat(device, [
                { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 },
                { semantic: SEMANTIC_TEXCOORD0, components: 2, type: TYPE_FLOAT32 }
            ])
        });
        const generated = shader.definition.fshader;
        expect(generated).to.be.a('string');

        const definition = {
            ...shader.definition,
            processingOptions: new ShaderProcessorOptions(viewUniformFormat, shader.definition.vertexFormat)
        };
        const webgl = { failed: false, name: 'texture-bias-test' };
        const webgpu = { failed: false, name: 'texture-bias-test' };
        const result = {
            generated,
            webgl: WebglShaderProcessorGLSL.run(device, definition, webgl).fshader,
            webgpu: ShaderProcessorGLSL.run(device, definition, webgpu).fshader
        };
        expect(webgl.failed).to.equal(false);
        expect(webgpu.failed).to.equal(false);
        return result;
    };

    it('is a member of the view uniform buffer format', function () {
        expect(app.renderer.getViewUniformFormat(false, new LightList()).get('textureBias')).to.exist;
        expect(app.renderer.getViewUniformFormat(true, new LightList()).get('textureBias')).to.exist;
    });

    it('samples the standard textures through the uniform, declared once in the view block', function () {
        // the material generates GLSL only on a WebGL2 device; the WGSL describe covers WebGPU
        if (app.graphicsDevice.isWebGPU) {
            this.skip();
        }
        const { generated, webgl, webgpu } = fragmentShaders(SPRITE_RENDERMODE_SIMPLE);
        expect(generated).not.to.contain('{STD_TEXTURE_BIAS}');
        expect(generated).to.contain(', textureBias)');
        for (const processed of [webgl, webgpu]) {
            expect(processed).not.to.contain('const float textureBias');
            expect(processed).not.to.contain('uniform float textureBias;');
            expect(processed.match(/float textureBias;/g)).to.have.lengthOf(1);
        }
    });

    it('forces the top mip in the tiled nine-slice mode without redeclaring the uniform', function () {
        // the material generates GLSL only on a WebGL2 device; the WGSL describe covers WebGPU
        if (app.graphicsDevice.isWebGPU) {
            this.skip();
        }
        const { generated, webgl, webgpu } = fragmentShaders(SPRITE_RENDERMODE_TILED);
        expect(generated).not.to.contain('{STD_TEXTURE_BIAS}');
        expect(generated).to.contain(', (-1000.0))');
        expect(generated).not.to.contain(', textureBias)');
        for (const processed of [webgl, webgpu]) {
            expect(processed).not.to.contain('const float textureBias');
            expect(processed.match(/float textureBias;/g)).to.have.lengthOf(1);
        }
    });

    describe('WGSL', function () {

        const includes = new Map([['litShaderArgsPS', '']]);
        const sample = 'fn f() -> f32 { return textureSampleBias(t, s, uv, {STD_TEXTURE_BIAS}); }';

        it('samples through the uniform, and forces the top mip in the tiled mode', function () {
            const simple = Preprocessor.run(`#define LIT_NONE_SLICE_MODE SIMPLE\n${litShaderCoreWGSL}\n${sample}`, includes, { stripDefines: true });
            expect(simple).to.contain('uniform textureBias: f32;');
            expect(simple).to.contain(', uniform.textureBias)');
            expect(simple).not.to.contain('{STD_TEXTURE_BIAS}');

            const tiled = Preprocessor.run(`#define LIT_NONE_SLICE_MODE TILED\n${litShaderCoreWGSL}\n${sample}`, includes, { stripDefines: true });
            expect(tiled).to.contain('uniform textureBias: f32;');
            expect(tiled).to.contain(', (-1000.0))');
            expect(tiled).not.to.contain('{STD_TEXTURE_BIAS}');
        });

        it('routes the uniform into the view block', function () {
            const source = vertex => `
                uniform textureBias: f32;
                uniform uMeshValue: f32;
                @${vertex ? 'vertex' : 'fragment'}
                fn ${vertex ? 'vertexMain(input: VertexInput) -> VertexOutput' : 'fragmentMain(input: FragmentInput) -> FragmentOutput'} {
                    var output: ${vertex ? 'VertexOutput' : 'FragmentOutput'};
                    output.${vertex ? 'position' : 'color'} = vec4f(uniform.textureBias, uniform.uMeshValue, 0.0, 1.0);
                    return output;
                }
            `;
            const processingOptions = new ShaderProcessorOptions(app.renderer.getViewUniformFormat(true, new LightList()));
            const definition = {
                attributes: { vertex_position: SEMANTIC_POSITION },
                vshader: source(true),
                fshader: source(false),
                processingOptions
            };
            const shader = { failed: false, name: 'texture-bias-test' };
            const result = WebgpuShaderProcessorWGSL.run(app.graphicsDevice, definition, shader);
            expect(shader.failed).to.equal(false);
            expect(result.fshader).to.contain('ub_view.textureBias');
            expect(result.fshader).to.contain('ub_mesh_ub.uMeshValue');
            expect(result.meshUniformBufferFormat.get('textureBias')).not.to.exist;
        });
    });
});
