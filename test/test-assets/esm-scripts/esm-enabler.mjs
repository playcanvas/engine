import { INITIALIZE, call } from '../../framework/components/esmscript/method-util.mjs';

export const attributes = {
    entityToEnable: { type: 'entity' }
};

export default class Enabler {
    initialize() {
        call(INITIALIZE(this));
        this.entityToEnable.enabled = true;
        this.entityToEnable.esmscript.enabled = true;

        const scriptA = this.entityToEnable.esmscript.get('ScriptA');
        const scriptB = this.entityToEnable.esmscript.get('ScriptB');

        if (scriptA) {
            this.entityToEnable.esmscript.enableModule(scriptA);
            // this.entityToEnable.script.scriptA.enabled = true;
        }
        if (scriptB) {
            this.entityToEnable.esmscript.enableModule(scriptB);
            // this.entityToEnable.script.scriptB.enabled = true;
        }
    }
}
