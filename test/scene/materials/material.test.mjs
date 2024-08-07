import { CULLFACE_BACK, FUNC_LESSEQUAL } from '../../../src/platform/graphics/constants.js';
import { BLEND_NONE } from '../../../src/scene/constants.js';
import { Material } from '../../../src/scene/materials/material.js';

import { expect } from 'chai';

describe('Material', () => {

    function checkDefaultMaterial(material) {
        expect(material).to.be.an.instanceof(Material);
        expect(material.alphaTest).to.equal(0);
        expect(material.alphaToCoverage).to.equal(false);
        expect(material.alphaWrite).to.equal(true);
        expect(material.blendType).to.equal(BLEND_NONE);
        expect(material.blueWrite).to.equal(true);
        expect(material.cull).to.equal(CULLFACE_BACK);
        expect(material.depthBias).to.equal(0);
        expect(material.depthTest).to.equal(true);
        expect(material.depthFunc).to.equal(FUNC_LESSEQUAL);
        expect(material.depthWrite).to.equal(true);
        expect(material.greenWrite).to.equal(true);
        expect(material.name).to.equal('Untitled');
        expect(material.redWrite).to.equal(true);
        expect(material.shader).to.be.null;
        expect(material.slopeDepthBias).to.equal(0);
        expect(material.stencilBack).to.not.exist;
        expect(material.stencilFront).to.not.exist;
    }

    describe('#constructor()', () => {

        it('should create a new instance', () => {
            const material = new Material();
            checkDefaultMaterial(material);
        });

    });

    describe('#clone()', () => {

        it('should clone a material', () => {
            const material = new Material();
            const clone = material.clone();
            checkDefaultMaterial(clone);
        });

    });

    describe('#copy()', () => {

        it('should copy a material', () => {
            const src = new Material();
            const dst = new Material();
            dst.copy(src);
            checkDefaultMaterial(dst);
        });

    });

});
