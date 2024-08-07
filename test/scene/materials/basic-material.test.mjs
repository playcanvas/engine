import { BasicMaterial } from '../../../src/scene/materials/basic-material.js';
import { Color } from '../../../src/core/math/color.js';
import { Material } from '../../../src/scene/materials/material.js';

import { expect } from 'chai';

describe('BasicMaterial', () => {

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

    describe('#constructor()', () => {

        it('should create a new instance', () => {
            const material = new BasicMaterial();
            checkDefaultMaterial(material);
        });

    });

    describe('#clone()', () => {

        it('should clone a material', () => {
            const material = new BasicMaterial();
            const clone = material.clone();
            checkDefaultMaterial(clone);
        });

    });

    describe('#copy()', () => {

        it('should copy a material', () => {
            const src = new BasicMaterial();
            const dst = new BasicMaterial();
            dst.copy(src);
            checkDefaultMaterial(dst);
        });

    });

});
