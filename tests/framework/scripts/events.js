pc.script.create("events", function(context) {
    var Events = function Script(entity) {
        this.entity = entity;
        this.entity.initEvents = [];
        this.entity.destroyEvents = [];
    };

    Events.prototype = {
        initialize: function () {
            this.entity.initEvents.push('initialize');
            this.on('set', this.onSet, this);
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
        },

        onSet: function (name, oldValue, newValue) {
            this.entity.setEventFired = true;
        },

        onAttributeChanged: function (name, oldValue, newValue) {
            this.entity.onAttributeChangedCalled = true;
        }
    };

    return Events;

});