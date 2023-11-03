import confetti from "https://esm.sh/canvas-confetti@1.6.0"

export default class MakeConfettiScript {
    initialize() {
        confetti();
    }

    destroy() {
        console.log('destorying');
    }
}
