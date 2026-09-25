import { expect } from 'chai';
import sinon from 'sinon';

import { Entity } from '../../../src/framework/entity.js';
import { DebugGraphics } from '../../../src/platform/graphics/debug-graphics.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * @import { Application } from '../../../src/framework/application.js'
 * @import { MeshInstance } from '../../../src/scene/mesh-instance.js'
 */

// The shadow render loop sets the state of a material when the material changes, as the forward
// render loop does, and the casters are sorted by shader and material to make those runs long. A
// mesh instance overriding some of the state has the material's values restored for the next
// caster of the same material.
describe('ShadowRenderer caster submission', function () {
    /** @type {Application} */
    let app;

    /** @type {MeshInstance[][]} */
    let submits;

    let inShadows = false;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        const camera = new Entity('camera');
        camera.addComponent('camera');
        camera.setPosition(0, 2, 12);
        app.root.addChild(camera);

        const sun = new Entity('sun');
        sun.addComponent('light', { type: 'directional', castShadows: true, numCascades: 1, shadowDistance: 40 });
        sun.setEulerAngles(45, 30, 0);
        app.root.addChild(sun);

        // record the casters of each shadow pass, and flag the calls made while submitting them
        submits = [];
        const shadowRenderer = app.renderer.shadowRenderer;
        const submitCasters = shadowRenderer.submitCasters;
        shadowRenderer.submitCasters = function (visibleCasters, light, camera) {
            submits.push(visibleCasters.slice());
            inShadows = true;
            try {
                submitCasters.call(this, visibleCasters, light, camera);
            } finally {
                inShadows = false;
            }
        };
    });

    afterEach(function () {
        sinon.restore();
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    const addBox = (material, x) => {
        const entity = new Entity(`box${x}`);
        entity.addComponent('render', { type: 'box', material });
        entity.setPosition(x, 0, 0);
        app.root.addChild(entity);
        return entity.render.meshInstances[0];
    };

    // records a value from each call of a method made while the shadow casters are submitted
    const record = (object, method, read) => {
        const records = [];
        const original = object[method];
        sinon.stub(object, method).callsFake(function (...args) {
            if (inShadows) {
                records.push(read(...args));
            }
            return original.apply(this, args);
        });
        return records;
    };

    // the shadow sort keys are assigned while rendering, so the second frame is the sorted one
    const renderSorted = () => {
        app.render();
        submits.length = 0;
    };

    it('sets the state of a material once per run of its casters', function () {
        const a = new StandardMaterial();
        const b = new StandardMaterial();
        for (let i = 0; i < 6; i++) {
            addBox(i % 2 ? b : a, i * 2 - 5);
        }
        renderSorted();

        const counts = new Map([[a, 0], [b, 0]]);
        record(a, 'setParameters', (device, restore) => !restore && counts.set(a, counts.get(a) + 1));
        record(b, 'setParameters', (device, restore) => !restore && counts.set(b, counts.get(b) + 1));
        const prepared = record(StandardMaterial.prototype, 'prepareForRender', () => 1);
        const alphaTests = record(app.renderer.alphaTestId, 'setValue', value => value);
        app.render();

        // the materials interleaved in the layer are grouped in each pass
        expect(submits.length).to.be.greaterThan(0);
        for (const casters of submits) {
            expect(casters).to.have.lengthOf(6);
            const runs = casters.filter((caster, i) => i === 0 || caster.material !== casters[i - 1].material);
            expect(runs).to.have.lengthOf(2);
        }
        expect(counts.get(a)).to.equal(submits.length);
        expect(counts.get(b)).to.equal(submits.length);
        expect(prepared).to.have.lengthOf(2 * submits.length);
        expect(alphaTests).to.have.lengthOf(2 * submits.length);
    });

    it('restores the scope parameters a caster overrides for the next caster of the material', function () {
        const material = new StandardMaterial();
        material.setParameter('uShadowTest', 1);
        const overriding = addBox(material, -2);
        overriding.setParameter('uShadowTest', 2);
        addBox(material, 0);
        addBox(material, 2);
        renderSorted();

        const scopeId = app.graphicsDevice.scope.resolve('uShadowTest');
        const values = record(app.renderer, 'setMeshInstanceMatrices', meshInstance => [meshInstance === overriding, scopeId.value]);
        app.render();

        expect(values.length).to.equal(3 * submits.length);
        for (const [isOverriding, value] of values) {
            expect(value).to.equal(isOverriding ? 2 : 1);
        }
    });

    it('restores the alpha test reference a caster overrides for the next caster of the material', function () {
        const material = new StandardMaterial();
        material.alphaTest = 0.5;
        material.update();
        const overriding = addBox(material, -2);
        overriding.setParameter('alpha_ref', 0.9);
        addBox(material, 0);
        addBox(material, 2);
        renderSorted();

        const scopeId = app.graphicsDevice.scope.resolve('alpha_ref');
        const values = record(app.renderer, 'setMeshInstanceMatrices', meshInstance => [meshInstance, scopeId.value]);
        app.render();

        // the overriding caster comes first in its run, so the next ones need the restore
        expect(values).to.have.lengthOf(3 * submits.length);
        for (let i = 0; i < values.length; i += 3) {
            expect(values[i]).to.deep.equal([overriding, 0.9]);
            expect(values[i + 1][1]).to.equal(0.5);
            expect(values[i + 2][1]).to.equal(0.5);
        }
    });

    it('rebinds the material bind group after a caster bound its copy with overrides', function () {
        const material = new StandardMaterial();
        const overriding = addBox(material, -2);
        overriding.setParameter('material_diffuse', [1, 0, 0]);
        addBox(material, 0);
        renderSorted();

        // the group bound at the material index when each caster is drawn
        const renderer = app.renderer;
        const bound = record(renderer, 'setMeshInstanceMatrices', meshInstance => [meshInstance, renderer._boundMaterialBindGroup]);
        app.render();

        const copy = overriding._materialBindGroup;
        expect(copy).to.exist;
        expect(bound).to.have.lengthOf(2 * submits.length);
        for (let i = 0; i < bound.length; i += 2) {
            // the overriding caster comes first in its run, so the next one needs the restore
            expect(bound[i]).to.deep.equal([overriding, copy]);
            expect(bound[i + 1][1]).to.equal(material.uniformBufferBindGroup);
        }
    });

    it('sets the cull mode and the front face once per caster', function () {
        const material = new StandardMaterial();
        for (let i = 0; i < 4; i++) {
            addBox(material, i * 2 - 3);
        }
        renderSorted();

        const device = app.graphicsDevice;
        const cullModes = record(device, 'setCullMode', mode => mode);
        const frontFaces = record(device, 'setFrontFace', face => face);
        app.render();

        const casterCount = submits.reduce((sum, casters) => sum + casters.length, 0);
        expect(cullModes).to.have.lengthOf(casterCount);
        expect(frontFaces).to.have.lengthOf(casterCount);
    });

    it('does not dirty the render pipeline per caster when the shadow map flips the front face', function () {
        const device = app.graphicsDevice;

        // the render pipeline exists on WebGPU only, where the shadow map flips the front face
        if (!device.isWebGPU) {
            this.skip();
        }

        const material = new StandardMaterial();
        for (let i = 0; i < 6; i++) {
            addBox(material, i * 2 - 5);
        }
        renderSorted();

        // count the draws which find the render pipeline dirty. The count of lookups would not do,
        // as debug builds look the pipeline up on every draw to validate the one reused
        let dirty = device._pipelineDirty;
        let dirtied = 0;
        Object.defineProperty(device, '_pipelineDirty', {
            configurable: true,
            get: () => dirty,
            set: (value) => {
                if (value && !dirty && inShadows) {
                    dirtied++;
                }
                dirty = value;
            }
        });
        try {
            app.render();
        } finally {
            delete device._pipelineDirty;
            device._pipelineDirty = dirty;
        }

        // the shadow map is stored bottom up, which flips the front face on WebGPU
        const light = app.root.findByName('sun').light.light;
        expect(light._shadowMap.renderTargets[0].flipY).to.equal(true);
        expect(submits.length).to.be.greaterThan(0);
        expect(dirtied).to.be.at.most(submits.length);
    });

    it('pops the GPU marker of a caster whose shadow shader failed', function () {
        const material = new StandardMaterial();
        const failing = addBox(material, -2);
        addBox(material, 0);
        renderSorted();

        // the shadow shader of the first caster fails, the forward one does not
        const getShaderInstance = failing.getShaderInstance;
        sinon.stub(failing, 'getShaderInstance').callsFake(function (...args) {
            return inShadows ? { shader: { failed: true } } : getShaderInstance.apply(this, args);
        });
        const pushed = record(DebugGraphics, 'pushGpuMarker', () => 1);
        const popped = record(DebugGraphics, 'popGpuMarker', () => 1);
        app.render();

        expect(submits.length).to.be.greaterThan(0);
        expect(pushed).to.have.lengthOf(2 * submits.length);
        expect(popped).to.have.lengthOf(pushed.length);
    });

    describe('#sortCompareShader', function () {

        const caster = (shaderId, materialId, meshId) => ({
            _sortKeyShadow: shaderId * 0x400000 + (materialId & 0x3fffff),
            mesh: { id: meshId }
        });

        it('orders by shader, then by material, then by mesh', function () {
            const compare = app.renderer.shadowRenderer.sortCompareShader;
            const list = [caster(1, 5, 1), caster(2, 1, 1), caster(1, 7, 2), caster(1, 5, 3), caster(1, 7, 1)];
            list.sort(compare);
            expect(list.map(c => [c._sortKeyShadow >= 2 * 0x400000 ? 2 : 1, c._sortKeyShadow % 0x400000, c.mesh.id])).to.deep.equal([
                [2, 1, 1], [1, 7, 2], [1, 7, 1], [1, 5, 3], [1, 5, 1]
            ]);
        });
    });
});
