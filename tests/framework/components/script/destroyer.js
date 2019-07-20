var Destroyer = pc.createScript('destroyer');

Destroyer.attributes.add('methodName', {type: 'string'});
Destroyer.attributes.add('destroyEntity', {type: 'boolean'});
Destroyer.attributes.add('destroyScriptComponent', {type: 'boolean'});
Destroyer.attributes.add('destroyScriptInstance', {type: 'boolean'});

Destroyer.prototype.initialize = function() {
    window.initializeCalls.push(this.entity.getGuid() + ' initialize destroyer');

    this.on('state', function (state) {
        window.initializeCalls.push(this.entity.getGuid() + ' state ' + state + ' destroyer');
    });
    this.on('disable', function () {
        window.initializeCalls.push(this.entity.getGuid() + ' disable destroyer');
    });
    this.on('enable', function () {
        window.initializeCalls.push(this.entity.getGuid() + ' enable destroyer');
    });
    this.on('destroy', function () {
        window.initializeCalls.push(this.entity.getGuid() + ' destroy destroyer');
    });

    if (this.methodName === 'initialize') {
        this.destroySomething();
    }
};

Destroyer.prototype.postInitialize = function () {
    window.initializeCalls.push(this.entity.getGuid() + ' postInitialize destroyer');

    if (this.methodName === 'postInitialize') {
        this.destroySomething();
    }
};

Destroyer.prototype.update = function () {
    window.initializeCalls.push(this.entity.getGuid() + ' update destroyer');

    if (!this.methodName || this.methodName === 'update')  {
        this.destroySomething();
    }
};

Destroyer.prototype.postUpdate = function () {
    window.initializeCalls.push(this.entity.getGuid() + ' postUpdate destroyer');

    if (this.methodName === 'postUpdate') {
        this.destroySomething();
    }
};


Destroyer.prototype.destroySomething = function () {
    if (this.destroyEntity) {
        return this.entity.destroy();
    }

    if (this.destroyScriptComponent) {
        return this.entity.removeComponent('script');
    }

    if (this.destroyScriptInstance) {
        if (this.entity.script.scriptA) {
            return this.entity.script.destroy('scriptA');
        }
    }
};
