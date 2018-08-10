describe('pc.events', function () {
  it("Add events to object", function () {
     var o = {};

     o = pc.extend(o, pc.events);

     expect(o.on).to.exist;
     expect(o.off).to.exist;
     expect(o.fire).to.exist;

  });


  it("Bind an event", function() {
     var o = {};

     o = pc.extend(o, pc.events);

     var cb = function() {
     };

     o.on("test", cb);

     expect(o._callbacks["test"]).to.exist;
     expect(o._callbacks["test"][0].callback).to.equal(cb);
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

     expect(called).to.exist;
  });

  it("Bind and unbind", function() {
     var o = {};

     o = pc.extend(o, pc.events);

     var f1 = function() {};
     var f2 = function() {};

     o.on("test", f1);
     o.on("test", f2);
     expect(o._callbacks["test"].length).to.equal(2);

     o.off("test", f1);

     expect(o._callbacks["test"].length).to.equal(1);
     expect(o._callbacks["test"][0].callback).to.equal(f2);
  });

  it("Bind and unbind, last", function() {
     var o = {};

     o = pc.extend(o, pc.events);

     var f1 = function() {};
     var f2 = function() {};

     o.on("test", f1);
     o.on("test", f2);
     expect(o._callbacks["test"].length).to.equal(2);

     o.off("test", f2);

     expect(o._callbacks["test"].length).to.equal(1);
     expect(o._callbacks["test"][0].callback).to.equal(f1);
  });

  it("Bind with scope", function() {
     var o = {};
     var m = {};

     o = pc.extend(o, pc.events);

     o.on("test", function() {
      expect(this).to.equal(m);
     }, m);

     o.fire('test');
  });

  it("Bind, unbind all", function() {
     var o = {};

     o = pc.extend(o, pc.events);

     o.on("test", function() {});
     o.on("test", function() {});

     o.off("test");

     expect(o._callbacks["test"]).to.be.undefined;
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

     expect(r.o).to.equal(true);
     expect(r.p).to.equal(false);

     r = {
         o: false,
         p: false
     };

     p.fire("test");
     expect(r.o).to.equal(false);
     expect(r.p).to.equal(true);

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

     expect(r.a).to.equal(true);
     expect(r.b).to.equal(true);
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

    expect(count).to.equal(2);
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

    expect(o._callbacks['test'].length).to.equal(0);
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

    expect(o._callbacks['test'].length).to.equal(1);
  });


  it("Fire with nothing bound", function() {
      var o = {}
      o = pc.extend(o, pc.events);

      var fn = function () {
        o.fire("test");
      }

      expect(fn).to.not.throw;
  })

  it("Unbind within a callback doesn't skip", function () {
    var o = {};
    o = pc.extend(o, pc.events);

    o.on('test', function () {
      o.off('test');
    });

    o.on('test', function () {
      expect(true).to.be.true; // just check we're being called
    });

    o.fire('test');
  });

  it("off with no event handlers setup", function () {
    var o = {};
    o = pc.extend(o, pc.events);

    var fn = function () {
      o.off('test');
    }

    expect(fn).to.not.throw;
  });

  it("hasEvent() no handlers", function () {
    var o = {};
    o = pc.extend(o, pc.events);

    expect(o.hasEvent('event_name')).to.equal(false);
  });

  it("hasEvent() with handlers", function () {
    var o = {};
    o = pc.extend(o, pc.events);

    o.on('event_name', function () {});

    expect(o.hasEvent('event_name')).to.equal(true);
  });

  it("hasEvent() with different handler", function () {
    var o = {};
    o = pc.extend(o, pc.events);

    o.on('other_event', function () {});

    expect(o.hasEvent('event_name')).to.equal(false);
  });

  it("hasEvent() handler removed", function () {
    var o = {};
    o = pc.extend(o, pc.events);
    o.on('event_name', function () {});
    o.off('event_name');
    expect(o.hasEvent('event_name')).to.equal(false);
  });

  it("Fire 1 argument", function () {
      var o = {};
      var value = "1234";

      pc.events.attach(o);

      o.on("test", function (a) {
          expect(a).to.equal(value);
      });

      o.fire("test", value);
  });

  it("Fire 2 arguments", function () {
      var o = {};
      var value = "1";
      var value2 = "2";

      pc.events.attach(o);

      o.on("test", function (a, b) {
          expect(a).to.equal(value);
          expect(b).to.equal(value2);
      });

      o.fire("test", value, value2);
  });

});

