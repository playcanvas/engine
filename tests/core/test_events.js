describe('pc.events', function () {
  it("Add events to object", function () {
     var o = {};

     o = pc.extend(o, pc.events);

     expect(o.on).toBeTruthy();
     expect(o.off).toBeTruthy();
     expect(o.fire).toBeTruthy();

  });


  it("Bind an event", function() {
     var o = {};

     o = pc.extend(o, pc.events);

     var cb = function() {
     };

     o.on("test", cb);

     expect(o._callbacks["test"]).toBeTruthy();
     expect(o._callbacks["test"][0].callback).toBe(cb);
  });

  it("Bind and fire", function() {
     var o = {};
     var called = false;

     o = pc.extend(o, pc.events);

     var cb = function() {
         called = true;
     };

     o.on("test", cb);

     o.fire("test");

     expect(called).toBeTruthy();
  });

  it("Bind and unbind", function() {
     var o = {};

     o = pc.extend(o, pc.events);

     var f1 = function() {};
     var f2 = function() {};

     o.on("test", f1);
     o.on("test", f2);
     expect(o._callbacks["test"].length).toBe(2);

     o.off("test", f1);

     expect(o._callbacks["test"].length).toBe(1);
     expect(o._callbacks["test"][0].callback).toBe(f2);
  });

  it("Bind and unbind, last", function() {
     var o = {};

     o = pc.extend(o, pc.events);

     var f1 = function() {};
     var f2 = function() {};

     o.on("test", f1);
     o.on("test", f2);
     expect(o._callbacks["test"].length).toBe(2);

     o.off("test", f2);

     expect(o._callbacks["test"].length).toBe(1);
     expect(o._callbacks["test"][0].callback).toBe(f1);
  });

  it("Bind with scope", function() {
     var o = {};
     var m = {};

     o = pc.extend(o, pc.events);

     o.on("test", function() {
      expect(this).toBe(m);
     }, m);

     o.fire('test');
  });

  it("Bind, unbind all", function() {
     var o = {};

     o = pc.extend(o, pc.events);

     o.on("test", function() {});
     o.on("test", function() {});

     o.off("test");

     expect(o._callbacks["test"]).toBeUndefined();
  });

  it("Bind two objects same event", function () {
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

     expect(r.o).toBe(true);
     expect(r.p).toBe(false);

     r = {
         o: false,
         p: false
     };

     p.fire("test");
     expect(r.o).toBe(false);
     expect(r.p).toBe(true);

  });

  it("Bind two functions to same event", function() {
     var o = {};
     var r = {
         a: false,
         b: false
     };

     o = pc.extend(o, pc.events);

     o.on("test", function() {r.a = true;});
     o.on("test", function() {r.b = true;});

     o.fire("test");

     expect(r.a).toBe(true);
     expect(r.b).toBe(true);
  });

  it("Bind same function twice", function() {
    var count = 0;
    var fn = function () {
      count++;
    }

    var o = {};
    o = pc.extend(o, pc.events);

    o.on('test', fn);
    o.on('test', fn);

    o.fire('test');

    expect(count).toBe(2);
  });

  it("Bind/Unbind same function twice", function() {
    var count = 0;
    var fn = function () {
      count++;
    }

    var o = {};
    o = pc.extend(o, pc.events);

    o.on('test', fn);
    o.on('test', fn);

    o.off("test", fn);

    expect(o._callbacks['test'].length).toBe(0);
  });

  it("Bind same function different scope", function () {
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

    expect(o._callbacks['test'].length).toBe(1);
  });


  it("Fire with nothing bound", function() {
      var o = {}
      o = pc.extend(o, pc.events);

      o.fire("test");

      expect().nothing();
  })

  it("Unbind within a callback doesn't skip", function () {
    var o = {};
    o = pc.extend(o, pc.events);

    o.on('test', function () {
      o.off('test');
    });

    o.on('test', function () {
      expect().nothing();
    });

    o.fire('test');
  });

  it("off with no event handlers setup", function () {
    var o = {};
    o = pc.extend(o, pc.events);

    o.off('test');

    expect().nothing();
  });

  it("hasEvent() no handlers", function () {
    var o = {};
    o = pc.extend(o, pc.events);

    expect(o.hasEvent('event_name')).toBe(false);
  });

  it("hasEvent() with handlers", function () {
    var o = {};
    o = pc.extend(o, pc.events);

    o.on('event_name', function () {});

    expect(o.hasEvent('event_name')).toBe(true);
  });

  it("hasEvent() with different handler", function () {
    var o = {};
    o = pc.extend(o, pc.events);

    o.on('other_event', function () {});

    expect(o.hasEvent('event_name')).toBe(false);
  });

  it("hasEvent() handler removed", function () {
    var o = {};
    o = pc.extend(o, pc.events);
    o.on('event_name', function () {});
    o.off('event_name');
    expect(o.hasEvent('event_name')).toBe(false);
  });

  it("Fire 1 argument", function () {
      var o = {};
      var value = "1234";

      pc.events.attach(o);

      o.on("test", function (a) {
          expect(a).toBe(value);
      });

      o.fire("test", value);
  });

  it("Fire 2 arguments", function () {
      var o = {};
      var value = "1";
      var value2 = "2";

      pc.events.attach(o);

      o.on("test", function (a, b) {
          expect(a).toBe(value);
          expect(b).toBe(value2);
      });

      o.fire("test", value, value2);
  });

});

