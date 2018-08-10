module("pc.ComponentSystem", {
    setup: function () {
        this.app = new pc.Application(document.createElement("canvas"));
        this.system = this.app.systems.layoutgroup;

        this.entity0 = this.buildLayoutGroupEntity();
        this.entity0_0 = this.buildLayoutGroupEntity();
        this.entity0_0_0 = this.buildLayoutGroupEntity();

        this.app.root.addChild(this.entity0);
        this.entity0.addChild(this.entity0_0);
        this.entity0_0.addChild(this.entity0_0_0);

        this.postUpdate();

        sinon.spy(this.entity0.layoutgroup, 'reflow');
        sinon.spy(this.entity0_0.layoutgroup, 'reflow');
        sinon.spy(this.entity0_0_0.layoutgroup, 'reflow');
    },

    buildLayoutGroupEntity: function () {
        var entity = new pc.Entity("myEntity", this.app);

        this.app.systems.element.addComponent(entity, { type: pc.ELEMENTTYPE_GROUP });
        this.app.systems.layoutgroup.addComponent(entity);

        return entity;
    },

    postUpdate: function () {
        pc.ComponentSystem.postUpdate();
    },

    teardown: function () {
        sinon.restore();
        this.app.destroy();
    }
});

test("reflows in ascending order of graph depth", function () {
    this.system.scheduleReflow(this.entity0_0.layoutgroup);
    this.system.scheduleReflow(this.entity0.layoutgroup);
    this.system.scheduleReflow(this.entity0_0_0.layoutgroup);

    this.postUpdate();

    strictEqual(this.entity0.layoutgroup.reflow.callCount, 1);
    strictEqual(this.entity0_0.layoutgroup.reflow.callCount, 1);
    strictEqual(this.entity0_0_0.layoutgroup.reflow.callCount, 1);

    ok(this.entity0.layoutgroup.reflow.calledBefore(this.entity0_0.layoutgroup.reflow));
    ok(this.entity0_0.layoutgroup.reflow.calledBefore(this.entity0_0_0.layoutgroup.reflow));
});

test("reflows additional groups that are pushed during the reflow", function () {
    this.system.scheduleReflow(this.entity0.layoutgroup);

    var done = false;

    this.entity0.layoutgroup.reflow.restore();
    sinon.stub(this.entity0.layoutgroup, 'reflow').callsFake(function () {
        if (!done) {
            done = true;
            this.system.scheduleReflow(this.entity0_0_0.layoutgroup);
            this.system.scheduleReflow(this.entity0_0.layoutgroup);
        }
    }.bind(this));

    this.postUpdate();

    strictEqual(this.entity0.layoutgroup.reflow.callCount, 1);
    strictEqual(this.entity0_0.layoutgroup.reflow.callCount, 1);
    strictEqual(this.entity0_0_0.layoutgroup.reflow.callCount, 1);

    ok(this.entity0.layoutgroup.reflow.calledBefore(this.entity0_0.layoutgroup.reflow));
    ok(this.entity0_0.layoutgroup.reflow.calledBefore(this.entity0_0_0.layoutgroup.reflow));
});

test("does not allow the same group to be pushed to the queue twice", function () {
    this.system.scheduleReflow(this.entity0.layoutgroup);
    this.system.scheduleReflow(this.entity0.layoutgroup);

    this.postUpdate();

    strictEqual(this.entity0.layoutgroup.reflow.callCount, 1);
});

test("bails if the maximum iteration count is reached", function () {
    sinon.stub(console, 'warn');

    this.system.scheduleReflow(this.entity0.layoutgroup);

    this.entity0.layoutgroup.reflow.restore();
    sinon.stub(this.entity0.layoutgroup, 'reflow').callsFake(function () {
        this.system.scheduleReflow(this.entity0.layoutgroup);
    }.bind(this));

    this.postUpdate();

    strictEqual(this.entity0.layoutgroup.reflow.callCount, 100);
    strictEqual(console.warn.getCall(0).args[0], 'Max reflow iterations limit reached, bailing.');
});
