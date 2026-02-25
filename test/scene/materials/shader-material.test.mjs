import { expect } from 'chai';

import { CULLFACE_BACK, FUNC_LESSEQUAL, FRONTFACE_CCW } from '../../../src/platform/graphics/constants.js';
import { BLEND_NONE } from '../../../src/scene/constants.js';
import { ShaderMaterial } from '../../../src/scene/materials/shader-material.js';

describe('Material', function () {

    function checkDefaultMaterial(material) {
        expect(material).to.be.an.instanceof(ShaderMaterial);
        expect(material.alphaTest).to.equal(0);
        expect(material.alphaToCoverage).to.equal(false);
        expect(material.alphaWrite).to.equal(true);
        expect(material.blendType).to.equal(BLEND_NONE);
        expect(material.blueWrite).to.equal(true);
        expect(material.cull).to.equal(CULLFACE_BACK);
        expect(material.frontFace).to.equal(FRONTFACE_CCW);
        expect(material.depthBias).to.equal(0);
        expect(material.depthTest).to.equal(true);
        expect(material.depthFunc).to.equal(FUNC_LESSEQUAL);
        expect(material.depthWrite).to.equal(true);
        expect(material.greenWrite).to.equal(true);
        expect(material.name).to.equal('Untitled');
        expect(material.redWrite).to.equal(true);
        expect(material.slopeDepthBias).to.equal(0);
        expect(material.stencilBack).to.not.exist;
        expect(material.stencilFront).to.not.exist;
    }

    describe('#constructor()', function () {

        it('should create a new instance', function () {
            const material = new ShaderMaterial();
            checkDefaultMaterial(material);
        });

    });

    describe('#clone()', function () {

        it('should clone a material', function () {
            const material = new ShaderMaterial();
            const clone = material.clone();
            checkDefaultMaterial(clone);
        });

    });

    describe('#copy()', function () {

        it('should copy a material', function () {
            const src = new ShaderMaterial();
            const dst = new ShaderMaterial();
            dst.copy(src);
            checkDefaultMaterial(dst);
        });

    });

});
