var Enabler = pc.createScript('enabler');

Enabler.attributes.add('entityToEnable', {type: 'entity'});

Enabler.prototype.initialize = function() {
    window.initializeCalls.push(this.entity.getGuid() + ' initialize enabler');
    this.entityToEnable.enabled = true;
    this.entityToEnable.script.enabled = true;
    if (this.entityToEnable.script.scriptA) {
        this.entityToEnable.script.scriptA.enabled = true;
    }
    if (this.entityToEnable.script.scriptB) {
        this.entityToEnable.script.scriptB.enabled = true;
    }

};

Enabler.prototype.postInitialize = function () {
    window.initializeCalls.push(this.entity.getGuid() + ' postInitialize enabler');
};
