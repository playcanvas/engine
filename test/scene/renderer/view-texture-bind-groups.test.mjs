import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { Mat3 } from '../../../src/core/math/mat3.js';
import { Mat4 } from '../../../src/core/math/mat4.js';
import { Entity } from '../../../src/framework/entity.js';
import { BindGroupFormat, BindTextureFormat } from '../../../src/platform/graphics/bind-group-format.js';
import { BindGroup } from '../../../src/platform/graphics/bind-group.js';
import {
    BINDGROUP_MESH, BINDGROUP_VIEW, SEMANTIC_POSITION, SHADERSTAGE_FRAGMENT, SHADERSTAGE_VERTEX,
    TEXTUREPROJECTION_EQUIRECT, UNIFORMTYPE_FLOAT
} from '../../../src/platform/graphics/constants.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { UniformBufferFormat, UniformFormat } from '../../../src/platform/graphics/uniform-buffer-format.js';
import { UniformBuffer } from '../../../src/platform/graphics/uniform-buffer.js';
import { getViewBindGroupFormat } from '../../../src/platform/graphics/view-bind-group-format.js';
import { BLEND_NORMAL, DITHER_BLUENOISE } from '../../../src/scene/constants.js';
import { LightList } from '../../../src/scene/lighting/light-list.js';
import { ShaderMaterial } from '../../../src/scene/materials/shader-material.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('Renderer view texture bind groups', function () {

    let app;
    let device;
    let renderer;
    let viewUniformFormat;
    let binds;
    let viewFormat;
    let emptyFormat;
    let meshFormat;

    const texture = name => new Texture(device, { name: name, width: 4, height: 4 });

    const shader = (viewBindGroupFormat, meshBindGroupFormat = emptyFormat) => ({ viewBindGroupFormat, meshBindGroupFormat });

    const shaderInstance = (shader) => {
        const uniformBuffer = new UniformBuffer(device, new UniformBufferFormat(device, [
            new UniformFormat('uMeshValue', UNIFORMTYPE_FLOAT)
        ]), false);
        return {
            shader,
            getBindGroup: sinon.spy(() => ({ update() {} })),
            getUniformBuffer: () => uniformBuffer
        };
    };

    const view = () => ({
        projMat: new Mat4(),
        viewOffMat: new Mat4(),
        viewInvOffMat: new Mat4(),
        viewMat3: new Mat3(),
        projViewOffMat: new Mat4(),
        positionData: new Float32Array(3)
    });

    const bindsAt = index => binds.filter(bind => bind.index === index);

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        device = app.graphicsDevice;
        renderer = app.renderer;

        // render a frame, so the scope holds the view uniforms and the frame textures
        const camera = new Entity('Camera');
        camera.addComponent('camera');
        app.root.addChild(camera);
        app.render();

        // the renderer logic under test runs on the backends using bind groups, which provide an
        // empty bind group
        device.usesMeshBindGroups = true;
        if (!device.emptyBindGroup) {
            device.emptyBindGroup = new BindGroup(device, new BindGroupFormat(device, []));
        }
        binds = [];
        sinon.stub(device, 'setBindGroup').callsFake((index, bindGroup, offsets) => {
            binds.push({ index, bindGroup, offset: (offsets ?? bindGroup.uniformBufferOffsets)?.[0] });
        });

        viewUniformFormat = renderer.getViewUniformFormat(false, new LightList());
        device.scope.resolve('uSceneColorMap').setValue(texture('color'));
        device.scope.resolve('uMeshValue').setValue(0);
        viewFormat = getViewBindGroupFormat(device, [new BindTextureFormat('uSceneColorMap', SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT)]);
        emptyFormat = new BindGroupFormat(device, []);
        meshFormat = new BindGroupFormat(device, [new BindTextureFormat('texture_meshMap', SHADERSTAGE_FRAGMENT)]);
    });

    afterEach(function () {
        sinon.restore();
        emptyFormat.destroy();
        meshFormat.destroy();
        app?.destroy();
        jsdomTeardown();
    });

    it('binds the view bind group of a shader only when its format changes', function () {
        renderer.setupViewUniformBuffers(viewUniformFormat, null);
        const dynamicBindGroup = bindsAt(BINDGROUP_VIEW)[0].bindGroup;

        const textured = shader(viewFormat);
        const plain = shader(null);

        binds.length = 0;
        renderer.setupViewBindGroup(plain);
        expect(binds).to.have.length(0);

        renderer.setupViewBindGroup(textured);
        renderer.setupViewBindGroup(textured);
        expect(bindsAt(BINDGROUP_VIEW)).to.have.length(1);
        const texturedBindGroup = bindsAt(BINDGROUP_VIEW)[0].bindGroup;
        expect(texturedBindGroup.format).to.equal(viewFormat);
        expect(texturedBindGroup.textures[0].name).to.equal('color');

        renderer.setupViewBindGroup(plain);
        renderer.setupViewBindGroup(textured);
        expect(bindsAt(BINDGROUP_VIEW).map(bind => bind.bindGroup)).to.deep.equal([texturedBindGroup, dynamicBindGroup, texturedBindGroup]);
    });

    it('updates the view bind group holding textures once per pass, with the view uniform buffer of the pass', function () {
        const textured = shader(viewFormat);
        const plain = shader(null);

        renderer.setupViewUniformBuffers(viewUniformFormat, null);
        renderer.setupViewBindGroup(textured);
        const bindGroup = bindsAt(BINDGROUP_VIEW)[1].bindGroup;
        const update = sinon.spy(bindGroup, 'update');

        renderer.setupViewBindGroup(plain);
        renderer.setupViewBindGroup(textured);
        expect(update.callCount).to.equal(0);

        // the next pass allocates the view uniform buffer again, and a new texture is picked up
        device.scope.resolve('uSceneColorMap').setValue(texture('color2'));
        binds.length = 0;
        renderer.setupViewUniformBuffers(viewUniformFormat, null);
        const passOffset = bindsAt(BINDGROUP_VIEW)[0].offset;
        renderer.setupViewBindGroup(textured);
        expect(update.callCount).to.equal(1);
        expect(bindsAt(BINDGROUP_VIEW)[1].bindGroup).to.equal(bindGroup);
        expect(bindsAt(BINDGROUP_VIEW)[1].offset).to.equal(passOffset);
        expect(bindGroup.textures[0].name).to.equal('color2');
    });

    it('keeps a view bind group per view in multiview, each with the uniform buffer of its view', function () {
        const textured = shader(viewFormat);
        renderer.setupViewUniformBuffers(viewUniformFormat, [view(), view()]);
        const dynamicBindGroups = renderer._viewBindGroups.slice();
        const dynamicOffsets = renderer._viewBindGroupOffsets.slice();

        binds.length = 0;
        renderer.setupViewBindGroup(textured);

        // the render loop binds them per view
        expect(bindsAt(BINDGROUP_VIEW)).to.have.length(0);
        const [first, second] = renderer._viewBindGroups;
        expect(first).not.to.equal(second);
        expect(first.format).to.equal(viewFormat);
        expect(second.format).to.equal(viewFormat);
        expect(first.uniformBuffers[0]).not.to.equal(second.uniformBuffers[0]);
        expect(renderer._viewBindGroupOffsets).to.deep.equal(dynamicOffsets);

        renderer.setupViewBindGroup(shader(null));
        expect(renderer._viewBindGroups).to.deep.equal(dynamicBindGroups);
    });

    it('binds the empty bind group once per pass for draws without mesh bind group resources', function () {
        const empty = shaderInstance(shader(null));
        const textured = shaderInstance(shader(null, meshFormat));

        renderer.setupViewUniformBuffers(viewUniformFormat, null);
        binds.length = 0;
        renderer.setupMeshUniformBuffers(empty);
        renderer.setupMeshUniformBuffers(empty);
        expect(bindsAt(BINDGROUP_MESH).map(bind => bind.bindGroup)).to.deep.equal([device.emptyBindGroup]);
        expect(empty.getBindGroup.called).to.equal(false);

        // a draw with mesh textures binds its own, after which the empty one is bound again
        renderer.setupMeshUniformBuffers(textured);
        renderer.setupMeshUniformBuffers(empty);
        expect(textured.getBindGroup.calledOnce).to.equal(true);
        expect(bindsAt(BINDGROUP_MESH)).to.have.length(3);
        expect(bindsAt(BINDGROUP_MESH)[2].bindGroup).to.equal(device.emptyBindGroup);

        // and once again in the next pass
        renderer.setupViewUniformBuffers(viewUniformFormat, null);
        renderer.setupMeshUniformBuffers(empty);
        expect(bindsAt(BINDGROUP_MESH)).to.have.length(4);
    });

    it('destroys the view bind groups holding textures with the renderer', function () {
        renderer.setupViewUniformBuffers(viewUniformFormat, null);
        renderer.setupViewBindGroup(shader(viewFormat));
        const bindGroup = bindsAt(BINDGROUP_VIEW)[1].bindGroup;
        const destroy = sinon.spy(bindGroup, 'destroy');
        app.destroy();
        app = null;
        expect(destroy.calledOnce).to.equal(true);
    });

    it('warns in debug when a view texture is set per material or per mesh instance', function () {
        const warn = sinon.stub(Debug, 'warnOnce');
        const material = new StandardMaterial();
        material.setParameter('light3_shadowMap', texture('shadow'));
        material.setParameter('texture_custom', texture('custom'));

        const entity = new Entity('box');
        entity.addComponent('render', { type: 'box' });
        entity.render.meshInstances[0].setParameter('scene_envAtlas', texture('env'));

        const messages = warn.args.map(args => args[0]);
        expect(messages.some(message => message.startsWith('Material#setParameter: \'light3_shadowMap\''))).to.equal(true);
        expect(messages.some(message => message.startsWith('MeshInstance#setParameter: \'scene_envAtlas\''))).to.equal(true);
        expect(messages.some(message => message.includes('texture_custom'))).to.equal(false);
        entity.destroy();
    });

    it('does not warn for a ShaderMaterial, which keeps its textures in the mesh bind group', function () {
        const warn = sinon.stub(Debug, 'warnOnce');
        const material = new ShaderMaterial();
        material.setParameter('uSceneColorMap', texture('user'));

        const entity = new Entity('box');
        entity.addComponent('render', { type: 'box', material });
        entity.render.meshInstances[0].setParameter('blueNoiseTex32', texture('noise'));

        const messages = warn.args.map(args => args[0]);
        expect(messages.some(message => message.includes('uSceneColorMap') || message.includes('blueNoiseTex32'))).to.equal(false);
        entity.destroy();
    });

    describe('rendering', function () {

        // Renders a pass mixing the view textures: clustered lights with shadows, a shadowed
        // directional light in a light slot, the scene environment, blue noise dithered shadow
        // casters, a refraction reading the scene color and an unlit transparent draw. Under
        // `npm run test:webgpu` any validation error - a pipeline expecting a view texture the bound
        // view bind group lacks - fails the test.

        const shadersOf = meshInstance => Array.from(meshInstance._shaderCache.values()).map(instance => instance.shader);
        const textureNames = format => format.textureFormats.map(textureFormat => textureFormat.name);
        const viewTexturesOf = shader => (shader.viewBindGroupFormat ? textureNames(shader.viewBindGroupFormat) : []);

        const addBox = (name, material, x) => {
            const entity = new Entity(name);
            entity.addComponent('render', { type: 'box', material });
            entity.setLocalPosition(x, 0, -6);
            app.root.addChild(entity);
            return entity.render.meshInstances[0];
        };

        it('renders a pass mixing shaders with and without view textures', function () {

            // the view bind groups exist on WebGPU only, and the null device cannot grab the color
            if (!device.isWebGPU) {
                this.skip();
            }
            sinon.restore();
            const assert = sinon.spy(Debug, 'assert');

            app.scene.envAtlas = new Texture(device, { name: 'envAtlas', width: 64, height: 64, mipmaps: false, projection: TEXTUREPROJECTION_EQUIRECT });

            app.root.findByName('Camera').camera.requestSceneColorMap(true);

            const sun = new Entity('Sun');
            sun.addComponent('light', { type: 'directional', castShadows: true, shadowResolution: 256 });
            sun.setEulerAngles(45, 30, 0);
            app.root.addChild(sun);

            const omni = new Entity('Omni');
            omni.addComponent('light', { type: 'omni', castShadows: true, range: 20 });
            omni.setLocalPosition(0, 3, -4);
            app.root.addChild(omni);

            const lit = addBox('lit', new StandardMaterial(), -3);

            const dithered = new StandardMaterial();
            dithered.opacity = 0.5;
            dithered.opacityDither = DITHER_BLUENOISE;
            dithered.opacityShadowDither = DITHER_BLUENOISE;
            dithered.update();
            const ditheredBox = addBox('dithered', dithered, -1);

            const refraction = new StandardMaterial();
            refraction.refraction = 0.5;
            refraction.useDynamicRefraction = true;
            refraction.blendType = BLEND_NORMAL;
            refraction.update();
            const refractionBox = addBox('refraction', refraction, 1);

            const unlit = new StandardMaterial();
            unlit.useLighting = false;
            unlit.useSkybox = false;
            unlit.opacity = 0.5;
            unlit.blendType = BLEND_NORMAL;
            unlit.update();
            const unlitBox = addBox('unlit', unlit, 3);

            // a user's shader reading a texture of a reserved name, set on its material
            const custom = new ShaderMaterial({
                uniqueName: 'ViewTextureUserShader',
                vertexWGSL: `
                    attribute vertex_position: vec4f;
                    uniform matrix_model: mat4x4f;
                    uniform matrix_viewProjection: mat4x4f;
                    @vertex fn vertexMain(input: VertexInput) -> VertexOutput {
                        var output: VertexOutput;
                        output.position = uniform.matrix_viewProjection * uniform.matrix_model * vertex_position;
                        return output;
                    }
                `,
                fragmentWGSL: `
                    var uSceneColorMap: texture_2d<f32>;
                    var uSceneColorMapSampler: sampler;
                    @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
                        var output: FragmentOutput;
                        output.color = textureSample(uSceneColorMap, uSceneColorMapSampler, vec2f(0.5));
                        return output;
                    }
                `,
                attributes: { vertex_position: SEMANTIC_POSITION }
            });
            custom.setParameter('uSceneColorMap', texture('user'));
            const customBox = addBox('custom', custom, 5);

            app.render();
            app.render();

            const failed = assert.args.filter(args => !args[0] && String(args[1]).includes('view bind group'));
            expect(failed, failed.map(args => args[1]).join('\n')).to.have.length(0);

            const litShader = shadersOf(lit).find(shader => viewTexturesOf(shader).includes('scene_envAtlas'));
            expect(litShader, 'lit forward shader').to.exist;
            expect(viewTexturesOf(litShader)).to.include.members(['clusterWorldTexture', 'lightsTexture', 'shadowAtlasTexture', 'light0_shadowMap']);
            expect(litShader.meshBindGroupFormat.empty).to.equal(true);

            expect(shadersOf(ditheredBox).some(shader => viewTexturesOf(shader).includes('blueNoiseTex32')), 'blue noise').to.equal(true);
            expect(shadersOf(refractionBox).some(shader => viewTexturesOf(shader).includes('uSceneColorMap')), 'scene color').to.equal(true);
            expect(shadersOf(unlitBox).every(shader => shader.viewBindGroupFormat === null), 'unlit').to.equal(true);

            // the user's texture stays in the mesh bind group, and is the one bound
            const customInstance = Array.from(customBox._shaderCache.values()).find(instance => instance.bindGroup);
            expect(customInstance.shader.viewBindGroupFormat).to.equal(null);
            expect(textureNames(customInstance.shader.meshBindGroupFormat)).to.deep.equal(['uSceneColorMap']);
            expect(customInstance.bindGroup.textures[0].name).to.equal('user');
        });
    });
});
