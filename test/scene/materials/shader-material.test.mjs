import { expect } from 'chai';
import { restore, stub } from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { BlendState } from '../../../src/platform/graphics/blend-state.js';
import {
    BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_SRC1_COLOR, BLENDMODE_ZERO,
    CULLFACE_BACK, FUNC_LESSEQUAL, FRONTFACE_CCW
} from '../../../src/platform/graphics/constants.js';
import { BLEND_NONE } from '../../../src/scene/constants.js';
import { ShaderMaterial } from '../../../src/scene/materials/shader-material.js';
import { shaderGeneratorShader } from '../../../src/scene/shader-lib/programs/shader-generator-shader.js';

describe('Material', function () {

    afterEach(function () {
        restore();
    });

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

    describe('#blendState', function () {

        it('clears shader variants when dual-source blending usage changes', function () {
            const material = new ShaderMaterial();
            const dualSource = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_SRC1_COLOR);

            material.variants.set(1, null);
            material.blendState = dualSource;
            expect(material.variants.size).to.equal(0);

            material.variants.set(1, null);
            material.blendState = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ZERO, BLENDMODE_SRC1_COLOR);
            expect(material.variants.size).to.equal(1);

            material.blendState = BlendState.NOBLEND;
            expect(material.variants.size).to.equal(0);
        });

    });

    describe('#update()', function () {

        it('increments the update version', function () {
            const material = new ShaderMaterial();

            expect(material.updateVersion).to.equal(0);
            material.update();
            expect(material.updateVersion).to.equal(1);
        });

        it('reports the removed dirty property', function () {
            const removed = stub(Debug, 'removed');
            const material = new ShaderMaterial();

            expect(material.dirty).to.equal(undefined);
            expect(removed.calledOnceWithExactly(
                'Material#dirty has been removed. Call Material#update() after modifying material properties.'
            )).to.equal(true);
        });

        it('clears dirty shader variants immediately', function () {
            const material = new ShaderMaterial();
            material.variants.set(1, {});

            material.update();

            expect(material.variants.size).to.equal(0);
            expect(material._dirtyShader).to.equal(false);
        });

        it('clears variants only once when shader state and defines are dirty', function () {
            const material = new ShaderMaterial();
            let clearCount = 0;
            material.meshInstances.add({
                clearShaders: () => {
                    clearCount++;
                }
            });
            material.setDefine('TEST_DEFINE', true);

            material.update();
            material.prepareForRender();

            expect(clearCount).to.equal(1);
        });

        it('retains preparation as a compatibility fallback', function () {
            const material = new ShaderMaterial();
            material.variants.set(1, {});

            material.prepareForRender();

            expect(material.variants.size).to.equal(0);
            expect(material._dirtyShader).to.equal(false);
        });

        it('does not clear variants during preparation after update processed them', function () {
            const material = new ShaderMaterial();
            material.update();
            material.variants.set(1, {});

            material.prepareForRender();

            expect(material.variants.size).to.equal(1);
        });

        it('prepares once for each material update', function () {
            const material = new ShaderMaterial();
            const updateUniforms = material.updateUniforms.bind(material);
            let prepareCount = 0;
            material.updateUniforms = (...args) => {
                prepareCount++;
                updateUniforms(...args);
            };

            material.prepareForRender();
            material.prepareForRender();
            expect(prepareCount).to.equal(1);

            material.update();
            material.prepareForRender();
            expect(prepareCount).to.equal(2);
        });

    });

    describe('shader generation', function () {

        it('includes dual-source blending usage in the shader key', function () {
            const shaderDesc = { uniqueName: 'DualSource' };
            const options = {
                defines: new Map(),
                shaderDesc
            };
            const regularKey = shaderGeneratorShader.generateKey(options);

            options.useDualSourceBlending = true;
            const dualSourceKey = shaderGeneratorShader.generateKey(options);

            expect(dualSourceKey).to.not.equal(regularKey);
        });

    });

});
