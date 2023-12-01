export const attributes = {
    entityToEnable: { type: 'entity' }
};

export default class Enabler {
    initialize() {
        window.initializeCalls.push(this.entity.getGuid() + ' initialize enabler');
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
