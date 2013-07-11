pc.script.create("test_script", function(context) {
    var Script = function Script(entity) {
        this.entity = entity;
        this.value = 'abc';

        if (this.entity.count === undefined) {
            this.entity.count = 0;
        }
        this.entity.count++;
    };
    
    Script.prototype = {
        update: function (dt) {
            equal(this.value, 'abc');
        },

        fixedUpdate: function (dt) {
        },

        postUpdate: function (dt) {
        },

        destroy: function () {
            this.entity.destroyed = true;
            this.entity.count--;
        },

        sum: function (a, b) {
            return a + b;
        },
    
        store: function (v) {
            this.v = v;
        }
    };

    return Script;
    
});
