module('pc.Coroutine');

var entity;
var app = app || new pc.Application(document.getElementById('canvas'), {});
app.start();

asyncTest('Coroutine ends', function () {
    var ended;
    app.coroutine.startCoroutine(function () {
    }, { duration: 1 }).on('ended', function () {
        ended = true;
    });
    setTimeout(function () {
        equal(ended, true, "Finished");
        start();
    }, 1200);
});

asyncTest('Coroutine runs', function () {
    var v = 0;
    app.coroutine.startCoroutine(function (dt) {
        v += dt;
    }, 1);
    setTimeout(function () {
        ok(v > 0.5, "Ran");
        start();
    }, 800);
});

asyncTest('Coroutine delays', function () {
    var v = 0;
    app.coroutine.startCoroutine(function (dt) {
        v += dt;
        return 0.5;
    }, { duration: 1.2 });
    var first = 1000;
    setTimeout(function () {
        ok(v > 0 && v < 0.2, "Paused");
        first = v;
    }, 600);
    setTimeout(function () {
        ok(v > first, "Resumed");
        start();
    }, 1500);
});

asyncTest('Coroutine stops', function () {
    var v = 0;
    app.coroutine.startCoroutine(function (dt) {
        v += dt;
        return v < 0.2;
    });
    setTimeout(function () {
        ok(v >= 0.2 && v < 0.3, "Paused: " + v);
        start();
    }, 400);

});

asyncTest('Coroutine switches', function () {
    var v = 0;
    var v2 = 0;
    app.coroutine.startCoroutine(function (dt) {
        v += dt;
        return v < 0.2 || function (dt) {
                v2 += dt;
            };
    }, { duration: 1 });
    setTimeout(function () {
        ok(v >= 0.2 && v < 0.3 && v2 > 0.4, "Switched: " + v + ' ' + v2);
        start();
    }, 1100);

});

asyncTest('Coroutine switches back and can access running function', function () {
    var v = 0;
    var v2 = 0;
    var t1, t2;
    app.coroutine.startCoroutine(function (dt, coroutine) {
        v += dt;
        var current = coroutine.fn;
        if (t2) t1 = true;
        return v < 0.2 || function (dt) {
                v2 += dt;
                t2 = true;
                return v2 < 0.2 || current;
            };
    }, { duration: 1 });
    setTimeout(function () {
        ok(t1, "Flipped: " + v + ' ' + v2);
        start();
    }, 1100);

});

asyncTest('Coroutines can be bound to objects', function () {
    var v = 0;
    var entity = new pc.Entity();
    entity.enabled = true;
    app.coroutine.startCoroutine(function (dt) {
        v += dt;
    },
        {
            duration: 1,
            tie: entity
        });
    setTimeout(function () {
        entity.enabled = false;
    }, 500);
    setTimeout(function () {
        ok(v >= 0.45 && v < 0.7, "Disabled: "  + v);
        start();
    }, 1100);

});

asyncTest('Timeout happens once after interval', function () {
    var v = 0;
    app.coroutine.timeout(function () {
        v++;
    }, 0.5);
    setTimeout(function () {
        equal(v, 0, "Happened: " + v);

    }, 100);
    setTimeout(function () {
        equal(v, 1, "Happened: " + v);
        start();
    }, 800);
});

asyncTest('Interval happens regularly', function () {
    var v = 0;
    app.coroutine.interval(function () {
        v = v + 1;
    }, 0.2);
    setTimeout(function () {
        equal(v, 5, "Happened: " + v);
        start();
    }, 1100);
});

asyncTest('Coroutine bound to an entity are destroyed when the entity is destroyed', function () {
    var entity = new pc.Entity(app);
    var v = 0;
    entity.coroutine(function (dt) {
        v = v + dt;
    });
    setTimeout(function () {
        entity.destroy();
    }, 500);
    setTimeout(function () {
        ok(v > 0.45 && v < 0.55, "V was set" + v);
        start();
    }, 700);
});

