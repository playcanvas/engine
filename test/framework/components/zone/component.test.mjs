import vm from 'node:vm';

import { expect } from 'chai';

import { Vec3 } from '../../../../src/core/math/vec3.js';
import { Entity } from '../../../../src/framework/entity.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('ZoneComponent', function () {
    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    describe('#addComponent', function () {

        it('accepts size as an array from another realm', function () {
            // as an array from another window or iframe is, this is no instance of Array
            const size = vm.runInNewContext('[1, 2, 3]');
            expect(size).to.not.be.an.instanceof(Array);

            const e = new Entity();
            e.addComponent('zone', { size });

            expect(e.zone.size.equals(new Vec3(1, 2, 3))).to.equal(true);
        });

    });

    describe('#size', function () {

        it('accepts an array from another realm', function () {
            const size = vm.runInNewContext('[4, 5, 6]');
            expect(size).to.not.be.an.instanceof(Array);

            const e = new Entity();
            e.addComponent('zone');
            e.zone.size = size;

            expect(e.zone.size.equals(new Vec3(4, 5, 6))).to.equal(true);
        });

    });

});
