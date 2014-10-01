pc.script.create("test_mult_1", function(context) {
    var Mult1 = function Script(entity) {
        this.entity = entity;
        this.value = 'foo';
    };
    
    Mult1.prototype = {
        concat: function (v) {
            return v + this.value;
        }
    };

    return Mult1;
    
});

pc.script.create("test_mult_2", function(context) {
    var Mult2 = function Script(entity) {
        this.entity = entity;
        this.value = 'bar';
    };
    
    Mult2.prototype = {
        concat: function (v) {
            return v + this.value;
        }
    };

    return Mult2;
    
});
