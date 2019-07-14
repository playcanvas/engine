describe("pc.EntityReference", function () {
    var app;
    var testEntity;
    var testComponent;
    var otherEntity1;
    var otherEntity2;

    beforeEach(function () {
        app = new pc.Application(document.createElement("canvas"));
        app.systems.add(new pc.DummyComponentSystem(app));

        testEntity = new pc.Entity("testEntity", app);
        testComponent = testEntity.addComponent("dummy", {});

        otherEntity1 = new pc.Entity("otherEntity1", app);
        otherEntity1.addComponent("dummy", {});
        otherEntity2 = new pc.Entity("otherEntity2", app);

        app.root.addChild(testEntity);
        app.root.addChild(otherEntity1);
        app.root.addChild(otherEntity2);
    });

    afterEach(function () {
        sinon.restore();
        app.destroy();
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

    it("provides a reference to the entity once the guid is populated", function () {
        var reference = new pc.EntityReference(testComponent, "myEntity1");
        expect(reference.entity).to.equal(null);

        testComponent.myEntity1 = otherEntity1.getGuid();
        expect(reference.entity).to.equal(otherEntity1);
    });

    it("does not attempt to resolve the entity reference if the parent component is not on the scene graph yet", function () {
        app.root.removeChild(testEntity);

        sinon.spy(app.root, "findByGuid");

        var reference = new pc.EntityReference(testComponent, "myEntity1");
        testComponent.myEntity1 = otherEntity1.getGuid();

        expect(reference.entity).to.equal(null);
        expect(app.root.findByGuid.callCount).to.equal(0);
    });

    it("resolves the entity reference when onParentComponentEnable() is called", function () {
        app.root.removeChild(testEntity);

        var reference = new pc.EntityReference(testComponent, "myEntity1");
        testComponent.myEntity1 = otherEntity1.getGuid();
        expect(reference.entity).to.equal(null);

        app.root.addChild(testEntity);
        reference.onParentComponentEnable();

        expect(reference.entity).to.equal(otherEntity1);
    });

    it("nullifies the reference when the guid is nullified", function () {
        var reference = new pc.EntityReference(testComponent, "myEntity1");
        testComponent.myEntity1 = otherEntity1.getGuid();
        expect(reference.entity).to.equal(otherEntity1);

        testComponent.myEntity1 = null;
        expect(reference.entity).to.equal(null);
    });

    it("nullifies the reference when the referenced entity is destroyed", function () {
        var reference = new pc.EntityReference(testComponent, "myEntity1");
        testComponent.myEntity1 = otherEntity1.getGuid();
        expect(reference.entity).to.equal(otherEntity1);

        otherEntity1.destroy();
        expect(reference.entity).to.equal(null);
    });

    it("removes all entity and component listeners when the guid is reassigned", function () {
        new pc.EntityReference(testComponent, "myEntity1", {
            "entity#foo": sinon.stub(),
            "dummy#bar": sinon.stub()
        });
        testComponent.myEntity1 = otherEntity1.getGuid();
        expect(getTotalEventListeners(otherEntity1)).to.equal(2);
        expect(getNumListenersForEvent(otherEntity1.dummy, 'bar')).to.equal(1);

        testComponent.myEntity1 = otherEntity2.getGuid();
        expect(getTotalEventListeners(otherEntity1)).to.equal(0);
        expect(getNumListenersForEvent(otherEntity1.dummy, 'bar')).to.equal(0);
    });

    it("removes all entity and component listeners when the parent component is removed", function () {
        new pc.EntityReference(testComponent, "myEntity1", {
            "entity#foo": sinon.stub(),
            "dummy#bar": sinon.stub()
        });
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

    it("removes all entity and component listeners when the parent component's entity is destroyed", function () {
        new pc.EntityReference(testComponent, "myEntity1", {
            "entity#foo": sinon.stub(),
            "dummy#bar": sinon.stub()
        });
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

    it("fires component gain events when a guid is first assigned, if the referenced entity already has the component", function () {
        var gainListener = sinon.stub();

        new pc.EntityReference(testComponent, "myEntity1", {
            "dummy#gain": gainListener
        });
        testComponent.myEntity1 = otherEntity1.getGuid();

        expect(gainListener.callCount).to.equal(1);
    });

    it("fires component gain events once a component is added", function () {
        var gainListener = sinon.stub();

        new pc.EntityReference(testComponent, "myEntity2", {
            "dummy#gain": gainListener
        });
        testComponent.myEntity2 = otherEntity2.getGuid();

        expect(gainListener.callCount).to.equal(0);

        otherEntity2.addComponent("dummy", {});

        expect(gainListener.callCount).to.equal(1);
    });

    it("fires component lose and gain events when a component is removed and re-added", function () {
        var gainListener = sinon.stub();
        var loseListener = sinon.stub();

        new pc.EntityReference(testComponent, "myEntity1", {
            "dummy#gain": gainListener,
            "dummy#lose": loseListener
        });
        testComponent.myEntity1 = otherEntity1.getGuid();

        expect(gainListener.callCount).to.equal(1);
        expect(loseListener.callCount).to.equal(0);

        otherEntity1.removeComponent("dummy");

        expect(gainListener.callCount).to.equal(1);
        expect(loseListener.callCount).to.equal(1);

        otherEntity1.addComponent("dummy", {});

        expect(gainListener.callCount).to.equal(2);
        expect(loseListener.callCount).to.equal(1);
    });

    it("fires component lose events when the guid is reassigned, but only for component types that the entity had", function () {
        var dummyLoseListener = sinon.stub();
        var lightLoseListener = sinon.stub();

        new pc.EntityReference(testComponent, "myEntity1", {
            "dummy#lose": dummyLoseListener,
            "light#lose": lightLoseListener
        });
        testComponent.myEntity1 = otherEntity1.getGuid();

        expect(dummyLoseListener.callCount).to.equal(0);
        expect(lightLoseListener.callCount).to.equal(0);

        testComponent.myEntity1 = null;

        expect(dummyLoseListener.callCount).to.equal(1);
        expect(lightLoseListener.callCount).to.equal(0);
    });

    it("forwards any events dispatched by a component", function () {
        var fooListener = sinon.stub();
        var barListener = sinon.stub();

        new pc.EntityReference(testComponent, "myEntity1", {
            "dummy#foo": fooListener,
            "dummy#bar": barListener
        });
        testComponent.myEntity1 = otherEntity1.getGuid();

        otherEntity1.dummy.fire("foo", "a", "b");
        expect(fooListener.callCount).to.equal(1);
        expect(fooListener.getCall(0).args[0]).to.equal("a");
        expect(fooListener.getCall(0).args[1]).to.equal("b");
        expect(barListener.callCount).to.equal(0);

        otherEntity1.dummy.fire("bar", "c", "d");
        expect(fooListener.callCount).to.equal(1);
        expect(barListener.callCount).to.equal(1);
        expect(barListener.getCall(0).args[0]).to.equal("c");
        expect(barListener.getCall(0).args[1]).to.equal("d");
    });

    it("correctly handles component event forwarding across component removal and subsequent re-addition", function () {
        var fooListener = sinon.stub();
        var barListener = sinon.stub();

        new pc.EntityReference(testComponent, "myEntity1", {
            "dummy#foo": fooListener,
            "dummy#bar": barListener
        });
        testComponent.myEntity1 = otherEntity1.getGuid();

        var oldDummyComponent = otherEntity1.dummy;

        otherEntity1.removeComponent("dummy");

        oldDummyComponent.fire("foo");
        oldDummyComponent.fire("bar");
        expect(fooListener.callCount).to.equal(0);
        expect(barListener.callCount).to.equal(0);

        var newDummyComponent = otherEntity1.addComponent("dummy");

        newDummyComponent.fire("foo");
        newDummyComponent.fire("bar");
        expect(fooListener.callCount).to.equal(1);
        expect(barListener.callCount).to.equal(1);
    });

    it("forwards any events dispatched by the entity", function () {
        var fooListener = sinon.stub();
        var barListener = sinon.stub();

        new pc.EntityReference(testComponent, "myEntity1", {
            "entity#foo": fooListener,
            "entity#bar": barListener
        });
        testComponent.myEntity1 = otherEntity1.getGuid();

        otherEntity1.fire("foo", "a", "b");
        expect(fooListener.callCount).to.equal(1);
        expect(fooListener.getCall(0).args[0]).to.equal("a");
        expect(fooListener.getCall(0).args[1]).to.equal("b");
        expect(barListener.callCount).to.equal(0);

        otherEntity1.fire("bar", "c", "d");
        expect(fooListener.callCount).to.equal(1);
        expect(barListener.callCount).to.equal(1);
        expect(barListener.getCall(0).args[0]).to.equal("c");
        expect(barListener.getCall(0).args[1]).to.equal("d");
    });

    it("correctly handles entity event forwarding across entity nullification and subsequent reassignment", function () {
        var fooListener = sinon.stub();
        var barListener = sinon.stub();

        new pc.EntityReference(testComponent, "myEntity1", {
            "entity#foo": fooListener,
            "entity#bar": barListener
        });
        testComponent.myEntity1 = otherEntity1.getGuid();

        testComponent.myEntity1 = null;

        otherEntity1.fire("foo");
        otherEntity1.fire("bar");
        expect(fooListener.callCount).to.equal(0);
        expect(barListener.callCount).to.equal(0);

        testComponent.myEntity1 = otherEntity2.getGuid();

        otherEntity2.fire("foo");
        otherEntity2.fire("bar");
        expect(fooListener.callCount).to.equal(1);
        expect(barListener.callCount).to.equal(1);
    });

    it("validates the event map", function () {
        function testEventMap(eventMap) {
            new pc.EntityReference(testComponent, "myEntity1", eventMap);
        }

        var callback = sinon.stub();

        expect(function() {
            testEventMap({ "foo": callback });
        }).to.throw("Invalid event listener description: `foo`");

        expect(function() {
            testEventMap({ "foo#": callback });
        }).to.throw("Invalid event listener description: `foo#`");

        expect(function() {
            testEventMap({ "#foo": callback });
        }).to.throw("Invalid event listener description: `#foo`");

        expect(function() {
            testEventMap({ "foo#bar": null });
        }).to.throw("Invalid or missing callback for event listener `foo#bar`");
    });

    it("logs a warning if the entity property is set to anything other than a string, undefined or null", function () {
        sinon.stub(console, "warn");

        new pc.EntityReference(testComponent, "myEntity1");
        testComponent.myEntity1 = otherEntity1.getGuid();
        testComponent.myEntity1 = null;
        testComponent.myEntity1 = undefined;

        expect(console.warn.callCount).to.equal(0);

        testComponent.myEntity1 = {};

        expect(console.warn.callCount).to.equal(1);
        expect(console.warn.getCall(0).args[0]).to.equal("Entity field `myEntity1` was set to unexpected type 'object'");
    });

    it("set reference to a pc.Entity instead of guid, converts property to guid", function () {
        var reference = new pc.EntityReference(testComponent, "myEntity1");
        testComponent.myEntity1 = otherEntity1;

        expect(testComponent.myEntity1).to.equal(otherEntity1.getGuid(), "Component property converted to guid");
        expect(reference.entity).to.equal(otherEntity1);
    });

    it("set reference to a pc.Entity that is not in hierarchy, converts property to guid", function () {
        var reference = new pc.EntityReference(testComponent, "myEntity1");
        var entity = new pc.Entity();
        testComponent.myEntity1 = entity;

        expect(testComponent.myEntity1).to.equal(entity.getGuid(), "Component property converted to guid");
        expect(reference.entity).to.equal(entity);
    });

    it("hasComponent() returns false if the entity is not present", function () {
        var reference = new pc.EntityReference(testComponent, "myEntity1");

        expect(reference.hasComponent("dummy")).to.equal(false);
    });

    it("hasComponent() returns false if the entity is present but does not have a component of the provided type", function () {
        var reference = new pc.EntityReference(testComponent, "myEntity1");
        testComponent.myEntity1 = otherEntity1.getGuid();
        otherEntity1.removeComponent("dummy");

        expect(reference.hasComponent("dummy")).to.equal(false);
    });

    it("hasComponent() returns true if the entity is present and has a component of the provided type", function () {
        var reference = new pc.EntityReference(testComponent, "myEntity1");
        testComponent.myEntity1 = otherEntity1.getGuid();

        expect(reference.hasComponent("dummy")).to.equal(true);
    });

});

