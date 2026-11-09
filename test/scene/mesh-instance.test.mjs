import { expect } from 'chai';

import { SHADERDEF_NOSHADOW } from '../../src/scene/constants.js';
import { StandardMaterial } from '../../src/scene/materials/standard-material.js';
import { MeshInstance } from '../../src/scene/mesh-instance.js';
import { Mesh } from '../../src/scene/mesh.js';
import { createGraphicsDevice } from '../device.mjs';

describe('MeshInstance', function () {
    let device;
    let material;
    let meshInstance;

    beforeEach(function () {
        device = createGraphicsDevice({ id: 'mesh-instance-test' });
        material = new StandardMaterial();
        meshInstance = new MeshInstance(new Mesh(device), material);
    });

    afterEach(function () {
        meshInstance.destroy();
        material.destroy();
        device.destroy();
    });

    describe('#castShadows', function () {

        it('defaults to false', function () {
            expect(meshInstance.castShadows).to.be.false;
        });

        it('forwards the deprecated castShadow to castShadows', function () {
            meshInstance.castShadow = true;
            expect(meshInstance.castShadows).to.be.true;
            expect(meshInstance.castShadow).to.be.true;
        });

    });

    describe('#receiveShadows', function () {

        it('defaults to true', function () {
            expect(meshInstance.receiveShadows).to.be.true;
        });

        it('toggles the no-shadow shader define', function () {
            meshInstance.receiveShadows = false;
            expect(meshInstance._shaderDefs & SHADERDEF_NOSHADOW).to.not.equal(0);

            meshInstance.receiveShadows = true;
            expect(meshInstance._shaderDefs & SHADERDEF_NOSHADOW).to.equal(0);
        });

        it('forwards the deprecated receiveShadow to receiveShadows', function () {
            meshInstance.receiveShadow = false;
            expect(meshInstance.receiveShadows).to.be.false;
            expect(meshInstance.receiveShadow).to.be.false;
            expect(meshInstance._shaderDefs & SHADERDEF_NOSHADOW).to.not.equal(0);
        });

    });

});
