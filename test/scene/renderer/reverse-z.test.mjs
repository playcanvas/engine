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
import { FOG_LINEAR, PROJECTION_ORTHOGRAPHIC, SHADER_FORWARD, SHADERDEF_SCREENSPACE } from '../../../src/scene/constants.js';
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

    describe('Camera.setReverseZDepth', function () {

        for (const [near, far] of [[0.1, 1000], [0.1, 100000], [0.01, 1000000]]) {
            for (const perspective of [true, false]) {
                it(`preserves ${perspective ? 'perspective' : 'orthographic'} depth at near=${near}, far=${far}`, function () {
                    const source = perspective ?
                        new Mat4().setPerspective(60, 1, near, far) :
                        new Mat4().setOrtho(-1, 1, -1, 1, near, far);

                    for (const flipY of [false, true]) {
                        const projection = Camera.applyShaderProjectionTransform(source, new Mat4(), flipY, true, true);
                        const before = Array.from(projection.data);
                        Camera.setReverseZDepth(projection, perspective, near, far);

                        expect(clipDepth(projection, -near)).to.be.closeTo(1, 1e-6);
                        // A tolerance scaled to the depth coefficient detects float32 cancellation.
                        const tolerance = perspective ? near / far * 1e-6 : 1e-6;
                        expect(clipDepth(projection, -far)).to.be.closeTo(0, tolerance);
                        expect(clipDepth(projection, -far * 0.9)).to.be.above(0);
                        expect(clipDepth(projection, -far * 1.1)).to.be.below(0);
                        for (let i = 0; i < 16; i++) {
                            if (i !== 10 && i !== 14) {
                                expect(projection.data[i]).to.equal(before[i]);
                            }
                        }
                    }
                });
            }
        }
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

        // reverse-z is set only on a device supporting it (WebGPU), so the tests rendering with it
        // run under `npm run test:webgpu`
        const requireReverseZ = (test) => {
            if (!app.graphicsDevice.supportsReverseZ) {
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

            it('is set only on a device supporting it', function () {
                const warn = spy(Debug, 'warnOnce');
                const entity = new Entity('camera');
                entity.addComponent('camera', { reverseZ: true });

                const supported = app.graphicsDevice.supportsReverseZ;
                expect(entity.camera.reverseZ).to.equal(supported);
                expect(entity.camera.camera.shaderParams.reverseZ).to.equal(false);
                expect(warn.calledWithMatch('not supported by the device')).to.equal(!supported);

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
                requireReverseZ(this);
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

        it('is supported on WebGPU', function () {
            expect(app.graphicsDevice.supportsReverseZ).to.equal(app.graphicsDevice.isWebGPU);
        });

        it('follows the capability of the device, not its type', function () {
            const device = app.graphicsDevice;
            const supported = device.supportsReverseZ;
            device.supportsReverseZ = !supported;
            try {
                const camera = new Camera(device);
                camera.reverseZ = true;
                expect(camera.reverseZ).to.equal(!supported);
            } finally {
                device.supportsReverseZ = supported;
            }
        });

        it('is set on the Camera only on a device supporting it', function () {
            const warn = spy(Debug, 'warnOnce');
            const camera = new Camera(app.graphicsDevice);
            camera.reverseZ = true;

            const supported = app.graphicsDevice.supportsReverseZ;
            expect(camera.reverseZ).to.equal(supported);
            expect(camera.reverseZActive).to.equal(supported);
            expect(warn.calledWithMatch('not supported by the device')).to.equal(!supported);
        });

        it('is not applied to the views of an XR session, and stays set', function () {
            requireReverseZ(this);
            const camera = createCamera('camera', true).camera;
            expect(camera.reverseZActive).to.equal(true);

            camera.xrViews = [];
            expect(camera.reverseZ).to.equal(true);
            expect(camera.reverseZActive).to.equal(false);

            camera.xrViews = null;
            expect(camera.reverseZActive).to.equal(true);
        });

        it('supplies the REVERSE_Z define to the shaders the camera renders with', function () {
            requireReverseZ(this);
            const camera = createCamera('camera', true);
            addBox();
            app.render();

            expect(camera.camera.shaderParams.reverseZ).to.equal(true);
            expect(camera.camera.shaderParams.defines.has('REVERSE_Z')).to.equal(true);
        });

        // the depth states the render pipelines are looked up with, copied as the device reuses the
        // object it passes
        const capturePipelineDepthStates = () => {
            const pipeline = app.graphicsDevice.renderPipeline;
            const get = pipeline.get.bind(pipeline);
            const states = [];
            pipeline.get = (...args) => {
                states.push(args[8].clone());
                return get(...args);
            };
            return states;
        };

        const createBiasedMaterial = () => {
            const material = new StandardMaterial();
            material.depthBias = 2;
            material.slopeDepthBias = 3;
            material.update();
            return material;
        };

        it('reverses the depth tests and biases of the materials', function () {
            requireReverseZ(this);
            createCamera('camera', true);
            const material = createBiasedMaterial();
            addBox(material);

            const setRenderPassReverseZ = spy(app.graphicsDevice, 'setReverseZ');
            const states = capturePipelineDepthStates();
            app.render();

            // the renderer sets the depth state of the material, which the device reverses
            expect(setRenderPassReverseZ.args.some(args => args[0] === true)).to.equal(true);
            const reversed = states.find(state => state.func === FUNC_GREATEREQUAL);
            expect(reversed, 'the depth state of the box').to.not.equal(undefined);
            expect(states.some(state => state.func === FUNC_LESSEQUAL && state.depthBias === 2)).to.equal(false);
            expect(reversed.write).to.equal(true);
            expect(reversed.depthBias).to.equal(-2);
            expect(reversed.depthBiasSlope).to.equal(-3);

            // the material keeps its depth state
            expect(material.depthState.func).to.equal(FUNC_LESSEQUAL);
            expect(material.depthState.depthBias).to.equal(2);
        });

        it('reverses the depth states only for the passes of a camera with reverse-z', function () {
            requireReverseZ(this);

            // both cameras render the same material, so the depth state the renderer sets does not
            // change between their passes, only the reverse-z setting does
            const reversedCamera = createCamera('reversed', true);
            reversedCamera.priority = 0;
            const standardCamera = createCamera('standard', false);
            standardCamera.priority = 1;
            addBox(createBiasedMaterial());

            const states = capturePipelineDepthStates();
            app.render();

            expect(states.some(state => state.func === FUNC_GREATEREQUAL && state.depthBias === -2), 'reversed').to.equal(true);
            expect(states.some(state => state.func === FUNC_LESSEQUAL && state.depthBias === 2), 'standard').to.equal(true);
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

        // the depth clear value of each GPU render pass started, as the device sets it up
        const captureDepthClearValues = () => {
            const device = app.graphicsDevice;
            const startRenderPass = device.startRenderPass.bind(device);
            const values = [];
            device.startRenderPass = (renderPass) => {
                startRenderPass(renderPass);
                const renderTarget = renderPass.renderTarget || device.backBuffer;
                const attachment = renderTarget.impl.renderPassDescriptor.depthStencilAttachment;
                if (renderPass.depthStencilOps.clearDepth && attachment) {
                    values.push(attachment.depthClearValue);
                }
            };
            return values;
        };

        it('clears the depth to the reverse of the clear depth of the camera', function () {
            requireReverseZ(this);
            const camera = createCamera('camera', true);
            camera.clearDepth = 0.75;

            const values = captureDepthClearValues();
            app.render();

            expect(values).to.deep.equal([0.25]);
        });

        it('keeps the clear depth of a camera without reverse-z', function () {
            requireReverseZ(this);
            const camera = createCamera('camera', false);
            camera.clearDepth = 0.75;

            const values = captureDepthClearValues();
            app.render();

            expect(values).to.deep.equal([0.75]);
        });

        it('keeps the clear depth of the camera on its passes, which the device reverses', function () {
            requireReverseZ(this);
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
            passes.forEach(pass => pass.before());
            expect(passes.map(pass => pass.depthStencilOps.clearDepthValue)).to.deep.equal([1, 1]);
            expect(passes.map(pass => pass.reverseZ)).to.deep.equal([true, false]);

            passes.forEach(pass => pass.destroy());
        });

        it('clears the depth for a reverse-z setting changed by a prerender handler', function () {
            requireReverseZ(this);
            createCamera('camera', false);
            app.scene.on('prerender', (cameraComponent) => {
                cameraComponent.reverseZ = true;
            });

            const values = captureDepthClearValues();
            app.render();

            expect(values).to.deep.equal([0]);
        });

        it('reverses the depth of the clears within a pass rendering with reverse-z', function () {
            requireReverseZ(this);

            // a camera covering part of its render target clears with GraphicsDevice#clear within
            // its pass, instead of with the clear of the pass
            const clearDepthOf = (reverseZ) => {
                const camera = createCamera(reverseZ ? 'reversed' : 'standard', reverseZ);
                camera.rect = new Vec4(0, 0, 0.5, 1);
                camera.clearDepth = 0.75;

                const set = spy(app.graphicsDevice.clearRenderer.uniformBuffer, 'set');
                app.render();
                const depths = set.args.filter(args => args[0] === 'depth').map(args => args[1]);
                set.restore();
                camera.entity.destroy();
                return depths;
            };

            expect(clearDepthOf(true)).to.deep.equal([0.25]);
            expect(clearDepthOf(false)).to.deep.equal([0.75]);
        });

        it('keeps the frustum of the camera without reverse-z', function () {
            requireReverseZ(this);
            const reversed = createCamera('reversed', true);
            const standard = createCamera('standard', false);
            addBox();
            app.render();

            expect(Array.from(reversed.frustum.planeData)).to.deep.equal(Array.from(standard.frustum.planeData));
        });

        it('renders with the reversed projection on WebGPU', function () {
            requireReverseZ(this);

            const camera = createCamera('camera', true);
            camera.nearClip = 0.5;
            camera.farClip = 1000;
            addBox();
            app.render();

            const projection = new Mat4().set(app.graphicsDevice.scope.resolve('matrix_projection').value);
            expect(clipDepth(projection, -0.5)).to.be.closeTo(1, 1e-6);
            expect(clipDepth(projection, -1000)).to.be.closeTo(0, 1e-6);
        });

        it('keeps the far plane in place with a small near clip and a large far clip', function () {
            requireReverseZ(this);

            const camera = createCamera('camera', true);
            camera.nearClip = 0.01;
            camera.farClip = 100000;
            addBox();
            app.render();

            // built from the float32 terms of the projection, the far plane was at about 83900
            const resolve = name => new Mat4().set(app.graphicsDevice.scope.resolve(name).value);
            for (const projection of [resolve('matrix_projection'), resolve('matrix_projectionSkybox')]) {
                expect(clipDepth(projection, -0.01)).to.be.closeTo(1, 1e-6);
                expect(clipDepth(projection, -100000)).to.be.closeTo(0, 1e-6);
                expect(clipDepth(projection, -90000)).to.be.above(1e-8);
            }
        });

        it('keeps the far plane in place for an orthographic camera', function () {
            requireReverseZ(this);

            const camera = createCamera('camera', true);
            camera.projection = PROJECTION_ORTHOGRAPHIC;
            camera.nearClip = 0.01;
            camera.farClip = 100000;
            addBox();
            app.render();

            const projection = new Mat4().set(app.graphicsDevice.scope.resolve('matrix_projection').value);
            expect(clipDepth(projection, -0.01)).to.be.closeTo(1, 1e-6);
            expect(clipDepth(projection, -100000)).to.be.closeTo(0, 1e-6);
            expect(clipDepth(projection, -50000.005)).to.be.closeTo(0.5, 1e-6);
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

    describe('DepthState#copyReversed', function () {

        it('reverses the depth test functions', function () {
            const funcs = [FUNC_NEVER, FUNC_LESS, FUNC_EQUAL, FUNC_LESSEQUAL, FUNC_GREATER, FUNC_NOTEQUAL, FUNC_GREATEREQUAL, FUNC_ALWAYS];
            const reversed = funcs.map(func => new DepthState().copyReversed(new DepthState(func, false)).func);

            expect(reversed).to.deep.equal([FUNC_NEVER, FUNC_GREATER, FUNC_EQUAL, FUNC_GREATEREQUAL, FUNC_LESS, FUNC_NOTEQUAL, FUNC_LESSEQUAL, FUNC_ALWAYS]);
        });

        it('keeps the write and reverses the biases', function () {
            for (const write of [false, true]) {
                const depthState = new DepthState(FUNC_LESS, write);
                depthState.depthBias = -0.5;
                depthState.depthBiasSlope = 4;
                const reversed = new DepthState().copyReversed(depthState);

                expect(reversed.write).to.equal(write);
                expect(reversed.depthBias).to.equal(0.5);
                expect(reversed.depthBiasSlope).to.equal(-4);
            }
        });

        it('keeps the source depth state', function () {
            const depthState = new DepthState(FUNC_LESSEQUAL, true);
            depthState.depthBias = 1;
            const key = depthState.key;
            new DepthState().copyReversed(depthState);

            expect(depthState.func).to.equal(FUNC_LESSEQUAL);
            expect(depthState.depthBias).to.equal(1);
            expect(depthState.key).to.equal(key);
        });
    });
});
