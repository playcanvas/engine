var k;

module('pc.keyboard', {
  setup: function () {
    k = new pc.Keyboard();
    k.attach(document.body);
  },

  teardown: function () {
    k.detach();
    delete k;
  }
});

function pressAndRelease(keyCode) {
  simulate(document.body, 'keydown', {
    keyCode: keyCode
  });
  simulate(document.body, 'keypress', {
    keyCode: keyCode
  });
  simulate(document.body, 'keyup', {
    keyCode: keyCode
  });
}

function press(keyCode) {
  simulate(document.body, 'keydown', {
    keyCode: keyCode
  });

  simulate(document.body, 'keypress', {
    keyCode: keyCode
  });
}

function pressSpecialChar(keyCode) {
  simulate(document.body, 'keydown', {
    keyCode: keyCode
  });
}

function pressAndHold(keyCode) {
  press(keyCode);
  press(keyCode);
}

function release(keyCode) {
  simulate(document.body, 'keyup', {
    keyCode: keyCode
  });
}

test("Object Exists", function () {
    ok(pc.Keyboard);
});

test("Keydown A", 3, function () {
    k.on(pc.input.EVENT_KEYDOWN, function (event) {
        equal(event.key, pc.input.KEY_A);
        equal(event.element, document.body);
        ok(event.event);
    });

    simulate(document.body, 'keydown', {
      keyCode: pc.input.KEY_A
    });
});

test("Keydown Left arrow", 3, function () {
    k.on(pc.input.EVENT_KEYDOWN, function (event) {
        equal(event.key, pc.input.KEY_LEFT);
        equal(event.element, document.body);
        ok(event.event);
    });

    simulate(document.body, 'keydown', {
      keyCode: pc.input.KEY_LEFT
    });
});

test("Keydown F1", 3, function () {
    k.on(pc.input.EVENT_KEYDOWN, function (event) {
        equal(event.key, pc.input.KEY_F1);
        equal(event.element, document.body);
        ok(event.event);
    });

    simulate(document.body, 'keydown', {
      keyCode: pc.input.KEY_F1
    });
});

test("Keyup A", 3, function () {
    k.on(pc.input.EVENT_KEYUP, function (event) {
        equal(event.key, pc.input.KEY_A);
        equal(event.element, document.body);
        ok(event.event);
    });

    simulate(document.body, 'keyup', {
      keyCode: pc.input.KEY_A
    });
});

test("Keyup Left arrow", 3, function () {
    k.on(pc.input.EVENT_KEYUP, function (event) {
        equal(event.key, pc.input.KEY_LEFT);
        equal(event.element, document.body);
        ok(event.event);
    });

    simulate(document.body, 'keyup', {
      keyCode: pc.input.KEY_LEFT
    });
});

test("Keyup F1", 3, function () {
    k.on(pc.input.EVENT_KEYUP, function (event) {
        equal(event.key, pc.input.KEY_F1);
        equal(event.element, document.body);
        ok(event.event);
    });

    simulate(document.body, 'keyup', {
      keyCode: pc.input.KEY_F1
    });
});

test("isPressed", function () {
  press(pc.input.KEY_A);
  ok(k.isPressed(pc.input.KEY_A));
  k.update();
  ok(k.isPressed(pc.input.KEY_A));
});

test("isPressed: released", function () {
  pressAndRelease(pc.input.KEY_A);
  equal(k.isPressed(pc.input.KEY_A), false);
});

test("isPressed: hold", function () {
  pressAndHold(pc.input.KEY_A);
  equal(k.isPressed(pc.input.KEY_A), true);
});

test("wasPressed", function () {
  press(pc.input.KEY_A);
  equal(k.wasPressed(pc.input.KEY_A), true);
  k.update();
  equal(k.wasPressed(pc.input.KEY_A), false);
});

test("wasReleased", function () {
  press(pc.input.KEY_A);
  equal(k.wasReleased(pc.input.KEY_A), false);
  k.update();
  release(pc.input.KEY_A);
  equal(k.wasReleased(pc.input.KEY_A), true);
});

// test("toKeyIdentifier: output is uppercase", function () {
//     var k = new pc.Keyboard(document.body);
//     var id = k.toKeyIdentifier(pc.input.KEY_N);
//     equal(id, "U+004E");
// });

// test("toKeyIdentifier: Upper and lowercase", function () {
//     var k = new pc.Keyboard(document.body),
//         lower = pc.string.ASCII_LOWERCASE,
//         upper = pc.string.ASCII_UPPERCASE,
//         index,
//         id;

//     for(index = 0; index < lower.length; index++) {
//         id = k.toKeyIdentifier(lower.charCodeAt(index));
//         equal(id.length, 6);
//         equal(String.fromCharCode(parseInt(id.slice(2), 16)), lower[index]);

//         id = k.toKeyIdentifier(upper.charCodeAt(index));
//         equal(id.length, 6);
//         equal(String.fromCharCode(parseInt(id.slice(2), 16)), upper[index]);
//     }

// });

// test("toKeyIdentifier: Special Keys", function () {
//     var codes = {
//         "Tab": 9,
//         "Shift": 16,
//         "Control": 17,
//         "Alt": 18,
//         "Escape": 27,

//         "Left": 37,
//         "Up": 38,
//         "Right": 39,
//         "Down": 40,

//         "Delete": 46
//     },
//     code,
//     id,
//     k = new pc.Keyboard(document.body);

//     for(code in codes) {
//         id = k.toKeyIdentifier(codes[code]);
//         equal(id, code);
//     }


// });
