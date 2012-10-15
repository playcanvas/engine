module('pc.input.mouse');

function simMouseDown(el) {
  var evt = document.createEvent("MouseEvents");
  // middle mouse down
  evt.initMouseEvent("mousedown", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 1, null);
  el.dispatchEvent(evt);
}

function simMouseUp(el) {
  var evt = document.createEvent("MouseEvents");
  // middle mouse down
  evt.initMouseEvent("mouseup", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 1, null);
  el.dispatchEvent(evt);
}

function simMouseMove(el) {
  var evt = document.createEvent("MouseEvents");
  evt.initMouseEvent("mousemove", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
  el.dispatchEvent(evt);
}

function simMouseWheel(mouse) {
  var evt = document.createEvent("MouseEvents");
  // middle mouse down
  evt.initMouseEvent("mousewheel", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
  el.dispatchEvent(evt);
}

test("Object exists", function () {
    ok(pc.input.Mouse);
});

test("mousedown: fires", function () {
    var m = new pc.input.Mouse(document.body);
    var called = false;
    
    m.bind("mousedown", function (event) {
        called = true;

        equal(event.x, 0);
        equal(event.y, 0);
        equal(event.button, pc.input.MOUSE_BUTTON_MIDDLE);
        equal(event._buttons[pc.input.MOUSE_BUTTON_LEFT], false);
        equal(event._buttons[pc.input.MOUSE_BUTTON_MIDDLE], true);
        equal(event._buttons[pc.input.MOUSE_BUTTON_RIGHT], false);
        ok(event.event);
    });
    
    simMouseDown(document.body);
    
    ok(called);
});

test("mouseup: fires", function () {
    var m = new pc.input.Mouse();
    m.attach(document.body);
    var called = false;
    
    m.bind("mouseup", function (event) {
        called = true;
        
        equal(event.x, 0);
        equal(event.y, 0);
        equal(event.button, pc.input.MOUSE_BUTTON_MIDDLE);
        equal(event._buttons[pc.input.MOUSE_BUTTON_LEFT], false);
        equal(event._buttons[pc.input.MOUSE_BUTTON_MIDDLE], false);
        equal(event._buttons[pc.input.MOUSE_BUTTON_RIGHT], false);
        ok(event.event);
    });
    
    simMouseUp(document.body);
    
    ok(called);
})

test("mousemove: fires", function () {
    var m = new pc.input.Mouse();
    m.attach(document.body);
    
    var called = false;
    
    m.bind("mousemove", function (event) {
        called = true;
        equal(event.x, 0);
        equal(event.y, 0);
        equal(event.deltaX, 0);
        equal(event.deltaY, 0);
        equal(event.button, pc.input.MOUSE_BUTTON_NONE);
        equal(event._buttons[pc.input.MOUSE_BUTTON_LEFT], false);
        equal(event._buttons[pc.input.MOUSE_BUTTON_MIDDLE], false);
        equal(event._buttons[pc.input.MOUSE_BUTTON_RIGHT], false);
        ok(event.event);
    });
    
    simMouseMove(document.body);
    
    ok(called);    
});

test("mousewheel: fires", function () {
    var m = new pc.input.Mouse();
    m.attach(document.body)
    var called = false;
    
    m.bind("mousewheel", function (event) {
        called = true;
        equal(event.y, 0);
        equal(event.x, 0);
        equal(event.deltaWheel, 1);
        equal(event.button, pc.input.MOUSE_BUTTON_NONE);
        equal(event._buttons[pc.input.MOUSE_BUTTON_LEFT], false);
        equal(event._buttons[pc.input.MOUSE_BUTTON_MIDDLE], false);
        equal(event._buttons[pc.input.MOUSE_BUTTON_RIGHT], false);
    });
    
    simMouseWheel(document.body;
    
    ok(called);    
});

test("getOffsetCoords", function () {
   var coords = pc.input.getOffsetCoords(createWebKitStyleMouseEvent()); 
   
   equal(coords.x, 0);
   equal(coords.y, 0);
   
});
