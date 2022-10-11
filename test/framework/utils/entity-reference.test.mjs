import { Application } from '../../../src/framework/application.js';
import { Entity } from '../../../src/framework/entity.js';
import { EntityReference } from '../../../src/framework/utils/entity-reference.js';

import { DummyComponentSystem } from '../test-component/system.mjs';

import { HTMLCanvasElement } from '@playcanvas/canvas-mock';

import { expect } from 'chai';
import { restore, spy, stub } from 'sinon';

/** @typedef {import('../../../../src/framework/components/component.js').Component} Component */

describe('EntityReference', function () {
    /** @type {Application} */
    let app;
    /** @type {Entity} */
    let testEntity;
    /** @type {Component} */
    let testComponent;
    /** @type {Entity} */
    let otherEntity1;
    /** @type {Entity} */
    let otherEntity2;

    beforeEach(function () {
        const canvas = new HTMLCanvasElement(500, 500);
        app = new Application(canvas);

        app.systems.add(new DummyComponentSystem(app));

        testEntity = new Entity('testEntity', app);
        testComponent = testEntity.addComponent('dummy', {});

        otherEntity1 = new Entity('otherEntity1', app);
        otherEntity1.addComponent('dummy', {});
        otherEntity2 = new Entity('otherEntity2', app);

        app.root.addChild(testEntity);
        app.root.addChild(otherEntity1);
        app.root.addChild(otherEntity2);
    });

    afterEach(function () {
        restore();
        app.destroy();
    });

    // Assertion helpers that rely on checking some private state. Usually I wouldn't do
    // this, but given that we're checking such a stable part of the API (_callbacks has
    // been present since 2011) I think it's preferable to adding public methods to the
    // Events class that are only required for tests. Also it's critical that listener
    // addition and removal is implemented correctly by EntityReference in order to avoid
    // memory leaks, so the benefits as significant.
    function getTotalEventListeners(entity) {
        let total = 0;

        Object.keys(entity._callbacks || {}).forEach(function (eventName) {
            total += entity._callbacks[eventName].length;
        });

        return total;
    }

    function getNumListenersForEvent(entity, eventName) {
        return (entity._callbacks && entity._callbacks[eventName] && entity._callbacks[eventName].length) || 0;
    }

    it('provides a reference to the entity once the guid is populated', function () {
        const reference = new EntityReference(testComponent, 'myEntity1');
        expect(reference.entity).to.equal(null);

        testComponent.myEntity1 = otherEntity1.getGuid();
        expect(reference.entity).to.equal(otherEntity1);
    });

    it('does not attempt to resolve the entity reference if the parent component is not on the scene graph yet', function () {
        app.root.removeChild(testEntity);

        spy(app.root, 'findByGuid');

        const reference = new EntityReference(testComponent, 'myEntity1');
        testComponent.myEntity1 = otherEntity1.getGuid();

        expect(reference.entity).to.equal(null);
        expect(app.root.findByGuid.callCount).to.equal(0);
    });

    it('resolves the entity reference when onParentComponentEnable() is called', function () {
        app.root.removeChild(testEntity);

        const reference = new EntityReference(testComponent, 'myEntity1');
        testComponent.myEntity1 = otherEntity1.getGuid();
        expect(reference.entity).to.equal(null);

        app.root.addChild(testEntity);
        reference.onParentComponentEnable();

        expect(reference.entity).to.equal(otherEntity1);
    });

    it('nullifies the reference when the guid is nullified', function () {
        const reference = new EntityReference(testComponent, 'myEntity1');
        testComponent.myEntity1 = otherEntity1.getGuid();
        expect(reference.entity).to.equal(otherEntity1);

        testComponent.myEntity1 = null;
        expect(reference.entity).to.equal(null);
    });

    it('nullifies the reference when the referenced entity is destroyed', function () {
        const reference = new EntityReference(testComponent, 'myEntity1');
        testComponent.myEntity1 = otherEntity1.getGuid();
        expect(reference.entity).to.equal(otherEntity1);

        otherEntity1.destroy();
        expect(reference.entity).to.equal(null);
    });

    it('removes all entity and component listeners when the guid is reassigned', function () {
        const reference = new EntityReference(testComponent, 'myEntity1', {
            'entity#foo': stub(),
            'dummy#bar': stub()
        });
        expect(reference).to.be.ok;

        testComponent.myEntity1 = otherEntity1.getGuid();
        expect(getTotalEventListeners(otherEntity1)).to.equal(2);
        expect(getNumListenersForEvent(otherEntity1.dummy, 'bar')).to.equal(1);

        testComponent.myEntity1 = otherEntity2.getGuid();
        expect(getTotalEventListeners(otherEntity1)).to.equal(0);
        expect(getNumListenersForEvent(otherEntity1.dummy, 'bar')).to.equal(0);
    });

    it('removes all entity and component listeners when the parent component is removed', function () {
        const reference = new EntityReference(testComponent, 'myEntity1', {
            'entity#foo': stub(),
            'dummy#bar': stub()
        });
        expect(reference).to.be.ok;

        testComponent.myEntity1 = otherEntity1.getGuid();
        expect(getTotalEventListeners(otherEntity1)).to.equal(2);
        expect(getNumListenersForEvent(otherEntity1.dummy, 'bar')).to.equal(1);
        expect(getNumListenersForEvent(app.systems.dummy, 'add')).to.equal(1);
        expect(getNumListenersForEvent(app.systems.dummy, 'beforeremove')).to.equal(2);

        testEntity.removeComponent('dummy');
        expect(getTotalEventListeners(otherEntity1)).to.equal(0);
        expect(getNumListenersForEvent(otherEntity1.dummy, 'bar')).to.equal(0);
        expect(getNumListenersForEvent(app.systems.dummy, 'add')).to.equal(0);
        expect(getNumListenersForEvent(app.systems.dummy, 'beforeremove')).to.equal(0);
    });

    it('removes all entity and component listeners when the parent component\'s entity is destroyed', function () {
        const reference = new EntityReference(testComponent, 'myEntity1', {
            'entity#foo': stub(),
            'dummy#bar': stub()
        });
        expect(reference).to.be.ok;

        testComponent.myEntity1 = otherEntity1.getGuid();
        expect(getTotalEventListeners(otherEntity1)).to.equal(2);
        expect(getNumListenersForEvent(otherEntity1.dummy, 'bar')).to.equal(1);
        expect(getNumListenersForEvent(app.systems.dummy, 'add')).to.equal(1);
        expect(getNumListenersForEvent(app.systems.dummy, 'beforeremove')).to.equal(2);

        testEntity.destroy();
        expect(getTotalEventListeners(otherEntity1)).to.equal(0);
        expect(getNumListenersForEvent(otherEntity1.dummy, 'bar')).to.equal(0);
        expect(getNumListenersForEvent(app.systems.dummy, 'add')).to.equal(0);
        expect(getNumListenersForEvent(app.systems.dummy, 'beforeremove')).to.equal(0);
    });

    it('fires component gain events when a guid is first assigned, if the referenced entity already has the component', function () {
        const gainListener = stub();

        const reference = new EntityReference(testComponent, 'myEntity1', {
            'dummy#gain': gainListener
        });
        expect(reference).to.be.ok;

        testComponent.myEntity1 = otherEntity1.getGuid();

        expect(gainListener.callCount).to.equal(1);
    });

    it('fires component gain events once a component is added', function () {
        const gainListener = stub();

        const reference = new EntityReference(testComponent, 'myEntity2', {
            'dummy#gain': gainListener
        });
        expect(reference).to.be.ok;

        testComponent.myEntity2 = otherEntity2.getGuid();

        expect(gainListener.callCount).to.equal(0);

        otherEntity2.addComponent('dummy', {});

        expect(gainListener.callCount).to.equal(1);
    });

    it('fires component lose and gain events when a component is removed and re-added', function () {
        const gainListener = stub();
        const loseListener = stub();

        const reference = new EntityReference(testComponent, 'myEntity1', {
            'dummy#gain': gainListener,
            'dummy#lose': loseListener
        });
        expect(reference).to.be.ok;

        testComponent.myEntity1 = otherEntity1.getGuid();

        expect(gainListener.callCount).to.equal(1);
        expect(loseListener.callCount).to.equal(0);

        otherEntity1.removeComponent('dummy');

        expect(gainListener.callCount).to.equal(1);
        expect(loseListener.callCount).to.equal(1);

        otherEntity1.addComponent('dummy', {});

        expect(gainListener.callCount).to.equal(2);
        expect(loseListener.callCount).to.equal(1);
    });

    it('fires component lose events when the guid is reassigned, but only for component types that the entity had', function () {
        const dummyLoseListener = stub();
        const lightLoseListener = stub();

        const reference = new EntityReference(testComponent, 'myEntity1', {
            'dummy#lose': dummyLoseListener,
            'light#lose': lightLoseListener
        });
        expect(reference).to.be.ok;

        testComponent.myEntity1 = otherEntity1.getGuid();

        expect(dummyLoseListener.callCount).to.equal(0);
        expect(lightLoseListener.callCount).to.equal(0);

        testComponent.myEntity1 = null;

        expect(dummyLoseListener.callCount).to.equal(1);
        expect(lightLoseListener.callCount).to.equal(0);
    });

    it('forwards any events dispatched by a component', function () {
        const fooListener = stub();
        const barListener = stub();

        const reference = new EntityReference(testComponent, 'myEntity1', {
            'dummy#foo': fooListener,
            'dummy#bar': barListener
        });
        expect(reference).to.be.ok;

        testComponent.myEntity1 = otherEntity1.getGuid();

        otherEntity1.dummy.fire('foo', 'a', 'b');
        expect(fooListener.callCount).to.equal(1);
        expect(fooListener.getCall(0).args[0]).to.equal('a');
        expect(fooListener.getCall(0).args[1]).to.equal('b');
        expect(barListener.callCount).to.equal(0);

        otherEntity1.dummy.fire('bar', 'c', 'd');
        expect(fooListener.callCount).to.equal(1);
        expect(barListener.callCount).to.equal(1);
        expect(barListener.getCall(0).args[0]).to.equal('c');
        expect(barListener.getCall(0).args[1]).to.equal('d');
    });

    it('correctly handles component event forwarding across component removal and subsequent re-addition', function () {
        const fooListener = stub();
        const barListener = stub();

        const reference = new EntityReference(testComponent, 'myEntity1', {
            'dummy#foo': fooListener,
            'dummy#bar': barListener
        });
        expect(reference).to.be.ok;

        testComponent.myEntity1 = otherEntity1.getGuid();

        const oldDummyComponent = otherEntity1.dummy;

        otherEntity1.removeComponent('dummy');

        oldDummyComponent.fire('foo');
        oldDummyComponent.fire('bar');
        expect(fooListener.callCount).to.equal(0);
        expect(barListener.callCount).to.equal(0);

        const newDummyComponent = otherEntity1.addComponent('dummy');

        newDummyComponent.fire('foo');
        newDummyComponent.fire('bar');
        expect(fooListener.callCount).to.equal(1);
        expect(barListener.callCount).to.equal(1);
    });

    it('forwards any events dispatched by the entity', function () {
        const fooListener = stub();
        const barListener = stub();

        const reference = new EntityReference(testComponent, 'myEntity1', {
            'entity#foo': fooListener,
            'entity#bar': barListener
        });
        expect(reference).to.be.ok;

        testComponent.myEntity1 = otherEntity1.getGuid();

        otherEntity1.fire('foo', 'a', 'b');
        expect(fooListener.callCount).to.equal(1);
        expect(fooListener.getCall(0).args[0]).to.equal('a');
        expect(fooListener.getCall(0).args[1]).to.equal('b');
        expect(barListener.callCount).to.equal(0);

        otherEntity1.fire('bar', 'c', 'd');
        expect(fooListener.callCount).to.equal(1);
        expect(barListener.callCount).to.equal(1);
        expect(barListener.getCall(0).args[0]).to.equal('c');
        expect(barListener.getCall(0).args[1]).to.equal('d');
    });

    it('correctly handles entity event forwarding across entity nullification and subsequent reassignment', function () {
        const fooListener = stub();
        const barListener = stub();

        const reference = new EntityReference(testComponent, 'myEntity1', {
            'entity#foo': fooListener,
            'entity#bar': barListener
        });
        expect(reference).to.be.ok;

        testComponent.myEntity1 = otherEntity1.getGuid();

        testComponent.myEntity1 = null;

        otherEntity1.fire('foo');
        otherEntity1.fire('bar');
        expect(fooListener.callCount).to.equal(0);
        expect(barListener.callCount).to.equal(0);

        testComponent.myEntity1 = otherEntity2.getGuid();

        otherEntity2.fire('foo');
        otherEntity2.fire('bar');
        expect(fooListener.callCount).to.equal(1);
        expect(barListener.callCount).to.equal(1);
    });

    it('validates the event map', function () {
        function testEventMap(eventMap) {
            const reference = new EntityReference(testComponent, 'myEntity1', eventMap);
            expect(reference).to.be.ok;
        }

        const callback = stub();

        expect(function () {
            testEventMap({ 'foo': callback });
        }).to.throw('Invalid event listener description: `foo`');

        expect(function () {
            testEventMap({ 'foo#': callback });
        }).to.throw('Invalid event listener description: `foo#`');

        expect(function () {
            testEventMap({ '#foo': callback });
        }).to.throw('Invalid event listener description: `#foo`');

        expect(function () {
            testEventMap({ 'foo#bar': null });
        }).to.throw('Invalid or missing callback for event listener `foo#bar`');
    });

    it('logs a warning if the entity property is set to anything other than a string, undefined or null', function () {
        stub(console, 'warn');

        const reference = new EntityReference(testComponent, 'myEntity1');
        expect(reference).to.be.ok;

        testComponent.myEntity1 = otherEntity1.getGuid();
        testComponent.myEntity1 = null;
        testComponent.myEntity1 = undefined;

        expect(console.warn.callCount).to.equal(0);

        testComponent.myEntity1 = {};

        expect(console.warn.callCount).to.equal(1);
        expect(console.warn.getCall(0).args[0]).to.equal('Entity field `myEntity1` was set to unexpected type \'object\'');
    });

    it('set reference to a Entity instead of guid, converts property to guid', function () {
        const reference = new EntityReference(testComponent, 'myEntity1');
        testComponent.myEntity1 = otherEntity1;

        expect(testComponent.myEntity1).to.equal(otherEntity1.getGuid(), 'Component property converted to guid');
        expect(reference.entity).to.equal(otherEntity1);
    });

    it('set reference to a Entity that is not in hierarchy, converts property to guid', function () {
        const reference = new EntityReference(testComponent, 'myEntity1');
        const entity = new Entity();
        testComponent.myEntity1 = entity;

        expect(testComponent.myEntity1).to.equal(entity.getGuid(), 'Component property converted to guid');
        expect(reference.entity).to.equal(entity);
    });

    it('hasComponent() returns false if the entity is not present', function () {
        const reference = new EntityReference(testComponent, 'myEntity1');

        expect(reference.hasComponent('dummy')).to.equal(false);
    });

    it('hasComponent() returns false if the entity is present but does not have a component of the provided type', function () {
        const reference = new EntityReference(testComponent, 'myEntity1');
        testComponent.myEntity1 = otherEntity1.getGuid();
        otherEntity1.removeComponent('dummy');

        expect(reference.hasComponent('dummy')).to.equal(false);
    });

    it('hasComponent() returns true if the entity is present and has a component of the provided type', function () {
        const reference = new EntityReference(testComponent, 'myEntity1');
        testComponent.myEntity1 = otherEntity1.getGuid();

        expect(reference.hasComponent('dummy')).to.equal(true);
    });

});
