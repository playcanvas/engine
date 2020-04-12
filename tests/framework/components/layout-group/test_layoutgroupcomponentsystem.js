describe("pc.LayoutGroupComponentSystem", function () {
    var app;
    var system;
    var entity0, entity0_0, entity0_0_0;

    beforeEach(function () {
        app = new pc.Application(document.createElement("canvas"));
        system = app.systems.layoutgroup;

        entity0 = buildLayoutGroupEntity("0");
        entity0_0 = buildLayoutGroupEntity("0_0");
        entity0_0_0 = buildLayoutGroupEntity("0_0_0");

        app.root.addChild(entity0);
        entity0.addChild(entity0_0);
        entity0_0.addChild(entity0_0_0);

        postUpdate();

        sinon.spy(entity0.layoutgroup, 'reflow');
        sinon.spy(entity0_0.layoutgroup, 'reflow');
        sinon.spy(entity0_0_0.layoutgroup, 'reflow');
    });

    afterEach(function () {
        sinon.restore();
        app.destroy();
    });

    var buildLayoutGroupEntity = function (name) {
        var entity = new pc.Entity("myEntity" + name, app);

        app.systems.element.addComponent(entity, { type: pc.ELEMENTTYPE_GROUP });
        app.systems.layoutgroup.addComponent(entity);

        return entity;
    };

    var postUpdate = function () {
        pc.ComponentSystem.postUpdate();
    };

    it("reflows in ascending order of graph depth", function () {
        system.scheduleReflow(entity0_0.layoutgroup);
        system.scheduleReflow(entity0.layoutgroup);
        system.scheduleReflow(entity0_0_0.layoutgroup);

        postUpdate();

        expect(entity0.layoutgroup.reflow.callCount).to.equal(1);
        expect(entity0_0.layoutgroup.reflow.callCount).to.equal(1);
        expect(entity0_0_0.layoutgroup.reflow.callCount).to.equal(1);

        expect(entity0.layoutgroup.reflow.calledBefore(entity0_0.layoutgroup.reflow)).to.be.true;
        expect(entity0_0.layoutgroup.reflow.calledBefore(entity0_0_0.layoutgroup.reflow)).to.be.true;
    });

    it("reflows additional groups that are pushed during the reflow", function () {
        system.scheduleReflow(entity0.layoutgroup);

        var done = false;

        entity0.layoutgroup.reflow.restore();
        sinon.stub(entity0.layoutgroup, 'reflow').callsFake(function () {
            if (!done) {
                done = true;
                system.scheduleReflow(entity0_0_0.layoutgroup);
                system.scheduleReflow(entity0_0.layoutgroup);
            }
        }.bind(this));

        postUpdate();

        expect(entity0.layoutgroup.reflow.callCount).to.equal(1);
        expect(entity0_0.layoutgroup.reflow.callCount).to.equal(1);
        expect(entity0_0_0.layoutgroup.reflow.callCount).to.equal(1);

        expect(entity0.layoutgroup.reflow.calledBefore(entity0_0.layoutgroup.reflow)).to.be.true;
        expect(entity0_0.layoutgroup.reflow.calledBefore(entity0_0_0.layoutgroup.reflow)).to.be.true;
    });

    it("does not allow the same group to be pushed to the queue twice", function () {
        system.scheduleReflow(entity0.layoutgroup);
        system.scheduleReflow(entity0.layoutgroup);

        postUpdate();

        expect(entity0.layoutgroup.reflow.callCount).to.equal(1);
    });

    it("bails if the maximum iteration count is reached", function () {
        sinon.stub(console, 'warn');

        system.scheduleReflow(entity0.layoutgroup);

        entity0.layoutgroup.reflow.restore();
        sinon.stub(entity0.layoutgroup, 'reflow').callsFake(function () {
            system.scheduleReflow(entity0.layoutgroup);
        }.bind(this));

        postUpdate();

        expect(entity0.layoutgroup.reflow.callCount).to.equal(100);
        expect(console.warn.getCall(0).args[0]).to.equal('Max reflow iterations limit reached, bailing.');
    });
});

