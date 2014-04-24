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

test('Color.toString()', function () {
    var c = new pc.Color(1,1,1);
    equal(c.toString(), '#ffffff');
    equal(c.toString(true), '#ffffffff');

    var c = new pc.Color(1,0,1,0);
    equal(c.toString(), '#ff00ff');
    equal(c.toString(true), '#ff00ff00');

    var c = new pc.Color(0.729411780834198, 0.729411780834198, 0.6941176652908325, 1);
    equal(c.toString(true), '#babab1ff');
});
