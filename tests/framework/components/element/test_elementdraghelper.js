(function() {
    module("pc.ElementDragHelper", {
        setup: function () {
            // Simulate the browser being touch capable, so that we can test touch-based dragging
            if (!('ontouchstart' in window)) {
                window.ontouchstart = {};
                this.stubbedOntouchstart = true;
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

            this.app = new pc.Application(canvas, {
                mouse: new pc.input.Mouse(canvas),
                touch: new pc.input.TouchDevice(canvas)
            });

            this.entity = new pc.Entity("entity", this.app);
            this.element = this.entity.addComponent("element", {
                type: "image",
                width: 100,
                height: 200,
                useInput: true
            });

            this.dragStartHandler = sinon.stub();
            this.dragEndHandler = sinon.stub();
            this.dragMoveHandler = sinon.stub();

            this.createDragHelper(null);

            var cameraEntity = new pc.Entity("camera", this.app);
            cameraEntity.setPosition(new pc.Vec3(0, 0, 100));
            this.camera = cameraEntity.addComponent("camera", {});

            this.parent = new pc.Entity("parent", this.app);
            this.parent.addChild(this.entity);
            this.app.root.addChild(this.parent);
        },

        createDragHelper: function(axis) {
            this.dragHelper = new pc.ElementDragHelper(this.element, axis);
            this.dragHelper.on("drag:start", this.dragStartHandler);
            this.dragHelper.on("drag:end", this.dragEndHandler);
            this.dragHelper.on("drag:move", this.dragMoveHandler);
        },

        teardown: function () {
            sinon.restore();

            if (this.stubbedOntouchstart) {
                delete window.ontouchstart;
            }
        }
    });

    test("fires a drag:start event when dragging starts via mouse", function () {
        this.element.fire("mousedown", {
            x: 50,
            y: 50,
            camera: this.camera
        });

        strictEqual(this.dragStartHandler.callCount, 1);
        strictEqual(this.dragHelper.isDragging, true);
    });

    test("fires a drag:start event when dragging starts via touch", function () {
        this.element.fire("touchstart", {
            x: 50,
            y: 50,
            camera: this.camera
        });

        strictEqual(this.dragStartHandler.callCount, 1);
        strictEqual(this.dragHelper.isDragging, true);
    });

    test("fires a drag:move event when dragging moves via mouse", function () {
        this.element.fire("mousedown", {
            x: 50,
            y: 50,
            camera: this.camera
        });

        this.app.mouse.fire("mousemove", {
            x: 51,
            y: 52
        });

        strictEqual(this.dragMoveHandler.callCount, 1);
        QUnit.close(this.dragMoveHandler.getCall(0).args[0].x, 0.49, 0.01);
        QUnit.close(this.dragMoveHandler.getCall(0).args[0].y, -0.41, 0.01);
    });

    test("fires a drag:move event when dragging moves via touch", function () {
        this.element.fire("touchstart", {
            x: 50,
            y: 50,
            camera: this.camera
        });

        this.app.touch.fire("touchmove", {
            x: 51,
            y: 52
        });

        strictEqual(this.dragMoveHandler.callCount, 1);
        QUnit.close(this.dragMoveHandler.getCall(0).args[0].x, 0.49, 0.01);
        QUnit.close(this.dragMoveHandler.getCall(0).args[0].y, -0.41, 0.01);
    });

    test("fires a drag:end event when dragging ends via mouse and stops firing drag:move events", function () {
        this.element.fire("mousedown", {
            x: 50,
            y: 50,
            camera: this.camera
        });

        window.dispatchEvent(new Event('mouseup'));

        strictEqual(this.dragEndHandler.callCount, 1);
        strictEqual(this.dragHelper.isDragging, false);

        this.app.mouse.fire("mousemove", {
            x: 51,
            y: 52
        });

        strictEqual(this.dragMoveHandler.callCount, 0);
    });

    function testDragEndViaTouch(touchEventName) {
        this.element.fire("touchstart", {
            x: 50,
            y: 50,
            camera: this.camera
        });

        window.dispatchEvent(new Event(touchEventName));

        strictEqual(this.dragEndHandler.callCount, 1);
        strictEqual(this.dragHelper.isDragging, false);

        this.app.touch.fire("touchmove", {
            x: 51,
            y: 52
        });

        strictEqual(this.dragMoveHandler.callCount, 0);
    }

    test("fires a drag:end event when dragging ends via touchend and stops firing drag:move events", function () {
        testDragEndViaTouch.call(this, "touchend");
    });

    test("fires a drag:end event when dragging ends via touchcancel and stops firing drag:move events", function () {
        testDragEndViaTouch.call(this, "touchcancel");
    });

    test("does not allow dragging if not enabled", function () {
        this.dragHelper.enabled = false;

        this.element.fire("mousedown", {
            x: 50,
            y: 50,
            camera: this.camera
        });

        strictEqual(this.dragStartHandler.callCount, 0);
        strictEqual(this.dragHelper.isDragging, false);
    });

    test("does not allow dragging once destroyed", function () {
        this.dragHelper.destroy();

        this.element.fire("mousedown", {
            x: 50,
            y: 50,
            camera: this.camera
        });

        strictEqual(this.dragStartHandler.callCount, 0);
        strictEqual(this.dragHelper.isDragging, false);
    });

    var defaultXDelta = 4.90;
    var defaultYDelta = -2.07;

    function runTransformTest(expectedXDelta, expectedYDelta) {
        this.element.fire("mousedown", {
            x: 50,
            y: 50,
            camera: this.camera
        });

        this.app.mouse.fire("mousemove", {
            x: 60,
            y: 60
        });

        strictEqual(this.dragMoveHandler.callCount, 1);
        QUnit.close(this.dragMoveHandler.getCall(0).args[0].x, expectedXDelta, 0.02);
        QUnit.close(this.dragMoveHandler.getCall(0).args[0].y, expectedYDelta, 0.02);
    }

    test("includes ancestral rotation in coordinate conversion", function () {
        var fourtyFiveDegreesAboutZ = new pc.Quat();
        fourtyFiveDegreesAboutZ.setFromAxisAngle(new pc.Vec3(0, 0, 1), 45);

        this.parent.setLocalRotation(fourtyFiveDegreesAboutZ);
        this.entity.setLocalRotation(fourtyFiveDegreesAboutZ);

        // Note that x and y are swapped here because we've rotated 90 degrees about the Z axis in total
        runTransformTest.call(this, defaultYDelta, -defaultXDelta);
    });

    test("includes ancestral scale in coordinate conversion", function () {
        var twoXandFourY = new pc.Vec3(2, 4, 1);

        this.parent.setLocalScale(twoXandFourY);
        this.entity.setLocalScale(twoXandFourY);

        runTransformTest.call(this, defaultXDelta / 2, defaultYDelta / 4);
    });

    test("includes camera rotation in coordinate conversion", function () {
        var ninetyDegreesAboutZ = new pc.Quat();
        ninetyDegreesAboutZ.setFromAxisAngle(new pc.Vec3(0, 0, 1), 90);
        this.camera.entity.setLocalRotation(ninetyDegreesAboutZ);

        // Note that x and y are swapped here because we've rotated the camera
        runTransformTest.call(this, -defaultYDelta, defaultXDelta);
    });

    test("includes screen scale in coordinate conversion and disables perspective when using screen space", function () {
        this.app.root.removeChild(this.parent);

        var screen = new pc.Entity("screen", this.app);
        screen.addComponent("screen", { screenSpace: true });
        screen.addChild(this.parent);
        screen.screen.scale = 0.5;

        this.app.root.addChild(screen);
        this.entity.element.screen = screen;

        runTransformTest.call(this, 20, -20);
    });

    test("allows dragging to be constrained to the X axis", function () {
        this.dragHelper.destroy();
        this.createDragHelper("x");

        runTransformTest.call(this, defaultXDelta, 0);
    });

    test("allows dragging to be constrained to the Y axis", function () {
        this.dragHelper.destroy();
        this.createDragHelper("y");

        runTransformTest.call(this, 0, defaultYDelta);
    });

    test("takes device pixel ratio into account", function () {
        this.app.graphicsDevice.maxPixelRatio = 2;
        runTransformTest.call(this, defaultXDelta * 2, defaultYDelta * 2);
    });
})();
