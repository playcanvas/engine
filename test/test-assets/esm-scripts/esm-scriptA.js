import { call } from '../../framework/components/esmscript/method-util.js';

export default class ScriptA {
    initialize() {
        call(this.entity.getGuid() + ' initialize scriptA');
    }

    postInitialize() {
        call(this.entity.getGuid() + ' postInitialize scriptA');
    }

    active() {
        call(this.entity.getGuid() + ' active scriptA');
    }

    inactive() {

    }

    update(dt) {
        call(this.entity.getGuid() + ' update scriptA');
    }

    postUpdate(dt) {
        call(this.entity.getGuid() + ' post-update scriptA');
    }

    destroy() {

    }
}
