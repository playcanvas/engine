const Cloner = pc.createScript('cloner');

Cloner.attributes.add('entityToClone', { type: 'entity' });

Cloner.prototype.initialize = function () {
    window.initializeCalls.push(`${this.entity.getGuid()} initialize cloner`);
    const clone = this.entityToClone.clone();
    clone.name += ' - clone';
    this.app.root.addChild(clone);
};

Cloner.prototype.postInitialize = function () {
    window.initializeCalls.push(`${this.entity.getGuid()} postInitialize cloner`);
};
