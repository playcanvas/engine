//import { EsmScriptType } from "../../../../src/framework/script/esm-script-type";

export const attributes = {
    entityToClone: { type: 'entity' }
};

export default class Cloner {
    initialize() {
        window.initializeCalls.push(this.entity.getGuid() + ' initialize cloner');
        var clone = this.entityToClone.clone();
        clone.name += ' - clone';
        this.app.root.addChild(clone);
    }

    postInitialize() {
        window.initializeCalls.push(this.entity.getGuid() + ' postInitialize cloner');
    }
}