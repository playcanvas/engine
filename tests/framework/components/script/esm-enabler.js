export const attributes = {
    entityToEnable: { type: 'entity' }
};

export default class Enabler {
    active({ entity }) {
        window.initializeCalls.push(entity.getGuid() + ' active enabler');
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
