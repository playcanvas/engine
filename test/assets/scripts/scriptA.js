const ScriptA = pc.createScript('scriptA');

ScriptA.prototype.initialize = function () {
    const guid = this.entity.guid;
    window.initializeCalls.push(`${guid} initialize scriptA`);
    this.entity.script.on('enable', () => {
        window.initializeCalls.push(`${guid} enable scriptComponent scriptA`);
    });
    this.entity.script.on('disable', () => {
        window.initializeCalls.push(`${guid} disable scriptComponent scriptA`);
    });
    this.entity.script.on('state', (enabled) => {
        window.initializeCalls.push(`${guid} state scriptComponent ${enabled} scriptA`);
    });
    this.on('enable', () => {
        window.initializeCalls.push(`${guid} enable scriptA`);
    });
    this.on('disable', () => {
        window.initializeCalls.push(`${guid} disable scriptA`);
    });
    this.on('state', (enabled) => {
        window.initializeCalls.push(`${guid} state ${enabled} scriptA`);
    });
    this.on('destroy', function () {
        window.initializeCalls.push(`${this.entity.guid} destroy scriptA`);
    });
};

ScriptA.prototype.postInitialize = function () {
    window.initializeCalls.push(`${this.entity.guid} postInitialize scriptA`);
};

ScriptA.prototype.update = function () {
    window.initializeCalls.push(`${this.entity.guid} update scriptA`);
};

ScriptA.prototype.postUpdate = function () {
    window.initializeCalls.push(`${this.entity.guid} postUpdate scriptA`);
};
