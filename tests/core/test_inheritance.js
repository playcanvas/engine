module('pc.core', {
    setup: function () {
        Base = function Base() {
            this.type = "base";
        };
        Base.prototype.a = function () {return "a";}

        Derived = function Derived() {
            this.type = "derived";
        };
        Derived = pc.inherits(Derived, Base);
        Derived.prototype.b = function () {return "b";}
    },
    teardown: function () {
        delete Base;
        delete Derived;
    }
});

test("Prototypes from Base exist in Derived", function () {
    var d = new Derived();
    equal(d.a(), "a");
});

test("Prototypes from Derived exist in Derived", function () {
    var d = new Derived();
    equal(d.b(), "b");
});

test("Prototypes from Derived do not exist in Base", function () {
    var b = new Base();

    equal(b.b, undefined);
});

test("Derived is instanceof Base", function () {
    var b = new Base();
    var d = new Derived();

    ok(d instanceof Base);
    ok(d instanceof Derived);
});

// test("constructor.name works for Base and Derived", function () {
//     var b = new Base();
//     var d = new Derived();

//     equal(b.constructor.name, "Base");
//     equal(d.constructor.name, "Derived");
// })

test("constructor not called during initialisation", 0, function () {
    var TestBase = function () {
        ok(false);
    };

    var TestDerived = function () {
        ok(false);
    }
    TestDerived = pc.inherits(TestDerived, TestBase);
});

test("_super can be used to access overridden functions", function () {
    var NewDerived = function () {

    };
    NewDerived = pc.inherits(NewDerived, Base);

    NewDerived.prototype.a = function () {
        return NewDerived._super.a();
    }

    var n = new NewDerived();
    equal(n.a(), "a");
});
