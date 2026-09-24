import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { BindGroupFormat, BindTextureFormat, BindUniformBufferFormat } from '../../../src/platform/graphics/bind-group-format.js';
import {
    BINDGROUP_MATERIAL, BINDGROUP_MESH, BINDGROUP_VIEW, SAMPLETYPE_DEPTH, SAMPLETYPE_UINT,
    SEMANTIC_POSITION
} from '../../../src/platform/graphics/constants.js';
import { ShaderProcessorGLSL } from '../../../src/platform/graphics/shader-processor-glsl.js';
import { ShaderProcessorOptions } from '../../../src/platform/graphics/shader-processor-options.js';
import { WebglShaderProcessorGLSL } from '../../../src/platform/graphics/webgl/webgl-shader-processor-glsl.js';
import { WebgpuShaderProcessorWGSL } from '../../../src/platform/graphics/webgpu/webgpu-shader-processor-wgsl.js';
import { LightList } from '../../../src/scene/lighting/light-list.js';
import { getViewTextures, isViewTexture } from '../../../src/scene/renderer/view-textures.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

const glslSource = (textures, output = 'gl_Position') => `
    ${textures.join('\n')}
    uniform float uMeshValue;
    void main() {
        ${output} = vec4(uMeshValue);
    }
`;

const wgslSource = (textures, vertex) => `
    ${textures.join('\n')}
    uniform uMeshValue: f32;
    @${vertex ? 'vertex' : 'fragment'}
    fn ${vertex ? 'vertexMain(input: VertexInput) -> VertexOutput' : 'fragmentMain(input: FragmentInput) -> FragmentOutput'} {
        var output: ${vertex ? 'VertexOutput' : 'FragmentOutput'};
        output.${vertex ? 'position' : 'color'} = vec4f(uniform.uMeshValue);
        return output;
    }
`;

const textureNames = format => format.textureFormats.map(textureFormat => textureFormat.name);

describe('View textures in the view bind group', function () {

    let app;
    let device;
    let viewUniformFormat;

    const options = (viewTextures = getViewTextures(viewUniformFormat)) => new ShaderProcessorOptions(viewUniformFormat, undefined, viewTextures);

    // the view uniform format of a pass with lights at the first two light slots
    const formatWithLights = () => {
        const lights = ['directional', 'spot'].map((type) => {
            const entity = new Entity(type);
            entity.addComponent('light', { type, castShadows: true });
            app.root.addChild(entity);
            return entity.light.light;
        });
        const list = new LightList();
        list.update(lights, false);
        return app.renderer.getViewUniformFormat(false, list);
    };

    const runGLSL = (textures, processingOptions = options()) => {
        const definition = {
            attributes: { vertex_position: SEMANTIC_POSITION },
            vshader: glslSource(textures),
            fshader: glslSource(textures, 'gl_FragColor'),
            processingOptions
        };
        const shader = { failed: false, name: 'view-textures-test' };
        const result = ShaderProcessorGLSL.run(device, definition, shader);
        expect(shader.failed).to.equal(false);
        return result;
    };

    const runWGSL = (textures, processingOptions = options()) => {
        const definition = {
            attributes: { vertex_position: SEMANTIC_POSITION },
            vshader: wgslSource(textures, true),
            fshader: wgslSource(textures, false),
            processingOptions
        };
        const shader = { failed: false, name: 'view-textures-test' };
        const result = WebgpuShaderProcessorWGSL.run(device, definition, shader);
        expect(shader.failed).to.equal(false);
        return result;
    };

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        device = app.graphicsDevice;
        viewUniformFormat = app.renderer.getViewUniformFormat(false, new LightList());
    });

    afterEach(function () {
        app.destroy();
        jsdomTeardown();
    });

    describe('getViewTextures', function () {

        it('names the textures set per pass or per frame, and the light slots of the format', function () {
            const names = getViewTextures(formatWithLights());
            for (const name of ['clusterWorldTexture', 'lightsTexture', 'shadowAtlasTexture', 'cookieAtlasTexture',
                'scene_envAtlas', 'scene_skybox', 'areaLightsLutTex1', 'areaLightsLutTex2', 'blueNoiseTex32',
                'uSceneDepthMap', 'uSceneColorMap', 'ssaoTexture',
                'light0_shadowMap', 'light0_cookie', 'light1_shadowMap', 'light1_cookie']) {
                expect(names.has(name), name).to.equal(true);
            }

            // slots the format does not hold, and textures set per material or per mesh instance
            for (const name of ['light2_shadowMap', 'light2_cookie', 'texture_diffuseMap', 'texture_envAtlas',
                'texture_lightMap', 'texture_poseMap', 'uFogTexture', 'uFogShadowMap']) {
                expect(names.has(name), name).to.equal(false);
            }
        });

        it('has no light slot textures for a format without lights', function () {
            expect(getViewTextures(viewUniformFormat).has('light0_shadowMap')).to.equal(false);
        });

        it('returns the same set for a format, and none without a format', function () {
            expect(getViewTextures(viewUniformFormat)).to.equal(getViewTextures(viewUniformFormat));
            expect(getViewTextures(formatWithLights())).not.to.equal(getViewTextures(viewUniformFormat));
            expect(getViewTextures(undefined)).to.equal(null);
        });
    });

    describe('isViewTexture', function () {

        it('selects the textures the renderer supplies per pass', function () {
            for (const name of ['clusterWorldTexture', 'lightsTexture', 'shadowAtlasTexture', 'cookieAtlasTexture',
                'scene_envAtlas', 'scene_skybox', 'areaLightsLutTex1', 'areaLightsLutTex2', 'blueNoiseTex32',
                'uSceneDepthMap', 'uSceneColorMap', 'ssaoTexture', 'light0_shadowMap', 'light12_cookie']) {
                expect(isViewTexture(name), name).to.equal(true);
            }
        });

        it('does not select material, mesh or post-process textures', function () {
            for (const name of ['texture_diffuseMap', 'texture_envAtlas', 'texture_lightMap', 'texture_poseMap',
                'uFogTexture', 'uFogShadowMap', 'light0_shadowMatrix', 'lightX_shadowMap', 'myTexture']) {
                expect(isViewTexture(name), name).to.equal(false);
            }
        });
    });

    describe('ShaderProcessorOptions', function () {

        it('keeps the view textures only with a view uniform format', function () {
            expect(options().viewTextures).to.equal(getViewTextures(viewUniformFormat));
            expect(new ShaderProcessorOptions(undefined, undefined, new Set(['uSceneColorMap'])).viewTextures).to.equal(null);
        });

        it('keys the WebGPU processing by the presence of the view textures', function () {
            const webgpu = { isWebGPU: true };
            const webgl = { isWebGPU: false };
            expect(options().generateKey(webgpu)).to.contain('|vt');
            expect(options(null).generateKey(webgpu)).not.to.contain('|vt');
            expect(options().generateKey(webgl)).to.equal(options(null).generateKey(webgl));
        });
    });

    describe('GLSL for WebGPU', function () {

        it('declares the view textures in the view bind group after the uniform buffer, ordered by name', function () {
            const result = runGLSL([
                'uniform sampler2D uSceneColorMap;',
                'uniform sampler2D texture_meshMap;',
                'uniform highp usampler2D clusterWorldTexture;'
            ]);

            const viewFormat = result.viewBindGroupFormat;
            expect(viewFormat).to.be.an.instanceof(BindGroupFormat);
            expect(viewFormat.uniformBufferFormats).to.have.length(1);
            expect(viewFormat.uniformBufferFormats[0].slot).to.equal(0);
            expect(textureNames(viewFormat)).to.deep.equal(['clusterWorldTexture', 'uSceneColorMap']);
            expect(viewFormat.textureFormats.map(format => format.slot)).to.deep.equal([1, 3]);
            expect(viewFormat.getTexture('clusterWorldTexture').sampleType).to.equal(SAMPLETYPE_UINT);

            expect(result.vshader).to.contain(`layout(set = ${BINDGROUP_VIEW}, binding = 0, std140) uniform ub_view {`);
            expect(result.vshader).to.contain(`layout(set = ${BINDGROUP_VIEW}, binding = 1) uniform utexture2D clusterWorldTexture;`);
            expect(result.vshader).to.contain(`layout(set = ${BINDGROUP_VIEW}, binding = 2) uniform sampler clusterWorldTexture_sampler;`);
            expect(result.vshader).to.contain(`layout(set = ${BINDGROUP_VIEW}, binding = 3) uniform texture2D uSceneColorMap;`);
            expect(result.vshader).to.contain(`layout(set = ${BINDGROUP_VIEW}, binding = 4) uniform sampler uSceneColorMap_sampler;`);

            // the other textures stay in the mesh bind group
            expect(textureNames(result.meshBindGroupFormat)).to.deep.equal(['texture_meshMap']);
            expect(result.vshader).to.contain(`layout(set = ${BINDGROUP_MESH}, binding = 0) uniform texture2D texture_meshMap;`);
        });

        it('shares one format between shaders declaring the same view textures in any order', function () {
            const a = runGLSL(['uniform sampler2D uSceneColorMap;', 'uniform sampler2D blueNoiseTex32;']);
            const b = runGLSL(['uniform sampler2D blueNoiseTex32;', 'uniform sampler2D texture_meshMap;', 'uniform sampler2D uSceneColorMap;']);
            expect(a.viewBindGroupFormat).to.equal(b.viewBindGroupFormat);
        });

        it('keeps a light slot shadow map a depth texture', function () {
            viewUniformFormat = formatWithLights();
            const result = runGLSL(['uniform sampler2DShadow light0_shadowMap;']);
            expect(result.viewBindGroupFormat.getTexture('light0_shadowMap').sampleType).to.equal(SAMPLETYPE_DEPTH);
            expect(result.meshBindGroupFormat.empty).to.equal(true);
        });

        it('keeps the texture of a light slot the format does not hold in the mesh bind group', function () {
            const result = runGLSL(['uniform sampler2DShadow light0_shadowMap;']);
            expect(result.viewBindGroupFormat).to.equal(null);
            expect(textureNames(result.meshBindGroupFormat)).to.deep.equal(['light0_shadowMap']);
        });

        it('has no view bind group format without view textures', function () {
            const result = runGLSL(['uniform sampler2D texture_meshMap;']);
            expect(result.viewBindGroupFormat).to.equal(null);
            expect(result.vshader).not.to.contain(`layout(set = ${BINDGROUP_VIEW}, binding = 1)`);
        });

        it('keeps the view textures in the mesh bind group without the predicate', function () {
            const result = runGLSL(['uniform sampler2D uSceneColorMap;'], options(null));
            expect(result.viewBindGroupFormat).to.equal(null);
            expect(textureNames(result.meshBindGroupFormat)).to.deep.equal(['uSceneColorMap']);
        });

        it('leaves a texture a supplied bind group claims to that group', function () {
            const processingOptions = options();
            const materialFormat = new BindGroupFormat(device, [
                new BindUniformBufferFormat('default', 3),
                new BindTextureFormat('uSceneColorMap', 3)
            ]);
            processingOptions.bindGroupFormats[BINDGROUP_MATERIAL] = materialFormat;
            const result = runGLSL(['uniform sampler2D uSceneColorMap;'], processingOptions);
            expect(result.viewBindGroupFormat).to.equal(null);
            expect(result.vshader).to.contain(`layout(set = ${BINDGROUP_MATERIAL}, binding = 1) uniform texture2D uSceneColorMap;`);
            materialFormat.destroy();
        });
    });

    describe('WGSL', function () {

        it('declares the view textures and their samplers in the view bind group, ordered by name', function () {
            const result = runWGSL([
                'var uSceneColorMap: texture_2d<f32>;',
                'var uSceneColorMapSampler: sampler;',
                'var texture_meshMap: texture_2d<f32>;',
                'var texture_meshMapSampler: sampler;',
                'var shadowAtlasTexture: texture_depth_2d;',
                'var shadowAtlasTextureSampler: sampler_comparison;',
                'var clusterWorldTexture: texture_2d<u32>;'
            ]);

            const viewFormat = result.viewBindGroupFormat;
            expect(textureNames(viewFormat)).to.deep.equal(['clusterWorldTexture', 'shadowAtlasTexture', 'uSceneColorMap']);
            expect(viewFormat.textureFormats.map(format => format.slot)).to.deep.equal([1, 2, 4]);
            expect(viewFormat.getTexture('clusterWorldTexture').hasSampler).to.equal(false);

            const code = result.fshader;
            expect(code).to.contain(`@group(${BINDGROUP_VIEW}) @binding(0) var<uniform> ub_view`);
            expect(code).to.contain(`@group(${BINDGROUP_VIEW}) @binding(1) var clusterWorldTexture: texture_2d<u32>;`);
            expect(code).to.contain(`@group(${BINDGROUP_VIEW}) @binding(2) var shadowAtlasTexture: texture_depth_2d;`);
            expect(code).to.contain(`@group(${BINDGROUP_VIEW}) @binding(3) var shadowAtlasTextureSampler: sampler_comparison;`);
            expect(code).to.contain(`@group(${BINDGROUP_VIEW}) @binding(4) var uSceneColorMap: texture_2d<f32>;`);
            expect(code).to.contain(`@group(${BINDGROUP_VIEW}) @binding(5) var uSceneColorMapSampler: sampler;`);

            // the other texture and its sampler stay in the mesh bind group
            expect(textureNames(result.meshBindGroupFormat)).to.deep.equal(['texture_meshMap']);
            expect(code).to.contain(`@group(${BINDGROUP_MESH}) @binding(0) var texture_meshMap: texture_2d<f32>;`);
            expect(code).to.contain(`@group(${BINDGROUP_MESH}) @binding(1) var texture_meshMapSampler: sampler;`);
        });

        it('shares one format between shaders declaring the same view textures in any order', function () {
            const a = runWGSL([
                'var uSceneColorMap: texture_2d<f32>;',
                'var uSceneColorMapSampler: sampler;',
                'var blueNoiseTex32: texture_2d<f32>;',
                'var blueNoiseTex32Sampler: sampler;'
            ]);
            const b = runWGSL([
                'var blueNoiseTex32: texture_2d<f32>;',
                'var blueNoiseTex32Sampler: sampler;',
                'var texture_meshMap: texture_2d<f32>;',
                'var uSceneColorMap: texture_2d<f32>;',
                'var uSceneColorMapSampler: sampler;'
            ]);
            expect(a.viewBindGroupFormat).to.equal(b.viewBindGroupFormat);

            // a different sampler is a different format
            const d = runWGSL(['var uSceneColorMap: texture_2d<f32>;', 'var blueNoiseTex32: texture_2d<f32>;']);
            expect(d.viewBindGroupFormat).not.to.equal(a.viewBindGroupFormat);
        });

        it('has no view bind group format without view textures', function () {
            const result = runWGSL(['var texture_meshMap: texture_2d<f32>;']);
            expect(result.viewBindGroupFormat).to.equal(null);
            expect(result.meshBindGroupFormat.empty).to.equal(false);
        });

        it('has an empty mesh bind group format when all textures are view textures', function () {
            const result = runWGSL(['var scene_envAtlas: texture_2d<f32>;', 'var scene_envAtlasSampler: sampler;']);
            expect(result.meshBindGroupFormat.empty).to.equal(true);
            expect(result.fshader).not.to.contain(`@group(${BINDGROUP_MESH}) @binding(0)`);
        });
    });

    describe('WebGL2', function () {

        it('keeps the view textures individual uniforms', function () {
            const definition = {
                attributes: { vertex_position: SEMANTIC_POSITION },
                vshader: glslSource(['uniform sampler2D uSceneColorMap;']),
                fshader: glslSource(['uniform sampler2D uSceneColorMap;'], 'gl_FragColor'),
                processingOptions: options()
            };
            const shader = { failed: false, name: 'view-textures-test' };
            const result = WebglShaderProcessorGLSL.run(device, definition, shader);
            expect(result.fshader).to.contain('uniform sampler2D uSceneColorMap;');
            expect(result.viewBindGroupFormat).to.equal(undefined);
        });
    });
});
