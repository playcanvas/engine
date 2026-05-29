import { Component } from 'react';

import { jsx } from '../jsx.mjs';

const FB_PATH = 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z';
const X_PATH = 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z';
const LI_PATH = 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z';
const RD_PATH = 'M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.04 1.604a3.4 3.4 0 0 1 .045.572c0 2.908-3.385 5.261-7.557 5.261-4.172 0-7.557-2.353-7.557-5.261 0-.193.013-.384.04-.572-.604-.27-1.036-.886-1.036-1.604 0-.967.785-1.753 1.753-1.753.477 0 .9.182 1.207.49 1.187-.85 2.83-1.41 4.643-1.49l.89-4.18a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.111-.714zM9.25 12c-.69 0-1.25.56-1.25 1.25 0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z';

/**
 * @typedef {object} Social
 * @property {string} key - Platform key.
 * @property {string} name - Display name.
 * @property {string} color - Background color hex.
 * @property {string} path - SVG path.
 * @property {(u: string, t: string) => string} url - Builds the share-intent URL.
 */

/** @type {Social[]} */
const SOCIALS = [
    { key: 'facebook', name: 'Facebook', color: '#1877F2', path: FB_PATH, url: u => `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { key: 'reddit', name: 'Reddit', color: '#FF4500', path: RD_PATH, url: (u, t) => `https://www.reddit.com/submit?url=${u}&title=${t}` },
    { key: 'x', name: 'X', color: '#000000', path: X_PATH, url: (u, t) => `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
    { key: 'linkedin', name: 'LinkedIn', color: '#0A66C2', path: LI_PATH, url: u => `https://www.linkedin.com/sharing/share-offsite/?url=${u}` }
];

/**
 * @param {() => Promise<any>} task - Async task.
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
 * @property {string} url - Shareable URL.
 * @property {string} title - Page title for share intents.
 * @property {() => void} onClose - Called when the dialog should close.
 */

/**
 * @typedef {object} State
 * @property {boolean} copied - True briefly after the URL is copied.
 */

/** @type {typeof Component<Props, State>} */
const TypedComponent = Component;

class ShareDialog extends TypedComponent {
    /** @type {State} */
    state = { copied: false };

    /** @type {ReturnType<typeof setTimeout> | null} */
    _copiedTimer = null;

    /**
     * @param {Props} props - Props.
     */
    constructor(props) {
        super(props);
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onBackdropClick = this._onBackdropClick.bind(this);
        this._onCopy = this._onCopy.bind(this);
    }

    componentDidMount() {
        document.addEventListener('keydown', this._onKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this._onKeyDown);
        if (this._copiedTimer) {
            clearTimeout(this._copiedTimer);
            this._copiedTimer = null;
        }
    }

    /**
     * @param {KeyboardEvent} e - Event.
     */
    _onKeyDown(e) {
        if (e.key === 'Escape') {
            this.props.onClose();
        }
    }

    /**
     * @param {{ target: EventTarget | null, currentTarget: EventTarget | null }} e - Event.
     */
    _onBackdropClick(e) {
        if (e.target === e.currentTarget) {
            this.props.onClose();
        }
    }

    async _onCopy() {
        const [err] = await tryCatchAsync(() => navigator.clipboard.writeText(this.props.url));
        if (err) {
            console.error('Failed to copy share URL', err);
            return;
        }
        this.setState({ copied: true });
        if (this._copiedTimer) {
            clearTimeout(this._copiedTimer);
        }
        this._copiedTimer = setTimeout(() => {
            this._copiedTimer = null;
            this.setState({ copied: false });
        }, 1500);
    }

    /**
     * @param {typeof SOCIALS[number]} social - Social platform config.
     */
    _onSocialClick(social) {
        const u = encodeURIComponent(this.props.url);
        const t = encodeURIComponent(this.props.title);
        const intent = social.url(u, t);
        window.open(intent, '_blank', 'noopener,noreferrer,width=600,height=400');
    }

    render() {
        const { url, onClose } = this.props;
        const { copied } = this.state;
        return jsx('div', {
            className: 'share-dialog-backdrop',
            onClick: this._onBackdropClick
        }, jsx('div', {
            className: 'share-dialog',
            role: 'dialog',
            'aria-modal': true,
            'aria-label': 'Share this page'
        },
        jsx('div', { className: 'share-dialog-header' },
            jsx('h2', { className: 'share-dialog-title' }, 'Share this page'),
            jsx('button', {
                type: 'button',
                className: 'share-dialog-close',
                onClick: onClose,
                'aria-label': 'Close'
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
            jsx('line', { x1: 18, y1: 6, x2: 6, y2: 18 }),
            jsx('line', { x1: 6, y1: 6, x2: 18, y2: 18 })
            ))
        ),
        jsx('div', { className: 'share-dialog-socials' },
            ...SOCIALS.map(social => jsx('button', {
                key: social.key,
                type: 'button',
                className: 'share-dialog-social',
                style: { backgroundColor: social.color },
                onClick: () => this._onSocialClick(social),
                'aria-label': `Share on ${social.name}`
            }, jsx('svg', {
                viewBox: '0 0 24 24',
                fill: 'currentColor',
                width: 22,
                height: 22
            }, jsx('path', { d: social.path }))))
        ),
        jsx('div', { className: 'share-dialog-divider' },
            jsx('span', null, 'OR COPY LINK')
        ),
        jsx('div', { className: 'share-dialog-copy' },
            jsx('input', {
                className: 'share-dialog-input',
                type: 'text',
                readOnly: true,
                value: url,
                onFocus: e => e.target.select()
            }),
            jsx('button', {
                type: 'button',
                className: `share-dialog-copy-button${copied ? ' copied' : ''}`,
                onClick: this._onCopy
            },
            jsx('svg', {
                viewBox: '0 0 24 24',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 2,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                width: 16,
                height: 16
            }, copied ?
                jsx('polyline', { points: '20 6 9 17 4 12' }) :
                [
                    jsx('rect', { key: 'r', x: 9, y: 9, width: 13, height: 13, rx: 2, ry: 2 }),
                    jsx('path', { key: 'p', d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' })
                ]
            ),
            jsx('span', null, copied ? 'Copied' : 'Copy')
            )
        )
        ));
    }
}

export { ShareDialog };
