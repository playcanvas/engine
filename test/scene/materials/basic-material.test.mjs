import { BasicMaterial } from '../../../src/scene/materials/basic-material.js';
import { Color } from '../../../src/core/math/color.js';
import { Material } from '../../../src/scene/materials/material.js';

import { expect } from 'chai';

describe('BasicMaterial', function () {

    function checkDefaultMaterial(material) {
        expect(material).to.be.an.instanceof(BasicMaterial);
        expect(material).to.be.an.instanceof(Material);
        expect(material.color).to.be.an.instanceof(Color);
        expect(material.color.r).to.equal(1);
        expect(material.color.g).to.equal(1);
        expect(material.color.b).to.equal(1);
        expect(material.color.a).to.equal(1);
        expect(material.colorMap).to.be.null;
        expect(material.vertexColors).to.equal(false);
    }

    describe('#constructor()', function () {

        it('should create a new instance', function () {
            const material = new BasicMaterial();
            checkDefaultMaterial(material);
        });

    });

    describe('#clone()', function () {

        it('should clone a material', function () {
            const material = new BasicMaterial();
            const clone = material.clone();
            checkDefaultMaterial(clone);
        });

    });

    describe('#copy()', function () {

        it('should copy a material', function () {
            const src = new BasicMaterial();
            const dst = new BasicMaterial();
            dst.copy(src);
            checkDefaultMaterial(dst);
        });

    });

});
