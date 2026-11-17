/**
 * @typedef {object} SwatchOption
 * @property {string} name - The name of the option.
 * @property {string} color - The CSS color of its swatch.
 */

/**
 * @typedef {object} SwatchGroup
 * @property {string} id - The identifier of the group.
 * @property {string} label - The label of its tab.
 * @property {SwatchOption[]} options - The options.
 * @property {number} selected - The index of the selected option.
 */

/**
 * @typedef {object} Toggle
 * @property {string} id - The identifier of the toggle.
 * @property {string} label - The label.
 * @property {boolean} on - Whether the toggle is on.
 * @property {string} [icon] - The SVG markup of its icon. Toggles without an icon are shown as
 * small chips.
 * @property {string} [group] - The group of the toggle. A divider separates the toggles with icons
 * of different groups.
 */

const STYLE = `
.cs-root {
    position: absolute;
    inset: 0;
    pointer-events: none;
    color: #fff;
    font-family: Inter, system-ui, -apple-system, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
    user-select: none;
}
:where(.cs-root) button {
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}
.cs-header {
    position: absolute;
    left: 36px;
    top: 76px;
    text-shadow: 0 1px 12px rgba(0, 0, 0, 0.4);
}
.cs-eyebrow {
    font-size: 11px;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.55);
}
.cs-title {
    margin-top: 6px;
    font-size: 36px;
    font-weight: 200;
    letter-spacing: 0.06em;
}
.cs-subtitle {
    margin-top: 6px;
    font-size: 13px;
    letter-spacing: 0.04em;
    color: rgba(255, 255, 255, 0.7);
    transition: opacity 0.3s;
}
.cs-panel {
    position: absolute;
    left: 50%;
    bottom: 28px;
    transform: translateX(-50%);
    display: flex;
    align-items: stretch;
    gap: 22px;
    padding: 14px 22px 12px;
    pointer-events: auto;
    background: rgba(14, 14, 16, 0.55);
    backdrop-filter: blur(20px) saturate(140%);
    -webkit-backdrop-filter: blur(20px) saturate(140%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
}
.cs-options {
    min-width: 330px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
}
.cs-tabs {
    display: flex;
    gap: 2px;
}
.cs-tab {
    padding: 5px 12px;
    border-radius: 999px;
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.45);
    transition: color 0.2s, background 0.2s;
}
.cs-tab:hover {
    color: rgba(255, 255, 255, 0.8);
}
.cs-tab.cs-active {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
}
.cs-swatches {
    display: flex;
    gap: 12px;
    min-height: 32px;
    align-items: center;
}
.cs-swatch {
    position: relative;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background:
        radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0) 42%),
        radial-gradient(circle at 65% 80%, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0) 60%),
        var(--cs-color);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18), 0 2px 6px rgba(0, 0, 0, 0.4);
    transition: transform 0.15s;
    animation: cs-pop 0.25s backwards;
}
.cs-swatch:hover {
    transform: scale(1.1);
}
.cs-swatch::after {
    content: '';
    position: absolute;
    inset: -5px;
    border-radius: 50%;
    border: 1.5px solid #fff;
    opacity: 0;
    transform: scale(0.85);
    transition: opacity 0.2s, transform 0.2s;
}
.cs-swatch.cs-active::after {
    opacity: 1;
    transform: scale(1);
}
@keyframes cs-pop {
    from { opacity: 0; transform: scale(0.6); }
}
.cs-name {
    font-size: 12px;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.75);
}
.cs-divider {
    width: 1px;
    background: rgba(255, 255, 255, 0.1);
}
.cs-toggles {
    display: flex;
    align-items: center;
    gap: 14px;
}
.cs-toggle {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    width: 58px;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.4);
    transition: color 0.25s;
}
.cs-toggle-divider {
    align-self: stretch;
    width: 1px;
    margin: 6px 0;
    background: rgba(255, 255, 255, 0.1);
}
.cs-toggle svg {
    width: 26px;
    height: 26px;
    transition: filter 0.25s;
}
.cs-toggle:hover {
    color: rgba(255, 255, 255, 0.75);
}
.cs-toggle.cs-on {
    color: #ffb36b;
}
.cs-toggle.cs-on svg {
    filter: drop-shadow(0 0 6px rgba(255, 150, 70, 0.8));
}
.cs-chips {
    position: absolute;
    right: 24px;
    top: 72px;
    display: flex;
    gap: 6px;
    pointer-events: auto;
}
.cs-chip {
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.45);
    background: rgba(14, 14, 16, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition: color 0.2s, border-color 0.2s;
}
.cs-chip.cs-on {
    color: #fff;
    border-color: rgba(255, 255, 255, 0.35);
}
@media (max-width: 640px) {
    .cs-header { left: 18px; top: 76px; }
    .cs-title { font-size: 26px; }
    .cs-chips { top: auto; bottom: 214px; right: 50%; transform: translateX(50%); }
    .cs-panel { bottom: 14px; gap: 12px; padding: 12px 14px 10px; flex-direction: column; align-items: center; }
    .cs-divider { width: 100%; height: 1px; }
    .cs-swatches { gap: 9px; }
    .cs-swatch { width: 26px; height: 26px; }
    .cs-options { min-width: 0; }
}
`;

/**
 * A minimal car configurator overlay: a title, a panel of swatch groups selected by tabs, toggle
 * buttons, and a row of small chips. It only presents the options, and reports the choices using
 * the callbacks.
 */
class ConfiguratorUI {
    /**
     * @param {object} options - The options.
     * @param {HTMLElement} options.parent - The element to add the overlay to.
     * @param {string} options.eyebrow - The small text above the title.
     * @param {string} options.title - The title.
     * @param {SwatchGroup[]} options.groups - The swatch groups.
     * @param {Toggle[]} options.toggles - The toggles.
     * @param {(group: SwatchGroup) => void} options.onTab - Called when a tab is selected.
     * @param {(group: SwatchGroup, index: number) => void} options.onSelect - Called when a swatch
     * is selected.
     * @param {(toggle: Toggle) => void} options.onToggle - Called when a toggle is switched.
     */
    constructor({ parent, eyebrow, title, groups, toggles, onTab, onSelect, onToggle }) {
        this._groups = groups;

        /**
         * The group whose swatches are shown.
         *
         * @type {SwatchGroup|null}
         */
        this._group = null;
        this._onSelect = onSelect;

        this._style = document.createElement('style');
        this._style.textContent = STYLE;
        document.head.appendChild(this._style);

        this.root = this._element('div', 'cs-root', parent);

        const header = this._element('div', 'cs-header', this.root);
        this._element('div', 'cs-eyebrow', header).textContent = eyebrow;
        this._element('div', 'cs-title', header).textContent = title;
        this._subtitle = this._element('div', 'cs-subtitle', header);

        const panel = this._element('div', 'cs-panel', this.root);
        const options = this._element('div', 'cs-options', panel);
        const tabs = this._element('div', 'cs-tabs', options);
        this._swatches = this._element('div', 'cs-swatches', options);
        this._name = this._element('div', 'cs-name', options);

        /** @type {HTMLButtonElement[]} */
        this._tabs = groups.map((group) => {
            const tab = /** @type {HTMLButtonElement} */ (this._element('button', 'cs-tab', tabs));
            tab.textContent = group.label;
            tab.addEventListener('click', () => {
                this._showGroup(group);
                onTab(group);
            });
            return tab;
        });

        this._element('div', 'cs-divider', panel);
        const toggleRow = this._element('div', 'cs-toggles', panel);
        const chipRow = this._element('div', 'cs-chips', this.root);
        let group = toggles.find((toggle) => toggle.icon)?.group;
        toggles.forEach((toggle) => {
            if (toggle.icon && toggle.group !== group) {
                group = toggle.group;
                this._element('div', 'cs-toggle-divider', toggleRow);
            }
            const button = this._element(
                'button',
                toggle.icon ? 'cs-toggle' : 'cs-chip',
                toggle.icon ? toggleRow : chipRow
            );
            button.innerHTML = toggle.icon ? `${toggle.icon}<span>${toggle.label}</span>` : toggle.label;
            button.classList.toggle('cs-on', toggle.on);
            button.addEventListener('click', () => {
                toggle.on = !toggle.on;
                button.classList.toggle('cs-on', toggle.on);
                onToggle(toggle);
            });
        });

        this._showGroup(groups[0]);
    }

    /**
     * Sets the text below the title.
     *
     * @param {string} text - The text.
     */
    set subtitle(text) {
        this._subtitle.textContent = text;
    }

    /**
     * Gets the text below the title.
     *
     * @type {string}
     */
    get subtitle() {
        return this._subtitle.textContent;
    }

    /**
     * Selects an option of a group, without reporting it.
     *
     * @param {string} id - The identifier of the group.
     * @param {number} index - The index of the option.
     */
    select(id, index) {
        const group = this._groups.find((g) => g.id === id);
        group.selected = index;
        if (group === this._group) {
            this._showGroup(group);
        }
    }

    destroy() {
        this.root.remove();
        this._style.remove();
    }

    /**
     * @param {string} tag - The tag name.
     * @param {string} className - The class name.
     * @param {HTMLElement} parent - The parent element.
     * @returns {HTMLElement} The element.
     * @private
     */
    _element(tag, className, parent) {
        const element = document.createElement(tag);
        element.className = className;
        parent.appendChild(element);
        return element;
    }

    /**
     * @param {SwatchGroup} group - The group to show the swatches of.
     * @private
     */
    _showGroup(group) {
        this._group = group;
        this._tabs.forEach((tab, index) => tab.classList.toggle('cs-active', this._groups[index] === group));

        this._swatches.replaceChildren();
        const buttons = group.options.map((option, index) => {
            const swatch = /** @type {HTMLButtonElement} */ (this._element('button', 'cs-swatch', this._swatches));
            swatch.style.setProperty('--cs-color', option.color);
            swatch.style.animationDelay = `${index * 25}ms`;
            swatch.title = option.name;
            swatch.addEventListener('mouseenter', () => {
                this._name.textContent = option.name;
            });
            swatch.addEventListener('mouseleave', () => {
                this._name.textContent = group.options[group.selected].name;
            });
            swatch.addEventListener('click', () => {
                group.selected = index;
                buttons.forEach((button, i) => button.classList.toggle('cs-active', i === index));
                this._name.textContent = option.name;
                this._onSelect(group, index);
            });
            return swatch;
        });
        buttons[group.selected].classList.add('cs-active');
        this._name.textContent = group.options[group.selected].name;
    }
}

export { ConfiguratorUI };
