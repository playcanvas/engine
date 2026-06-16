// dev-only: synthesize a DOM input event so the running app's pc.Keyboard / pc.Mouse react.
// pc.Keyboard reads the legacy event.keyCode, which the KeyboardEvent constructor does NOT
// populate from its init dict — so we stamp keyCode/which after construction, else injected
// keys register as 0 and never match KEY_*. dispatched on the canvas with bubbles, so it
// reaches devices attached to the canvas, document, or window.

// only the codes whose keyCode can't be derived from the code string
const KEYCODE = {
    Space: 32,
    Enter: 13,
    Escape: 27,
    Tab: 9,
    Backspace: 8,
    ArrowLeft: 37,
    ArrowUp: 38,
    ArrowRight: 39,
    ArrowDown: 40,
    ShiftLeft: 16,
    ShiftRight: 16,
    ControlLeft: 17,
    ControlRight: 17,
    AltLeft: 18,
    AltRight: 18
};

const keyCodeFor = (code) => {
    if (!code) return 0;
    if (KEYCODE[code] !== undefined) return KEYCODE[code];
    if (code.startsWith('Key')) return code.charCodeAt(3);    // KeyW -> 'W' -> 87
    if (code.startsWith('Digit')) return code.charCodeAt(5);  // Digit1 -> '1' -> 49
    return 0;
};

const injectInput = (canvas, msg) => {
    if (msg.kind === 'key') {
        const ev = new KeyboardEvent(msg.action, { code: msg.code, key: msg.key ?? '', bubbles: true, cancelable: true });
        const kc = keyCodeFor(msg.code);
        if (kc) {
            Object.defineProperty(ev, 'keyCode', { get: () => kc });
            Object.defineProperty(ev, 'which', { get: () => kc });
        }
        canvas.dispatchEvent(ev);
    } else if (msg.kind === 'mouse') {
        canvas.dispatchEvent(new MouseEvent(msg.action, {
            clientX: msg.x ?? 0,
            clientY: msg.y ?? 0,
            movementX: msg.dx ?? 0,
            movementY: msg.dy ?? 0,
            button: msg.button ?? 0,
            buttons: msg.buttons ?? 0,
            bubbles: true,
            cancelable: true
        }));
    }
};

export { injectInput };
