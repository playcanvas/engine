module('pc.Coroutine');

asyncTest('Coroutine ends', function() {
	var ended;
	new pc.Coroutine(function() {}, 1).on('ended', function() { ended = true; });
	setTimeout(function() {
		equal(ended, true, "Finished");
		start();
	}, 1200);
});

asyncTest('Coroutine runs', function() {
	var v = 0;
	new pc.Coroutine(function(dt) {
		v += dt;
	}, 1);
	setTimeout(function () {
		ok(v > 0.5, "Ran");
		start();
	}, 800);
});

asyncTest('Coroutine delays', function() {
	var v = 0;
	new pc.Coroutine(function (dt) {
		v += dt;
		return 0.5;
	}, 1);
	var first;
	setTimeout(function () {
		ok(v > 0 && v < 0.2, "Paused");
		first = v;
	}, 400);
	setTimeout(function () {
		ok(v > first, "Resumed");
		start();
	}, 1000);
});

asyncTest('Coroutine stops', function() {
	var v = 0;
	new pc.Coroutine(function (dt) {
		v += dt;
		return v < 0.2;
	}, 1);
	setTimeout(function () {
		ok(v >= 0.2 && v < 0.3, "Paused: "  + v);
		start();
	}, 400);

});

asyncTest('Coroutine switches', function () {
	var v = 0;
	var v2 = 0;
	new pc.Coroutine(function (dt) {
		v += dt;
		return v < 0.2 || function(dt) {
				v2 += dt;
			};
	}, 1);
	setTimeout(function () {
		ok(v >= 0.2 && v < 0.3 && v2 > 0.4, "Switched: " + v + ' ' + v2);
		start();
	}, 1100);

});

asyncTest('Coroutine switches back and can access running function', function () {
	var v = 0;
	var v2 = 0;
	new pc.Coroutine(function (dt, coroutine) {
		v += dt;
		var current = coroutine.fn;
		return v < 0.2 || function (dt) {
				v2 += dt;
				return v2 < 0.2 || current;
			};
	}, 1);
	setTimeout(function () {
		ok(v >= 0.45 && v < 0.55 && v2 > 0.45, "Flipped: " + v + ' ' + v2);
		start();
	}, 1100);

});

asyncTest('Coroutines can be bound to objects', function () {
	var v = 0;
	var entity = new pc.Entity();
	entity.enabled = true;
	new pc.Coroutine(function (dt) {
		v += dt;
	}, 1, entity);
	setTimeout(function() {
		entity.enabled = false;
	}, 500);
	setTimeout(function () {
		ok(v >= 0.45 && v < 0.55,"Disabled" + v);
		start();
	}, 1100);

});

asyncTest('Timeout happens once after interval', function() {
	var v = 0;
	pc.Coroutine.timeout(function() {
		v++;
	}, 0.4);
	setTimeout(function () {
		equal(v, 1, "Happened: " + v);
		start();
	}, 800);
});

asyncTest('Interval happens regularly', function () {
	var v = 0;
	pc.Coroutine.interval(function () {
		v = v + 1;
	}, 0.2);
	setTimeout(function () {
		equal(v, 5, "Happened: " + v);
		start();
	}, 1100);
});

asyncTest('Coroutine bound to an entity are destroyed when the entity is destroyed', function() {
	var entity = new pc.Entity(app);
	var v = 0;
	entity.coroutine(function(dt) {
		v = v + dt;
	});
	setTimeout(function() {
		entity.destroy();
	}, 500);
	setTimeout(function() {
		ok(v > 0.45 && v < 0.55, "V was set" + v);
		start();
	}, 700);
});

