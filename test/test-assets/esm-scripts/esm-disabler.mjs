import { INITIALIZE, POST_INITIALIZE, call } from '../../framework/components/esmscript/method-util.mjs';

const attributes = {
    disableEntity: { type: 'boolean' },
    disableScriptComponent: { type: 'boolean' },
    disableScriptInstance: { type: 'boolean' }
};

export default class Disabler {
    static attributes = attributes;

    initialize() {
        call(INITIALIZE(this));

        if (this.disableEntity) {
            this.entity.enabled = false;
        }

        if (this.disableScriptComponent) {
            this.entity.script.enabled = false;
        }

        if (this.disableScriptInstance) {
            if (this.entity.script.scriptA) {
                this.entity.script.scriptA.enabled = false;
            }

            if (this.entity.script.scriptB) {
                this.entity.script.scriptB.enabled = false;
            }
        }
    }

    postInitialize() {
        call(POST_INITIALIZE(this));
    }
}
