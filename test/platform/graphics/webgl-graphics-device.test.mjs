import { WebglGraphicsDevice } from '../../../src/platform/graphics/webgl/webgl-graphics-device.js';

import { HTMLCanvasElement } from '@playcanvas/canvas-mock';

import { expect } from 'chai';

describe('WebglGraphicsDevice', function () {

    describe('#constructor', function () {

        it('no options', function () {
            const canvas = new HTMLCanvasElement(500, 500);
            const gd = new WebglGraphicsDevice(canvas);
            expect(gd.canvas).to.equal(canvas);
//            expect(gd.fullscreen).to.be.false;
            expect(gd.height).to.equal(500);
            expect(gd.gl).to.be.ok;
            expect(gd.maxAnisotropy).to.equal(1);
            expect(gd.maxCubeMapSize).to.be.greaterThanOrEqual(1024);
            expect(gd.maxPixelRatio).to.be.greaterThanOrEqual(1);
            expect(gd.maxTextureSize).to.be.greaterThanOrEqual(1024);
            expect(gd.maxVolumeSize).to.be.greaterThanOrEqual(1);
            expect(gd.precision).to.be.oneOf(['highp', 'mediump', 'lowp']);
            expect(gd.width).to.equal(500);
        });

    });

});
