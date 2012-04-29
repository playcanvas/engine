module('pc.core');
test('type', function() {
    var types = [
        null,
        1,
        "a",
        true,
        {},
        [],
        function() {},
        new Date(),
        new RegExp()
    ],
    expected = [
        "null",
        "number",
        "string",
        "boolean",
        "object",
        "array",
        "function",
        "date",
        "regexp"
    ],
    index;
    
    for (index = 0; index < types.length; index++ ) {
        equal(pc.type(types[index]), expected[index]);
    }
});

test('extend: object, object', function() {
    var o1 = {
        a:"a",
        b:"b"
    };
    
    var o2 = {
        c:"c",
        d:"d"
    };
    
    o1 = pc.extend(o1,o2);
    
    strictEqual(o1.a, "a");
    strictEqual(o1.b, "b");
    strictEqual(o1.c, "c");
    strictEqual(o1.d, "d");
});

test('extend: array, array', function() {
    var a1 = [1,2,3];
    var a2 = [4,5,6];
    
    a1 = pc.extend(a1,a2);
    strictEqual(a1.length,a2.length);
    strictEqual(a1[0],a2[0]);
    strictEqual(a1[1],a2[1]);
    strictEqual(a1[2],a2[2]);
});

test('extend: object, array', function() {
    var o1 = {a: "a"};
    var a1 = [1,2];
    
    var o1 = pc.extend(o1,a1);
    
    strictEqual(o1.a, "a");
    strictEqual(o1[0], 1);
    strictEqual(o1[1], 2);    
});

test('extend: deep object', function() {
    var o1 = {
        A: "A"  
    };

    var o2 = {
        a: {b: "b"},
        c: [1,2]
    };
    
    o1 = pc.extend(o1,o2);
    
    strictEqual(o1.a.b, "b");
    strictEqual(o1.c[0], 1);
    strictEqual(o1.c[1], 2);
    strictEqual(o1.A, "A");
});

test('extend: deep object not reference', function() {
    var o1 = {
        A: "A"  
    };

    var o2 = {
        a: {b: "b"},
        c: [1,2]
    };
    
    o1 = pc.extend(o1,o2);
    
    // Change original so if o1 contains a reference test will fail
    o2.a.b = "z";
     
    strictEqual(o1.a.b, "b");
    strictEqual(o1.c[0], 1);
    strictEqual(o1.c[1], 2);
    strictEqual(o1.A, "A");
});

test('isDefined', function () {
    var a;
    var b = 1;
    var c = null;
    var d = 1 / 0;
    
    equal(pc.isDefined(a), false);
    equal(pc.isDefined(b), true);
    equal(pc.isDefined(c), true);
    equal(pc.isDefined(d), true);
});
