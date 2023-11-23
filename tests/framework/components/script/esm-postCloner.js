// import { EsmScriptType } from "../../../../src/framework/script/esm-script-type";

export const attributes = {
    entityToClone: { type: 'entity' }
};

export default class PostCloner {
    postInitialize() {
        var clone = this.entityToClone.clone();
        this.app.root.addChild(clone);
        clone.enabled = true;
    }
}
