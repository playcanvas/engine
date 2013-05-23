module("pc.core.Color");


test('new Color()', function () {
    var c = new pc.Color();

    equal(c.r, 0);
    equal(c.g, 0);
    equal(c.b, 0);
    equal(c.a, 1);
});

test('new Color(1,2,3,4)', function () {
    var c = new pc.Color(1,2,3,4);

    equal(c.r, 1);
    equal(c.g, 2);
    equal(c.b, 3);
    equal(c.a, 4);    
});

test('new Color(1,2,3)', function () {
    var c = new pc.Color(1,2,3);

    equal(c.r, 1);
    equal(c.g, 2);
    equal(c.b, 3);
    equal(c.a, 1);
});

test('new Color([1,2,3,4])', function () {
    var c = new pc.Color([1,2,3,4]);

    equal(c.r, 1);
    equal(c.g, 2);
    equal(c.b, 3);
    equal(c.a, 4);
});    

test('new Color([1,2,3])', function () {
    var c = new pc.Color([1,2,3]);

    equal(c.r, 1);
    equal(c.g, 2);
    equal(c.b, 3);
    equal(c.a, 1);
});    

test('new Color("#ff00ff")', function () {
    var c = new pc.Color("#ff00ff");

    equal(c.r, 1);
    equal(c.g, 0);
    equal(c.b, 1);
    equal(c.a, 1);
});

test('new Color("#ff00ff00")', function () {
    var c = new pc.Color("#ff00ff00");

    equal(c.r, 1);
    equal(c.g, 0);
    equal(c.b, 1);
    equal(c.a, 0);
});
