var LoadedLater = pc.createScript('loadedLater');

LoadedLater.attributes.add('disableEntity', {type: 'boolean'});
LoadedLater.attributes.add('disableScriptComponent', {type: 'boolean'});
LoadedLater.attributes.add('disableScriptInstance', {type: 'boolean'});

LoadedLater.prototype.initialize = function() {
    window.initializeCalls.push(this.entity.getGuid() + ' initialize loadedLater');

    if (this.disableEntity) {
        this.entity.enabled = false;
    }

    if (this.disableScriptComponent) {
        this.entity.script.enabled = false;
    }

    if (this.disableScriptInstance) {
        this.entity.script.loadedLater.enabled = false;
    }
};

LoadedLater.prototype.postInitialize = function () {
    window.initializeCalls.push(this.entity.getGuid() + ' postInitialize loadedLater');
};
