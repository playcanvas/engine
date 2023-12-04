import { INITIALIZE, call } from '../../framework/components/esmscript/method-util.js';

export const attributes = {
    entityToEnable: { type: 'entity' }
};

export default class Enabler {
    initialize() {
        call(INITIALIZE(this));
        this.entityToEnable.enabled = true;
        this.entityToEnable.esmscript.enabled = true;
        // if (this.entityToEnable.script.scriptA) {
        //     this.entityToEnable.script.scriptA.enabled = true;
        // }
        // if (this.entityToEnable.script.scriptB) {
        //     this.entityToEnable.script.scriptB.enabled = true;
        // }
    }
}
