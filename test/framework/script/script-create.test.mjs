import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { ScriptAttributes } from '../../../src/framework/script/script-attributes.js';
import { createScript } from '../../../src/framework/script/script-create.js';
import { ScriptType } from '../../../src/framework/script/script-type.js';
import { Script } from '../../../src/framework/script/script.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('createScript', function () {

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

    it('creates a script type which extends ScriptType, including its static members', function () {
        const Mover = createScript('mover');

        expect(Mover.prototype).to.be.an.instanceof(ScriptType);
        expect(Object.getPrototypeOf(Mover)).to.equal(ScriptType);
        expect(Script.isPrototypeOf(Mover)).to.equal(true);
    });

    it('gives each script type its own attributes', function () {
        const Mover = createScript('mover');
        const Turner = createScript('turner');

        expect(Mover.attributes).to.be.an.instanceof(ScriptAttributes);
        expect(Mover.attributes).to.equal(Mover.attributes);
        expect(Mover.attributes).to.not.equal(Turner.attributes);

        Mover.attributes.add('speed', { type: 'number', default: 5 });
        expect(Mover.attributes.has('speed')).to.equal(true);
        expect(Turner.attributes.has('speed')).to.equal(false);
    });

    it('adds the methods passed to extend to its own prototype only', function () {
        const Mover = createScript('mover');
        const Turner = createScript('turner');

        Mover.extend({
            move() {
                return 'moved';
            }
        });

        expect(Mover.prototype.move()).to.equal('moved');
        expect(Turner.prototype.move).to.equal(undefined);
    });

    it('initializes the attributes of a script created on an entity', function () {
        const Mover = createScript('mover');
        Mover.attributes.add('speed', { type: 'number', default: 5 });

        const e = new Entity();
        e.addComponent('script');
        const mover = e.script.create('mover', { attributes: { speed: 8 } });

        expect(mover).to.be.an.instanceof(Mover);
        expect(mover.speed).to.equal(8);
    });

});
