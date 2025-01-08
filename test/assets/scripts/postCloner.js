const postCloner = pc.createScript('postCloner');

postCloner.attributes.add('entityToClone', { type: 'entity' });

postCloner.prototype.postInitialize = function () {

    const clone = this.entityToClone.clone();

    this.app.root.addChild(clone);

    clone.enabled = true;
};
