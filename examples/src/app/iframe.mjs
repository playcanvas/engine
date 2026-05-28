/**
 * A wrapper class for managing iframes.
 */
class IFrame {
    /**
     * @type {string}
     */
    _id;

    /**
     * @param {string} id - The iframe id.
     */
    constructor(id) {
        this._id = id;
    }

    /**
     * @type {any} - The content window.
     */
    get window() {
        const e = document.getElementById(this._id);
        if (!(e instanceof HTMLIFrameElement)) {
            console.warn('iframe doesnt exist yet.');
            return null;
        }
        return e.contentWindow;
    }

    get ready() {
        try {
            return this.window?.eval('ready === true');
        } catch (e) {}
        return false;
    }

    get path() {
        const href = this.window?.location.href ?? '';
        const pathname = href ? new URL(href).pathname : '';
        /* eslint-disable-next-line */
        const groups = /([\w-]+)_([\w-]+).html$/.exec(pathname);
        if (!groups) {
            return '';
        }

        return `/${groups[1]}/${groups[2]}`;
    }

    /**
     * @param {string} [stamp] - Cache-busting stamp.
     */
    reload(stamp = '') {
        const win = this.window;
        if (!win) {
            return;
        }
        if (!stamp) {
            win.location.reload();
            return;
        }
        const url = new URL(win.location.href);
        url.searchParams.set('t', stamp);
        win.location.href = url.href;
    }

    /**
     * @param {string} eventName - The event name.
     * @param {Record<string, any>} [detail] - The detail obj.
     */
    fire(eventName, detail = {}) {
        this.window?.dispatchEvent(new CustomEvent(eventName, { detail }));
    }
}

const iframe = new IFrame('exampleIframe');

export { iframe };
