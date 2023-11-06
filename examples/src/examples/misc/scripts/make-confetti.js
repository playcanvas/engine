import confetti from "https://esm.sh/canvas-confetti@1.6.0"

export const attributes = {
    particleCount: { type: 'number', default: 10 }
};

export default class MakeConfettiScript {
    initialize() {
        confetti(this);
    }
}
