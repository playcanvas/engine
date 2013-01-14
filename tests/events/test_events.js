module('pc.events');

test("Add events to object", function () {
   var o = {};
   
   o = pc.extend(o, pc.events);
   
   ok(o.on);
   ok(o.off);
   ok(o.fire);
    
});


test("Bind an event", function() {
   var o = {};
   
   o = pc.extend(o, pc.events);
   
   var cb = function() {
   };
   
   o.on("test", cb);
   
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
   
   o.on("test", cb);
   
   o.fire("test");
   
   ok(called);
});

test("Bind and unbind", function() {
   var o = {};
   
   o = pc.extend(o, pc.events);
   
   var f1 = function() {};
   var f2 = function() {};
   
   o.on("test", f1);
   o.on("test", f2);
   strictEqual(o._callbacks["test"].length, 2);

   o.off("test", f1);
   
   strictEqual(o._callbacks["test"].length, 1);
   strictEqual(o._callbacks["test"][0].callback, f2);
});

test("Bind and unbind, last", function() {
   var o = {};
   
   o = pc.extend(o, pc.events);
   
   var f1 = function() {};
   var f2 = function() {};
   
   o.on("test", f1);
   o.on("test", f2);
   strictEqual(o._callbacks["test"].length, 2);

   o.off("test", f2);
   
   strictEqual(o._callbacks["test"].length, 1);
   strictEqual(o._callbacks["test"][0].callback, f1);
});

test("Bind with scope", function() {
   var o = {};
   var m = {};

   o = pc.extend(o, pc.events);
   
   o.on("test", function() {
    strictEqual(this, m);
   }, m);
      
   o.fire('test');
});

test("Bind, unbind all", function() {
   var o = {};
   
   o = pc.extend(o, pc.events);
   
   o.on("test", function() {});
   o.on("test", function() {});
   
   o.off("test");
   
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
   
   o.on("test", function() {r.o = true;});
   p.on("test", function() {r.p = true;});
   
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
   
   o.on("test", function() {r.a = true;}); 
   o.on("test", function() {r.b = true;});
   
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

  o.on('test', fn);
  o.on('test', fn);

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

  o.on('test', fn);
  o.on('test', fn);

  o.off("test", fn);

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

  o.on('test', fn, o);
  o.on('test', fn, m);


  o.off("test", fn, o);

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

  o.on('test', function () {
    o.off('test');
  });

  o.on('test', function () {
    ok(true);
  });

  o.fire('test');
});

test("off with no event handlers setup", function () {
  var o = {};
  o = pc.extend(o, pc.events);
  
  o.off('test');

  ok(true);
});

test("hasEvent() no handlers", function () {
  var o = {};
  o = pc.extend(o, pc.events);

  equal(o.hasEvent('event_name'), false);
});

test("hasEvent() with handlers", function () {
  var o = {};
  o = pc.extend(o, pc.events);

  o.on('event_name', function () {});

  equal(o.hasEvent('event_name'), true);
});

test("hasEvent() with different handler", function () {
  var o = {};
  o = pc.extend(o, pc.events);

  o.on('other_event', function () {});

  equal(o.hasEvent('event_name'), false);
});

test("hasEvent() handler removed", function () {
  var o = {};
  o = pc.extend(o, pc.events);
  o.on('event_name', function () {});
  o.off('event_name');
  equal(o.hasEvent('event_name'), false);
});

test("Deprecated bind()", function() {
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

test("Deprecated bind and unbind", function() {
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