var postCloner = pc.createScript('postCloner');

postCloner.attributes.add('entityToClone', {type: 'entity'});

postCloner.prototype.postInitialize = function () {

    var clone = this.entityToClone.clone();

    this.app.root.addChild(clone);

    clone.enabled = true;
};
