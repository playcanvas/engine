const postInitializeReporter = pc.createScript('postInitializeReporter');

postInitializeReporter.prototype.initialize = function () {
    console.log(`${this.entity.guid} initialize postInitializeReporter`);
};

postInitializeReporter.prototype.postInitialize = function () {
    window.initializeCalls.push(`${this.entity.guid} postInitialize postInitializeReporter`);
};
