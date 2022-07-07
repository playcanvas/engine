import { ELEMENTTYPE_GROUP } from '../../../../src/framework/components/element/constants.js';
import { Application } from '../../../../src/framework/application.js';
import { Entity } from '../../../../src/framework/entity.js';

import { HTMLCanvasElement } from '@playcanvas/canvas-mock';

import { expect } from 'chai';
import { restore, spy, stub } from 'sinon';

/** @typedef {import('../../../../src/framework/components/layout-group/system.js').LayoutGroupComponentSystem} LayoutGroupComponentSystem */

describe('LayoutGroupComponent', function () {
    /** @type {Application} */
    let app;
    /** @type {LayoutGroupComponentSystem} */
    let system;
    /** @type {Entity} */
    let entity0;
    /** @type {Entity} */
    let entity0_0;
    /** @type {Entity} */
    let entity0_0_0;

    const buildLayoutGroupEntity = function (name) {
        const entity = new Entity('myEntity' + name, app);

        app.systems.element.addComponent(entity, { type: ELEMENTTYPE_GROUP });
        app.systems.layoutgroup.addComponent(entity);

        return entity;
    };

    beforeEach(function () {
        const canvas = new HTMLCanvasElement(500, 500);
        app = new Application(canvas);
        system = app.systems.layoutgroup;

        entity0 = buildLayoutGroupEntity('0');
        entity0_0 = buildLayoutGroupEntity('0_0');
        entity0_0_0 = buildLayoutGroupEntity('0_0_0');

        app.root.addChild(entity0);
        entity0.addChild(entity0_0);
        entity0_0.addChild(entity0_0_0);

        app.systems.fire('postUpdate');

        spy(entity0.layoutgroup, 'reflow');
        spy(entity0_0.layoutgroup, 'reflow');
        spy(entity0_0_0.layoutgroup, 'reflow');
    });

    afterEach(function () {
        restore();
        app.destroy();
    });

    it('reflows in ascending order of graph depth', function () {
        system.scheduleReflow(entity0_0.layoutgroup);
        system.scheduleReflow(entity0.layoutgroup);
        system.scheduleReflow(entity0_0_0.layoutgroup);

        app.systems.fire('postUpdate');

        expect(entity0.layoutgroup.reflow.callCount).to.equal(1);
        expect(entity0_0.layoutgroup.reflow.callCount).to.equal(1);
        expect(entity0_0_0.layoutgroup.reflow.callCount).to.equal(1);

        expect(entity0.layoutgroup.reflow.calledBefore(entity0_0.layoutgroup.reflow)).to.be.true;
        expect(entity0_0.layoutgroup.reflow.calledBefore(entity0_0_0.layoutgroup.reflow)).to.be.true;
    });

    it('reflows additional groups that are pushed during the reflow', function () {
        system.scheduleReflow(entity0.layoutgroup);

        let done = false;

        entity0.layoutgroup.reflow.restore();
        stub(entity0.layoutgroup, 'reflow').callsFake(function () {
            if (!done) {
                done = true;
                system.scheduleReflow(entity0_0_0.layoutgroup);
                system.scheduleReflow(entity0_0.layoutgroup);
            }
        });

        app.systems.fire('postUpdate');

        expect(entity0.layoutgroup.reflow.callCount).to.equal(1);
        expect(entity0_0.layoutgroup.reflow.callCount).to.equal(1);
        expect(entity0_0_0.layoutgroup.reflow.callCount).to.equal(1);

        expect(entity0.layoutgroup.reflow.calledBefore(entity0_0.layoutgroup.reflow)).to.be.true;
        expect(entity0_0.layoutgroup.reflow.calledBefore(entity0_0_0.layoutgroup.reflow)).to.be.true;
    });

    it('does not allow the same group to be pushed to the queue twice', function () {
        system.scheduleReflow(entity0.layoutgroup);
        system.scheduleReflow(entity0.layoutgroup);

        app.systems.fire('postUpdate');

        expect(entity0.layoutgroup.reflow.callCount).to.equal(1);
    });

    it('bails if the maximum iteration count is reached', function () {
        stub(console, 'warn');

        system.scheduleReflow(entity0.layoutgroup);

        entity0.layoutgroup.reflow.restore();
        stub(entity0.layoutgroup, 'reflow').callsFake(function () {
            system.scheduleReflow(entity0.layoutgroup);
        });

        app.systems.fire('postUpdate');

        expect(entity0.layoutgroup.reflow.callCount).to.equal(100);
        expect(console.warn.getCall(0).args[0]).to.equal('Max reflow iterations limit reached, bailing.');
    });
});
