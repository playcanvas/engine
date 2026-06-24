// synthesize a DOM input event so the running app's pc.Keyboard / pc.Mouse / pc.TouchDevice react.
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
const INJECTED = '__playcanvasRuntimeToolsInjected';

const keyCodeFor = (code) => {
    if (!code) return 0;
    if (KEYCODE[code] !== undefined) return KEYCODE[code];
    if (code.startsWith('Key')) return code.charCodeAt(3);    // KeyW -> 'W' -> 87
    if (code.startsWith('Digit')) return code.charCodeAt(5);  // Digit1 -> '1' -> 49
    return 0;
};

// build a touch event from a list of points ({ id, x, y }). real Touch/TouchEvent (chromium, where
// the app actually runs) for fidelity; a plain Event carrying the same lists as a fallback for
// jsdom unit tests (no Touch/TouchEvent there, and pc.TouchDevice reads the list props, not types).
// on touchend/cancel the lifted points stay in changedTouches but leave touches/targetTouches.
const makeTouchEvent = (canvas, action, pts) => {
    const ending = action === 'touchend' || action === 'touchcancel';
    const real = typeof TouchEvent === 'function' && typeof Touch === 'function';
    const list = pts.map((p) => {
        const t = { identifier: p.id ?? 0, target: canvas, clientX: p.x ?? 0, clientY: p.y ?? 0, pageX: p.x ?? 0, pageY: p.y ?? 0, screenX: p.x ?? 0, screenY: p.y ?? 0, radiusX: 1, radiusY: 1, rotationAngle: 0, force: 1 };
        return real ? new Touch(t) : t;
    });
    const touches = ending ? [] : list;
    if (real) return new TouchEvent(action, { touches, targetTouches: touches, changedTouches: list, bubbles: true, cancelable: true });
    // fallback (jsdom): build in the canvas's realm — a bare `new Event` resolves to node's global
    // Event, which jsdom's dispatchEvent rejects. pc.TouchDevice reads the props below, not the type.
    const ev = /** @type {any} */ (canvas.ownerDocument.createEvent('Event'));
    ev.initEvent(action, true, true);
    ev.touches = touches;
    ev.targetTouches = touches;
    ev.changedTouches = list;
    return ev;
};

const dispatch = (canvas, ev, msg, record) => {
    Object.defineProperty(ev, INJECTED, { value: true });
    record?.(msg);
    canvas.dispatchEvent(ev);
};

const injectInput = (canvas, msg, record) => {
    if (msg.kind === 'key') {
        const ev = new KeyboardEvent(msg.action, { code: msg.code, key: msg.key ?? '', bubbles: true, cancelable: true });
        const kc = keyCodeFor(msg.code);
        if (kc) {
            Object.defineProperty(ev, 'keyCode', { get: () => kc });
            Object.defineProperty(ev, 'which', { get: () => kc });
        }
        dispatch(canvas, ev, msg, record);
    } else if (msg.kind === 'mouse') {
        dispatch(canvas, new MouseEvent(msg.action, {
            clientX: msg.x ?? 0,
            clientY: msg.y ?? 0,
            movementX: msg.dx ?? 0,
            movementY: msg.dy ?? 0,
            button: msg.button ?? 0,
            buttons: msg.buttons ?? 0,
            bubbles: true,
            cancelable: true
        }), msg, record);
    } else if (msg.kind === 'touch') {
        const pts = msg.touches ?? [{ id: msg.id ?? 0, x: msg.x ?? 0, y: msg.y ?? 0 }];
        dispatch(canvas, makeTouchEvent(canvas, msg.action, pts), msg, record);
    }
};

export { injectInput };
