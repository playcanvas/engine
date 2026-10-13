import { expect } from 'chai';
import sinon from 'sinon';

import { Mat4 } from '../../../src/core/math/mat4.js';
import { Vec4 } from '../../../src/core/math/vec4.js';
import { Compute } from '../../../src/platform/graphics/compute.js';
import {
    BUFFERUSAGE_COPY_SRC, PIXELFORMAT_R32F, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA8, SHADERLANGUAGE_WGSL
} from '../../../src/platform/graphics/constants.js';
import { Shader } from '../../../src/platform/graphics/shader.js';
import { StorageBuffer } from '../../../src/platform/graphics/storage-buffer.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { Camera } from '../../../src/scene/camera.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * @import { Application } from '../../../src/framework/application.js'
 */

// Dawn's null backend validates the API and compiles the shaders, but executes no GPU work, so the
// values the shaders compute are only checked on a backend which runs them
const executesGpuWork = !!process.env.PC_WEBGPU_BACKEND && process.env.PC_WEBGPU_BACKEND !== 'null';

describe('Compute', function () {
    /** @type {Application} */
    let app;

    /** @type {import('../../../src/platform/graphics/graphics-device.js').GraphicsDevice} */
    let device;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        device = app.graphicsDevice;

        // a compute shader needs a compute backend, which the null device does not have
        if (!device.supportsCompute) {
            this.skip();
        }
    });

    afterEach(function () {
        sinon.restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    const createCompute = (source, name = 'Test') => {
        const shader = new Shader(device, { name, shaderLanguage: SHADERLANGUAGE_WGSL, cshader: source });
        return new Compute(device, shader, name);
    };

    const dispatch = async (compute, count, results, length) => {
        compute.setupDispatch(count, 1, 1);
        device.computeDispatch([compute], 'Test');
        const data = new Float32Array(length);
        await results.read(0, length * 4, data, true);
        return data;
    };

    const captureErrors = () => {
        const messages = [];
        const stub = sinon.stub(console, 'error').callsFake((...args) => {
            messages.push(args.map(String).join(' '));
        });
        return { messages, restore: () => stub.restore() };
    };

    describe('#setParameter', function () {

        const source = /* wgsl */`
            uniform value: f32;
            var<storage, read_write> result: array<f32>;

            @compute @workgroup_size(1)
            fn main() {
                result[0] = uniform.value;
            }
        `;

        it('uses the values set on the compute instance, and leaves the scope as it was', async function () {
            const compute = createCompute(source);
            const results = new StorageBuffer(device, 16, BUFFERUSAGE_COPY_SRC);
            compute.setParameter('result', results);
            compute.setParameter('value', 3);

            const global = device.scope.resolve('value');
            global.setValue(7);

            const data = await dispatch(compute, 1, results, 1);
            if (executesGpuWork) {
                expect(data[0]).to.equal(3);
            }
            expect(global.value).to.equal(7);

            compute.destroy();
            results.destroy();
        });

        it('reports a value the shader uses but the compute instance does not have', async function () {
            const compute = createCompute(source, 'MissingValue');
            const results = new StorageBuffer(device, 16, BUFFERUSAGE_COPY_SRC);
            compute.setParameter('result', results);

            // the value set globally does not count
            device.scope.resolve('value').setValue(7);

            const errors = captureErrors();
            await dispatch(compute, 1, results, 1);
            await dispatch(compute, 1, results, 1);
            errors.restore();

            const reports = errors.messages.filter(message => message.includes('MissingValue') && message.includes('value'));
            expect(reports).to.have.lengthOf(1);

            compute.destroy();
            results.destroy();
        });

        describe('dispatched more than once in a submit', function () {

            const captureWarnings = () => {
                const messages = [];
                const stub = sinon.stub(console, 'warn').callsFake((...args) => {
                    messages.push(args.map(String).join(' '));
                });
                return { messages, restore: () => stub.restore() };
            };

            const createInstance = (shader, name, results) => {
                const compute = new Compute(device, shader, name);
                compute.setParameter('result', results);
                compute.setParameter('value', 1);
                compute.setupDispatch(1, 1, 1);
                return compute;
            };

            // dispatches twice, alternating between the instances and submitting in between when
            // asked to, and returns the warnings about the computes of the name
            const run = async (name, instanceCount, submitBetween) => {
                const shader = new Shader(device, { name, shaderLanguage: SHADERLANGUAGE_WGSL, cshader: source });
                const results = new StorageBuffer(device, 16, BUFFERUSAGE_COPY_SRC);
                const computes = [];
                for (let i = 0; i < instanceCount; i++) {
                    computes.push(createInstance(shader, name, results));
                }

                const warnings = captureWarnings();
                device.computeDispatch([computes[0]], 'Test');
                if (submitBetween) {
                    await results.read(0, 4, new Float32Array(1), true);
                }
                device.computeDispatch([computes[1 % instanceCount]], 'Test');
                await results.read(0, 4, new Float32Array(1), true);
                warnings.restore();

                computes.forEach(compute => compute.destroy());
                shader.destroy();
                results.destroy();
                return warnings.messages.filter(message => message.includes(name) && message.includes('more than once'));
            };

            it('reports a compute instance dispatched twice', async function () {
                expect(await run('TwiceDispatched', 1, false)).to.have.lengthOf(1);
            });

            it('does not report a compute instance dispatched in separate submits', async function () {
                expect(await run('TwiceSubmitted', 1, true)).to.have.lengthOf(0);
            });

            it('does not report compute instances sharing a shader, each dispatched once', async function () {
                expect(await run('TwoInstances', 2, false)).to.have.lengthOf(0);
            });
        });

        it('rejects the names the scene map chunks use', function () {
            const compute = createCompute(source);
            const errors = captureErrors();
            compute.setParameter('computeSceneDepthMap', null);
            errors.restore();
            expect(errors.messages.some(message => message.includes('setSceneDepthMap'))).to.equal(true);
            compute.destroy();
        });
    });

    describe('#setSceneDepthMap', function () {

        const source = /* wgsl */`
            #include "sceneDepthCS"
            var<storage, read_write> result: array<vec4f>;

            @compute @workgroup_size(1)
            fn main(@builtin(global_invocation_id) id: vec3u) {
                let texel = vec2i(i32(id.x), 0);
                result[id.x] = vec4f(sceneDepthWorldPosition(texel), sceneDepthLinear(texel));
            }
        `;

        const near = 0.5;
        const far = 100;
        const depths = [1, 4, 20, 60];

        // a camera at the origin looking down -z, with the projection the shaders are given on WebGPU
        const viewProjection = new Mat4();
        Camera.applyShaderProjectionTransform(new Mat4().setPerspective(60, 2, near, far), viewProjection, false, true);
        const viewProjectionInverse = viewProjection.clone().invert();

        const createCamera = () => {
            const camera = new Camera(device);
            camera.nearClip = near;
            camera.farClip = far;
            camera._viewProjInverse.copy(viewProjectionInverse);
            return camera;
        };

        // the world position of each texel of a 4 x 1 depth map, from the depth along its ray
        const expectedPositions = () => depths.map((depth, i) => {
            const ndcX = ((i + 0.5) / depths.length) * 2 - 1;
            const nearPoint = viewProjectionInverse.transformVec4(new Vec4(ndcX, 0, 0, 1), new Vec4());
            const farPoint = viewProjectionInverse.transformVec4(new Vec4(ndcX, 0, 1, 1), new Vec4());
            nearPoint.mulScalar(1 / nearPoint.w);
            farPoint.mulScalar(1 / farPoint.w);
            const t = (depth - near) / (far - near);
            const nearValues = [nearPoint.x, nearPoint.y, nearPoint.z];
            const farValues = [farPoint.x, farPoint.y, farPoint.z];
            return nearValues.map((value, c) => value + (farValues[c] - value) * t);
        });

        const check = (data) => {
            if (!executesGpuWork) return;
            const positions = expectedPositions();
            depths.forEach((depth, i) => {
                expect(data[i * 4 + 3]).to.be.closeTo(depth, depth * 1e-3);
                for (let c = 0; c < 3; c++) {
                    expect(data[i * 4 + c]).to.be.closeTo(positions[i][c], Math.max(1e-3, depth * 1e-3));
                }
            });
        };

        const run = async (values, linear, reciprocal) => {
            const camera = createCamera();
            const texture = new Texture(device, {
                width: depths.length, height: 1, format: PIXELFORMAT_R32F, mipmaps: false, levels: [new Float32Array(values)]
            });
            camera.publishSceneDepthMap(texture, device.renderVersion, linear, false, reciprocal);

            const compute = createCompute(source);
            const results = new StorageBuffer(device, depths.length * 16, BUFFERUSAGE_COPY_SRC);
            compute.setParameter('result', results);
            compute.setSceneDepthMap(camera.sceneDepthMapHandle);

            const data = await dispatch(compute, depths.length, results, depths.length * 4);
            const variant = compute.activeShader;

            compute.destroy();
            results.destroy();
            texture.destroy();
            camera.destroy();
            return { data, variant };
        };

        it('decodes a depth buffer', async function () {
            // the depth buffer value each depth is projected to
            const values = depths.map((depth) => {
                const clip = viewProjection.transformVec4(new Vec4(0, 0, -depth, 1), new Vec4());
                return clip.z / clip.w;
            });
            const { data } = await run(values, false, false);
            check(data);
        });

        it('decodes a linear depth', async function () {
            const { data, variant } = await run(depths, true, false);
            check(data);
            expect(variant.computeDefinition.cdefines.has('SCENE_DEPTHMAP_LINEAR')).to.equal(true);
        });

        it('decodes a reciprocal depth', async function () {
            const { data, variant } = await run(depths.map(depth => 1 / depth), true, true);
            check(data);
            expect(variant.computeDefinition.cdefines.has('SCENE_DEPTHMAP_RECIPROCAL')).to.equal(true);
        });

        describe('with a camera rendering to a part of its target', function () {

            const viewportSource = /* wgsl */`
                #include "sceneDepthCS"
                var<storage, read_write> result: array<vec4f>;

                @compute @workgroup_size(1)
                fn main(@builtin(global_invocation_id) id: vec3u) {
                    let viewport = sceneDepthViewport();
                    let texel = vec2i(viewport.xy + vec2u(id.x % viewport.z, id.x / viewport.z));
                    result[id.x] = vec4f(sceneDepthWorldPosition(texel), sceneDepthLinear(texel));
                }
            `;

            // an 8 x 4 depth map, the camera rendering to its right half and the upper half of the
            // target, a 4 x 2 viewport with the aspect ratio of the projection
            const width = 8;
            const height = 4;
            const viewportWidth = 4;
            const viewportHeight = 2;
            const viewportDepths = [1, 3, 9, 27, 2, 6, 18, 54];

            const run = async (flipY) => {
                const camera = createCamera();
                camera.rect = new Vec4(0.5, 0.5, 0.5, 0.5);

                // the target places the upper half in the first rows, unless its rows are flipped
                const firstRow = flipY ? 2 : 0;
                const values = new Float32Array(width * height);
                viewportDepths.forEach((depth, i) => {
                    const x = 4 + (i % viewportWidth);
                    const y = firstRow + Math.floor(i / viewportWidth);
                    values[y * width + x] = depth;
                });
                const texture = new Texture(device, {
                    width, height, format: PIXELFORMAT_R32F, mipmaps: false, levels: [values]
                });
                camera.publishSceneDepthMap(texture, device.renderVersion, true, false, false, flipY);
                expect(Array.from(camera.sceneDepthMapHandle.viewport)).to.deep.equal([4, firstRow, viewportWidth, viewportHeight]);

                const compute = createCompute(viewportSource);
                const results = new StorageBuffer(device, viewportDepths.length * 16, BUFFERUSAGE_COPY_SRC);
                compute.setParameter('result', results);
                compute.setSceneDepthMap(camera.sceneDepthMapHandle);
                const data = await dispatch(compute, viewportDepths.length, results, viewportDepths.length * 4);

                compute.destroy();
                results.destroy();
                texture.destroy();
                camera.destroy();
                return data;
            };

            // the world position of each texel of the viewport, from the depth along its ray
            const check = (data) => {
                if (!executesGpuWork) return;
                viewportDepths.forEach((depth, i) => {
                    const ndcX = (((i % viewportWidth) + 0.5) / viewportWidth) * 2 - 1;
                    const ndcY = 1 - ((Math.floor(i / viewportWidth) + 0.5) / viewportHeight) * 2;
                    const nearPoint = viewProjectionInverse.transformVec4(new Vec4(ndcX, ndcY, 0, 1), new Vec4());
                    const farPoint = viewProjectionInverse.transformVec4(new Vec4(ndcX, ndcY, 1, 1), new Vec4());
                    nearPoint.mulScalar(1 / nearPoint.w);
                    farPoint.mulScalar(1 / farPoint.w);
                    const t = (depth - near) / (far - near);
                    const expected = [
                        nearPoint.x + (farPoint.x - nearPoint.x) * t,
                        nearPoint.y + (farPoint.y - nearPoint.y) * t,
                        nearPoint.z + (farPoint.z - nearPoint.z) * t
                    ];

                    expect(data[i * 4 + 3]).to.be.closeTo(depth, depth * 1e-3);
                    for (let c = 0; c < 3; c++) {
                        expect(data[i * 4 + c]).to.be.closeTo(expected[c], Math.max(1e-3, depth * 1e-3));
                    }
                });
            };

            it('reconstructs the world positions within its viewport', async function () {
                check(await run(false));
            });

            it('reconstructs the world positions within its viewport on a target with flipped rows', async function () {
                check(await run(true));
            });
        });

        it('reads the depth map the handle identifies when the compute is dispatched', async function () {
            const camera = createCamera();
            const first = new Texture(device, { width: depths.length, height: 1, format: PIXELFORMAT_R32F, mipmaps: false, levels: [new Float32Array(depths.map(d => d * 2))] });
            const second = new Texture(device, { width: depths.length, height: 1, format: PIXELFORMAT_R32F, mipmaps: false, levels: [new Float32Array(depths)] });

            const compute = createCompute(source);
            const results = new StorageBuffer(device, depths.length * 16, BUFFERUSAGE_COPY_SRC);
            compute.setParameter('result', results);

            // attached before the camera publishes, and published again before the dispatch
            camera.publishSceneDepthMap(first, device.renderVersion, true, false, false);
            compute.setSceneDepthMap(camera.sceneDepthMapHandle);
            camera.publishSceneDepthMap(second, device.renderVersion, true, false, false);

            check(await dispatch(compute, depths.length, results, depths.length * 4));

            compute.destroy();
            results.destroy();
            first.destroy();
            second.destroy();
            camera.destroy();
        });

        it('reports a detached depth map the shader uses', async function () {
            const camera = createCamera();
            const texture = new Texture(device, { width: depths.length, height: 1, format: PIXELFORMAT_R32F, mipmaps: false, levels: [new Float32Array(depths)] });
            camera.publishSceneDepthMap(texture, device.renderVersion, true, false, false);

            const compute = createCompute(source, 'Detached');
            const results = new StorageBuffer(device, depths.length * 16, BUFFERUSAGE_COPY_SRC);
            compute.setParameter('result', results);
            compute.setSceneDepthMap(camera.sceneDepthMapHandle);
            compute.setSceneDepthMap(null);

            const errors = captureErrors();
            await dispatch(compute, depths.length, results, depths.length * 4);
            errors.restore();
            expect(errors.messages.some(message => message.includes('Detached') && message.includes('setSceneDepthMap'))).to.equal(true);

            compute.destroy();
            results.destroy();
            texture.destroy();
            camera.destroy();
        });

        it('reports the depth map of a destroyed camera', async function () {
            const camera = createCamera();
            const compute = createCompute(source, 'DestroyedCamera');
            const results = new StorageBuffer(device, depths.length * 16, BUFFERUSAGE_COPY_SRC);
            compute.setParameter('result', results);
            compute.setSceneDepthMap(camera.sceneDepthMapHandle);
            camera.destroy();

            const errors = captureErrors();
            await dispatch(compute, depths.length, results, depths.length * 4);
            errors.restore();
            expect(errors.messages.some(message => message.includes('DestroyedCamera') && message.includes('destroyed'))).to.equal(true);

            compute.destroy();
            results.destroy();
        });
    });

    describe('#setSceneColorMap', function () {

        const source = /* wgsl */`
            #include "sceneColorCS"
            var<storage, read_write> result: array<vec4f>;

            @compute @workgroup_size(1)
            fn main() {
                let color = sceneColorLoad(vec2i(0), 0);
                result[0] = color;
                result[1] = vec4f(sceneColorToLinear(color.rgb), 1.0);
                result[2] = vec4f(sceneColorToDisplay(color.rgb), 1.0);
                result[3] = sceneColorSample(vec2f(0.5), 0.0);
            }
        `;

        const run = async (texture, gamma) => {
            const camera = new Camera(device);
            camera.publishSceneColorMap(texture, gamma);

            const compute = createCompute(source);
            const results = new StorageBuffer(device, 4 * 16, BUFFERUSAGE_COPY_SRC);
            compute.setParameter('result', results);
            compute.setSceneColorMap(camera.sceneColorMapHandle);

            const data = await dispatch(compute, 1, results, 16);
            const variant = compute.activeShader;

            compute.destroy();
            results.destroy();
            camera.destroy();
            return { data, variant };
        };

        const createTexture = (format, data) => new Texture(device, {
            width: 1, height: 1, format, mipmaps: false, levels: [data]
        });

        it('converts a gamma encoded color', async function () {
            const texture = createTexture(PIXELFORMAT_RGBA8, new Uint8Array([128, 64, 255, 255]));
            const { data, variant } = await run(texture, true);
            if (executesGpuWork) {
                const stored = [128 / 255, 64 / 255, 1];
                stored.forEach((value, c) => {
                    expect(data[c]).to.be.closeTo(value, 1e-3);
                    expect(data[4 + c]).to.be.closeTo(value ** 2.2, 1e-3);
                    expect(data[8 + c]).to.be.closeTo(value, 1e-3);
                    expect(data[12 + c]).to.be.closeTo(value, 1e-3);
                });
            }
            expect(variant.computeDefinition.cdefines.has('SCENE_COLORMAP_GAMMA')).to.equal(true);
            texture.destroy();
        });

        it('converts a linear color', async function () {
            const texture = createTexture(PIXELFORMAT_RGBA8, new Uint8Array([128, 64, 255, 255]));
            const { data, variant } = await run(texture, false);
            if (executesGpuWork) {
                const stored = [128 / 255, 64 / 255, 1];
                stored.forEach((value, c) => {
                    expect(data[4 + c]).to.be.closeTo(value, 1e-3);
                    expect(data[8 + c]).to.be.closeTo(value ** (1 / 2.2), 1e-3);
                });
            }
            expect(variant.computeDefinition).to.not.equal(null);
            texture.destroy();
        });

        it('reads a color map which cannot be filtered', async function () {
            sinon.replace(device, 'textureFloatFilterable', false);

            const texture = createTexture(PIXELFORMAT_RGBA32F, new Float32Array([2, 0.5, 0.25, 1]));
            const { data, variant } = await run(texture, false);

            if (executesGpuWork) {
                expect(Array.from(data.slice(12, 16))).to.deep.equal([2, 0.5, 0.25, 1]);
            }
            expect(variant.computeDefinition.cdefines.has('SCENE_COLORMAP_UNFILTERABLE')).to.equal(true);
            texture.destroy();
        });
    });
});
