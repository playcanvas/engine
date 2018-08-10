(function() {
    QUnit.module("pc.EntityReference", {
        setup: function () {
            this.app = new pc.Application(document.createElement("canvas"));

            new pc.DummyComponentSystem(this.app);

            this.testEntity = new pc.Entity("testEntity", this.app);
            this.testComponent = this.testEntity.addComponent("dummy", {});

            this.otherEntity1 = new pc.Entity("otherEntity1", this.app);
            this.otherEntity1.addComponent("dummy", {});
            this.otherEntity2 = new pc.Entity("otherEntity2", this.app);

            this.app.root.addChild(this.testEntity);
            this.app.root.addChild(this.otherEntity1);
            this.app.root.addChild(this.otherEntity2);
        },

        teardown: function () {
            sinon.restore();
        }
    });

    // Assertion helpers that rely on checking some private state. Usually I wouldn't do
    // this, but given that we're checking such a stable part of the API (_callbacks has
    // been present since 2011) I think it's preferable to adding public methods to the
    // Events class that are only required for tests. Also it's critical that listener
    // addition and removal is implemented correctly by EntityReference in order to avoid
    // memory leaks, so the benefits as significant.
    function getTotalEventListeners(entity) {
        var total = 0;

        Object.keys(entity._callbacks || {}).forEach(function(eventName) {
            total += entity._callbacks[eventName].length;
        });

        return total;
    }

    function getNumListenersForEvent(entity, eventName) {
        return (entity._callbacks && entity._callbacks[eventName] && entity._callbacks[eventName].length) || 0;
    }

    test("provides a reference to the entity once the guid is populated", function () {
        var reference = new pc.EntityReference(this.testComponent, "myEntity1");
        strictEqual(reference.entity, null);

        this.testComponent.myEntity1 = this.otherEntity1.getGuid();
        strictEqual(reference.entity, this.otherEntity1);
    });

    test("does not attempt to resolve the entity reference if the parent component is not on the scene graph yet", function () {
        this.app.root.removeChild(this.testEntity);

        sinon.spy(this.app.root, "findByGuid");

        var reference = new pc.EntityReference(this.testComponent, "myEntity1");
        this.testComponent.myEntity1 = this.otherEntity1.getGuid();

        strictEqual(reference.entity, null);
        strictEqual(this.app.root.findByGuid.callCount, 0);
    });

    test("resolves the entity reference when onParentComponentEnable() is called", function () {
        this.app.root.removeChild(this.testEntity);

        var reference = new pc.EntityReference(this.testComponent, "myEntity1");
        this.testComponent.myEntity1 = this.otherEntity1.getGuid();
        strictEqual(reference.entity, null);

        this.app.root.addChild(this.testEntity);
        reference.onParentComponentEnable();

        strictEqual(reference.entity, this.otherEntity1);
    });

    test("nullifies the reference when the guid is nullified", function () {
        var reference = new pc.EntityReference(this.testComponent, "myEntity1");
        this.testComponent.myEntity1 = this.otherEntity1.getGuid();
        strictEqual(reference.entity, this.otherEntity1);

        this.testComponent.myEntity1 = null;
        strictEqual(reference.entity, null);
    });

    test("nullifies the reference when the referenced entity is destroyed", function () {
        var reference = new pc.EntityReference(this.testComponent, "myEntity1");
        this.testComponent.myEntity1 = this.otherEntity1.getGuid();
        strictEqual(reference.entity, this.otherEntity1);

        this.otherEntity1.destroy();
        strictEqual(reference.entity, null);
    });

    test("removes all entity and component listeners when the guid is reassigned", function () {
        new pc.EntityReference(this.testComponent, "myEntity1", {
            "entity#foo": sinon.stub(),
            "dummy#bar": sinon.stub()
        });
        this.testComponent.myEntity1 = this.otherEntity1.getGuid();
        strictEqual(getTotalEventListeners(this.otherEntity1), 2);
        strictEqual(getNumListenersForEvent(this.otherEntity1.dummy, 'bar'), 1);

        this.testComponent.myEntity1 = this.otherEntity2.getGuid();
        strictEqual(getTotalEventListeners(this.otherEntity1), 0);
        strictEqual(getNumListenersForEvent(this.otherEntity1.dummy, 'bar'), 0);
    });

    test("removes all entity and component listeners when the parent component is removed", function () {
        new pc.EntityReference(this.testComponent, "myEntity1", {
            "entity#foo": sinon.stub(),
            "dummy#bar": sinon.stub()
        });
        this.testComponent.myEntity1 = this.otherEntity1.getGuid();
        strictEqual(getTotalEventListeners(this.otherEntity1), 2);
        strictEqual(getNumListenersForEvent(this.otherEntity1.dummy, 'bar'), 1);
        strictEqual(getNumListenersForEvent(this.app.systems.dummy, 'add'), 1);
        strictEqual(getNumListenersForEvent(this.app.systems.dummy, 'beforeremove'), 2);

        this.testEntity.removeComponent('dummy');
        strictEqual(getTotalEventListeners(this.otherEntity1), 0);
        strictEqual(getNumListenersForEvent(this.otherEntity1.dummy, 'bar'), 0);
        strictEqual(getNumListenersForEvent(this.app.systems.dummy, 'add'), 0);
        strictEqual(getNumListenersForEvent(this.app.systems.dummy, 'beforeremove'), 0);
    });

    test("removes all entity and component listeners when the parent component's entity is destroyed", function () {
        new pc.EntityReference(this.testComponent, "myEntity1", {
            "entity#foo": sinon.stub(),
            "dummy#bar": sinon.stub()
        });
        this.testComponent.myEntity1 = this.otherEntity1.getGuid();
        strictEqual(getTotalEventListeners(this.otherEntity1), 2);
        strictEqual(getNumListenersForEvent(this.otherEntity1.dummy, 'bar'), 1);
        strictEqual(getNumListenersForEvent(this.app.systems.dummy, 'add'), 1);
        strictEqual(getNumListenersForEvent(this.app.systems.dummy, 'beforeremove'), 2);

        this.testEntity.destroy();
        strictEqual(getTotalEventListeners(this.otherEntity1), 0);
        strictEqual(getNumListenersForEvent(this.otherEntity1.dummy, 'bar'), 0);
        strictEqual(getNumListenersForEvent(this.app.systems.dummy, 'add'), 0);
        strictEqual(getNumListenersForEvent(this.app.systems.dummy, 'beforeremove'), 0);
    });

    test("fires component gain events when a guid is first assigned, if the referenced entity already has the component", function () {
        var gainListener = sinon.stub();

        new pc.EntityReference(this.testComponent, "myEntity1", {
            "dummy#gain": gainListener
        });
        this.testComponent.myEntity1 = this.otherEntity1.getGuid();

        strictEqual(gainListener.callCount, 1);
    });

    test("fires component gain events once a component is added", function () {
        var gainListener = sinon.stub();

        new pc.EntityReference(this.testComponent, "myEntity2", {
            "dummy#gain": gainListener
        });
        this.testComponent.myEntity2 = this.otherEntity2.getGuid();

        strictEqual(gainListener.callCount, 0);

        this.otherEntity2.addComponent("dummy", {});

        strictEqual(gainListener.callCount, 1);
    });

    test("fires component lose and gain events when a component is removed and re-added", function () {
        var gainListener = sinon.stub();
        var loseListener = sinon.stub();

        new pc.EntityReference(this.testComponent, "myEntity1", {
            "dummy#gain": gainListener,
            "dummy#lose": loseListener
        });
        this.testComponent.myEntity1 = this.otherEntity1.getGuid();

        strictEqual(gainListener.callCount, 1);
        strictEqual(loseListener.callCount, 0);

        this.otherEntity1.removeComponent("dummy");

        strictEqual(gainListener.callCount, 1);
        strictEqual(loseListener.callCount, 1);

        this.otherEntity1.addComponent("dummy", {});

        strictEqual(gainListener.callCount, 2);
        strictEqual(loseListener.callCount, 1);
    });

    test("fires component lose events when the guid is reassigned, but only for component types that the entity had", function () {
        var dummyLoseListener = sinon.stub();
        var lightLoseListener = sinon.stub();

        new pc.EntityReference(this.testComponent, "myEntity1", {
            "dummy#lose": dummyLoseListener,
            "light#lose": lightLoseListener
        });
        this.testComponent.myEntity1 = this.otherEntity1.getGuid();

        strictEqual(dummyLoseListener.callCount, 0);
        strictEqual(lightLoseListener.callCount, 0);

        this.testComponent.myEntity1 = null;

        strictEqual(dummyLoseListener.callCount, 1);
        strictEqual(lightLoseListener.callCount, 0);
    });

    test("forwards any events dispatched by a component", function () {
        var fooListener = sinon.stub();
        var barListener = sinon.stub();

        new pc.EntityReference(this.testComponent, "myEntity1", {
            "dummy#foo": fooListener,
            "dummy#bar": barListener
        });
        this.testComponent.myEntity1 = this.otherEntity1.getGuid();

        this.otherEntity1.dummy.fire("foo", "a", "b");
        strictEqual(fooListener.callCount, 1);
        strictEqual(fooListener.getCall(0).args[0], "a");
        strictEqual(fooListener.getCall(0).args[1], "b");
        strictEqual(barListener.callCount, 0);

        this.otherEntity1.dummy.fire("bar", "c", "d");
        strictEqual(fooListener.callCount, 1);
        strictEqual(barListener.callCount, 1);
        strictEqual(barListener.getCall(0).args[0], "c");
        strictEqual(barListener.getCall(0).args[1], "d");
    });

    test("correctly handles component event forwarding across component removal and subsequent re-addition", function () {
        var fooListener = sinon.stub();
        var barListener = sinon.stub();

        new pc.EntityReference(this.testComponent, "myEntity1", {
            "dummy#foo": fooListener,
            "dummy#bar": barListener
        });
        this.testComponent.myEntity1 = this.otherEntity1.getGuid();

        var oldDummyComponent = this.otherEntity1.dummy;

        this.otherEntity1.removeComponent("dummy");

        oldDummyComponent.fire("foo");
        oldDummyComponent.fire("bar");
        strictEqual(fooListener.callCount, 0);
        strictEqual(barListener.callCount, 0);

        var newDummyComponent = this.otherEntity1.addComponent("dummy");

        newDummyComponent.fire("foo");
        newDummyComponent.fire("bar");
        strictEqual(fooListener.callCount, 1);
        strictEqual(barListener.callCount, 1);
    });

    test("forwards any events dispatched by the entity", function () {
        var fooListener = sinon.stub();
        var barListener = sinon.stub();

        new pc.EntityReference(this.testComponent, "myEntity1", {
            "entity#foo": fooListener,
            "entity#bar": barListener
        });
        this.testComponent.myEntity1 = this.otherEntity1.getGuid();

        this.otherEntity1.fire("foo", "a", "b");
        strictEqual(fooListener.callCount, 1);
        strictEqual(fooListener.getCall(0).args[0], "a");
        strictEqual(fooListener.getCall(0).args[1], "b");
        strictEqual(barListener.callCount, 0);

        this.otherEntity1.fire("bar", "c", "d");
        strictEqual(fooListener.callCount, 1);
        strictEqual(barListener.callCount, 1);
        strictEqual(barListener.getCall(0).args[0], "c");
        strictEqual(barListener.getCall(0).args[1], "d");
    });

    test("correctly handles entity event forwarding across entity nullification and subsequent reassignment", function () {
        var fooListener = sinon.stub();
        var barListener = sinon.stub();

        new pc.EntityReference(this.testComponent, "myEntity1", {
            "entity#foo": fooListener,
            "entity#bar": barListener
        });
        this.testComponent.myEntity1 = this.otherEntity1.getGuid();

        this.testComponent.myEntity1 = null;

        this.otherEntity1.fire("foo");
        this.otherEntity1.fire("bar");
        strictEqual(fooListener.callCount, 0);
        strictEqual(barListener.callCount, 0);

        this.testComponent.myEntity1 = this.otherEntity2.getGuid();

        this.otherEntity2.fire("foo");
        this.otherEntity2.fire("bar");
        strictEqual(fooListener.callCount, 1);
        strictEqual(barListener.callCount, 1);
    });

    test("validates the event map", function () {
        function testEventMap(eventMap) {
            new pc.EntityReference(this.testComponent, "myEntity1", eventMap);
        }

        var callback = sinon.stub();

        throws(function() {
            testEventMap({ "foo": callback });
        }, "Invalid event listener description: `foo`");

        throws(function() {
            testEventMap({ "foo#": callback });
        }, "Invalid event listener description: `foo#`");

        throws(function() {
            testEventMap({ "#foo": callback });
        }, "Invalid event listener description: `#foo`");

        throws(function() {
            testEventMap({ "foo#bar": null });
        }, "Invalid or missing callback for event listener `foo#bar`");
    });

    test("logs a warning if the entity property is set to anything other than a string, undefined or null", function () {
        sinon.stub(console, "warn");

        new pc.EntityReference(this.testComponent, "myEntity1");
        this.testComponent.myEntity1 = this.otherEntity1.getGuid();
        this.testComponent.myEntity1 = null;
        this.testComponent.myEntity1 = undefined;

        strictEqual(console.warn.callCount, 0);

        this.testComponent.myEntity1 = {};

        strictEqual(console.warn.callCount, 1);
        strictEqual(console.warn.getCall(0).args[0], "Entity field `myEntity1` was set to unexpected type 'object'");
    });

    test("set reference to a pc.Entity instead of guid, converts property to guid", function () {
        var reference = new pc.EntityReference(this.testComponent, "myEntity1");
        this.testComponent.myEntity1 = this.otherEntity1;

        strictEqual(this.testComponent.myEntity1, this.otherEntity1.getGuid(), "Component property converted to guid");
        strictEqual(reference.entity, this.otherEntity1);
    });

    test("set reference to a pc.Entity that is not in hierarchy, converts property to guid", function () {
        var reference = new pc.EntityReference(this.testComponent, "myEntity1");
        var entity = new pc.Entity();
        this.testComponent.myEntity1 = entity;

        strictEqual(this.testComponent.myEntity1, entity.getGuid(), "Component property converted to guid");
        strictEqual(reference.entity, entity);
    });

    test("hasComponent() returns false if the entity is not present", function () {
        var reference = new pc.EntityReference(this.testComponent, "myEntity1");

        strictEqual(reference.hasComponent("dummy"), false);
    });

    test("hasComponent() returns false if the entity is present but does not have a component of the provided type", function () {
        var reference = new pc.EntityReference(this.testComponent, "myEntity1");
        this.testComponent.myEntity1 = this.otherEntity1.getGuid();
        this.otherEntity1.removeComponent("dummy");

        strictEqual(reference.hasComponent("dummy"), false);
    });

    test("hasComponent() returns true if the entity is present and has a component of the provided type", function () {
        var reference = new pc.EntityReference(this.testComponent, "myEntity1");
        this.testComponent.myEntity1 = this.otherEntity1.getGuid();

        strictEqual(reference.hasComponent("dummy"), true);
    });
})();
