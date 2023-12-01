export default class ScriptB {
    initialize() {
        window.initializeCalls.push(this.entity.getGuid() + ' initialize scriptB');
    }

    postInitialize() {
        window.initializeCalls.push(this.entity.getGuid() + ' postInitialize scriptB');
    }

    active({ entity }) {
        window.initializeCalls.push(entity.getGuid() + ' active scriptB');
    }

    inactive() {

    }

    update(dt) {
        window.initializeCalls.push(this.entity.getGuid() + ' update scriptB');
    }

    postUpdate(dt) {
        window.initializeCalls.push(this.entity.getGuid() + ' post-update scriptB');
    }

    destroy() {

    }

    // initialize() {
    //     var guid = this.entity.getGuid();
    //     console.log('sdfs', this.entity)
    //     window.initializeCalls.push(guid + ' initialize scriptA');
    //     this.entity.esmscript.on('enable', function () {
    //         window.initializeCalls.push(guid + ' enable scriptComponent scriptA');
    //     });
    //     this.entity.esmscript.on('disable', function () {
    //         window.initializeCalls.push(guid + ' disable scriptComponent scriptA');
    //     });
    //     this.entity.esmscript.on('state', function (enabled) {
    //         window.initializeCalls.push(guid + ' state scriptComponent ' + enabled + ' scriptA');
    //     });
    //     this.on('enable', function () {
    //         window.initializeCalls.push(guid + ' enable scriptA');
    //     });
    //     this.on('disable', function () {
    //         window.initializeCalls.push(guid + ' disable scriptA');
    //     });
    //     this.on('state', function (enabled) {
    //         window.initializeCalls.push(guid + ' state ' + enabled + ' scriptA');
    //     });
    //     this.on('destroy', function () {
    //         window.initializeCalls.push(this.entity.getGuid() + ' destroy scriptA');
    //     });
    // }

    // postInitialize() {
    //     window.initializeCalls.push(this.entity.getGuid() + ' postInitialize scriptA');
    // }

    // update() {
    //     window.initializeCalls.push(this.entity.getGuid() + ' update scriptA');
    // }

    // postUpdate() {
    //     window.initializeCalls.push(this.entity.getGuid() + ' postUpdate scriptA');
    // }
}
