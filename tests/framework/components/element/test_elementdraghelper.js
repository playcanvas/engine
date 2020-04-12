describe("pc.ElementDragHelper", function() {
    var stubbedOntouchstart;
    var app;
    var entity;
    var element;
    var dragHelper;
    var dragStartHandler;
    var dragEndHandler;
    var dragMoveHandler;
    var camera;
    var parent;

    beforeEach(function () {
        // Simulate the browser being touch capable, so that we can test touch-based dragging
        if (!('ontouchstart' in window)) {
            window.ontouchstart = {};
            stubbedOntouchstart = true;
            pc.platform.touch = true;
        }

        var canvasWidth = 300;
        var canvasHeight = 400;

        var canvas = document.createElement("canvas");
        canvas.width = canvasWidth;
        canvas.height = 400;
        canvas.getBoundingClientRect = function() {
            return {
                left: 0,
                top: 0,
                right: canvasWidth,
                bottom: canvasHeight,
                x: 0,
                y: 0,
                width: canvasWidth,
                height: canvasHeight
            };
        };

        app = new pc.Application(canvas, {
            mouse: new pc.input.Mouse(canvas),
            touch: new pc.input.TouchDevice(canvas)
        });

        entity = new pc.Entity("entity", app);
        element = entity.addComponent("element", {
            type: "image",
            width: 100,
            height: 200,
            useInput: true
        });

        dragStartHandler = sinon.stub();
        dragEndHandler = sinon.stub();
        dragMoveHandler = sinon.stub();

        createDragHelper(null);

        var cameraEntity = new pc.Entity("camera", app);
        cameraEntity.setPosition(new pc.Vec3(0, 0, 100));
        camera = cameraEntity.addComponent("camera", {});

        parent = new pc.Entity("parent", app);
        parent.addChild(entity);
        app.root.addChild(parent);
    });

    var createDragHelper = function(axis) {
        dragHelper = new pc.ElementDragHelper(element, axis);
        dragHelper.on("drag:start", dragStartHandler);
        dragHelper.on("drag:end", dragEndHandler);
        dragHelper.on("drag:move", dragMoveHandler);
    };

    afterEach(function () {
        sinon.restore();

        dragHelper.destroy();

        app.destroy();

        if (stubbedOntouchstart) {
            delete window.ontouchstart;
            pc.platform.touch = false;
        }
    });

    it("fires a drag:start event when dragging starts via mouse", function () {
        element.fire("mousedown", {
            x: 50,
            y: 50,
            camera: camera
        });

        expect(dragStartHandler.callCount).to.equal(1);
        expect(dragHelper.isDragging).to.equal(true);
    });

    it("fires a drag:start event when dragging starts via touch", function () {
        element.fire("touchstart", {
            x: 50,
            y: 50,
            camera: camera
        });

        expect(dragStartHandler.callCount).to.equal(1);
        expect(dragHelper.isDragging).to.equal(true);
    });

    it("fires a drag:move event when dragging moves via mouse", function () {
        element.fire("mousedown", {
            x: 50,
            y: 50,
            camera: camera
        });

        app.mouse.fire("mousemove", {
            x: 51,
            y: 52
        });

        expect(dragMoveHandler.callCount).to.equal(1);

        expect(dragMoveHandler.getCall(0).args[0].x).to.be.closeTo(0.49, 0.01);
        expect(dragMoveHandler.getCall(0).args[0].y).to.be.closeTo(-0.41, 0.01);
    });

    it("fires a drag:move event when dragging moves via touch", function () {
        element.fire("touchstart", {
            x: 50,
            y: 50,
            camera: camera
        });

        app.touch.fire("touchmove", {
            x: 51,
            y: 52
        });

        expect(dragMoveHandler.callCount).to.equal(1);
        expect(dragMoveHandler.getCall(0).args[0].x).to.be.closeTo(0.49, 0.01);
        expect(dragMoveHandler.getCall(0).args[0].y).to.be.closeTo(-0.41, 0.01);
    });

    it("fires a drag:end event when dragging ends via mouse and stops firing drag:move events", function () {
        element.fire("mousedown", {
            x: 50,
            y: 50,
            camera: camera
        });

        window.dispatchEvent(new Event('mouseup'));

        expect(dragEndHandler.callCount).to.equal(1);
        expect(dragHelper.isDragging).to.equal(false);

        app.mouse.fire("mousemove", {
            x: 51,
            y: 52
        });

        expect(dragMoveHandler.callCount).to.equal(0);
    });

    function testDragEndViaTouch(touchEventName) {
        element.fire("touchstart", {
            x: 50,
            y: 50,
            camera: camera
        });

        window.dispatchEvent(new Event(touchEventName));

        expect(dragEndHandler.callCount).to.equal(1);
        expect(dragHelper.isDragging).to.equal(false);

        app.touch.fire("touchmove", {
            x: 51,
            y: 52
        });

        expect(dragMoveHandler.callCount).to.equal(0);
    }

    it("fires a drag:end event when dragging ends via touchend and stops firing drag:move events", function () {
        testDragEndViaTouch.call(this, "touchend");
    });

    it("fires a drag:end event when dragging ends via touchcancel and stops firing drag:move events", function () {
        testDragEndViaTouch.call(this, "touchcancel");
    });

    it("does not allow dragging if not enabled", function () {
        dragHelper.enabled = false;

        element.fire("mousedown", {
            x: 50,
            y: 50,
            camera: camera
        });

        expect(dragStartHandler.callCount).to.equal(0);
        expect(dragHelper.isDragging).to.equal(false);
    });

    it("does not allow dragging once destroyed", function () {
        dragHelper.destroy();

        element.fire("mousedown", {
            x: 50,
            y: 50,
            camera: camera
        });

        expect(dragStartHandler.callCount).to.equal(0);
        expect(dragHelper.isDragging).to.equal(false);
    });

    var defaultXDelta = 4.90;
    var defaultYDelta = -2.07;

    function runTransformTest(expectedXDelta, expectedYDelta) {
        element.fire("mousedown", {
            x: 50,
            y: 50,
            camera: camera
        });

        app.mouse.fire("mousemove", {
            x: 60,
            y: 60
        });

        expect(dragMoveHandler.callCount).to.equal(1);
        expect(dragMoveHandler.getCall(0).args[0].x).to.be.closeTo(expectedXDelta, 0.02);
        expect(dragMoveHandler.getCall(0).args[0].y).to.be.closeTo(expectedYDelta, 0.02);
    }

    it("includes ancestral rotation in coordinate conversion", function () {
        var fourtyFiveDegreesAboutZ = new pc.Quat();
        fourtyFiveDegreesAboutZ.setFromAxisAngle(new pc.Vec3(0, 0, 1), 45);

        parent.setLocalRotation(fourtyFiveDegreesAboutZ);
        entity.setLocalRotation(fourtyFiveDegreesAboutZ);

        // Note that x and y are swapped here because we've rotated 90 degrees about the Z axis in total
        runTransformTest.call(this, defaultYDelta, -defaultXDelta);
    });

    it("includes ancestral scale in coordinate conversion", function () {
        var twoXandFourY = new pc.Vec3(2, 4, 1);

        parent.setLocalScale(twoXandFourY);
        entity.setLocalScale(twoXandFourY);

        runTransformTest.call(this, defaultXDelta / 2, defaultYDelta / 4);
    });

    it("includes camera rotation in coordinate conversion", function () {
        var ninetyDegreesAboutZ = new pc.Quat();
        ninetyDegreesAboutZ.setFromAxisAngle(new pc.Vec3(0, 0, 1), 90);
        camera.entity.setLocalRotation(ninetyDegreesAboutZ);

        // Note that x and y are swapped here because we've rotated the camera
        runTransformTest.call(this, -defaultYDelta, defaultXDelta);
    });

    it("includes screen scale in coordinate conversion and disables perspective when using screen space", function () {
        app.root.removeChild(parent);

        var screen = new pc.Entity("screen", app);
        screen.addComponent("screen", { screenSpace: true });
        screen.addChild(parent);
        screen.screen.scale = 0.5;

        app.root.addChild(screen);
        entity.element.screen = screen;

        runTransformTest.call(this, 20, -20);
    });

    it("allows dragging to be constrained to the X axis", function () {
        dragHelper.destroy();
        createDragHelper("x");

        runTransformTest.call(this, defaultXDelta, 0);
    });

    it("allows dragging to be constrained to the Y axis", function () {
        dragHelper.destroy();
        createDragHelper("y");

        runTransformTest.call(this, 0, defaultYDelta);
    });

    it("takes device pixel ratio into account", function () {
        app.graphicsDevice.maxPixelRatio = 2;
        runTransformTest.call(this, defaultXDelta * 2, defaultYDelta * 2);
    });
});
