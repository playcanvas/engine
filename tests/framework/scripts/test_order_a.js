pc.script.create("test_order_a", function(context) {
    var Test_order_a = function (entity) {
        this.entity = entity;
        if (!this.entity.methodsByA) {
            this.entity.methodsByA = [];
        }
    };

    Test_order_a.prototype = {
        initialize: function () {
            this.entity.methodsByA.push('initialize');
        },

        onEnable: function () {
            this.entity.methodsByA.push('onEnable');
        },

        postInitialize: function () {
            this.entity.methodsByA.push('postInitialize');
        },

        update: function (dt) {
            this.entity.methodsByA.push('update');
        },

        postUpdate: function (dt) {
            this.entity.methodsByA.push('postUpdate');
        },

        onDisable: function () {
            this.entity.methodsByA.push('onDisable');
        },

        destroy: function () {
            this.entity.methodsByA.push('destroy');
        }
    };

    return Test_order_a;
});