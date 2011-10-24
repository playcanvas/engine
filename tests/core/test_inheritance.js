module('pc.core', {
    setup: function () {
        Base = function Base() {
            this.type = "base";    
        };
        Base.prototype.a = function () {return "a";}
        
        Derived = function Derived() {
            this.type = "derived";        
        };
        Derived = Derived.extendsFrom(Base);
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

test("constructor.name works for Base and Derived", function () {
    var b = new Base();
    var d = new Derived();
    
    equal(b.constructor.name, "Base");
    equal(d.constructor.name, "Derived");
})

test("constructor not called during initialisation", function () {
    var TestBase = function () {
        ok(false);
    };
    
    var TestDerived = function () {
        ok(false);
    }    
    TestDerived = TestDerived.extendsFrom(TestBase);    
});

test("super_ can be used to access overridden functions", function () {
    var NewDerived = function () {
        
    };
    NewDerived = NewDerived.extendsFrom(Base);
    
    NewDerived.prototype.a = function () {
        return NewDerived._super.a();
    }
    
    var n = new NewDerived();
    equal(n.a(), "a");    
});
