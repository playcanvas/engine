import { Button, Container } from '@playcanvas/pcui/react';
import { Component } from 'react';

import { ShareDialog } from './ShareDialog.mjs';
import { iframe } from '../iframe.mjs';
import { jsx } from '../jsx.mjs';
import { logo } from '../paths.mjs';
import { buildShareUrl, getHashPath, patchState, readState } from '../url-state.mjs';
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
 * @property {boolean} fullscreen - Fullscreen state.
 * @property {boolean} hasCredits - Whether the loaded example has any credits.
 * @property {boolean} shareDialogOpen - Whether the share dialog is visible.
 * @property {string} shareUrl - URL displayed in the share dialog.
 * @property {string} shareTitle - Title used for social share intents.
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
            shareDialogOpen: false,
            shareUrl: '',
            shareTitle: ''
        };
    })();

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
        this.openShareDialog = this.openShareDialog.bind(this);
        this.closeShareDialog = this.closeShareDialog.bind(this);
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
    }

    openShareDialog() {
        const path = getHashPath().replace(/^\//, '');
        const parts = path.split('/').filter(Boolean);
        const exampleName = (parts[1] ?? parts[0] ?? '').replace(/-/g, ' ');
        const title = exampleName ? `${exampleName} - PlayCanvas Examples` : 'PlayCanvas Examples';
        this.setState({
            shareDialogOpen: true,
            shareUrl: buildShareUrl(),
            shareTitle: title
        });
    }

    closeShareDialog() {
        this.setState({ shareDialogOpen: false });
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
        const { showMiniStats, hasCredits, shareDialogOpen, shareUrl, shareTitle } = this.state;
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
                    className: 'pcui-button',
                    onClick: this.openShareDialog,
                    'aria-label': 'Share this page',
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
                },
                jsx('circle', { cx: 18, cy: 5, r: 3 }),
                jsx('circle', { cx: 6, cy: 12, r: 3 }),
                jsx('circle', { cx: 18, cy: 19, r: 3 }),
                jsx('line', { x1: 8.59, y1: 13.51, x2: 15.42, y2: 17.49 }),
                jsx('line', { x1: 15.41, y1: 6.51, x2: 8.59, y2: 10.49 })
                )),
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
            ),
            shareDialogOpen && jsx(ShareDialog, {
                url: shareUrl,
                title: shareTitle,
                onClose: this.closeShareDialog
            })
        );
    }
}

export { Menu };
