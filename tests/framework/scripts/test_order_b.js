pc.script.create("test_order_b", function(context) {
    var Test_order_b = function (entity) {
        this.entity = entity;
        if (!this.entity.methodsByB) {
            this.entity.methodsByB = [];
        }
    };

    Test_order_b.prototype = {
        initialize: function () {
            this.entity.methodsByB.push('initialize');
        },

        onEnable: function () {
            this.entity.methodsByB.push('onEnable');
        },

        postInitialize: function () {
            this.entity.methodsByB.push('postInitialize');
        },

        update: function (dt) {
            this.entity.methodsByB.push('update');
        },

        postUpdate: function (dt) {
            this.entity.methodsByB.push('postUpdate');
        },

        onDisable: function () {
            this.entity.methodsByB.push('onDisable');
        },

        destroy: function () {
            this.entity.methodsByB.push('destroy');
        }
    };
    return Test_order_b;
});