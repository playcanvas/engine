import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../src/core/debug.js';
import { Entity } from '../../src/framework/entity.js';
import {
    LIGHTTYPE_DIRECTIONAL, MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, MASK_BAKE,
    SHADERDEF_AFFECT_DYNAMIC, SHADERDEF_AFFECT_LIGHTMAPPED, SHADERDEF_BAKE, SHADERDEF_INSTANCEINDEX, SHADERDEF_UV7
} from '../../src/scene/constants.js';
import { Light } from '../../src/scene/light.js';
import { LitMaterialOptionsBuilder } from '../../src/scene/materials/lit-material-options-builder.js';
import { ShaderMaterial } from '../../src/scene/materials/shader-material.js';
import { StandardMaterial } from '../../src/scene/materials/standard-material.js';
import { MeshInstance } from '../../src/scene/mesh-instance.js';
import { Mesh } from '../../src/scene/mesh.js';
import { createApp } from '../app.mjs';
import { createGraphicsDevice } from '../device.mjs';
import { jsdomSetup, jsdomTeardown } from '../jsdom.mjs';

// The light mask of a mesh instance is held in its shader defines as a flag for each of its values,
// so it identifies the shader variants of the mesh instance like its other flags.
describe('MeshInstance#mask', function () {

    let device;
    let meshInstance;

    beforeEach(function () {
        device = createGraphicsDevice({ width: 1, height: 1 });
        meshInstance = new MeshInstance(new Mesh(device), new ShaderMaterial());
    });

    afterEach(function () {
        meshInstance.destroy();
        device.destroy();
    });

    const maskFlags = SHADERDEF_AFFECT_DYNAMIC | SHADERDEF_AFFECT_LIGHTMAPPED | SHADERDEF_BAKE;

    it('defaults to MASK_AFFECT_DYNAMIC', function () {
        expect(meshInstance.mask).to.equal(MASK_AFFECT_DYNAMIC);
        expect(meshInstance._shaderDefs & maskFlags).to.equal(SHADERDEF_AFFECT_DYNAMIC);
    });

    it('returns every combination of MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED and MASK_BAKE', function () {
        for (let mask = 0; mask < 8; mask++) {
            meshInstance.mask = mask;
            expect(meshInstance.mask).to.equal(mask);
        }
    });

    it('holds each value of the mask in its own shader define flag', function () {
        const flags = [
            [MASK_AFFECT_DYNAMIC, SHADERDEF_AFFECT_DYNAMIC],
            [MASK_AFFECT_LIGHTMAPPED, SHADERDEF_AFFECT_LIGHTMAPPED],
            [MASK_BAKE, SHADERDEF_BAKE]
        ];
        for (const [mask, flag] of flags) {
            meshInstance.mask = mask;
            expect(meshInstance._shaderDefs & maskFlags).to.equal(flag);
        }
    });

    it('keeps the flags when set, and the flags keep it', function () {
        meshInstance.setInstancing(true);
        meshInstance.mask = MASK_BAKE | MASK_AFFECT_LIGHTMAPPED;
        expect(meshInstance._shaderDefs & SHADERDEF_INSTANCEINDEX).to.equal(SHADERDEF_INSTANCEINDEX);

        meshInstance.setInstancing(null);
        expect(meshInstance.mask).to.equal(MASK_BAKE | MASK_AFFECT_LIGHTMAPPED);
    });

    it('drops the bits of other values, and asserts in debug builds', function () {
        const assert = sinon.stub(Debug, 'assert');
        try {
            meshInstance.mask = MASK_AFFECT_DYNAMIC | 0x80;
            expect(meshInstance.mask).to.equal(MASK_AFFECT_DYNAMIC);
            expect(assert.calledWith(false)).to.equal(true);
        } finally {
            assert.restore();
        }
    });

    it('does not share a bit with the highest flag', function () {
        meshInstance._updateShaderDefs(meshInstance._shaderDefs | SHADERDEF_UV7);
        expect(meshInstance.mask).to.equal(MASK_AFFECT_DYNAMIC);

        meshInstance.mask = MASK_AFFECT_DYNAMIC | MASK_AFFECT_LIGHTMAPPED | MASK_BAKE;
        expect(meshInstance._shaderDefs & SHADERDEF_UV7).to.equal(SHADERDEF_UV7);
        expect(meshInstance.mask).to.equal(MASK_AFFECT_DYNAMIC | MASK_AFFECT_LIGHTMAPPED | MASK_BAKE);
    });
});

describe('Light#mask', function () {

    it('keeps the values a mesh instance holds, drops the others, and asserts in debug builds', function () {
        const device = createGraphicsDevice({ width: 1, height: 1 });
        const light = new Light(device, false);
        light.type = LIGHTTYPE_DIRECTIONAL;

        light.mask = MASK_AFFECT_LIGHTMAPPED | MASK_BAKE;
        expect(light.mask).to.equal(MASK_AFFECT_LIGHTMAPPED | MASK_BAKE);

        const assert = sinon.stub(Debug, 'assert');
        try {
            light.mask = MASK_AFFECT_DYNAMIC | 0x80;
            expect(light.mask).to.equal(MASK_AFFECT_DYNAMIC);
            expect(assert.calledWith(false)).to.equal(true);
        } finally {
            assert.restore();
            light.destroy();
            device.destroy();
        }
    });
});

describe('Standard material light mask', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        const camera = new Entity('camera');
        camera.addComponent('camera');
        camera.setPosition(0, 0, 5);
        app.root.addChild(camera);
    });

    afterEach(function () {
        sinon.restore();
        app.destroy();
        jsdomTeardown();
    });

    it('selects the lights of its shader variant by the mask of the mesh instance', function () {
        const selectLights = sinon.spy(LitMaterialOptionsBuilder, 'selectLights');

        const entity = new Entity('box');
        entity.addComponent('render', { type: 'box', material: new StandardMaterial() });
        app.root.addChild(entity);
        entity.render.meshInstances[0].mask = MASK_AFFECT_LIGHTMAPPED | MASK_BAKE;
        app.render();

        expect(selectLights.called).to.equal(true);
        expect(selectLights.args.every(args => args[1] === (MASK_AFFECT_LIGHTMAPPED | MASK_BAKE))).to.equal(true);
    });
});
