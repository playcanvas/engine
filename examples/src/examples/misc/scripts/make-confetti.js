import confetti from "https://esm.sh/canvas-confetti@1.6.0";
import * as Rotate from "./rotate.js";

export const attributes = {
    confettiSettings: {
        particleCount: { type: 'number', default: 10 }
    }
};

export default class MakeConfettiScript extends pc.EsmScriptType {
    confettiSettings = {};

    initialize() {
        this.entity.esmscript.add(Rotate);
        confetti(this.confettiSettings);
    }
}
