import { expect } from 'chai';
import { restore, spy } from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { Mat4 } from '../../../src/core/math/mat4.js';
import { Vec4 } from '../../../src/core/math/vec4.js';
import { Entity } from '../../../src/framework/entity.js';
import {
    FUNC_ALWAYS, FUNC_EQUAL, FUNC_GREATER, FUNC_GREATEREQUAL, FUNC_LESS, FUNC_LESSEQUAL, FUNC_NEVER, FUNC_NOTEQUAL,
    SEMANTIC_POSITION, TYPE_FLOAT32
} from '../../../src/platform/graphics/constants.js';
import { DepthState } from '../../../src/platform/graphics/depth-state.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { VertexFormat } from '../../../src/platform/graphics/vertex-format.js';
import { CameraShaderParams } from '../../../src/scene/camera-shader-params.js';
import { Camera } from '../../../src/scene/camera.js';
import { FOG_LINEAR, SHADER_FORWARD, SHADERDEF_SCREENSPACE } from '../../../src/scene/constants.js';
import { LightList } from '../../../src/scene/lighting/light-list.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { RenderPassForward } from '../../../src/scene/renderer/render-pass-forward.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * @import { Application } from '../../../src/framework/application.js'
 */

// the clip space depth of a view space point, divided by w
const clipDepth = (projection, z) => {
    const p = projection.transformVec4(new Vec4(0, 0, z, 1), new Vec4());
    return p.z / p.w;
};

describe('Reverse-z', function () {

    describe('Camera.applyShaderProjectionTransform', function () {

        const projection = new Mat4().setPerspective(60, 1, 0.5, 1000);

        it('maps the near plane to 1 and the far plane to 0 with reverse-z', function () {
            const reversed = Camera.applyShaderProjectionTransform(projection, new Mat4(), false, true, true);

            expect(clipDepth(reversed, -0.5)).to.be.closeTo(1, 1e-6);
            expect(clipDepth(reversed, -1000)).to.be.closeTo(0, 1e-6);
        });

        it('reverses the depth of the standard WebGPU range, with and without the flip', function () {
            for (const flipY of [false, true]) {
                const standard = Camera.applyShaderProjectionTransform(projection, new Mat4(), flipY, true);
                const reversed = Camera.applyShaderProjectionTransform(projection, new Mat4(), flipY, true, true);

                for (const z of [-0.5, -3, -40, -999]) {
                    expect(clipDepth(reversed, z)).to.be.closeTo(1 - clipDepth(standard, z), 1e-6);
                }
            }
        });

        it('ignores reverse-z without the WebGPU depth range', function () {
            const reversed = Camera.applyShaderProjectionTransform(projection, new Mat4(), false, false, true);
            expect(reversed.data).to.deep.equal(projection.data);
        });
    });

    describe('CameraShaderParams#reverseZ', function () {

        it('supplies the REVERSE_Z define and takes part in the hash', function () {
            const params = new CameraShaderParams();
            const hash = params.hash;
            expect(params.defines.has('REVERSE_Z')).to.equal(false);

            params.reverseZ = true;
            expect(params.defines.has('REVERSE_Z')).to.equal(true);
            expect(params.hash).to.not.equal(hash);

            params.reverseZ = false;
            expect(params.defines.has('REVERSE_Z')).to.equal(false);
            expect(params.hash).to.equal(hash);
        });
    });

    describe('with an application', function () {

        /** @type {Application} */
        let app;

        const createCamera = (name, reverseZ) => {
            const entity = new Entity(name);
            entity.addComponent('camera', { reverseZ });
            entity.setPosition(0, 0, 5);
            app.root.addChild(entity);
            return entity.camera;
        };

        // reverse-z is set on WebGPU only, so the tests rendering with it run under
        // `npm run test:webgpu`
        const requireWebGPU = (test) => {
            if (!app.graphicsDevice.isWebGPU) {
                test.skip();
            }
        };

        const addBox = (material = new StandardMaterial()) => {
            const entity = new Entity('box');
            entity.addComponent('render', { type: 'box', material });
            app.root.addChild(entity);
            return entity;
        };

        beforeEach(function () {
            jsdomSetup();
            app = createApp();
        });

        afterEach(function () {
            restore();
            app.destroy();
            jsdomTeardown();
        });

        describe('CameraComponent#reverseZ', function () {

            it('is set on WebGPU only', function () {
                const warn = spy(Debug, 'warnOnce');
                const entity = new Entity('camera');
                entity.addComponent('camera', { reverseZ: true });

                const webgpu = app.graphicsDevice.isWebGPU;
                expect(entity.camera.reverseZ).to.equal(webgpu);
                expect(entity.camera.camera.shaderParams.reverseZ).to.equal(false);
                expect(warn.calledWithMatch('only supported on WebGPU')).to.equal(!webgpu);

                entity.camera.reverseZ = false;
                expect(entity.camera.reverseZ).to.equal(false);
                entity.destroy();
            });

            it('is cloned', function () {
                const entity = new Entity('camera');
                entity.addComponent('camera', { reverseZ: true });
                const clone = entity.clone();

                expect(clone.camera.reverseZ).to.equal(entity.camera.reverseZ);
                clone.destroy();
                entity.destroy();
            });

            it('is cloned from a camera rendering an XR session', function () {
                requireWebGPU(this);
                const entity = new Entity('camera');
                entity.addComponent('camera', { reverseZ: true });
                entity.camera.camera.xrViews = [];
                const clone = entity.clone();

                expect(clone.camera.reverseZ).to.equal(true);
                expect(clone.camera.camera.reverseZActive).to.equal(true);
                clone.destroy();
                entity.destroy();
            });
        });

        it('is set on the Camera on WebGPU only', function () {
            const warn = spy(Debug, 'warnOnce');
            const camera = new Camera(app.graphicsDevice);
            camera.reverseZ = true;

            const webgpu = app.graphicsDevice.isWebGPU;
            expect(camera.reverseZ).to.equal(webgpu);
            expect(camera.reverseZActive).to.equal(webgpu);
            expect(warn.calledWithMatch('only supported on WebGPU')).to.equal(!webgpu);
        });

        it('is not applied to the views of an XR session, and stays set', function () {
            requireWebGPU(this);
            const camera = createCamera('camera', true).camera;
            expect(camera.reverseZActive).to.equal(true);

            camera.xrViews = [];
            expect(camera.reverseZ).to.equal(true);
            expect(camera.reverseZActive).to.equal(false);

            camera.xrViews = null;
            expect(camera.reverseZActive).to.equal(true);
        });

        it('supplies the REVERSE_Z define to the shaders the camera renders with', function () {
            requireWebGPU(this);
            const camera = createCamera('camera', true);
            addBox();
            app.render();

            expect(camera.camera.shaderParams.reverseZ).to.equal(true);
            expect(camera.camera.shaderParams.defines.has('REVERSE_Z')).to.equal(true);
        });

        it('reverses the depth tests and biases of the materials', function () {
            requireWebGPU(this);
            createCamera('camera', true);
            const material = new StandardMaterial();
            material.depthBias = 2;
            material.slopeDepthBias = 3;
            material.update();
            addBox(material);

            const setDepthState = spy(app.graphicsDevice, 'setDepthState');
            app.render();

            const states = setDepthState.args.map(args => args[0]);
            const reversed = states.find(state => state.func === FUNC_GREATEREQUAL);
            expect(reversed, 'the depth state of the box').to.not.equal(undefined);
            expect(states.some(state => state === material.depthState)).to.equal(false);
            expect(reversed.write).to.equal(true);
            expect(reversed.depthBias).to.equal(-2);
            expect(reversed.depthBiasSlope).to.equal(-3);

            // the material keeps its depth state
            expect(material.depthState.func).to.equal(FUNC_LESSEQUAL);
            expect(material.depthState.depthBias).to.equal(2);
        });

        it('keeps the depth tests of the materials of a camera without reverse-z', function () {
            createCamera('camera', false);
            const material = new StandardMaterial();
            addBox(material);

            const setDepthState = spy(app.graphicsDevice, 'setDepthState');
            app.render();

            expect(setDepthState.args.some(args => args[0] === material.depthState)).to.equal(true);
            expect(setDepthState.args.some(args => args[0].func === FUNC_GREATEREQUAL)).to.equal(false);
        });

        it('clears the depth to the reverse of the clear depth of the camera', function () {
            requireWebGPU(this);
            const reversed = createCamera('reversed', true);
            const standard = createCamera('standard', false);

            const passes = [reversed, standard].map((camera) => {
                const pass = new RenderPassForward(app.graphicsDevice, app.scene, camera);
                pass.init(null);
                pass.addLayer(app.scene.layers.getLayerByName('World'), false);
                return pass;
            });

            app.renderer.frameUpdate();
            passes.forEach(pass => pass.frameUpdate());
            expect(passes.map(pass => pass.depthStencilOps.clearDepthValue)).to.deep.equal([0, 1]);

            reversed.camera.clearDepth = 0.75;
            passes[0].frameUpdate();
            expect(passes[0].depthStencilOps.clearDepthValue).to.equal(0.25);

            passes.forEach(pass => pass.destroy());
        });

        it('clears the depth for a reverse-z setting changed by a prerender handler', function () {
            requireWebGPU(this);
            const camera = createCamera('camera', false);
            const pass = new RenderPassForward(app.graphicsDevice, app.scene, camera);
            pass.init(null);
            pass.addLayer(app.scene.layers.getLayerByName('World'), false);

            app.renderer.frameUpdate();
            pass.frameUpdate();
            expect(pass.depthStencilOps.clearDepthValue).to.equal(1);

            // the event fires in before(), after the clears were set up, and before the pass starts
            app.scene.on('prerender', (cameraComponent) => {
                cameraComponent.reverseZ = true;
            });
            pass.before();
            expect(pass.depthStencilOps.clearDepthValue).to.equal(0);

            pass.destroy();
        });

        it('clears the depth in every pass of the camera for a reverse-z setting changed by a prerender handler', function () {
            requireWebGPU(this);
            const camera = createCamera('camera', false);
            const passes = [0, 1].map(() => {
                const pass = new RenderPassForward(app.graphicsDevice, app.scene, camera);
                pass.init(null);
                pass.addLayer(app.scene.layers.getLayerByName('World'), false);
                return pass;
            });

            app.renderer.frameUpdate();
            passes.forEach(pass => pass.frameUpdate());
            expect(passes.map(pass => pass.firstCameraUse)).to.deep.equal([true, false]);
            expect(passes.map(pass => pass.depthStencilOps.clearDepth)).to.deep.equal([true, true]);
            expect(passes.map(pass => pass.depthStencilOps.clearDepthValue)).to.deep.equal([1, 1]);

            // the event fires in the first pass only; the second still clears for the new setting
            app.scene.on('prerender', (cameraComponent) => {
                cameraComponent.reverseZ = true;
            });
            passes.forEach(pass => pass.before());
            expect(passes.map(pass => pass.depthStencilOps.clearDepthValue)).to.deep.equal([0, 0]);

            passes.forEach(pass => pass.destroy());
        });

        it('keeps the frustum of the camera without reverse-z', function () {
            requireWebGPU(this);
            const reversed = createCamera('reversed', true);
            const standard = createCamera('standard', false);
            addBox();
            app.render();

            expect(Array.from(reversed.frustum.planeData)).to.deep.equal(Array.from(standard.frustum.planeData));
        });

        it('renders with the reversed projection on WebGPU', function () {
            requireWebGPU(this);

            const camera = createCamera('camera', true);
            camera.nearClip = 0.5;
            camera.farClip = 1000;
            addBox();
            app.render();

            const projection = new Mat4().set(app.graphicsDevice.scope.resolve('matrix_projection').value);
            expect(clipDepth(projection, -0.5)).to.be.closeTo(1, 1e-6);
            expect(clipDepth(projection, -1000)).to.be.closeTo(0, 1e-6);
        });
    });

    // Under `npm run test:webgpu` the WGSL of each shader is compiled by Dawn, and an error fails the
    // test.
    describe('shaders', function () {

        /** @type {Application} */
        let app;

        beforeEach(function () {
            jsdomSetup();
            app = createApp();
        });

        afterEach(function () {
            app.destroy();
            jsdomTeardown();
        });

        const cameraShaderParams = (reverseZ) => {
            const params = new CameraShaderParams();
            params.fog = FOG_LINEAR;
            params.reverseZ = reverseZ;
            return params;
        };

        const generate = (material, objDefs, params, vertexFormat) => {
            const device = app.graphicsDevice;
            const shader = material.getShaderVariant({
                device,
                scene: app.scene,
                objDefs,
                pass: SHADER_FORWARD,
                cameraShaderParams: params,
                viewUniformFormat: app.renderer.getViewUniformFormat(false, new LightList()),
                vertexFormat: vertexFormat ?? new VertexFormat(device, [
                    { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 }
                ])
            });
            expect(shader.failed).to.equal(false);
            return shader.definition;
        };

        // the fog depth from the depth of the fragment, and the screen space depth at the near plane
        const FOG_DEPTH = /\(1\.0 - (gl_FragCoord|pcPosition)\.z\) \/ (gl_FragCoord|pcPosition)\.w/;
        const SCREEN_SPACE_DEPTH = /posW\.zw = vec2\(1\.0, 1\.0\)|vec4f\(posW\.xy, 1\.0, 1\.0\)/;

        it('reverses the fog depth and the depth of screen space meshes', function () {
            const material = new StandardMaterial();
            material.update();

            const reversed = generate(material, SHADERDEF_SCREENSPACE, cameraShaderParams(true));
            expect(reversed.fshader).to.match(FOG_DEPTH);
            expect(reversed.vshader).to.match(SCREEN_SPACE_DEPTH);

            const standard = generate(material, SHADERDEF_SCREENSPACE, cameraShaderParams(false));
            expect(standard.fshader).to.not.match(FOG_DEPTH);
            expect(standard.vshader).to.not.match(SCREEN_SPACE_DEPTH);
        });

        it('places the sky at the far plane', function () {
            const envAtlas = new Texture(app.graphicsDevice, { name: 'EnvAtlas', width: 4, height: 4, mipmaps: false });
            app.scene.envAtlas = envAtlas;
            const entity = new Entity('camera');
            entity.addComponent('camera', { reverseZ: true });
            app.root.addChild(entity);
            app.render();

            const { meshInstance } = app.scene.sky.skyMesh;
            const generateSky = reverseZ => generate(meshInstance.material, 0, cameraShaderParams(reverseZ), meshInstance.mesh.vertexBuffer.format);
            const SKY_DEPTH = /[pP]osition\.z = 0\.0;/;
            expect(generateSky(true).vshader).to.match(SKY_DEPTH);
            expect(generateSky(false).vshader).to.not.match(SKY_DEPTH);

            envAtlas.destroy();
        });

        [true, false].forEach((gpu) => {
            it(`places screen space particles at the near plane on the ${gpu ? 'GPU' : 'CPU'} path`, function () {
                // the null device skips particle systems by default - enable them so the emitter is created
                app.graphicsDevice.disableParticleSystem = false;
                app.graphicsDevice.supportsGpuParticles = gpu;
                const entity = new Entity();
                entity.addComponent('particlesystem', { numParticles: 10, screenSpace: true });
                app.root.addChild(entity);

                const { material } = entity.particlesystem.emitter;
                const source = reverseZ => material.getShaderVariant({
                    device: app.graphicsDevice,
                    scene: app.scene,
                    objDefs: 0,
                    pass: SHADER_FORWARD,
                    cameraShaderParams: cameraShaderParams(reverseZ)
                }).definition.vshader;

                const PARTICLE_DEPTH = /vec4f?\(localPos\.x, localPos\.y, 1\.0, 1\.0\)/;
                expect(source(true)).to.match(PARTICLE_DEPTH);
                expect(source(false)).to.not.match(PARTICLE_DEPTH);
            });
        });
    });

    describe('Renderer#getReverseZDepthState', function () {

        /** @type {Application} */
        let app;

        beforeEach(function () {
            jsdomSetup();
            app = createApp();
        });

        afterEach(function () {
            app.destroy();
            jsdomTeardown();
        });

        it('reverses the depth test functions', function () {
            const funcs = [FUNC_NEVER, FUNC_LESS, FUNC_EQUAL, FUNC_LESSEQUAL, FUNC_GREATER, FUNC_NOTEQUAL, FUNC_GREATEREQUAL, FUNC_ALWAYS];
            const reversed = funcs.map(func => app.renderer.getReverseZDepthState(new DepthState(func, false)).func);

            expect(reversed).to.deep.equal([FUNC_NEVER, FUNC_GREATER, FUNC_EQUAL, FUNC_GREATEREQUAL, FUNC_LESS, FUNC_NOTEQUAL, FUNC_LESSEQUAL, FUNC_ALWAYS]);
        });

        it('keeps the write and reverses the biases', function () {
            const depthState = new DepthState(FUNC_LESS, false);
            depthState.depthBias = -0.5;
            depthState.depthBiasSlope = 4;
            const reversed = app.renderer.getReverseZDepthState(depthState);

            expect(reversed.write).to.equal(false);
            expect(reversed.depthBias).to.equal(0.5);
            expect(reversed.depthBiasSlope).to.equal(-4);
        });

        it('creates a depth state once for equal depth states', function () {
            const reversed = app.renderer.getReverseZDepthState(new DepthState(FUNC_LESSEQUAL, true));

            expect(app.renderer.getReverseZDepthState(new DepthState(FUNC_LESSEQUAL, true))).to.equal(reversed);
            expect(app.renderer.getReverseZDepthState(DepthState.DEFAULT)).to.equal(reversed);
            expect(app.renderer.getReverseZDepthState(new DepthState(FUNC_LESSEQUAL, false))).to.not.equal(reversed);

            // the biases are part of the key of a depth state, so each one gets its own reversed state
            const biased = new DepthState(FUNC_LESSEQUAL, true);
            biased.depthBias = 1;
            const reversedBiased = app.renderer.getReverseZDepthState(biased);
            expect(reversedBiased).to.not.equal(reversed);
            expect(reversedBiased.depthBias).to.equal(-1);
        });
    });
});
