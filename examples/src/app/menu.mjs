import { Component } from 'react';
import { Button, Container } from '@playcanvas/pcui/react';
import { jsx } from './jsx.mjs';
import { logo } from '../assetPath.mjs';
//import { iframeShowStats } from './code-editor.mjs';

/**
 * @typedef {object} Props
 * @property {(value: boolean) => void} setShowMiniStats
 */

/**
 * @typedef {object} State
 */

/** @type {typeof Component<Props, State>} */
const TypedComponent = Component;

class Menu extends TypedComponent {
    mouseTimeout = null;

    /**
     * @param {Props} props 
     */
    constructor(props) {
        super(props);
        this.handleExampleLoad = this.handleExampleLoad.bind(this);
    }
    /** @type {EventListener | null} */
    clickFullscreenListener = null;
    toggleFullscreen() {
        if (this.clickFullscreenListener) {
            document.querySelector('iframe').contentDocument.removeEventListener('mousemove', this.clickFullscreenListener);
        }
        document.querySelector('#canvas-container').classList.toggle('fullscreen');
        const app = document.querySelector('#appInner');
        app.classList.toggle('fullscreen');
        document.querySelector('iframe').contentDocument.getElementById('appInner').classList.toggle('fullscreen');
        if (app.classList.contains('fullscreen')) {
            this.clickFullscreenListener = () => {
                app.classList.add('active');
                if (this.mouseTimeout) {
                    window.clearTimeout(this.mouseTimeout);
                }
                this.mouseTimeout = setTimeout(() => {
                    app.classList.remove('active');
                }, 2000);
            };
            document.querySelector('iframe').contentDocument.addEventListener('mousemove', this.clickFullscreenListener);
        }
    };

    componentDidMount() {
        const escapeKeyEvent = (e) => {
            if (e.keyCode === 27 && document.querySelector('#canvas-container').classList.contains('fullscreen')) {
                this.toggleFullscreen();
            }
        };
        const iframe = document.querySelector('iframe');
        if (iframe) {
            iframe.contentDocument.addEventListener('keydown', escapeKeyEvent);
        } else {
            console.warn('Menu#useEffect> iframe undefined');
        }
        document.addEventListener('keydown', escapeKeyEvent);
        window.addEventListener('exampleLoad', this.handleExampleLoad);
    }

    handleExampleLoad() {
        const selected = document.getElementById('showMiniStatsButton').classList.contains('selected');
        // console.log('Menu#handleExampleLoad, selected:', selected);
        this.props.setShowMiniStats(selected);
    }

    render() {
        return jsx(
            Container,
            {
                id: 'menu'
            },
            jsx(Container,
                {
                    id: 'menu-buttons'
                },
                jsx("img", {
                    id: 'playcanvas-icon',
                    src: logo,
                    onClick: () => {
                        window.open("https://github.com/playcanvas/engine");
                    }
                }),
                jsx(Button, {
                    icon: 'E256',
                    text: '',
                    onClick: () => {
                        const tweetText = encodeURI(`Check out this @playcanvas engine example! ${location.href.replace('#/', '')}`);
                        window.open(`https://twitter.com/intent/tweet?text=${tweetText}`);
                    }
                }),
                jsx(Button, {
                    icon: 'E149',
                    id: 'showMiniStatsButton',
                    class: 'selected',
                    text: '',
                    onClick: () => {
                        document.getElementById('showMiniStatsButton').classList.toggle('selected');
                        const selected = document.getElementById('showMiniStatsButton').classList.contains('selected');
                        this.props.setShowMiniStats(selected);

                        
                    },
                }),
                jsx(Button, {
                    icon: 'E127', text: '', id: 'fullscreen-button', onClick: this.toggleFullscreen.bind(this)
                })
            )
        );
    }
};

export { Menu };
