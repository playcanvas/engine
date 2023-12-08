export const attributes = {
    entityToClone: { type: 'entity' }
};

export default class PostCloner {
    static attributes = attributes;

    postInitialize() {
        const clone = this.entityToClone.clone();
        this.app.root.addChild(clone);
        clone.enabled = true;
    }
}
