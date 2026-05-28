import { Button, Container } from '@playcanvas/pcui/react';
import { Component } from 'react';

import { iframe } from '../iframe.mjs';
import { jsx } from '../jsx.mjs';
import { logo } from '../paths.mjs';
import { buildShareUrl, patchState, readState } from '../url-state.mjs';
import { getLayout } from '../utils.mjs';

/**
 * @param {() => Promise<any>} task - Async task to execute.
 * @returns {Promise<[any, any]>} Error and result tuple.
 */
const tryCatchAsync = async (task) => {
    try {
        return [null, await task()];
    } catch (err) {
        return [err, null];
    }
};

/**
 * @typedef {object} Props
 * @property {(value: boolean) => void} setShowMiniStats - The state set function .
 * @property {'mobile'|'desktop'} [layout] - Current layout.
 * @property {boolean} showCredits - Whether the desktop credits overlay is visible.
 * @property {(value: boolean) => void} setShowCredits - Set credits overlay visibility.
 */

/**
 * @typedef {object} State
 * @property {boolean} showMiniStats - Show MiniStats state.
 * @property {boolean} fullscreen - Fullscreen state.
 * @property {boolean} hasCredits - Whether the loaded example has any credits.
 * @property {boolean} shareCopied - True briefly after the share URL is copied to clipboard.
 */

/** @type {typeof Component<Props, State>} */
const TypedComponent = Component;

class Menu extends TypedComponent {
    /** @type {State} */
    state = (() => {
        const ui = readState().ui ?? {};
        return {
            showMiniStats: typeof ui.miniStats === 'boolean' ? ui.miniStats : getLayout() === 'desktop',
            fullscreen: typeof ui.fullscreen === 'boolean' ? ui.fullscreen : false,
            hasCredits: false,
            shareCopied: false
        };
    })();

    /** @type {ReturnType<typeof setTimeout> | null} */
    _shareCopiedTimer = null;

    mouseTimeout = null;

    /**
     * @param {Props} props - Component properties.
     */
    constructor(props) {
        super(props);
        this._handleKeyDown = this._handleKeyDown.bind(this);
        this._handleExampleLoad = this._handleExampleLoad.bind(this);
        this._handleMiniStats = this._handleMiniStats.bind(this);
        this.toggleMiniStats = this.toggleMiniStats.bind(this);
        this.toggleCredits = this.toggleCredits.bind(this);
        this.copyShareUrl = this.copyShareUrl.bind(this);
    }

    toggleCredits() {
        this.props.setShowCredits(!this.props.showCredits);
    }

    /** @type {EventListener | null} */
    clickFullscreenListener = null;

    resizeIframe() {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                iframe.window?.dispatchEvent(new Event('resize'));
            });
        });
    }

    /**
     * @param {boolean} value - Fullscreen state.
     * @param {boolean} [force] - Reapply state even when unchanged.
     */
    setFullscreen(value, force = false) {
        const contentDocument = document.querySelector('iframe')?.contentDocument;
        if (!contentDocument) {
            return;
        }
        if (this.clickFullscreenListener) {
            contentDocument.removeEventListener('mousemove', this.clickFullscreenListener);
            this.clickFullscreenListener = null;
        }
        const canvasContainer = document.querySelector('#canvas-container');
        const app = document.querySelector('#appInner');
        const fullscreen = app?.classList.contains('fullscreen') ?? false;
        if (!force && fullscreen === value) {
            return;
        }
        canvasContainer?.classList.toggle('fullscreen', value);
        app?.classList.toggle('fullscreen', value);
        contentDocument.getElementById('appInner')?.classList.toggle('fullscreen', value);
        if (value) {
            this.clickFullscreenListener = () => {
                app?.classList.add('active');
                if (this.mouseTimeout) {
                    window.clearTimeout(this.mouseTimeout);
                }
                // @ts-ignore
                this.mouseTimeout = setTimeout(() => {
                    app?.classList.remove('active');
                }, 2000);
            };
            contentDocument.addEventListener('mousemove', this.clickFullscreenListener);
        }
        this.resizeIframe();
    }

    toggleFullscreen() {
        const fullscreen = !this.state.fullscreen;
        this.setState({ fullscreen }, () => {
            this.setFullscreen(fullscreen);
            patchState({ ui: { fullscreen } });
        });
    }

    componentDidMount() {
        const iframe = document.querySelector('iframe');
        if (iframe) {
            iframe.contentDocument?.addEventListener('keydown', this._handleKeyDown);
        } else {
            console.warn('Menu#useEffect> iframe undefined');
        }
        document.addEventListener('keydown', this._handleKeyDown);
        window.addEventListener('exampleLoad', this._handleExampleLoad);
        window.addEventListener('miniStats', this._handleMiniStats);
    }

    componentWillUnmount() {
        const iframe = document.querySelector('iframe');
        if (iframe) {
            iframe.contentDocument?.removeEventListener('keydown', this._handleKeyDown);
            if (this.clickFullscreenListener) {
                iframe.contentDocument?.removeEventListener('mousemove', this.clickFullscreenListener);
            }
        }
        document.removeEventListener('keydown', this._handleKeyDown);
        window.removeEventListener('exampleLoad', this._handleExampleLoad);
        window.removeEventListener('miniStats', this._handleMiniStats);
        if (this._shareCopiedTimer) {
            clearTimeout(this._shareCopiedTimer);
            this._shareCopiedTimer = null;
        }
    }

    async copyShareUrl() {
        const url = buildShareUrl();
        const [err] = await tryCatchAsync(() => navigator.clipboard.writeText(url));
        if (err) {
            console.error('Failed to copy share URL', err);
            return;
        }
        this.setState({ shareCopied: true });
        if (this._shareCopiedTimer) {
            clearTimeout(this._shareCopiedTimer);
        }
        this._shareCopiedTimer = setTimeout(() => {
            this._shareCopiedTimer = null;
            this.setState({ shareCopied: false });
        }, 1500);
    }

    /**
     * @param {KeyboardEvent} e - Keyboard event.
     */
    _handleKeyDown(e) {
        const canvasContainer = document.querySelector('#canvas-container');
        if (!canvasContainer) {
            return;
        }
        if (e.key === 'Escape' && canvasContainer.classList.contains('fullscreen')) {
            this.toggleFullscreen();
        }
    }

    /**
     * @param {Event} event - exampleLoad event.
     */
    _handleExampleLoad(event) {
        this.props.setShowMiniStats(this.state.showMiniStats);
        this.setFullscreen(this.state.fullscreen, true);
        const detail = /** @type {CustomEvent<{ credits?: unknown[] }>} */ (event).detail;
        this.setState({ hasCredits: (detail?.credits?.length ?? 0) > 0 });
    }

    toggleMiniStats() {
        const value = !this.state.showMiniStats;
        this.setState({ showMiniStats: value }, () => patchState({ ui: { miniStats: this.state.showMiniStats } }));
        this.props.setShowMiniStats(value);
    }

    /**
     * @param {Event} event - MiniStats state event.
     */
    _handleMiniStats(event) {
        const customEvent = /** @type {CustomEvent<{ state: boolean }>} */ (event);
        this.setState({
            showMiniStats: !!customEvent.detail.state
        }, () => patchState({ ui: { miniStats: this.state.showMiniStats } }));
    }

    render() {
        const { showMiniStats, hasCredits, shareCopied } = this.state;
        const { layout, showCredits } = this.props;
        return jsx(
            Container,
            {
                id: 'menu'
            },
            jsx(
                Container,
                {
                    id: 'menu-buttons'
                },
                jsx('img', {
                    id: 'playcanvas-icon',
                    src: logo,
                    onClick: () => {
                        window.open('https://github.com/playcanvas/engine');
                    }
                }),
                jsx('button', {
                    type: 'button',
                    id: 'shareButton',
                    className: `pcui-button${shareCopied ? ' selected' : ''}`,
                    onClick: this.copyShareUrl,
                    'aria-label': 'Copy share link',
                    style: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }
                }, jsx('svg', {
                    viewBox: '0 0 24 24',
                    fill: 'none',
                    stroke: 'currentColor',
                    strokeWidth: 2,
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round',
                    width: 20,
                    height: 20
                }, ...(shareCopied ? [
                    jsx('polyline', { key: 'check', points: '20 6 9 17 4 12' })
                ] : [
                    jsx('circle', { key: 'c1', cx: 18, cy: 5, r: 3 }),
                    jsx('circle', { key: 'c2', cx: 6, cy: 12, r: 3 }),
                    jsx('circle', { key: 'c3', cx: 18, cy: 19, r: 3 }),
                    jsx('line', { key: 'l1', x1: 8.59, y1: 13.51, x2: 15.42, y2: 17.49 }),
                    jsx('line', { key: 'l2', x1: 15.41, y1: 6.51, x2: 8.59, y2: 10.49 })
                ]))),
                jsx(Button, {
                    icon: 'E149',
                    id: 'showMiniStatsButton',
                    class: showMiniStats ? 'selected' : undefined,
                    text: '',
                    onClick: this.toggleMiniStats
                }),
                hasCredits && layout === 'desktop' && jsx(Button, {
                    id: 'showCreditsButton',
                    class: showCredits ? 'selected' : undefined,
                    text: '',
                    onClick: this.toggleCredits
                }),
                jsx(Button, {
                    icon: 'E127',
                    text: '',
                    id: 'fullscreen-button',
                    onClick: this.toggleFullscreen.bind(this)
                })
            )
        );
    }
}

export { Menu };
