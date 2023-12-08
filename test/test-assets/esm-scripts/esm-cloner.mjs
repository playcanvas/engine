export default class Cloner {
    initialize() {
        window.initializeCalls.push(this.entity.getGuid() + ' initialize cloner');
        const clone = this.entityToClone.clone();
        clone.name += ' - clone';
        this.app.root.addChild(clone);
    }

    postInitialize() {
        window.initializeCalls.push(this.entity.getGuid() + ' postInitialize cloner');
    }
}

Cloner.attributes = {
    entityToClone: { type: 'entity' }
};
