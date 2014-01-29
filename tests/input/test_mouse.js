var m;

module('pc.input.mouse', {
  setup: function () {
    m = new pc.input.Mouse();    
    m.attach(document.body);
  },

  teardown: function () {
    m.detach(document.body);
    delete m;
  }
});

test("Object exists", function () {
    ok(pc.input.Mouse);
});

test("mousedown: middlebutton", 10, function () {
    m.on(pc.input.EVENT_MOUSEDOWN, function (event) {
        equal(event.x, 0);
        equal(event.y, 0);
        equal(event.dx, 0);
        equal(event.dy, 0);
        equal(event.button, pc.input.MOUSEBUTTON_MIDDLE);
        equal(event.buttons[pc.input.MOUSEBUTTON_LEFT], false);
        equal(event.buttons[pc.input.MOUSEBUTTON_MIDDLE], true);
        equal(event.buttons[pc.input.MOUSEBUTTON_RIGHT], false);
        equal(event.element, document.body);
        ok(event.event);
    });
    
    simulate(document.body, 'mousedown', {
      button: pc.input.MOUSEBUTTON_MIDDLE
    });
  });

test("mouseup: middlebutton", 10, function () {
    m.on(pc.input.EVENT_MOUSEUP, function (event) {
        equal(event.x, 0);
        equal(event.y, 0);
        equal(event.dx, 0);
        equal(event.dy, 0);
        equal(event.button, pc.input.MOUSEBUTTON_MIDDLE);
        equal(event.buttons[pc.input.MOUSEBUTTON_LEFT], false);
        equal(event.buttons[pc.input.MOUSEBUTTON_MIDDLE], false);
        equal(event.buttons[pc.input.MOUSEBUTTON_RIGHT], false);
        equal(event.element, document.body);
        ok(event.event);
    });
    
    simulate(document.body, 'mouseup', {
      button: pc.input.MOUSEBUTTON_MIDDLE
    });
});

test("mousemove", 10, function () {
    // move before event bound  
    simulate(document.body, 'mousemove', {
      pointerX: 0,
      pointerX: 0
    });

    m.on(pc.input.EVENT_MOUSEMOVE, function (event) {
        equal(event.x, 10);
        equal(event.y, 10);
        equal(event.dx, 10);
        equal(event.dy, 10);
        equal(event.button, pc.input.MOUSEBUTTON_NONE);
        equal(event.buttons[pc.input.MOUSEBUTTON_LEFT], false);
        equal(event.buttons[pc.input.MOUSEBUTTON_MIDDLE], false);
        equal(event.buttons[pc.input.MOUSEBUTTON_RIGHT], false);
        equal(event.element, document.body);
        ok(event.event);
    });
    
    simulate(document.body, 'mousemove', {
      pointerX: 10,
      pointerY: 10
    });

});

test("mousewheel: fires", 11, function () {
    m.on(pc.input.EVENT_MOUSEWHEEL, function (event) {
        equal(event.x, 0);
        equal(event.y, 0);
        equal(event.dx, 0);
        equal(event.dy, 0);
        equal(event.wheel, -120);
        equal(event.button, pc.input.MOUSEBUTTON_NONE);
        equal(event.buttons[pc.input.MOUSEBUTTON_LEFT], false);
        equal(event.buttons[pc.input.MOUSEBUTTON_MIDDLE], false);
        equal(event.buttons[pc.input.MOUSEBUTTON_RIGHT], false);
        ok(event.event)
        equal(event.element, document.body);
    });
    
    simulate(document.body, 'mousewheel', {
      detail: 120
    });
});

test("isPressed", function () {
  m.update();
  simulate(document.body, 'mousedown');
  equal(m.isPressed(pc.input.MOUSEBUTTON_LEFT), true);
  m.update();
  equal(m.isPressed(pc.input.MOUSEBUTTON_LEFT), true);
});

test("wasPressed", function () {
  m.update();
  simulate(document.body, 'mousedown');
  equal(m.wasPressed(pc.input.MOUSEBUTTON_LEFT), true);
  m.update()
  equal(m.wasPressed(pc.input.MOUSEBUTTON_LEFT), false);
});

test("wasReleased", function () {
  m.update();
  simulate(document.body, 'mousedown');
  equal(m.wasReleased(pc.input.MOUSEBUTTON_LEFT), false);
  m.update()
  simulate(document.body, 'mouseup');
  equal(m.wasReleased(pc.input.MOUSEBUTTON_LEFT), true);
});
