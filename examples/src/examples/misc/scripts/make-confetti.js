import confetti from "https://esm.sh/canvas-confetti@1.6.0"

export const attributes = {
    confettiSettings: {
        particleCount: { type: 'number', default: 10 }
    }
};

export default class MakeConfettiScript extends pc.EsmScriptType {
    confettiSettings = {};

    initialize() {
        confetti(this.confettiSettings);
    }
}
