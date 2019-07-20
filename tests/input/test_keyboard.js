
describe('pc.keyboard', function () {
  var k;

  beforeEach(function () {
    k = new pc.Keyboard();
    k.attach(document.body);
  });

  afterEach(function () {
    k.detach();
    delete k;
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

  it("Object Exists", function () {
      ok(pc.Keyboard);
  });

  it("Keydown A", function () {
      k.on(pc.input.EVENT_KEYDOWN, function (event) {
          equal(event.key, pc.input.KEY_A);
          equal(event.element, document.body);
          ok(event.event);
      });

      simulate(document.body, 'keydown', {
        keyCode: pc.input.KEY_A
      });
  });

  it("Keydown Left arrow", function () {
      k.on(pc.input.EVENT_KEYDOWN, function (event) {
          equal(event.key, pc.input.KEY_LEFT);
          equal(event.element, document.body);
          ok(event.event);
      });

      simulate(document.body, 'keydown', {
        keyCode: pc.input.KEY_LEFT
      });
  });

  it("Keydown F1", function () {
      k.on(pc.input.EVENT_KEYDOWN, function (event) {
          equal(event.key, pc.input.KEY_F1);
          equal(event.element, document.body);
          ok(event.event);
      });

      simulate(document.body, 'keydown', {
        keyCode: pc.input.KEY_F1
      });
  });

  it("Keyup A", function () {
      k.on(pc.input.EVENT_KEYUP, function (event) {
          equal(event.key, pc.input.KEY_A);
          equal(event.element, document.body);
          ok(event.event);
      });

      simulate(document.body, 'keyup', {
        keyCode: pc.input.KEY_A
      });
  });

  it("Keyup Left arrow", function () {
      k.on(pc.input.EVENT_KEYUP, function (event) {
          equal(event.key, pc.input.KEY_LEFT);
          equal(event.element, document.body);
          ok(event.event);
      });

      simulate(document.body, 'keyup', {
        keyCode: pc.input.KEY_LEFT
      });
  });

  it("Keyup F1", function () {
      k.on(pc.input.EVENT_KEYUP, function (event) {
          equal(event.key, pc.input.KEY_F1);
          equal(event.element, document.body);
          ok(event.event);
      });

      simulate(document.body, 'keyup', {
        keyCode: pc.input.KEY_F1
      });
  });

  it("isPressed", function () {
    press(pc.input.KEY_A);
    ok(k.isPressed(pc.input.KEY_A));
    k.update();
    ok(k.isPressed(pc.input.KEY_A));
  });

  it("isPressed: released", function () {
    pressAndRelease(pc.input.KEY_A);
    equal(k.isPressed(pc.input.KEY_A), false);
  });

  it("isPressed: hold", function () {
    pressAndHold(pc.input.KEY_A);
    equal(k.isPressed(pc.input.KEY_A), true);
  });

  it("wasPressed", function () {
    press(pc.input.KEY_A);
    equal(k.wasPressed(pc.input.KEY_A), true);
    k.update();
    equal(k.wasPressed(pc.input.KEY_A), false);
  });

  it("wasReleased", function () {
    press(pc.input.KEY_A);
    equal(k.wasReleased(pc.input.KEY_A), false);
    k.update();
    release(pc.input.KEY_A);
    equal(k.wasReleased(pc.input.KEY_A), true);
  });

  // it("toKeyIdentifier: output is uppercase", function () {
  //     var k = new pc.Keyboard(document.body);
  //     var id = k.toKeyIdentifier(pc.input.KEY_N);
  //     equal(id, "U+004E");
  // });

  // it("toKeyIdentifier: Upper and lowercase", function () {
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

  // it("toKeyIdentifier: Special Keys", function () {
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


});



