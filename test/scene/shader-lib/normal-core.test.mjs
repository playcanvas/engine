import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { Preprocessor } from '../../../src/core/preprocessor.js';
import { Entity } from '../../../src/framework/entity.js';
import { SEMANTIC_NORMAL, SEMANTIC_POSITION } from '../../../src/platform/graphics/constants.js';
import { ShaderMaterial } from '../../../src/scene/materials/shader-material.js';
import normalCoreGLSL from '../../../src/scene/shader-lib/glsl/chunks/common/vert/normalCore.js';
import normalCoreWGSL from '../../../src/scene/shader-lib/wgsl/chunks/common/vert/normalCore.js';
import { ShaderPass } from '../../../src/scene/shader-pass.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// The normal matrix of a draw is the matrix_normal uniform, which the forward passes set. Skinned,
// batched and instanced meshes, which have none of their own, and the shadow pass, which sets none,
// use the upper 3x3 of the model matrix instead, and do not declare the uniform. Under
// `npm run test:webgpu` the WGSL of each shader is compiled by Dawn, and an error fails the test.
describe('Normal core vertex chunk', function () {

    describe('declarations', function () {

        const chunks = [['GLSL', normalCoreGLSL, 'mat3(modelMatrix[0].xyz'], ['WGSL', normalCoreWGSL, 'mat3x3f(modelMatrix[0].xyz']];

        for (const [language, chunk, upper3x3] of chunks) {

            it(`declares and returns the normal matrix uniform of a mesh, in ${language}`, function () {
                const source = Preprocessor.run(chunk);
                expect(source).to.contain('matrix_normal');
                expect(source).not.to.contain(upper3x3);
            });

            for (const define of ['SKIN', 'BATCH', 'INSTANCING', 'SHADOW_PASS']) {
                it(`returns the upper 3x3 of the model matrix, without the uniform, with ${define}, in ${language}`, function () {
                    const source = Preprocessor.run(`#define ${define}\n${chunk}`);
                    expect(source).not.to.contain('matrix_normal');
                    expect(source).to.contain(upper3x3);
                });
            }
        }
    });

    describe('ShaderMaterial', function () {

        let app;

        beforeEach(function () {
            jsdomSetup();
            app = createApp();

            const camera = new Entity('camera');
            camera.addComponent('camera');
            camera.setPosition(0, 2, 8);
            app.root.addChild(camera);

            const light = new Entity('light');
            light.addComponent('light', { type: 'directional', castShadows: true });
            light.setEulerAngles(45, 30, 0);
            app.root.addChild(light);
        });

        afterEach(function () {
            sinon.restore();
            app.destroy();
            jsdomTeardown();
        });

        // a user shader with the world normal of the engine chunks, in the shadow pass as well
        const userMaterial = () => new ShaderMaterial({
            uniqueName: 'NormalCoreUserShader',
            vertexGLSL: `
                #include "transformCoreVS"
                #include "normalCoreVS"
                varying vec3 worldNormal;
                void main(void) {
                    mat4 modelMatrix = getModelMatrix();
                    gl_Position = matrix_viewProjection * modelMatrix * vec4(getLocalPosition(vertex_position.xyz), 1.0);
                    worldNormal = normalize(getNormalMatrix(modelMatrix) * getLocalNormal(vertex_normal));
                }
            `,
            fragmentGLSL: `
                varying vec3 worldNormal;
                void main(void) {
                    gl_FragColor = vec4(worldNormal, 1.0);
                }
            `,
            vertexWGSL: `
                #include "transformCoreVS"
                #include "normalCoreVS"
                varying worldNormal: vec3f;
                @vertex fn vertexMain(input: VertexInput) -> VertexOutput {
                    var output: VertexOutput;
                    let modelMatrix = getModelMatrix();
                    output.position = uniform.matrix_viewProjection * modelMatrix * vec4f(getLocalPosition(vertex_position.xyz), 1.0);
                    output.worldNormal = normalize(getNormalMatrix(modelMatrix) * getLocalNormal(vertex_normal));
                    return output;
                }
            `,
            fragmentWGSL: `
                varying worldNormal: vec3f;
                @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
                    var output: FragmentOutput;
                    output.color = vec4f(input.worldNormal, 1.0);
                    return output;
                }
            `,
            attributes: { vertex_position: SEMANTIC_POSITION, vertex_normal: SEMANTIC_NORMAL }
        });

        it('reads the normal matrix uniform in the forward pass only, and never an unset one', function () {
            const warn = sinon.spy(Debug, 'warnOnce');
            const material = userMaterial();

            // the shader variants of the material, by whether their pass is a shadow pass
            const shadow = [];
            const forward = [];
            const getShaderVariant = material.getShaderVariant;
            sinon.stub(material, 'getShaderVariant').callsFake(function (params) {
                const shader = getShaderVariant.call(this, params);
                (ShaderPass.get(app.graphicsDevice).getByIndex(params.pass).isShadow ? shadow : forward).push(shader);
                return shader;
            });

            const entity = new Entity('box');
            entity.addComponent('render', { type: 'box', material });
            app.root.addChild(entity);
            app.render();

            const shaders = [...shadow, ...forward];
            expect(shadow.length).to.be.greaterThan(0);
            expect(forward).to.have.lengthOf(1);

            for (const shader of shaders) {
                expect(shader.failed, shader.label).to.equal(false);
            }
            expect(forward[0].definition.vshader).to.contain('matrix_normal');
            for (const shader of shadow) {
                expect(shader.definition.vshader, shader.label).not.to.contain('matrix_normal');
            }

            // the debug check knows it on WebGPU, which reflects the declared uniforms, and not on the
            // null device
            const known = app.graphicsDevice.isWebGPU;
            expect(forward[0].debugReadsUniform('matrix_normal')).to.equal(known ? true : null);
            for (const shader of shadow) {
                expect(shader.debugReadsUniform('matrix_normal'), shader.label).to.equal(known ? false : null);
                expect(shader._debugNormalMatrixChecked, shader.label).to.equal(known);
            }

            const unset = warn.args.filter(args => String(args[0]).startsWith('Value was not set'));
            expect(unset.map(args => args[0])).to.deep.equal([]);
            expect(warn.args.filter(args => String(args[0]).includes('reads matrix_normal'))).to.have.lengthOf(0);
        });

        it('gives a shader declaring the normal matrix itself the identity in the shadow pass', function () {
            const warn = sinon.spy(Debug, 'warnOnce');
            const material = new ShaderMaterial({
                uniqueName: 'NormalCoreOwnUniformShader',
                vertexGLSL: `
                    attribute vec4 vertex_position;
                    attribute vec3 vertex_normal;
                    uniform mat4 matrix_model;
                    uniform mat4 matrix_viewProjection;
                    uniform mat3 matrix_normal;
                    varying vec3 worldNormal;
                    void main(void) {
                        worldNormal = normalize(matrix_normal * vertex_normal);
                        gl_Position = matrix_viewProjection * matrix_model * vertex_position;
                    }
                `,
                fragmentGLSL: `
                    varying vec3 worldNormal;
                    void main(void) {
                        gl_FragColor = vec4(worldNormal, 1.0);
                    }
                `,
                vertexWGSL: `
                    attribute vertex_position: vec4f;
                    attribute vertex_normal: vec3f;
                    uniform matrix_model: mat4x4f;
                    uniform matrix_viewProjection: mat4x4f;
                    uniform matrix_normal: mat3x3f;
                    varying worldNormal: vec3f;
                    @vertex fn vertexMain(input: VertexInput) -> VertexOutput {
                        var output: VertexOutput;
                        output.worldNormal = normalize(uniform.matrix_normal * input.vertex_normal);
                        output.position = uniform.matrix_viewProjection * uniform.matrix_model * input.vertex_position;
                        return output;
                    }
                `,
                fragmentWGSL: `
                    varying worldNormal: vec3f;
                    @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
                        var output: FragmentOutput;
                        output.color = vec4f(input.worldNormal, 1.0);
                        return output;
                    }
                `,
                attributes: { vertex_position: SEMANTIC_POSITION, vertex_normal: SEMANTIC_NORMAL }
            });

            // a rotated and non-uniformly scaled box, whose normal matrix is not the identity
            const entity = new Entity('box');
            entity.addComponent('render', { type: 'box', material });
            entity.setEulerAngles(30, 40, 0);
            entity.setLocalScale(1, 2, 1);
            app.root.addChild(entity);

            // the forward pass of the first frame leaves the normal matrix of the box set
            app.render();

            // the normal matrix each shadow caster is drawn with
            const renderer = app.renderer;
            const shadowRenderer = renderer.shadowRenderer;
            const normalMatrices = [];
            let inShadowPass = false;
            const submitCasters = shadowRenderer.submitCasters;
            sinon.stub(shadowRenderer, 'submitCasters').callsFake(function (...args) {
                inShadowPass = true;
                submitCasters.apply(this, args);
                inShadowPass = false;
            });
            const draw = app.graphicsDevice.draw;
            sinon.stub(app.graphicsDevice, 'draw').callsFake(function (...args) {
                if (inShadowPass) {
                    normalMatrices.push(Array.from(renderer.normalMatrixId.value));
                }
                return draw.apply(this, args);
            });
            app.render();

            expect(normalMatrices.length).to.be.greaterThan(0);
            for (const normalMatrix of normalMatrices) {
                expect(normalMatrix).to.deep.equal([1, 0, 0, 0, 1, 0, 0, 0, 1]);
            }
            const unset = warn.args.filter(args => String(args[0]).startsWith('Value was not set'));
            expect(unset.map(args => args[0])).to.deep.equal([]);

            // the debug build warns about it once per shadow shader, where the device can tell
            const reads = warn.args.filter(args => String(args[0]).includes('reads matrix_normal in the shadow pass'));
            expect(reads).to.have.lengthOf(app.graphicsDevice.isWebGPU ? 1 : 0);
        });
    });
});
