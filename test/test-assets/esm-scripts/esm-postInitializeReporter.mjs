// import { EsmScriptType } from "../../../../src/framework/script/esm-script-type";

export default class PostInitializeReporter {
    initialize() {
        console.log(this.entity.getGuid() + ' initialize postInitializeReporter');
    }

    postInitialize() {
        window.initializeCalls.push(this.entity.getGuid() + ' postInitialize postInitializeReporter');
    }
}
