import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../src/core/debug.js';
import { Vec3 } from '../../src/core/math/vec3.js';
import { Plane } from '../../src/core/shape/plane.js';
import { Entity } from '../../src/framework/entity.js';
import { SEMANTIC_POSITION, TYPE_FLOAT32 } from '../../src/platform/graphics/constants.js';
import { VertexFormat } from '../../src/platform/graphics/vertex-format.js';
import { CameraShaderParams } from '../../src/scene/camera-shader-params.js';
import {
    LAYERID_WORLD, LIGHTTYPE_DIRECTIONAL, SHADER_FORWARD, SHADER_PICK, SHADER_PREPASS,
    SHADERDEF_CLIP, SHADERDEF_SCREENSPACE, SHADOW_PCF3_32F
} from '../../src/scene/constants.js';
import { LightList } from '../../src/scene/lighting/light-list.js';
import { LitMaterial } from '../../src/scene/materials/lit-material.js';
import { ShaderMaterial } from '../../src/scene/materials/shader-material.js';
import { StandardMaterial } from '../../src/scene/materials/standard-material.js';
import { MeshInstance } from '../../src/scene/mesh-instance.js';
import { ShaderPass } from '../../src/scene/shader-pass.js';
import { createApp } from '../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../jsdom.mjs';

// Under `npm run test:webgpu` the WGSL of each shader is compiled by Dawn, and an error fails the
// test.
describe('Clipping planes', function () {

    let app;

    let camera;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        const entity = new Entity('camera');
        entity.addComponent('camera');
        entity.setPosition(0, 1, 10);
        app.root.addChild(entity);
        camera = entity.camera;
    });

    afterEach(function () {
        sinon.restore();
        app.destroy();
        jsdomTeardown();
    });

    const addBox = (material = new StandardMaterial(), name = 'box') => {
        const entity = new Entity(name);
        entity.addComponent('render', { type: 'box', material });
        app.root.addChild(entity);
        return entity;
    };

    // a LitMaterial with a minimal front end, in both shader languages
    const createLitMaterial = () => {
        const material = new LitMaterial();
        material.shaderChunkGLSL = `
            #include "litShaderCorePS"
            void evaluateFrontend() {
                litArgs_albedo = vec3(0.5);
                litArgs_opacity = 1.0;
                litArgs_worldNormal = dVertexNormalW;
            }`;
        material.shaderChunkWGSL = `
            #include "litShaderCorePS"
            fn evaluateFrontend() {
                litArgs_albedo = vec3f(0.5);
                litArgs_opacity = 1.0;
                litArgs_worldNormal = dVertexNormalW;
            }`;
        return material;
    };

    // keeps the half space below y = 1
    const below = () => new Plane().setFromPointNormal(new Vec3(0, 1, 0), Vec3.DOWN);

    // keeps the half space where x is negative
    const left = () => new Plane().setFromPointNormal(Vec3.ZERO, Vec3.LEFT);

    // gives an owner a plane twice, and a plane of the caller, through the array its getter
    // returns, then assigns planes at distances 2 and 3
    const assignThroughReturnedArray = (owner) => {
        owner.clippingPlanes = [new Plane(Vec3.UP, 1)];
        const planes = owner.clippingPlanes;
        planes.push(planes[0]);
        const own = new Plane(Vec3.UP, 1);
        planes.push(own);
        owner.clippingPlanes = planes;

        const returned = owner.clippingPlanes;
        expect(new Set(returned).size).to.equal(3);
        expect(returned).to.not.include(own);

        owner.clippingPlanes = [new Plane(Vec3.UP, 2), new Plane(Vec3.UP, 3)];
        expect(owner.clippingPlanes.map(plane => plane.distance)).to.deep.equal([2, 3]);
    };

    // makes two planes an owner returned share a normal, assigns planes facing up and right, then
    // assigns the returned planes back
    const assignAfterSharingNormals = (owner) => {
        owner.clippingPlanes = [new Plane(Vec3.UP, 1), new Plane(Vec3.RIGHT, 2)];
        const planes = owner.clippingPlanes;
        planes[0].normal = planes[1].normal;
        owner.clippingPlanes = [new Plane(Vec3.UP, 1), new Plane(Vec3.RIGHT, 2)];

        const returned = owner.clippingPlanes;
        expect(returned[0].normal).to.not.equal(returned[1].normal);
        const normals = returned.map(({ normal }) => [normal.x, normal.y, normal.z]);
        expect(normals).to.deep.equal([[0, 1, 0], [1, 0, 0]]);
        owner.clippingPlanes = returned;
    };

    // the planes up at distance 1 and right at distance 2 as the uniform data
    const upAndRight = [0, 1, 0, 1, 1, 0, 0, 2];

    describe('MeshInstance', function () {

        it('copies the planes, so a later change of a plane does not apply', function () {
            const meshInstance = addBox().render.meshInstances[0];
            const plane = below();
            meshInstance.clippingPlanes = [plane];

            expect(meshInstance.clippingPlanes).to.have.lengthOf(1);
            expect(meshInstance.clippingPlanes[0]).to.not.equal(plane);
            expect(meshInstance.clippingPlanes[0].normal).to.deep.equal(Vec3.DOWN);

            plane.distance = 5;
            expect(meshInstance.clippingPlanes[0].distance).to.equal(1);
            expect(meshInstance.getParameter('clipPlanes[0]').data[3]).to.equal(1);

            // assigning the array again applies the change
            meshInstance.clippingPlanes = [plane];
            expect(meshInstance.getParameter('clipPlanes[0]').data[3]).to.equal(5);
        });

        it('applies changes to the planes it returns when they are assigned back', function () {
            const meshInstance = addBox().render.meshInstances[0];
            meshInstance.clippingPlanes = [below()];
            const planes = meshInstance.clippingPlanes;

            planes[0].distance = 3;
            meshInstance.clippingPlanes = planes;

            expect(meshInstance.clippingPlanes).to.equal(planes);
            expect(meshInstance.getParameter('clipPlanes[0]').data[3]).to.equal(3);
        });

        it('sets the planes, their count and the intersection flag as uniforms', function () {
            const meshInstance = addBox().render.meshInstances[0];
            meshInstance.clippingPlanes = [below(), left()];

            const planes = meshInstance.getParameter('clipPlanes[0]').data;
            // adding 0 turns the -0 distance of the plane through the origin into 0
            const values = Array.from(planes.subarray(0, 8), value => value + 0);
            expect(values).to.deep.equal([0, -1, 0, 1, -1, 0, 0, 0]);
            expect(Array.from(meshInstance.getParameter('clipParams').data)).to.deep.equal([2, 0]);

            meshInstance.clipIntersection = true;
            expect(Array.from(meshInstance.getParameter('clipParams').data)).to.deep.equal([2, 1]);
        });

        it('enables the clipping shader define while it has planes', function () {
            const meshInstance = addBox().render.meshInstances[0];
            expect(meshInstance._shaderDefs & SHADERDEF_CLIP).to.equal(0);

            meshInstance.clippingPlanes = [below()];
            expect(meshInstance._shaderDefs & SHADERDEF_CLIP).to.equal(SHADERDEF_CLIP);

            meshInstance.clippingPlanes = [];
            expect(meshInstance._shaderDefs & SHADERDEF_CLIP).to.equal(0);
            expect(meshInstance.getParameter('clipPlanes[0]')).to.equal(undefined);
            expect(meshInstance.getParameter('clipParams')).to.equal(undefined);
        });

        it('keeps its shaders when the planes move or their number changes', function () {
            const meshInstance = addBox().render.meshInstances[0];
            meshInstance.clippingPlanes = [below()];
            app.render();
            const shaders = Array.from(meshInstance._shaderCache.values());
            expect(shaders).to.not.be.empty;

            const moved = below();
            moved.distance = 2;
            meshInstance.clippingPlanes = [moved, left()];
            meshInstance.clipIntersection = true;
            app.render();

            expect(Array.from(meshInstance._shaderCache.values())).to.deep.equal(shaders);
        });

        it('uses up to 8 planes', function () {
            const assert = sinon.stub(Debug, 'assert');
            const meshInstance = addBox().render.meshInstances[0];
            meshInstance.clippingPlanes = Array.from({ length: 9 }, below);

            expect(meshInstance.clippingPlanes).to.have.lengthOf(8);
            expect(meshInstance.getParameter('clipParams').data[0]).to.equal(8);
            expect(assert.calledWith(false)).to.equal(true);
        });

        it('keeps the assigned values when given its own planes in another order', function () {
            const meshInstance = addBox().render.meshInstances[0];
            meshInstance.clippingPlanes = [new Plane(Vec3.UP, 1), new Plane(Vec3.UP, 2)];
            const planes = meshInstance.clippingPlanes;
            meshInstance.clippingPlanes = [planes[1], planes[0]];

            expect(meshInstance.clippingPlanes.map(plane => plane.distance)).to.deep.equal([2, 1]);
            const data = meshInstance.getParameter('clipPlanes[0]').data;
            expect([data[3], data[7]]).to.deep.equal([2, 1]);
        });

        it('keeps its copies independent, whatever is put into the returned array', function () {
            const meshInstance = addBox().render.meshInstances[0];
            assignThroughReturnedArray(meshInstance);

            const data = meshInstance.getParameter('clipPlanes[0]').data;
            expect([data[3], data[7]]).to.deep.equal([2, 3]);
        });

        it('keeps the normals of its copies independent', function () {
            const meshInstance = addBox().render.meshInstances[0];
            assignAfterSharingNormals(meshInstance);

            const data = meshInstance.getParameter('clipPlanes[0]').data;
            expect(Array.from(data.subarray(0, 8))).to.deep.equal(upAndRight);
        });

        it('changes only the mode when the intersection flag changes', function () {
            const meshInstance = addBox().render.meshInstances[0];
            meshInstance.clippingPlanes = [below()];

            // a change to a returned plane, which is not assigned
            meshInstance.clippingPlanes[0].distance = 9;
            meshInstance.clipIntersection = true;

            expect(meshInstance.getParameter('clipPlanes[0]').data[3]).to.equal(1);
            expect(Array.from(meshInstance.getParameter('clipParams').data)).to.deep.equal([1, 1]);
        });

        it('applies its planes to its own draws, in the forward and shadow passes', function () {
            const light = new Entity('light');
            light.addComponent('light', { type: 'directional', castShadows: true });
            light.setEulerAngles(45, 30, 0);
            app.root.addChild(light);

            const clipped = addBox(new StandardMaterial(), 'clipped').render.meshInstances[0];
            clipped.clippingPlanes = [below()];
            addBox(new StandardMaterial(), 'unclipped').setPosition(3, 0, 0);

            // the clip planes uniform at each draw
            const planesId = app.graphicsDevice.scope.resolve('clipPlanes[0]');
            const draws = [];
            const draw = app.graphicsDevice.draw;
            sinon.stub(app.graphicsDevice, 'draw').callsFake(function (...args) {
                draws.push(planesId.value);
                return draw.apply(this, args);
            });
            app.render();

            // each box is drawn by the shadow pass and the forward pass, and only the clipped one
            // with its planes
            const planes = clipped.getParameter('clipPlanes[0]').data;
            expect(draws).to.have.lengthOf(4);
            expect(draws.filter(value => value === planes)).to.have.lengthOf(2);
        });
    });

    describe('shaders', function () {

        // the fragment shader source of the variant of the material, for the mesh defines and the
        // shader params of the camera
        const fragmentSource = (material, pass, objDefs,
            cameraShaderParams = new CameraShaderParams()) => {
            const device = app.graphicsDevice;
            material.update();
            const shader = material.getShaderVariant({
                device,
                scene: app.scene,
                objDefs,
                pass,
                cameraShaderParams,
                viewUniformFormat: app.renderer.getViewUniformFormat(false, new LightList()),
                vertexFormat: new VertexFormat(device, [
                    { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 }
                ])
            });
            expect(shader.failed).to.equal(false);
            return shader.definition.fshader;
        };

        // the shader params of a camera with clipping planes
        const clippingCamera = () => {
            const params = new CameraShaderParams();
            params.clipPlanes = true;
            return params;
        };

        const passes = () => {
            // allocated as by the ShadowRenderer for a directional light
            const shadowPass = ShaderPass.get(app.graphicsDevice).allocate('ShadowPass_0_0', {
                isShadow: true,
                lightType: LIGHTTYPE_DIRECTIONAL,
                shadowType: SHADOW_PCF3_32F
            }).index;
            return {
                forward: SHADER_FORWARD,
                prepass: SHADER_PREPASS,
                pick: SHADER_PICK,
                shadow: shadowPass
            };
        };

        for (const [name, createMaterial] of [
            ['StandardMaterial', () => new StandardMaterial()],
            ['LitMaterial', createLitMaterial]
        ]) {
            it(`clips the forward, prepass, picking and shadow shaders of a ${name}`, function () {
                for (const [passName, pass] of Object.entries(passes())) {
                    const clipped = fragmentSource(createMaterial(), pass, SHADERDEF_CLIP);
                    expect(clipped, passName).to.include('applyClipPlanes(');
                    expect(clipped, passName).to.match(/applyClipPlanes\(\s*vPositionW\s*\);/);

                    const unclipped = fragmentSource(createMaterial(), pass, 0);
                    expect(unclipped, passName).to.not.include('applyClipPlanes');
                }
            });

            it(`clips the camera passes of a ${name} with the camera planes`, function () {
                // shadows render with the shadow camera, see the CameraComponent tests
                const cameraPasses = Object.entries(passes())
                .filter(([passName]) => passName !== 'shadow');
                for (const [passName, pass] of cameraPasses) {
                    const clipped = fragmentSource(createMaterial(), pass, 0, clippingCamera());
                    expect(clipped, passName).to.match(/applyClipPlanes\(\s*vPositionW\s*\);/);
                    expect(clipped, passName).to.include('camera_clipPlanes');
                    expect(clipped, passName).to.not.match(/\bclipPlanes\b/);
                }
            });
        }

        it('clips with the planes of both the camera and the mesh instance', function () {
            const clipped = fragmentSource(new StandardMaterial(), SHADER_FORWARD, SHADERDEF_CLIP,
                clippingCamera());
            expect(clipped).to.match(/\bclipPlanes\b/);
            expect(clipped).to.include('camera_clipPlanes');
        });

        it('does not clip screen space elements with the camera planes', function () {
            const material = new StandardMaterial();
            const screenSpace = fragmentSource(material, SHADER_FORWARD, SHADERDEF_SCREENSPACE,
                clippingCamera());
            expect(screenSpace).to.not.include('camera_clipPlanes');

            // their own planes still apply
            const clipped = fragmentSource(material, SHADER_FORWARD,
                SHADERDEF_SCREENSPACE | SHADERDEF_CLIP, clippingCamera());
            expect(clipped).to.match(/\bclipPlanes\b/);
            expect(clipped).to.not.include('camera_clipPlanes');
        });

        it('defines CLIP_PLANES for a ShaderMaterial, which clips with clipPlanesPS', function () {
            const material = new ShaderMaterial({
                uniqueName: 'ClippedShaderMaterial',
                vertexGLSL: `
                    attribute vec3 vertex_position;
                    uniform mat4 matrix_model;
                    uniform mat4 matrix_viewProjection;
                    varying vec3 vPositionW;
                    void main(void) {
                        vec4 positionW = matrix_model * vec4(vertex_position, 1.0);
                        vPositionW = positionW.xyz;
                        gl_Position = matrix_viewProjection * positionW;
                    }
                `,
                fragmentGLSL: `
                    varying vec3 vPositionW;
                    #ifdef CLIP_PLANES
                        #include "clipPlanesPS"
                    #endif
                    void main(void) {
                        #ifdef CLIP_PLANES
                            applyClipPlanes(vPositionW);
                        #endif
                        gl_FragColor = vec4(1.0);
                    }
                `,
                vertexWGSL: `
                    attribute vertex_position: vec3f;
                    uniform matrix_model: mat4x4f;
                    uniform matrix_viewProjection: mat4x4f;
                    varying vPositionW: vec3f;
                    @vertex fn vertexMain(input: VertexInput) -> VertexOutput {
                        var output: VertexOutput;
                        let positionW = uniform.matrix_model * vec4f(input.vertex_position, 1.0);
                        output.vPositionW = positionW.xyz;
                        output.position = uniform.matrix_viewProjection * positionW;
                        return output;
                    }
                `,
                fragmentWGSL: `
                    varying vPositionW: vec3f;
                    #ifdef CLIP_PLANES
                        #include "clipPlanesPS"
                    #endif
                    @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
                        var output: FragmentOutput;
                        #ifdef CLIP_PLANES
                            applyClipPlanes(vPositionW);
                        #endif
                        output.color = vec4f(1.0);
                        return output;
                    }
                `,
                attributes: { vertex_position: SEMANTIC_POSITION }
            });

            const clipped = fragmentSource(material, SHADER_FORWARD, SHADERDEF_CLIP);
            expect(clipped).to.include('applyClipPlanes(');
            expect(fragmentSource(material, SHADER_FORWARD, 0)).to.not.include('applyClipPlanes');

            // the camera planes define CLIP_PLANES as well
            const cameraClipped = fragmentSource(material, SHADER_FORWARD, 0, clippingCamera());
            expect(cameraClipped).to.include('camera_clipPlanes');

            // and draws with it
            const meshInstance = addBox(material).render.meshInstances[0];
            meshInstance.clippingPlanes = [below()];
            app.render();
            const instances = Array.from(meshInstance._shaderCache.values());
            const shaders = instances.map(instance => instance.shader);
            const sources = shaders.map(shader => shader.definition.fshader);
            expect(sources.some(source => source.includes('applyClipPlanes('))).to.equal(true);
            expect(shaders.every(shader => !shader.failed)).to.equal(true);
        });
    });

    describe('RenderComponent', function () {

        it('applies its planes and intersection flag to its mesh instances', function () {
            const entity = addBox();
            entity.render.clipIntersection = true;
            entity.render.clippingPlanes = [below(), left()];

            const meshInstance = entity.render.meshInstances[0];
            expect(meshInstance.clipIntersection).to.equal(true);
            const normals = meshInstance.clippingPlanes.map(plane => plane.normal);
            expect(normals).to.deep.equal([Vec3.DOWN, Vec3.LEFT]);
            expect(entity.render.clippingPlanes).to.have.lengthOf(2);
        });

        it('applies its planes to mesh instances created later', function () {
            const entity = addBox();
            entity.render.clippingPlanes = [below()];
            entity.render.clipIntersection = true;

            entity.render.type = 'sphere';

            const meshInstance = entity.render.meshInstances[0];
            expect(meshInstance.clippingPlanes).to.have.lengthOf(1);
            expect(meshInstance.clipIntersection).to.equal(true);
        });

        it('takes its planes from the component data, and keeps them when cloned', function () {
            const entity = new Entity();
            entity.addComponent('render', {
                type: 'box',
                clippingPlanes: [below()],
                clipIntersection: true
            });
            app.root.addChild(entity);
            expect(entity.render.meshInstances[0].clippingPlanes).to.have.lengthOf(1);

            const clone = entity.clone();
            expect(clone.render.clippingPlanes).to.have.lengthOf(1);
            expect(clone.render.clippingPlanes[0]).to.not.equal(entity.render.clippingPlanes[0]);
            expect(clone.render.clipIntersection).to.equal(true);
            expect(clone.render.meshInstances[0].clippingPlanes).to.have.lengthOf(1);
        });

        it('removes the planes from its mesh instances', function () {
            const entity = addBox();
            entity.render.clippingPlanes = [below()];
            entity.render.clippingPlanes = [];

            const meshInstance = entity.render.meshInstances[0];
            expect(meshInstance.clippingPlanes).to.have.lengthOf(0);
            expect(meshInstance._shaderDefs & SHADERDEF_CLIP).to.equal(0);
        });

        it('uses up to 8 planes, as its mesh instances do', function () {
            const assert = sinon.stub(Debug, 'assert');
            const entity = addBox();
            entity.render.clippingPlanes = Array.from({ length: 9 }, below);

            expect(entity.render.clippingPlanes).to.have.lengthOf(8);
            expect(entity.render.meshInstances[0].clippingPlanes).to.have.lengthOf(8);
            expect(assert.calledWith(false)).to.equal(true);
        });

        it('keeps the assigned values when given its own planes in another order', function () {
            const entity = addBox();
            entity.render.clippingPlanes = [new Plane(Vec3.UP, 1), new Plane(Vec3.UP, 2)];
            const planes = entity.render.clippingPlanes;
            entity.render.clippingPlanes = [planes[1], planes[0]];

            const distances = owner => owner.clippingPlanes.map(plane => plane.distance);
            expect(distances(entity.render)).to.deep.equal([2, 1]);
            expect(distances(entity.render.meshInstances[0])).to.deep.equal([2, 1]);
        });

        it('keeps its copies independent, whatever is put into the returned array', function () {
            const entity = addBox();
            assignThroughReturnedArray(entity.render);

            const data = entity.render.meshInstances[0].getParameter('clipPlanes[0]').data;
            expect([data[3], data[7]]).to.deep.equal([2, 3]);
        });

        it('keeps the normals of its copies independent', function () {
            const entity = addBox();
            assignAfterSharingNormals(entity.render);

            const data = entity.render.meshInstances[0].getParameter('clipPlanes[0]').data;
            expect(Array.from(data.subarray(0, 8))).to.deep.equal(upAndRight);
        });

        it('removes planes assigned to its mesh instances directly when given none', function () {
            const entity = addBox();
            const meshInstance = entity.render.meshInstances[0];
            meshInstance.clippingPlanes = [below()];

            entity.render.clippingPlanes = [];
            expect(meshInstance.clipped).to.equal(false);
            expect(meshInstance.clippingPlanes).to.have.lengthOf(0);
        });

        it('clones the planes as they were assigned', function () {
            const entity = addBox();
            entity.render.clippingPlanes = [below()];

            // a change to a returned plane, which is not assigned
            entity.render.clippingPlanes[0].distance = 9;
            const clone = entity.clone();

            expect(clone.render.clippingPlanes[0].distance).to.equal(1);
            const data = clone.render.meshInstances[0].getParameter('clipPlanes[0]').data;
            expect(data[3]).to.equal(1);
        });

        it('gives its mesh instances its planes and mode together, replacing theirs', function () {
            const entity = addBox();
            const meshInstance = entity.render.meshInstances[0];
            meshInstance.clippingPlanes = [below(), left()];
            meshInstance.clipIntersection = true;

            // the mode of a component without planes removes the planes of the mesh instance too
            entity.render.clipIntersection = false;
            expect(meshInstance.clipped).to.equal(false);
            expect(meshInstance.clipIntersection).to.equal(false);

            // and the mode of a component with planes gives the mesh instance those planes
            entity.render.clippingPlanes = [below()];
            meshInstance.clippingPlanes = [below(), left()];
            entity.render.clipIntersection = true;
            expect(meshInstance.clippingPlanes).to.have.lengthOf(1);
            expect(meshInstance.clipIntersection).to.equal(true);
            const params = meshInstance.getParameter('clipParams').data;
            expect(Array.from(params)).to.deep.equal([1, 1]);
        });

        it('gives the mesh instances it is given its planes and its mode', function () {
            const entity = addBox();
            entity.render.clippingPlanes = [below()];

            const mesh = entity.render.meshInstances[0].mesh;
            const meshInstance = new MeshInstance(mesh, new StandardMaterial());
            meshInstance.clipIntersection = true;
            entity.render.meshInstances = [meshInstance];

            expect(meshInstance.clippingPlanes).to.have.lengthOf(1);
            expect(meshInstance.clipIntersection).to.equal(false);
        });

        it('removes the planes of mesh instances it is given when it has none', function () {
            const entity = addBox();
            const mesh = entity.render.meshInstances[0].mesh;
            const meshInstance = new MeshInstance(mesh, new StandardMaterial());
            meshInstance.clippingPlanes = [below()];
            entity.render.meshInstances = [meshInstance];

            expect(meshInstance.clipped).to.equal(false);
        });

        it('gives mesh instances created later the planes as they were assigned', function () {
            const entity = addBox();
            entity.render.clippingPlanes = [below()];

            // a change to a returned plane, which is not assigned
            entity.render.clippingPlanes[0].distance = 9;
            entity.render.type = 'sphere';

            expect(entity.render.meshInstances[0].clippingPlanes[0].distance).to.equal(1);
        });
    });

    describe('CameraComponent', function () {

        it('copies the planes, so a later change of a plane does not apply', function () {
            const plane = below();
            camera.clippingPlanes = [plane];

            expect(camera.clippingPlanes).to.have.lengthOf(1);
            expect(camera.clippingPlanes[0]).to.not.equal(plane);
            expect(camera.clippingPlanes[0].normal).to.deep.equal(Vec3.DOWN);

            plane.distance = 5;
            expect(camera.camera._clipPlanes.planesData[3]).to.equal(1);

            // assigning the array again applies the change
            camera.clippingPlanes = [plane];
            expect(camera.camera._clipPlanes.planesData[3]).to.equal(5);
        });

        it('sets the planes, their count and the intersection flag as uniforms', function () {
            camera.clippingPlanes = [below(), left()];
            camera.clipIntersection = true;
            addBox();

            // the camera plane uniforms at each draw
            const scope = app.graphicsDevice.scope;
            const planesId = scope.resolve('camera_clipPlanes[0]');
            const paramsId = scope.resolve('camera_clipParams');
            const draws = [];
            const draw = app.graphicsDevice.draw;
            sinon.stub(app.graphicsDevice, 'draw').callsFake(function (...args) {
                // adding 0 turns the -0 distance of the plane through the origin into 0
                const planes = Array.from(planesId.value.subarray(0, 8), value => value + 0);
                draws.push([planes, Array.from(paramsId.value)]);
                return draw.apply(this, args);
            });
            app.render();

            expect(draws).to.deep.equal([[[0, -1, 0, 1, -1, 0, 0, 0], [2, 1]]]);
        });

        it('enables the clipping shader defines while it has planes', function () {
            const params = camera.camera.shaderParams;
            const hash = params.hash;
            expect(params.defines.has('CLIP_PLANES')).to.equal(false);

            camera.clippingPlanes = [below()];
            expect(params.defines.has('CLIP_PLANES')).to.equal(true);
            expect(params.defines.has('CLIP_PLANES_CAMERA')).to.equal(true);
            const clippedHash = params.hash;
            expect(clippedHash).to.not.equal(hash);

            // moving the planes or changing their number keeps the shaders
            camera.clippingPlanes = [left(), below()];
            camera.clipIntersection = true;
            expect(params.hash).to.equal(clippedHash);

            camera.clippingPlanes = [];
            expect(params.defines.has('CLIP_PLANES')).to.equal(false);
            expect(params.hash).to.equal(hash);
        });

        it('uses up to 8 planes', function () {
            const assert = sinon.stub(Debug, 'assert');
            camera.clippingPlanes = Array.from({ length: 9 }, below);

            expect(camera.clippingPlanes).to.have.lengthOf(8);
            expect(camera.camera._clipPlanes.paramsData[0]).to.equal(8);
            expect(assert.calledWith(false)).to.equal(true);
        });

        it('keeps the assigned values when given its own planes in another order', function () {
            camera.clippingPlanes = [new Plane(Vec3.UP, 1), new Plane(Vec3.UP, 2)];
            const planes = camera.clippingPlanes;
            camera.clippingPlanes = [planes[1], planes[0]];

            expect(camera.clippingPlanes.map(plane => plane.distance)).to.deep.equal([2, 1]);
            const data = camera.camera._clipPlanes.planesData;
            expect([data[3], data[7]]).to.deep.equal([2, 1]);
        });

        it('keeps its copies independent, whatever is put into the returned array', function () {
            assignThroughReturnedArray(camera);

            const data = camera.camera._clipPlanes.planesData;
            expect([data[3], data[7]]).to.deep.equal([2, 3]);
        });

        it('keeps the normals of its copies independent', function () {
            assignAfterSharingNormals(camera);

            const data = camera.camera._clipPlanes.planesData;
            expect(Array.from(data.subarray(0, 8))).to.deep.equal(upAndRight);
        });

        it('clones the planes as they were assigned', function () {
            camera.clippingPlanes = [below()];

            // a change to a returned plane, which is not assigned
            camera.clippingPlanes[0].distance = 9;
            const clone = camera.entity.clone();

            expect(clone.camera.clippingPlanes[0].distance).to.equal(1);
            expect(clone.camera.camera._clipPlanes.planesData[3]).to.equal(1);
        });

        it('changes only the mode when the intersection flag changes', function () {
            camera.clippingPlanes = [below()];

            // a change to a returned plane, which is not assigned
            camera.clippingPlanes[0].distance = 9;
            camera.clipIntersection = true;

            expect(camera.camera._clipPlanes.planesData[3]).to.equal(1);
            expect(Array.from(camera.camera._clipPlanes.paramsData)).to.deep.equal([1, 1]);
        });

        it('does not clip shadows', function () {
            const light = new Entity('light');
            light.addComponent('light', { type: 'directional', castShadows: true });
            light.setEulerAngles(45, 30, 0);
            app.root.addChild(light);
            addBox();
            camera.clippingPlanes = [below()];

            // whether the shader of each draw reads the camera planes
            const device = app.graphicsDevice;
            let shader = null;
            const setShader = device.setShader;
            sinon.stub(device, 'setShader').callsFake(function (...args) {
                shader = args[0];
                return setShader.apply(this, args);
            });
            const draws = [];
            const draw = device.draw;
            sinon.stub(device, 'draw').callsFake(function (...args) {
                draws.push(shader.definition.fshader.includes('camera_clipPlanes'));
                return draw.apply(this, args);
            });
            app.render();

            // the box is drawn by the shadow pass, and then by the forward pass
            expect(draws).to.deep.equal([false, true]);
        });

        it('takes its planes from the component data, and keeps them when cloned', function () {
            const entity = new Entity('data camera');
            entity.addComponent('camera', { clippingPlanes: [below()], clipIntersection: true });
            app.root.addChild(entity);
            expect(entity.camera.clippingPlanes).to.have.lengthOf(1);
            expect(entity.camera.clipIntersection).to.equal(true);

            const clone = entity.clone();
            expect(clone.camera.clippingPlanes).to.have.lengthOf(1);
            expect(clone.camera.clippingPlanes[0]).to.not.equal(entity.camera.clippingPlanes[0]);
            expect(clone.camera.clippingPlanes[0].normal).to.deep.equal(Vec3.DOWN);
            expect(clone.camera.clipIntersection).to.equal(true);
            expect(clone.camera.camera.shaderParams.clipPlanes).to.equal(true);
        });
    });

    describe('batching', function () {

        let group;

        beforeEach(function () {
            group = app.batcher.addGroup('Clipping', false, 100);
        });

        const addBatchedBox = (name) => {
            const entity = new Entity(name);
            entity.addComponent('render', { type: 'box', batchGroupId: group.id });
            app.root.addChild(entity);
            return entity;
        };

        const layerMeshInstances = () => app.scene.layers.getLayerById(LAYERID_WORLD).meshInstances;

        it('renders a clipped entity on its own, outside of the batch', function () {
            const clipped = addBatchedBox('clipped');
            clipped.render.clippingPlanes = [below()];
            const batched = addBatchedBox('batched');

            sinon.stub(Debug, 'warnOnce');
            app.batcher.generate();

            const meshInstances = layerMeshInstances();
            expect(meshInstances).to.include(clipped.render.meshInstances[0]);
            expect(meshInstances).to.not.include(batched.render.meshInstances[0]);
            expect(app.batcher._batchList).to.have.lengthOf(1);
            const batch = app.batcher._batchList[0];
            expect(batch.origMeshInstances).to.deep.equal(batched.render.meshInstances);
        });

        it('takes a batched entity out of its batch while it is clipped', function () {
            const entity = addBatchedBox('entity');
            addBatchedBox('other');
            app.batcher.generate();
            expect(layerMeshInstances()).to.not.include(entity.render.meshInstances[0]);

            entity.render.clippingPlanes = [below()];
            expect(app.batcher._dirtyGroups).to.include(group.id);
            app.batcher.generate(app.batcher._dirtyGroups);
            expect(layerMeshInstances()).to.include(entity.render.meshInstances[0]);

            entity.render.clippingPlanes = [];
            expect(app.batcher._dirtyGroups).to.include(group.id);
            app.batcher.generate(app.batcher._dirtyGroups);
            expect(layerMeshInstances()).to.not.include(entity.render.meshInstances[0]);
        });

        it('keeps a clipped entity hidden while its render component is disabled', function () {
            const entity = new Entity('disabled');
            entity.addComponent('render', { type: 'box', enabled: false });
            app.root.addChild(entity);

            // a disabled render component of an enabled entity stays out of the group it is given
            entity.render.batchGroupId = group.id;
            entity.render.clippingPlanes = [below()];

            sinon.stub(Debug, 'warnOnce');
            app.batcher.generate();

            expect(layerMeshInstances()).to.not.include(entity.render.meshInstances[0]);
        });

        it('rebuilds the group when planes are pushed into the returned array', function () {
            const entity = addBatchedBox('entity');
            app.batcher.generate();

            const planes = entity.render.clippingPlanes;
            planes.push(below());
            entity.render.clippingPlanes = planes;
            expect(app.batcher._dirtyGroups).to.include(group.id);
        });

        it('rebuilds the group when the returned array is emptied and assigned', function () {
            const entity = addBatchedBox('entity');
            entity.render.clippingPlanes = [below()];
            sinon.stub(Debug, 'warnOnce');
            app.batcher.generate();

            const planes = entity.render.clippingPlanes;
            planes.length = 0;
            entity.render.clippingPlanes = planes;
            expect(app.batcher._dirtyGroups).to.include(group.id);
        });

        it('clips a mesh instance given planes once its batch group is rebuilt', function () {
            const entity = addBatchedBox('entity');
            addBatchedBox('other');
            app.batcher.generate();

            // planes given to a batched mesh instance directly apply when its group is rebuilt
            const meshInstance = entity.render.meshInstances[0];
            meshInstance.clippingPlanes = [below()];
            expect(layerMeshInstances()).to.not.include(meshInstance);

            sinon.stub(Debug, 'warnOnce');
            app.batcher.markGroupDirty(group.id);
            app.batcher.generate(app.batcher._dirtyGroups);
            expect(layerMeshInstances()).to.include(meshInstance);
        });

        it('rebuilds the group when the component removes planes of mesh instances', function () {
            const entity = addBatchedBox('entity');
            addBatchedBox('other');
            const meshInstance = entity.render.meshInstances[0];
            meshInstance.clippingPlanes = [below()];
            sinon.stub(Debug, 'warnOnce');
            app.batcher.generate();
            expect(layerMeshInstances()).to.include(meshInstance);

            entity.render.clippingPlanes = [];
            expect(app.batcher._dirtyGroups).to.include(group.id);
        });

        it('batches by the assigned planes, not by changes to the returned ones', function () {
            const entity = addBatchedBox('entity');
            addBatchedBox('other');

            // a plane added to the returned array, which is not assigned
            entity.render.meshInstances[0].clippingPlanes.push(below());
            app.batcher.generate();
            expect(layerMeshInstances()).to.not.include(entity.render.meshInstances[0]);
        });
    });
});
