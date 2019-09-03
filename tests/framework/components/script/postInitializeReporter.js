var postInitializeReporter = pc.createScript('postInitializeReporter');

postInitializeReporter.prototype.initialize = function () {
    console.log(this.entity.getGuid() + ' initialize postInitializeReporter');
};

postInitializeReporter.prototype.postInitialize = function () {
    window.initializeCalls.push(this.entity.getGuid() + ' postInitialize postInitializeReporter');
};
