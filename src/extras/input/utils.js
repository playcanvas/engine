// https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/movementX
export const movementState = () => {
    const state = new Map();
    return {
        down: (/** @type {PointerEvent} */ event) => {
            state.set(event.pointerId, [event.screenX, event.screenY]);
        },
        move: (/** @type {PointerEvent} */ event) => {
            if (!state.has(event.pointerId)) {
                return [0, 0];
            }
            const prev = state.get(event.pointerId);
            const mvX = event.screenX - prev[0];
            const mvY = event.screenY - prev[1];
            prev[0] = event.screenX;
            prev[1] = event.screenY;
            return [mvX, mvY];
        },
        up: (/** @type {PointerEvent} */ event) => {
            state.delete(event.pointerId);
        }
    };
};
