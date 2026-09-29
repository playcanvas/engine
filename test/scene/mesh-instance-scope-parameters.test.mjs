import { expect } from 'chai';
import sinon from 'sinon';

import { Entity } from '../../src/framework/entity.js';
import { SEMANTIC_POSITION } from '../../src/platform/graphics/constants.js';
import { LAYERID_WORLD, SORTMODE_MANUAL } from '../../src/scene/constants.js';
import { ShaderMaterial } from '../../src/scene/materials/shader-material.js';
import { createApp } from '../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../jsdom.mjs';

// A parameter a mesh instance sets which its material does not have, such as one overriding a value
// set globally on the scope, applies to the draws of that mesh instance only - the draws that
// follow read the value it replaced (#2456).
describe('MeshInstance scope parameters', function () {

    let app;
    let tintId;

    // the value of the tint uniform at each draw
    let draws;

    const globalTint = new Float32Array([1, 0, 0]);
    const localTint = new Float32Array([0, 1, 0]);

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        const camera = new Entity('camera');
        camera.addComponent('camera');
        camera.setPosition(0, 1, 10);
        app.root.addChild(camera);

        // the boxes are drawn in their draw order
        app.scene.layers.getLayerById(LAYERID_WORLD).opaqueSortMode = SORTMODE_MANUAL;

        // the global value, set on the scope
        tintId = app.graphicsDevice.scope.resolve('tint');
        tintId.setValue(globalTint);

        draws = [];
        const draw = app.graphicsDevice.draw;
        sinon.stub(app.graphicsDevice, 'draw').callsFake(function (...args) {
            draws.push(tintId.value);
            return draw.apply(this, args);
        });
    });

    afterEach(function () {
        sinon.restore();
        app.destroy();
        jsdomTeardown();
    });

    // a material reading the tint uniform, which it does not have as a parameter
    const tintMaterial = () => new ShaderMaterial({
        uniqueName: 'ScopeParameterTint',
        vertexGLSL: `
            attribute vec3 vertex_position;
            uniform mat4 matrix_model;
            uniform mat4 matrix_viewProjection;
            void main(void) {
                gl_Position = matrix_viewProjection * matrix_model * vec4(vertex_position, 1.0);
            }
        `,
        fragmentGLSL: `
            uniform vec3 tint;
            void main(void) {
                gl_FragColor = vec4(tint, 1.0);
            }
        `,
        vertexWGSL: `
            attribute vertex_position: vec3f;
            uniform matrix_model: mat4x4f;
            uniform matrix_viewProjection: mat4x4f;
            @vertex fn vertexMain(input: VertexInput) -> VertexOutput {
                var output: VertexOutput;
                output.position = uniform.matrix_viewProjection * uniform.matrix_model * vec4f(input.vertex_position, 1.0);
                return output;
            }
        `,
        fragmentWGSL: `
            uniform tint: vec3f;
            @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
                var output: FragmentOutput;
                output.color = vec4f(uniform.tint, 1.0);
                return output;
            }
        `,
        attributes: { vertex_position: SEMANTIC_POSITION }
    });

    const addBox = (material, drawOrder, x) => {
        const entity = new Entity(`box${drawOrder}`);
        entity.addComponent('render', { type: 'box', material });
        entity.setPosition(x, 0, 0);
        app.root.addChild(entity);
        const meshInstance = entity.render.meshInstances[0];
        meshInstance.drawOrder = drawOrder;
        return meshInstance;
    };

    it('restores a global value after the draw of a mesh instance overriding it, for the same material', function () {
        const material = tintMaterial();
        addBox(material, 0, -1).setParameter('tint', localTint);
        addBox(material, 1, 1);
        app.render();

        expect(draws).to.have.lengthOf(2);
        expect(draws[0]).to.equal(localTint);
        expect(draws[1]).to.equal(globalTint);
        expect(tintId.value).to.equal(globalTint);
    });

    it('restores a global value after the draw of a mesh instance overriding it, for a different material', function () {
        addBox(tintMaterial(), 0, -1).setParameter('tint', localTint);
        addBox(tintMaterial(), 1, 1);
        app.render();

        expect(draws).to.have.lengthOf(2);
        expect(draws[0]).to.equal(localTint);
        expect(draws[1]).to.equal(globalTint);
    });

    it('keeps the global value over frames when the overriding mesh instance is drawn last', function () {
        const material = tintMaterial();
        addBox(material, 0, -1);
        addBox(material, 1, 1).setParameter('tint', localTint);
        app.render();
        app.render();

        expect(draws).to.have.lengthOf(4);
        expect(draws[0]).to.equal(globalTint);
        expect(draws[1]).to.equal(localTint);
        expect(draws[2]).to.equal(globalTint);
        expect(draws[3]).to.equal(localTint);
        expect(tintId.value).to.equal(globalTint);
    });

    it('restores the value of the material for a parameter the material has', function () {
        const materialTint = new Float32Array([0, 0, 1]);
        const material = tintMaterial();
        material.setParameter('tint', materialTint);
        addBox(material, 0, -1).setParameter('tint', localTint);
        addBox(material, 1, 1);
        app.render();

        expect(draws).to.have.lengthOf(2);
        expect(draws[0]).to.equal(localTint);
        expect(draws[1]).to.equal(materialTint);
    });

    it('restores a global value after a shadow caster overriding it', function () {
        const light = new Entity('light');
        light.addComponent('light', { type: 'directional', castShadows: true });
        light.setEulerAngles(45, 30, 0);
        app.root.addChild(light);

        const material = tintMaterial();
        addBox(material, 0, -1).setParameter('tint', localTint);
        addBox(material, 1, 1);
        app.render();

        // each box is drawn in the shadow pass and in the forward pass, in any order in the shadow
        // pass, and the one overriding the tint is the only one reading its value
        expect(draws).to.have.lengthOf(4);
        expect(draws.filter(value => value === localTint)).to.have.lengthOf(2);
        expect(draws.filter(value => value === globalTint)).to.have.lengthOf(2);
        expect(tintId.value).to.equal(globalTint);
    });
});
