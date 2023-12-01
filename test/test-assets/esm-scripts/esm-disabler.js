export const attributes = {
    disableEntity: { type: 'boolean' },
    disableScriptComponent: { type: 'boolean' },
    disableScriptInstance: { type: 'boolean' }
};

export default class Disabler {
    active({ entity }) {
        window.initializeCalls.push(entity.getGuid() + ' active disabler');

        if (this.disableEntity) {
            entity.enabled = false;
        }

        if (this.disableScriptComponent) {
            entity.script.enabled = false;
        }

        if (this.disableScriptInstance) {
            if (entity.script.scriptA) {
                entity.script.scriptA.enabled = false;
            }

            if (entity.script.scriptB) {
                entity.script.scriptB.enabled = false;
            }
        }
    }

    postInitialize() {
        window.initializeCalls.push(this.entity.getGuid() + ' postInitialize disabler');
    }
}
