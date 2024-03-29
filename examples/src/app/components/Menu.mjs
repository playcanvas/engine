import { Component } from 'react';
import { Button, Container } from '@playcanvas/pcui/react';

import { jsx } from '../jsx.mjs';
import { logo } from '../paths.mjs';

/**
 * @typedef {object} Props
 * @property {(value: boolean) => void} setShowMiniStats - The state set function .
 */

// eslint-disable-next-line jsdoc/require-property
/**
 * @typedef {object} State
 */

/** @type {typeof Component<Props, State>} */
const TypedComponent = Component;

class Menu extends TypedComponent {
    mouseTimeout = null;

    /**
     * @param {Props} props - Component properties.
     */
    constructor(props) {
        super(props);
        this._handleKeyDown = this._handleKeyDown.bind(this);
        this._handleExampleLoad = this._handleExampleLoad.bind(this);
    }

    /** @type {EventListener | null} */
    clickFullscreenListener = null;

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
    }

    componentWillUnmount() {
        const iframe = document.querySelector('iframe');
        if (iframe) {
            iframe.contentDocument?.removeEventListener('keydown', this._handleKeyDown);
        }
        document.removeEventListener('keydown', this._handleKeyDown);
        window.removeEventListener('exampleLoad', this._handleExampleLoad);
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

    _handleExampleLoad() {
        const showMiniStatsBtn = document.getElementById('showMiniStatsButton');
        if (!showMiniStatsBtn) {
            return;
        }
        const selected = showMiniStatsBtn.classList.contains('selected');
        this.props.setShowMiniStats(selected);
    }

    render() {
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
                    class: 'selected',
                    text: '',
                    onClick: () => {
                        document.getElementById('showMiniStatsButton')?.classList.toggle('selected');
                        const selected = document.getElementById('showMiniStatsButton')?.classList.contains('selected');
                        this.props.setShowMiniStats(!!selected);
                    }
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
