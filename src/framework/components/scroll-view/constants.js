Object.assign(pc, {
    /**
     * @enum pc.SCROLL_MODE
     * @name pc.SCROLL_MODE_CLAMP
     * @description Content does not scroll any further than its bounds.
     */
    SCROLL_MODE_CLAMP: 0,
    /**
     * @enum pc.SCROLL_MODE
     * @name pc.SCROLL_MODE_BOUNCE
     * @description Content scrolls past its bounds and then gently bounces back.
     */
    SCROLL_MODE_BOUNCE: 1,
    /**
     * @enum pc.SCROLL_MODE
     * @name pc.SCROLL_MODE_INFINITE
     * @description Content can scroll forever.
     */
    SCROLL_MODE_INFINITE: 2,

    /**
     * @enum pc.SCROLLBAR_VISIBILITY
     * @name pc.SCROLLBAR_VISIBILITY_SHOW_ALWAYS
     * @description The scrollbar will be visible all the time.
     */
    SCROLLBAR_VISIBILITY_SHOW_ALWAYS: 0,
    /**
     * @enum pc.SCROLLBAR_VISIBILITY
     * @name pc.SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED
     * @description The scrollbar will be visible only when content exceeds the size of the viewport.
     */
    SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED: 1
});
