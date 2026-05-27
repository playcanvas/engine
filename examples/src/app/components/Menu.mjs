import { Button, Container } from '@playcanvas/pcui/react';
import { Component } from 'react';

import { iframe } from '../iframe.mjs';
import { jsx } from '../jsx.mjs';
import { logo } from '../paths.mjs';
import { getLayout } from '../utils.mjs';

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
 * @property {boolean} hasCredits - Whether the loaded example has any credits.
 */

/** @type {typeof Component<Props, State>} */
const TypedComponent = Component;

class Menu extends TypedComponent {
    /** @type {State} */
    state = {
        showMiniStats: getLayout() === 'desktop',
        hasCredits: false
    };

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

    toggleFullscreen() {
        const contentDocument = document.querySelector('iframe')?.contentDocument;
        if (!contentDocument) {
            return;
        }
        if (this.clickFullscreenListener) {
            contentDocument.removeEventListener('mousemove', this.clickFullscreenListener);
        }
        document.querySelector('#canvas-container')?.classList.toggle('fullscreen');
        const app = document.querySelector('#appInner');
        app?.classList.toggle('fullscreen');
        contentDocument.getElementById('appInner')?.classList.toggle('fullscreen');
        if (app?.classList.contains('fullscreen')) {
            this.clickFullscreenListener = () => {
                app?.classList.add('active');
                if (this.mouseTimeout) {
                    window.clearTimeout(this.mouseTimeout);
                }
                // @ts-ignore
                this.mouseTimeout = setTimeout(() => {
                    app.classList.remove('active');
                }, 2000);
            };
            contentDocument.addEventListener('mousemove', this.clickFullscreenListener);
        }
        this.resizeIframe();
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
        }
        document.removeEventListener('keydown', this._handleKeyDown);
        window.removeEventListener('exampleLoad', this._handleExampleLoad);
        window.removeEventListener('miniStats', this._handleMiniStats);
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
        const detail = /** @type {CustomEvent<{ credits?: unknown[] }>} */ (event).detail;
        this.setState({ hasCredits: (detail?.credits?.length ?? 0) > 0 });
    }

    toggleMiniStats() {
        const value = !this.state.showMiniStats;
        this.setState({ showMiniStats: value });
        this.props.setShowMiniStats(value);
    }

    /**
     * @param {Event} event - MiniStats state event.
     */
    _handleMiniStats(event) {
        const customEvent = /** @type {CustomEvent<{ state: boolean }>} */ (event);
        this.setState({ showMiniStats: !!customEvent.detail.state });
    }

    render() {
        const { showMiniStats, hasCredits } = this.state;
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
                jsx(Button, {
                    icon: 'E256',
                    text: '',
                    onClick: () => {
                        const url = new URL(location.href);
                        const link = `${url.origin}/share/${url.hash.slice(2).replace(/\//g, '_')}`;
                        const tweetText = encodeURI(`Check out this @playcanvas engine example! ${link}`);
                        window.open(`https://twitter.com/intent/tweet?text=${tweetText}`);
                    }
                }),
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
