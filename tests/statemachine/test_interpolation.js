module('pc.interpolate');

test('Value returns correctly the interpolation of two numbers', function() {

    equal(pc.interpolate.value(0,10,0.5), 5, "Middle interpolated");
    equal(pc.interpolate.value(0, 10, 0), 0, "start interpolated");
    equal(pc.interpolate.value(0, 10, 1), 10, "end interpolated");
    equal(pc.interpolate.value(0, 10, 1.2), 12, "can interpolate out of range");


});

test('Lerp returns correctly the interpolation of two numbers', function () {

    equal(pc.interpolate.lerp(0, 10, 0.5), 5, "Middle interpolated");
    equal(pc.interpolate.lerp(0, 10, 0), 0, "start interpolated");
    equal(pc.interpolate.lerp(0, 10, 1), 10, "end interpolated");
    equal(pc.interpolate.lerp(0, 10, 1.2), 10, "can interpolate out of range");


});


test('EaseInOut returns correctly the interpolation of two numbers', function () {

    equal(pc.interpolate.easeInOut(0, 10, 0.5), 5, "Middle interpolated");
    equal(pc.interpolate.easeInOut(0, 10, 0), 0, "start interpolated");
    equal(pc.interpolate.easeInOut(0, 10, 1), 10, "end interpolated");
    equal(pc.interpolate.easeInOut(0, 10, 1.2), 10, "can interpolate out of range");

});

test('EaseIn returns correctly the interpolation of two numbers', function () {

    equal(pc.interpolate.easeIn(0, 10, 0.5), 5, "Middle interpolated");
    equal(pc.interpolate.easeIn(0, 10, 0), 0, "start interpolated");
    equal(pc.interpolate.easeIn(0, 10, 1), 10, "end interpolated");
    equal(pc.interpolate.easeIn(0, 10, 1.2), 10, "can interpolate out of range");

});

test('EaseOut returns correctly the interpolation of two numbers', function () {

    equal(pc.interpolate.easeOut(0, 10, 0.5), 5, "Middle interpolated");
    equal(pc.interpolate.easeOut(0, 10, 0), 0, "start interpolated");
    equal(pc.interpolate.easeOut(0, 10, 1), 10, "end interpolated");
    equal(pc.interpolate.easeOut(0, 10, 1.2), 10, "can interpolate out of range");

});

test('Lerp can lerp vectors', function() {

    var result = pc.interpolate.lerp(new pc.Vec3(0,0,0), new pc.Vec3(1,1,1), 0.5);
    equal(result.x,0.5, "X lerped");
    equal(result.y, 0.5, "Y lerped");
    equal(result.z, 0.5, "Z lerped");


});

test('Lerp can lerp quaternions', function () {

    var result = pc.interpolate.lerp(new pc.Quat(), new pc.Quat().setFromEulerAngles(0,90,0), 0.5).getEulerAngles();
    equal(result.x, 0, "X lerped");
    equal(result.y, 45, "Y lerped");
    equal(result.z, 0, "Z lerped");


});

test('value can hyper extend quaternions', function () {

    var result = pc.interpolate.value(new pc.Quat(),
        new pc.Quat().setFromEulerAngles(0, 45, 0),
        2).getEulerAngles();
    equal(result.x, 0, "X lerped");
    equal(result.y, 90, "Y lerped");
    equal(result.z, 0, "Z lerped");


});


test('Move Towards makes it all the way', function() {
    equal(pc.interpolate.moveTowards(0, 10, 10), 10, "With numbers");
    var result = pc.interpolate.moveTowards(pc.Vec3.ZERO, new pc.Vec3(0,10,0), 10);
    equal(result.y, 10, "With a vector");
    var qresult = pc.interpolate.moveTowards(pc.Quat.IDENTITY, new pc.Quat().setFromEulerAngles(0,90,0), 90).getEulerAngles();
    equal(qresult.y, 90, "With a quaternion");
});


test('Move Towards makes it part of the way', function () {
    equal(pc.interpolate.moveTowards(0, 20, 10), 10, "With numbers");
    var result = pc.interpolate.moveTowards(pc.Vec3.ZERO, new pc.Vec3(0, 20, 0), 10);
    equal(result.y, 10, "With a vector");
    var qresult = pc.interpolate.moveTowards(pc.Quat.IDENTITY,
        new pc.Quat().setFromEulerAngles(0, 180, 0),
        90).getEulerAngles();
    equal(qresult.y, 90, "With a quaternion");
});

asyncTest('Lerp over time', function() {

    var v = -1;
    var v2 = -1;
    app.coroutine.interpolate.lerp(0, 10, 2).on('value', function(value) { v = value; });
    app.coroutine.interpolate.lerp(0, 10, 2, function (value) {
        v2 = value;
    });
    setTimeout(function() {
        ok(Math.abs(v-5) < 0.25, "Event driven: " + v);
        ok(Math.abs(v2-5) < 0.25, "Function driven: " + v2);
        start();
    }, 1000);

});

asyncTest('EaseInOut over time', function () {

    var v = -1;
    var v2 = -1;
    app.coroutine.interpolate.easeInOut(0, 10, 2).on('value', function (value) {
        v = value;
    });
    app.coroutine.interpolate.easeInOut(0, 10, 2, function (value) {
        v2 = value;
    });
    setTimeout(function () {
        ok(Math.abs(v - 5) < 0.25, "Event driven: " + v);
        ok(Math.abs(v2 - 5) < 0.25, "Function driven: " + v);
        start();
    }, 1000);

});

test('Curves are interpolated', function() {
    var curve = new pc.Curve([0,0,1,1]);
    equal(pc.interpolate.curve(curve, 0, 10, 0.5), 5, "Mid range");
});

test('Curves sets are interpolated', function () {
    var curves = new pc.CurveSet([[0, 0, 1, 1],[0,0,1,2]]);
    deepEqual(pc.interpolate.curveSet(curves, 0, 10, 0.5), [5, 10], "Mid range");
});


asyncTest('Curves are interpolated over time', function() {
    var v = -1;
    var v2 = -1;
    var curve = new pc.Curve([0, 0, 1, 1]);
    app.coroutine.interpolate.curve(curve, 0, 10, 2).on('value', function (value) {
        v = value;
    });
    app.coroutine.interpolate.curve(curve, 0, 10, 2, function (value) {
        v2 = value;
    });
    setTimeout(function () {
        ok(Math.abs(v - 5) < 0.25, "Event driven: " + v);
        ok(Math.abs(v2 - 5) < 0.25, "Function driven: " + v2);
        start();
    }, 1000);
});

asyncTest('Curve sets are interpolated over time', function () {
    var v = [];
    var v2 = [];
    var curves = new pc.CurveSet([[0, 0, 1, 1], [0, 0, 1, 2]]);
    app.coroutine.interpolate.curveSet(curves, 0, 10, 2).on('value', function (value) {
        v = value;
    });
    app.coroutine.interpolate.curveSet(curves, 0, 10, 2, function (value) {
        v2 = value;
    });
    setTimeout(function () {
        ok(Math.abs(v[0] - 5) < 0.25 && Math.abs(v[1] - 10) < 0.5, "Event driven: " + JSON.stringify(v));
        ok(Math.abs(v2[0] - 5) < 0.25 && Math.abs(v2[1] - 10) < 0.5, "Function driven: " + JSON.stringify(v2));
        start();
    }, 1000);
});

asyncTest('Lerp over time is cancelled', function() {
    var v = -1;
    var v2 = -1;
    app.coroutine.interpolate.lerp(0, 10, 2).on('value', function (value) {
        v = value;
    }).cancel(0.5);
    app.coroutine.interpolate.lerp(0, 10, 2, function (value) {
        v2 = value;
    }).cancel(0.5);
    setTimeout(function () {
        ok(Math.abs(v - 2.5) < 0.1, "Event driven: " + v);
        ok(Math.abs(v2 - 2.5) < 0.1, "Function driven: " + v2);
        start();
    }, 1000);
});

