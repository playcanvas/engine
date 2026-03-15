const ScriptB = pc.createScript('scriptB');

ScriptB.prototype.initialize = function () {
    const guid = this.entity.getGuid();
    window.initializeCalls.push(`${guid} initialize scriptB`);
    this.entity.script.on('enable', () => {
        window.initializeCalls.push(`${guid} enable scriptB`);
    });
    this.entity.script.on('disable', () => {
        window.initializeCalls.push(`${guid} disable scriptB`);
    });
    this.entity.script.on('state', (enabled) => {
        window.initializeCalls.push(`${guid} state ${enabled} scriptB`);
    });
    this.on('destroy', function () {
        window.initializeCalls.push(`${this.entity.getGuid()} destroy scriptB`);
    });
};

ScriptB.prototype.postInitialize = function () {
    window.initializeCalls.push(`${this.entity.getGuid()} postInitialize scriptB`);
};

ScriptB.prototype.update = function () {
    window.initializeCalls.push(`${this.entity.getGuid()} update scriptB`);
};

ScriptB.prototype.postUpdate = function () {
    window.initializeCalls.push(`${this.entity.getGuid()} postUpdate scriptB`);
};
