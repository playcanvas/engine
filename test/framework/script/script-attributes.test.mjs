import vm from 'node:vm';

import { expect } from 'chai';

import { Color } from '../../../src/core/math/color.js';
import { CurveSet } from '../../../src/core/math/curve-set.js';
import { Vec3 } from '../../../src/core/math/vec3.js';
import { Entity } from '../../../src/framework/entity.js';
import { ScriptAttributes } from '../../../src/framework/script/script-attributes.js';
import { createScript } from '../../../src/framework/script/script-create.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('ScriptAttributes', function () {

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

    describe('#add', function () {

        it('converts an array from another realm to a vector', function () {
            const Mover = createScript('mover');
            Mover.attributes.add('offset', { type: 'vec3' });

            // as an array from another window or iframe is, this is no instance of Array
            const offset = vm.runInNewContext('[1, 2, 3]');
            expect(offset).to.not.be.an.instanceof(Array);

            const e = new Entity();
            e.addComponent('script');
            const mover = e.script.create('mover', { attributes: { offset } });

            expect(mover.offset).to.be.an.instanceof(Vec3);
            expect(mover.offset.equals(new Vec3(1, 2, 3))).to.equal(true);

            mover.offset = vm.runInNewContext('[4, 5, 6]');
            expect(mover.offset.equals(new Vec3(4, 5, 6))).to.equal(true);
        });

        it('converts an array from another realm to a color', function () {
            const Mover = createScript('mover');
            Mover.attributes.add('tint', { type: 'rgba' });

            const tint = vm.runInNewContext('[1, 0.5, 0.25, 0.5]');
            expect(tint).to.not.be.an.instanceof(Array);

            const e = new Entity();
            e.addComponent('script');
            const mover = e.script.create('mover', { attributes: { tint } });

            expect(mover.tint).to.be.an.instanceof(Color);
            expect(mover.tint.equals(new Color(1, 0.5, 0.25, 0.5))).to.equal(true);
        });

    });

    describe('.attributeToValue', function () {

        it('converts curve keys given as arrays from another realm to a curve set', function () {
            const data = vm.runInNewContext('({ keys: [[0, 0, 1, 2], [0, 4, 1, 8]], type: 0 })');
            expect(data.keys[0]).to.not.be.an.instanceof(Array);

            const curves = ScriptAttributes.attributeToValue(app, { type: 'curve' }, data, null);

            expect(curves).to.be.an.instanceof(CurveSet);
            expect(curves.length).to.equal(2);
            expect(curves.value(1)).to.deep.equal([2, 8]);
        });

    });

});
