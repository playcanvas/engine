pc.script.create("test_script", function(context) {
    var Script = function Script(entity) {
        this.entity = entity;
        this.value = 'abc';
    };
    
    Script.prototype = {
        update: function (dt) {
            equal(this.value, 'abc');
        },

        fixedUpdate: function (dt) {
        },

        postUpdate: function (dt) {
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
