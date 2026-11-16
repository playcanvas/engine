/**
 * For each element, the number of input handlers that need its `touch-action` style to be `none`,
 * and the element's inline value and priority before the first of them set it. Several handlers
 * often share one canvas, such as a touch device, camera controls and a gizmo, and they can attach
 * and detach in any order.
 *
 * @type {WeakMap<Element, { count: number, value: string, priority: string }>}
 */
const users = new WeakMap();

/**
 * Sets the `touch-action` style of an element to `none`, so the browser does not take a touch on
 * the element as a page scroll or zoom, and cancel it. Without it, a page cannot stop this for
 * pointer events, and touch events stop being cancelable once a scroll starts. Each call must be
 * matched by a call to {@link releaseTouchAction}.
 *
 * @param {Element} element - The element.
 * @ignore
 */
function acquireTouchAction(element) {
    const style = /** @type {HTMLElement} */ (element).style;
    if (!style) {
        return;
    }

    const entry = users.get(element);
    if (entry) {
        entry.count++;
        return;
    }

    users.set(element, {
        count: 1,
        value: style.touchAction,
        priority: style.getPropertyPriority('touch-action')
    });
    style.touchAction = 'none';
}

/**
 * Releases a call to {@link acquireTouchAction}. The element's previous inline `touch-action`,
 * including an `!important` priority, is restored when the last handler releases it.
 *
 * @param {Element} element - The element.
 * @ignore
 */
function releaseTouchAction(element) {
    const entry = users.get(element);
    if (!entry) {
        return;
    }

    entry.count--;
    if (entry.count === 0) {
        users.delete(element);
        /** @type {HTMLElement} */ (element).style.setProperty('touch-action', entry.value, entry.priority);
    }
}

export { acquireTouchAction, releaseTouchAction };
