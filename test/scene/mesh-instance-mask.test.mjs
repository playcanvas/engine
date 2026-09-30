import { expect } from 'chai';
import sinon from 'sinon';

import { Entity } from '../../src/framework/entity.js';
import { MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, MASK_BAKE, SHADERDEF_INSTANCEINDEX } from '../../src/scene/constants.js';
import { LitMaterialOptionsBuilder } from '../../src/scene/materials/lit-material-options-builder.js';
import { ShaderMaterial } from '../../src/scene/materials/shader-material.js';
import { StandardMaterial } from '../../src/scene/materials/standard-material.js';
import { MeshInstance } from '../../src/scene/mesh-instance.js';
import { Mesh } from '../../src/scene/mesh.js';
import { createApp } from '../app.mjs';
import { createGraphicsDevice } from '../device.mjs';
import { jsdomSetup, jsdomTeardown } from '../jsdom.mjs';

// The light mask of a mesh instance is packed with its shader define flags into one number, which
// identifies its shader variants: the flags in the lowest 24 bits, and the mask in the top 8.
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

    it('defaults to MASK_AFFECT_DYNAMIC', function () {
        expect(meshInstance.mask).to.equal(MASK_AFFECT_DYNAMIC);
    });

    it('returns every 8 bit value it is given, the top bit included', function () {
        for (let mask = 0; mask < 256; mask++) {
            meshInstance.mask = mask;
            expect(meshInstance.mask).to.equal(mask);
        }
    });

    it('keeps the flags when set, and the flags keep it', function () {
        meshInstance.setInstancing(true);
        meshInstance.mask = MASK_BAKE | 0x80;
        expect(meshInstance._shaderDefs & SHADERDEF_INSTANCEINDEX).to.equal(SHADERDEF_INSTANCEINDEX);

        meshInstance.setInstancing(null);
        expect(meshInstance.mask).to.equal(MASK_BAKE | 0x80);
    });

    it('does not share a bit with the highest flag', function () {
        const highestFlag = 1 << 23;
        meshInstance._updateShaderDefs(meshInstance._shaderDefs | highestFlag);
        expect(meshInstance.mask).to.equal(MASK_AFFECT_DYNAMIC);

        meshInstance.mask = 0xff;
        expect(meshInstance._shaderDefs & highestFlag).to.equal(highestFlag);
        expect(meshInstance.mask).to.equal(0xff);
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
        entity.render.meshInstances[0].mask = MASK_AFFECT_LIGHTMAPPED | 0x80;
        app.render();

        expect(selectLights.called).to.equal(true);
        expect(selectLights.args.every(args => args[1] === (MASK_AFFECT_LIGHTMAPPED | 0x80))).to.equal(true);
    });
});
