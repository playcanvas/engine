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

            this.dragHelper = new pc.ElementDragHelper(this.element);
            this.dragHelper.on("drag:start", this.dragStartHandler);
            this.dragHelper.on("drag:end", this.dragEndHandler);
            this.dragHelper.on("drag:move", this.dragMoveHandler);

            var cameraEntity = new pc.Entity("camera", this.app);
            cameraEntity.setPosition(new pc.Vec3(0, 0, 100));
            this.camera = cameraEntity.addComponent("camera", {});

            this.app.root.addChild(this.entity);
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

    // TODO Tests for screen space -> element space transform calculations
    // TODO Tests for 2D screen vs 3D screen calculations
    // TODO Tests for axis constraining
})();
