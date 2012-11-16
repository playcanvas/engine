module('pc.events');

test("Add events to object", function () {
   var o = {};
   
   o = pc.extend(o, pc.events);
   
   ok(o.bind);
   ok(o.unbind);
   ok(o.fire);
    
});


test("Bind an event", function() {
   var o = {};
   
   o = pc.extend(o, pc.events);
   
   var cb = function() {
   };
   
   o.bind("test", cb);
   
   ok(o._callbacks["test"]);
   strictEqual(o._callbacks["test"][0].callback, cb);
});

test("Bind and fire", function() {
   var o = {};
   var called = false;
   
   o = pc.extend(o, pc.events);
   
   var cb = function() {
       called = true;
   };
   
   o.bind("test", cb);
   
   o.fire("test");
   
   ok(called);
});

test("Bind and unbind", function() {
   var o = {};
   
   o = pc.extend(o, pc.events);
   
   var f1 = function() {};
   var f2 = function() {};
   
   o.bind("test", f1);
   o.bind("test", f2);
   strictEqual(o._callbacks["test"].length, 2);

   o.unbind("test", f1);
   
   strictEqual(o._callbacks["test"].length, 1);
   strictEqual(o._callbacks["test"][0].callback, f2);
});

test("Bind and unbind, last", function() {
   var o = {};
   
   o = pc.extend(o, pc.events);
   
   var f1 = function() {};
   var f2 = function() {};
   
   o.bind("test", f1);
   o.bind("test", f2);
   strictEqual(o._callbacks["test"].length, 2);

   o.unbind("test", f2);
   
   strictEqual(o._callbacks["test"].length, 1);
   strictEqual(o._callbacks["test"][0].callback, f1);
});

test("Bind with scope", function() {
   var o = {};
   var m = {};

   o = pc.extend(o, pc.events);
   
   o.bind("test", function() {
    strictEqual(this, m);
   }, m);
      
   o.fire('test');
});

test("Bind, unbind all", function() {
   var o = {};
   
   o = pc.extend(o, pc.events);
   
   o.bind("test", function() {});
   o.bind("test", function() {});
   
   o.unbind("test");
   
   strictEqual(o._callbacks["test"].length, 0); 
});

test("Bind two objects same event", function () {
   var o = {};
   var p = {};
   var r = {
       o: false,
       p: false
   };
   
   o = pc.extend(o, pc.events);
   p = pc.extend(p, pc.events);
   
   o.bind("test", function() {r.o = true;});
   p.bind("test", function() {r.p = true;});
   
   o.fire("test");
   
   equal(r.o, true);
   equal(r.p, false);

   r = {
       o: false,
       p: false
   };
   
   p.fire("test");
   equal(r.o, false);
   equal(r.p, true);
   
});

test("Bind two functions to same event", function() {
   var o = {};
   var r = {
       a: false,
       b: false
   };
    
   o = pc.extend(o, pc.events);
   
   o.bind("test", function() {r.a = true;}); 
   o.bind("test", function() {r.b = true;});
   
   o.fire("test");
   
   equal(r.a, true);
   equal(r.b, true);
});

test("Bind same function twice", function() {
  var count = 0;
  var fn = function () {
    count++;
  }

  var o = {};
  o = pc.extend(o, pc.events);

  o.bind('test', fn);
  o.bind('test', fn);

  o.fire('test');

  equal(count, 2);
});

test("Bind/Unbind same function twice", function() {
  var count = 0;
  var fn = function () {
    count++;
  }

  var o = {};
  o = pc.extend(o, pc.events);

  o.bind('test', fn);
  o.bind('test', fn);

  o.unbind("test", fn);

  equal(o._callbacks['test'].length, 0);
});

test("Bind same function different scope", function () {
  var count = 0;
  var fn = function () {
    count++;
  }

  var o = {};
  var m = {};
  o = pc.extend(o, pc.events);

  o.bind('test', fn, o);
  o.bind('test', fn, m);


  o.unbind("test", fn, o);

  equal(o._callbacks['test'].length, 1);
});


test("Fire with nothing bound", 0, function() {
    var o = {}
    o = pc.extend(o, pc.events);
    
    o.fire("test");
})

test("Unbind within a callback doesn't skip", function () {
  var o = {};
  o = pc.extend(o, pc.events);

  o.bind('test', function () {
    o.unbind('test');
  });

  o.bind('test', function () {
    ok(true);
  });

  o.fire('test');
});
