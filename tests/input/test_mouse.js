var m;

module('pc.mouse', {
    setup: function () {
        m = new pc.Mouse();
        m.attach(document.body);
    },

    teardown: function () {
        m.detach(document.body);
    }
});

test("Object exists", function () {
    ok(pc.Mouse);
});

test("mousedown: middlebutton", 10, function () {
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

test("mouseup: middlebutton", 10, function () {
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

test("mousemove", 10, function () {
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

test("mousewheel: fires", 11, function () {
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

test("isPressed", function () {
    m.update();
    simulate(document.body, 'mousedown');
    equal(m.isPressed(pc.MOUSEBUTTON_LEFT), true);
    m.update();
    equal(m.isPressed(pc.MOUSEBUTTON_LEFT), true);
});

test("wasPressed", function () {
    m.update();
    simulate(document.body, 'mousedown');
    equal(m.wasPressed(pc.MOUSEBUTTON_LEFT), true);
    m.update();
    equal(m.wasPressed(pc.MOUSEBUTTON_LEFT), false);
});

test("wasReleased", function () {
    m.update();
    simulate(document.body, 'mousedown');
    equal(m.wasReleased(pc.MOUSEBUTTON_LEFT), false);
    m.update();
    simulate(document.body, 'mouseup');
    equal(m.wasReleased(pc.MOUSEBUTTON_LEFT), true);
});
