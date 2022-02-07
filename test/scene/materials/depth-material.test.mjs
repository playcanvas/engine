import { DepthMaterial } from '../../../src/scene/materials/depth-material.js';
import { Material } from '../../../src/scene/materials/material.js';

import { expect } from 'chai';

describe('DepthMaterial', function () {

    function checkDefaultMaterial(material) {
        expect(material).to.be.an.instanceof(DepthMaterial);
        expect(material).to.be.an.instanceof(Material);
    }

    describe('#constructor()', function () {

        it('should create a new instance', function () {
            const material = new DepthMaterial();
            checkDefaultMaterial(material);
        });

    });

    describe('#clone()', function () {

        it('should clone a material', function () {
            const material = new DepthMaterial();
            const clone = material.clone();
            checkDefaultMaterial(clone);
        });

    });

    describe('#copy()', function () {

        it('should copy a material', function () {
            const src = new DepthMaterial();
            const dst = new DepthMaterial();
            dst.copy(src);
            checkDefaultMaterial(dst);
        });

    });

});
