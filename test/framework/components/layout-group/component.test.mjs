import { expect } from 'chai';
import { restore, spy, stub } from 'sinon';

import { ELEMENTTYPE_GROUP } from '../../../../src/framework/components/element/constants.js';
import { Entity } from '../../../../src/framework/entity.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

/**
 * @import { Application } from '../../../../src/framework/application.js'
 * @import { LayoutGroupComponentSystem } from '../../../../src/framework/components/layout-group/system.js'
 */

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
        const entity = new Entity(`myEntity${name}`, app);

        app.systems.element.addComponent(entity, { type: ELEMENTTYPE_GROUP });
        app.systems.layoutgroup.addComponent(entity);

        return entity;
    };

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

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
        app?.destroy();
        app = null;
        jsdomTeardown();
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
        stub(entity0.layoutgroup, 'reflow').callsFake(() => {
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

    ['self', 'child'].forEach((targetName) => {
        ['element', 'layoutchild'].forEach((changedType) => {
            describe(`${changedType} lifecycle on ${targetName}`, function () {
                let target;
                let survivingComponent;
                let scheduleReflow;

                const addComponent = () => target.addComponent(changedType,
                    changedType === 'element' ? { type: ELEMENTTYPE_GROUP } : {});

                const expectSingleResizeNotification = () => {
                    app.systems.fire('postUpdate');
                    scheduleReflow.resetHistory();
                    entity0.layoutgroup.reflow.resetHistory();

                    survivingComponent.fire('resize');

                    const calls = scheduleReflow.getCalls().filter(call => call.args[0] === entity0.layoutgroup);
                    expect(calls.length).to.equal(1);

                    app.systems.fire('postUpdate');
                    expect(entity0.layoutgroup.reflow.called).to.be.true;
                };

                beforeEach(function () {
                    target = targetName === 'self' ? entity0 : entity0_0;
                    if (changedType === 'element') {
                        target.removeComponent('element');
                        target.addComponent('layoutchild');
                        survivingComponent = target.layoutchild;
                    } else {
                        survivingComponent = target.element;
                    }
                    scheduleReflow = spy(system, 'scheduleReflow');
                });

                it('does not duplicate notifications from the existing component when adding', function () {
                    addComponent();
                    expectSingleResizeNotification();
                });

                it('keeps notifications from the surviving component when removing', function () {
                    const removedComponent = addComponent();
                    target.removeComponent(changedType);
                    scheduleReflow.resetHistory();
                    removedComponent.fire('resize');
                    expect(scheduleReflow.called).to.be.false;
                    expectSingleResizeNotification();
                });

                it('keeps one subscription after repeated removal and re-addition', function () {
                    for (let i = 0; i < 3; i++) {
                        addComponent();
                        expectSingleResizeNotification();
                        target.removeComponent(changedType);
                        expectSingleResizeNotification();
                    }
                    addComponent();
                    expectSingleResizeNotification();
                });
            });
        });
    });

    it('bails if the maximum iteration count is reached', function () {
        stub(console, 'warn');

        system.scheduleReflow(entity0.layoutgroup);

        entity0.layoutgroup.reflow.restore();
        stub(entity0.layoutgroup, 'reflow').callsFake(() => {
            system.scheduleReflow(entity0.layoutgroup);
        });

        app.systems.fire('postUpdate');

        expect(entity0.layoutgroup.reflow.callCount).to.equal(100);
        expect(console.warn.getCall(0).args[0]).to.equal('Max reflow iterations limit reached, bailing.');
    });
});
