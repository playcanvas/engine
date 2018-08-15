describe('pc.mouse', function () {
    var m;

    beforeEach(function () {
        this.prevDocumentElementStyle = document.documentElement.style;
        this.prevBodyStyle = document.body.style;

        document.documentElement.style = "height: 100%;";
        document.body.style = "height: 100%;";

        m = new pc.Mouse();
        m.attach(document.body);
    });

    afterEach( function () {
        document.documentElement.style = this.prevDocumentElementStyle;
        document.body.style = this.prevBodyStyle;

        m.detach(document.body);
    });

    it("Object exists", function () {
        ok(pc.Mouse);
    });

    it("mousedown: middlebutton", function () {
        m.on(pc.input.EVENT_MOUSEDOWN, function (event) {
            equal(event.x, 8);
            equal(event.y, 8);
            equal(event.dx, 8);
            equal(event.dy, 8);
            equal(event.button, pc.MOUSEBUTTON_MIDDLE);
            equal(event.buttons[pc.MOUSEBUTTON_LEFT], false);
            equal(event.buttons[pc.MOUSEBUTTON_MIDDLE], true);
            equal(event.buttons[pc.MOUSEBUTTON_RIGHT], false);
            equal(event.element, document.body);
            ok(event.event);
        });

        simulate(document.body, 'mousedown', {
            button: pc.MOUSEBUTTON_MIDDLE
        });
    });

    it("mouseup: middlebutton", function () {
        m.on(pc.input.EVENT_MOUSEUP, function (event) {
            equal(event.x, 8);
            equal(event.y, 8);
            equal(event.dx, 8);
            equal(event.dy, 8);
            equal(event.button, pc.MOUSEBUTTON_MIDDLE);
            equal(event.buttons[pc.MOUSEBUTTON_LEFT], false);
            equal(event.buttons[pc.MOUSEBUTTON_MIDDLE], false);
            equal(event.buttons[pc.MOUSEBUTTON_RIGHT], false);
            equal(event.element, document.body);
            ok(event.event);
        });

        simulate(document.body, 'mouseup', {
            button: pc.MOUSEBUTTON_MIDDLE
        });
    });

    it("mousemove", function () {
        // move before event bound
        simulate(document.body, 'mousemove', {
            pointerX: 16,
            pointerY: 16
        });

        m.on(pc.input.EVENT_MOUSEMOVE, function (event) {
            equal(event.x, 24);
            equal(event.y, 24);
            equal(event.dx, 16);
            equal(event.dy, 16);
            equal(event.button, pc.MOUSEBUTTON_NONE);
            equal(event.buttons[pc.MOUSEBUTTON_LEFT], false);
            equal(event.buttons[pc.MOUSEBUTTON_MIDDLE], false);
            equal(event.buttons[pc.MOUSEBUTTON_RIGHT], false);
            equal(event.element, document.body);
            ok(event.event);
        });

        simulate(document.body, 'mousemove', {
            pointerX: 32,
            pointerY: 32
        });
    });

    it("mousewheel: fires", function () {
        m.on(pc.input.EVENT_MOUSEWHEEL, function (event) {
            equal(event.x, 8);
            equal(event.y, 8);
            equal(event.dx, 8);
            equal(event.dy, 8);
            equal(event.wheel, -120);
            equal(event.button, pc.MOUSEBUTTON_NONE);
            equal(event.buttons[pc.MOUSEBUTTON_LEFT], false);
            equal(event.buttons[pc.MOUSEBUTTON_MIDDLE], false);
            equal(event.buttons[pc.MOUSEBUTTON_RIGHT], false);
            ok(event.event);
            equal(event.element, document.body);
        });

        simulate(document.body, 'mousewheel', {
            detail: 120
        });
    });

    it("isPressed", function () {
        m.update();
        simulate(document.body, 'mousedown');
        equal(m.isPressed(pc.MOUSEBUTTON_LEFT), true);
        m.update();
        equal(m.isPressed(pc.MOUSEBUTTON_LEFT), true);
    });

    it("wasPressed", function () {
        m.update();
        simulate(document.body, 'mousedown');
        equal(m.wasPressed(pc.MOUSEBUTTON_LEFT), true);
        m.update();
        equal(m.wasPressed(pc.MOUSEBUTTON_LEFT), false);
    });

    it("wasReleased", function () {
        m.update();
        simulate(document.body, 'mousedown');
        equal(m.wasReleased(pc.MOUSEBUTTON_LEFT), false);
        m.update();
        simulate(document.body, 'mouseup');
        equal(m.wasReleased(pc.MOUSEBUTTON_LEFT), true);
    });

});

