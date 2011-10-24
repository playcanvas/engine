module('pc.input.keyboard');

function createWebKitStyleKeyboardEvent(ch, type) {
    var id;
    if (typeof(ch) == "string") {
        ch = ch.toUpperCase().charCodeAt(0);
        id = "U+00" + ch.toString(16);
    }
    
    // A mock Keyboard Event like that of Chrome for a keydown of letter char
    return {
        altGraphKey: false,
        altKey: false,
        bubbles: true,
        cancelBubble: false,
        cancelable: true,
        charCode: type == "keypress" ? ch : 0,
        /*clipboardData: undefined,*/
        ctrlKey: false,
        currentTarget: document,
        defaultPrevented: false,
        detail: 0,
        eventPhase: 3,
        keyCode: ch,
        keyIdentifier: id, 
        keyLocation: 0,
        layerX: 0,
        layerY: 0,
        metaKey: false,
        pageX: 0,
        pageY: 0,
        returnValue: true,
        shiftKey: false,
        srcElement: document.body,
        target: document.body,
        timeStamp: 1296472963160,
        type: type,
        view: window,
        which: ch
    };    
}

function simFullKeyPressAndRelease(k, ch) {
    simKeyDown(k, ch);
    simKeyPress(k, ch);
    simKeyUp(k, ch);
}

function simFullKeyPress(k, ch) {
    simKeyDown(k, ch);
    simKeyPress(k, ch);    
}

function simFullKeyPressSpecialChar(k, ch) {
    // Special non-printable characters (like arrow keys) don't produce a keypress event
    simKeyDown(k, ch);
}

function simFullKeyPressAndHold(k, ch) {
    simFullKeyPress(k, ch);
    simFullKeyPress(k, ch);
}

function simKeyDown(k, ch) {
    k._handleKeyDown(createWebKitStyleKeyboardEvent(ch, "keydown"));    
}

function simKeyPress(k, ch) {
    k._handleKeyPress(createWebKitStyleKeyboardEvent(ch, "keypress"));    
}

function simKeyUp(k, ch) {
    k._handleKeyUp(createWebKitStyleKeyboardEvent(ch, "keyup"));
}

test("Object Exists", function () {
    ok(pc.input.Keyboard);
});

test("Keydown: fires", function () {
    var k = new pc.input.Keyboard(document.body);
    var called = false;
    
    k.bind("keydown", function (event) {
        called = true;
    });
    
    simKeyDown(k, "a");
    
    ok(called);    
});

test("keypress: fires", function () {
    var k = new pc.input.Keyboard(document.body);
    var called = false;
    
    k.bind("keypress", function (event) {
        called = true;
    });
    
    simKeyPress(k, "a");
    
    ok(called);    
});

test("keyup: fires", function () {
    var k = new pc.input.Keyboard(document.body);
    var called = false;
    
    k.bind("keyup", function (event) {
        called = true;
    });
    
    simKeyUp(k, "a");
    
    ok(called);    
});

test("isPressed: Pressed", function () {
   var k = new pc.input.Keyboard(document.body);
   
   simFullKeyPress(k, "a");
   
   ok(k.isPressed('a'));
});

test("isPressed: Released", function () {
   var k = new pc.input.Keyboard(document.body);
   
   simFullKeyPressAndRelease(k, "a");
   
   equal(k.isPressed('a'), false);
});

test("isPressed: Held", function () {
   var k = new pc.input.Keyboard(document.body);
   
   simFullKeyPressAndHold(k, "a");
   
   equal(k.isPressed('a'), true);
});

test("isPressed and wasPressed", function () {
   var k = new pc.input.Keyboard(document.body);
   
   simFullKeyPress(k, 'a');
   equal(k.isPressed('a'), true);
   equal(k.wasPressed('a'), true);
   k.update(0.0167);
   equal(k.isPressed('a'), true);
   equal(k.wasPressed('a'), false);
   k.update(0.0167);
   equal(k.isPressed('a'), true);
   equal(k.wasPressed('a'), false);
   simKeyUp(k, 'a');
   equal(k.isPressed('a'), false);
   equal(k.wasPressed('a'), false);
   
});

test("wasPressed and isPressed", function () {
   var k = new pc.input.Keyboard(document.body);
   
   simFullKeyPress(k, 'a');
   equal(k.wasPressed('a'), true);
   equal(k.isPressed('a'), true);
   k.update(0.0167);
   equal(k.wasPressed('a'), false);
   equal(k.isPressed('a'), true);
   k.update(0.0167);
   equal(k.wasPressed('a'), false);
   equal(k.isPressed('a'), true);
   simKeyUp(k, 'a');
   equal(k.wasPressed('a'), false);
   equal(k.isPressed('a'), false);
});

test("isPressed: charCodes", function () {
   var k = new pc.input.Keyboard(document.body);
   
   simFullKeyPress(k, "a");
   
   ok(k.isPressed(65));
});

test("isPressed: special character", function () {
   var k = new pc.input.Keyboard(document.body);
   
   simFullKeyPressSpecialChar(k, 39);
   
   ok(k.isPressed(39));

});

test("toKeyIdentifier: Upper and lowercase", function () {
    var k = new pc.input.Keyboard(document.body),
        lower = pc.string.ASCII_LOWERCASE,
        upper = pc.string.ASCII_UPPERCASE,
        index,
        id;
            
    for(index = 0; index < lower.length; index++) {
        id = k.toKeyIdentifier(lower.charCodeAt(index));
        equal(id.length, 6);
        equal(String.fromCharCode(parseInt(id.slice(2), 16)), lower[index]);

        id = k.toKeyIdentifier(upper.charCodeAt(index));
        equal(id.length, 6);
        equal(String.fromCharCode(parseInt(id.slice(2), 16)), upper[index]);
    }
    
});

test("toKeyIdentifier: Special Keys", function () {
    var codes = {
        "Tab": 9,
        "Shift": 16,
        "Control": 17,
        "Alt": 18,
        "Escape": 27,
        
        "Left": 37,
        "Up": 38,
        "Right": 39,
        "Down": 40,
        
        "Delete": 46
    }, 
    code,
    id,
    k = new pc.input.Keyboard(document.body);
    
    for(code in codes) {
        id = k.toKeyIdentifier(codes[code]);
        equal(id, code);
    }
    
    
});
