let blocked = false;

const blockZoom = () => {
    if (blocked || !matchMedia('(pointer: coarse)').matches) {
        return;
    }

    blocked = true;
    let last = 0;

    document.addEventListener('touchmove', (event) => {
        if (event.touches.length > 1) {
            event.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('touchend', (event) => {
        const now = Date.now();
        if (now - last < 300) {
            event.preventDefault();
        }
        last = now;
    }, { passive: false });

    document.addEventListener('dblclick', event => event.preventDefault(), { passive: false });
    document.addEventListener('gesturestart', event => event.preventDefault(), { passive: false });
    document.addEventListener('gesturechange', event => event.preventDefault(), { passive: false });
    document.addEventListener('gestureend', event => event.preventDefault(), { passive: false });
};

export { blockZoom };
