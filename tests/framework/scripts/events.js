pc.script.create("events", function(context) {
    var Events = function Script(entity) {
        this.entity = entity;
        this.entity.initEvents = [];
        this.entity.destroyEvents = [];
    };

    Events.prototype = {
        initialize: function () {
            this.entity.initEvents.push('initialize');
        },

        postInitialize: function () {
            this.entity.initEvents.push('postInitialize');
        },

        onEnable: function () {
            this.entity.initEvents.push('onEnable');
        },

        onDisable: function () {
            this.entity.destroyEvents.push('onDisable');
        },

        destroy: function () {
            this.entity.destroyEvents.push('destroy');
        }
    };

    return Events;

});