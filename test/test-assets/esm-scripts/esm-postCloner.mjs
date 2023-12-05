export const attributes = {
    entityToClone: { type: 'entity' }
};

export default class PostCloner {
    postInitialize() {
        const clone = this.entityToClone.clone();
        this.app.root.addChild(clone);
        clone.enabled = true;
    }
}
