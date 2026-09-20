/** @import { PropertyRow, PropertySection } from './model.js' */

/**
 * @typedef {object} RowElements
 * @ignore
 * @property {HTMLElement} el - The row.
 * @property {HTMLElement} labelEl - The label.
 * @property {HTMLElement} valueEl - The value.
 * @property {HTMLElement|null} swatchEl - The color chip, if any.
 * @property {string} text - The value text last rendered.
 * @property {string} cls - The value class last rendered.
 * @property {*} target - The object the value links to, if any.
 * @property {HTMLElement|null} codeEl - The code block under the row, once expanded.
 * @property {HTMLElement|null} copyEl - The copy button of a code row.
 * @property {string} code - The code last rendered.
 */

/**
 * @typedef {object} SectionElements
 * @ignore
 * @property {HTMLElement} el - The section.
 * @property {HTMLElement} titleEl - The clickable title.
 * @property {HTMLElement} rowsEl - The container the rows live in.
 * @property {Map<string, RowElements>} rows - The rows by key.
 */

/**
 * @param {string} tag - The element tag.
 * @param {string} className - The class name.
 * @returns {HTMLElement} The element.
 */
function el(tag, className) {
    const element = document.createElement(tag);
    element.className = className;
    return element;
}

/**
 * A read-only property panel for any subject a model builder can describe: a node, a render pass,
 * a render target. Sections and rows are keyed and reconciled in place, so refreshing at a high
 * rate only touches the text that actually changed and never resets the scroll position or the
 * collapsed sections.
 *
 * @ignore
 */
class PropertyView {
    /**
     * The element the panel is rendered into.
     *
     * @type {HTMLElement}
     */
    container;

    /**
     * Called with the target of a value link when it is clicked.
     *
     * @type {(target: *) => void}
     */
    onSelect;

    /**
     * @type {*}
     * @private
     */
    _subject = null;

    /**
     * @type {*}
     * @private
     */
    _key = null;

    /**
     * @type {((subject: *) => PropertySection[])|null}
     * @private
     */
    _buildModel = null;

    /**
     * @type {Map<string, SectionElements>}
     * @private
     */
    _sections = new Map();

    /**
     * @type {Set<string>}
     * @private
     */
    _collapsed = new Set();

    /**
     * Keys of the code rows whose block is expanded, as section key and row key.
     *
     * @type {Set<string>}
     * @private
     */
    _expanded = new Set();

    /**
     * @type {HTMLElement|null}
     * @private
     */
    _emptyEl = null;

    /**
     * @param {HTMLElement} container - The element to render into.
     * @param {(target: *) => void} onSelect - The value link callback.
     */
    constructor(container, onSelect) {
        this.container = container;
        this.onSelect = onSelect;
        this.refresh();
    }

    /**
     * The subject being shown.
     *
     * @type {*}
     */
    get subject() {
        return this._subject;
    }

    /**
     * Shows a subject. The DOM is rebuilt only when the key changes, so a subject that is
     * recreated every frame under a stable key keeps its scroll position.
     *
     * @param {*} subject - The subject, or null to show nothing.
     * @param {(subject: *) => PropertySection[]} [buildModel] - Turns the subject into sections.
     * @param {*} [key] - Identifies the subject across refreshes. Defaults to the subject itself.
     */
    setSubject(subject, buildModel, key = subject) {
        if (key !== this._key || !subject) {
            this._key = subject ? key : null;
            this.container.textContent = '';
            this._sections.clear();
            this._emptyEl = null;
        }
        this._subject = subject;
        this._buildModel = buildModel ?? null;
        this.refresh();
    }

    /**
     * Re-reads every shown property and updates the text that changed.
     */
    refresh() {
        const subject = this._subject;

        if (!subject || !this._buildModel) {
            if (!this._emptyEl) {
                this._emptyEl = el('div', 'pci-empty');
                this._emptyEl.textContent = 'Select an item in the list above';
                this.container.appendChild(this._emptyEl);
            }
            return;
        }

        this._renderSections(this._buildModel(subject));
    }

    /**
     * @param {PropertySection[]} model - The sections to show, in order.
     * @private
     */
    _renderSections(model) {
        const seen = new Set();
        let cursor = this.container.firstChild;

        for (const section of model) {
            const elements = this._sections.get(section.key) ?? this._createSection(section);
            seen.add(section.key);

            if (elements.titleEl.textContent !== section.title) {
                elements.titleEl.textContent = section.title;
            }
            if (elements.el !== cursor) {
                this.container.insertBefore(elements.el, cursor);
            } else {
                cursor = cursor.nextSibling;
            }

            const collapsed = this._collapsed.has(section.key);
            elements.el.classList.toggle('pci-collapsed', collapsed);
            if (!collapsed) {
                this._renderRows(elements, section.rows);
            }
        }

        for (const [key, elements] of this._sections) {
            if (!seen.has(key)) {
                elements.el.remove();
                this._sections.delete(key);
            }
        }
    }

    /**
     * @param {SectionElements} section - The section.
     * @param {PropertyRow[]} rows - The rows to show, in order.
     * @private
     */
    _renderRows(section, rows) {
        const seen = new Set();
        let cursor = section.rowsEl.firstChild;

        for (const row of rows) {
            const elements = section.rows.get(row.key) ?? this._createRow(section, row);
            seen.add(row.key);

            if (elements.labelEl.textContent !== row.label) {
                elements.labelEl.textContent = row.label;
            }
            elements.el.classList.toggle('pci-indent', !!row.indent);

            const { text, cls = 'obj', target = null, swatch, code } = row.value;
            const hasCode = typeof code === 'string';
            const expanded = hasCode && this._expanded.has(`${section.key}\0${row.key}`);
            const shown = hasCode ? `${expanded ? '▾' : '▸'} ${text}` : text;
            if (elements.text !== shown) {
                elements.text = shown;
                elements.valueEl.lastChild.textContent = shown;
            }
            elements.el.classList.toggle('pci-code-row', hasCode);
            this._renderCode(section, elements, hasCode ? code : null, expanded);
            if (elements.cls !== cls) {
                elements.valueEl.classList.remove(`pci-v-${elements.cls}`);
                elements.valueEl.classList.add(`pci-v-${cls}`);
                elements.cls = cls;
            }
            if (elements.target !== target) {
                elements.target = target;
                elements.valueEl.classList.toggle('pci-link', !!target);
            }
            if (swatch) {
                if (!elements.swatchEl) {
                    elements.swatchEl = el('i', 'pci-swatch');
                    elements.valueEl.prepend(elements.swatchEl);
                }
                if (elements.swatchEl.style.background !== swatch) {
                    elements.swatchEl.style.background = swatch;
                }
            } else if (elements.swatchEl) {
                elements.swatchEl.remove();
                elements.swatchEl = null;
            }

            if (elements.el !== cursor) {
                section.rowsEl.insertBefore(elements.el, cursor);
            } else {
                cursor = cursor.nextSibling;
            }
            // the code block follows its row
            if (elements.codeEl) {
                if (elements.codeEl !== cursor) {
                    section.rowsEl.insertBefore(elements.codeEl, cursor);
                } else {
                    cursor = cursor.nextSibling;
                }
            }
        }

        for (const [key, elements] of section.rows) {
            if (!seen.has(key)) {
                elements.el.remove();
                elements.codeEl?.remove();
                section.rows.delete(key);
            }
        }
    }

    /**
     * Keeps the copy button and the expanded code block of a row in step with its value.
     *
     * @param {SectionElements} section - The section the row belongs to.
     * @param {RowElements} elements - The row.
     * @param {string|null} code - The code, or null for a row without any.
     * @param {boolean} expanded - Whether the block is shown.
     * @private
     */
    _renderCode(section, elements, code, expanded) {
        if (code === null) {
            elements.copyEl?.remove();
            elements.copyEl = null;
            elements.codeEl?.remove();
            elements.codeEl = null;
            elements.code = '';
            return;
        }

        if (!elements.copyEl) {
            elements.copyEl = el('button', 'pci-copy');
            elements.copyEl.textContent = 'Copy';
            elements.copyEl.title = 'Copy to the clipboard';
            elements.copyEl.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard?.writeText(elements.code);
                elements.copyEl.textContent = 'Copied';
                setTimeout(() => {
                    if (elements.copyEl) elements.copyEl.textContent = 'Copy';
                }, 1200);
            });
            elements.el.appendChild(elements.copyEl);
        }

        if (!expanded) {
            elements.codeEl?.remove();
            elements.codeEl = null;
            elements.code = code;
            return;
        }

        if (!elements.codeEl) {
            elements.codeEl = el('pre', 'pci-code');
            elements.code = '';
            section.rowsEl.insertBefore(elements.codeEl, elements.el.nextSibling);
        }
        if (elements.code !== code || !elements.codeEl.firstChild) {
            elements.code = code;
            elements.codeEl.textContent = '';
            for (const line of code.split('\n')) {
                const lineEl = el('span', 'pci-code-line');
                lineEl.textContent = line;
                elements.codeEl.appendChild(lineEl);
            }
        }
    }

    /**
     * @param {PropertySection} section - The section.
     * @returns {SectionElements} The new section elements.
     * @private
     */
    _createSection(section) {
        const elements = {
            el: el('div', 'pci-section'),
            titleEl: el('div', 'pci-section-title'),
            rowsEl: el('div', 'pci-rows'),
            rows: new Map()
        };
        elements.el.append(elements.titleEl, elements.rowsEl);
        if (section.collapsed) this._collapsed.add(section.key);
        elements.titleEl.addEventListener('click', () => {
            if (this._collapsed.has(section.key)) this._collapsed.delete(section.key);
            else this._collapsed.add(section.key);
            this.refresh();
        });
        this._sections.set(section.key, elements);
        return elements;
    }

    /**
     * @param {SectionElements} section - The section the row belongs to.
     * @param {PropertyRow} row - The row.
     * @returns {RowElements} The new row elements.
     * @private
     */
    _createRow(section, row) {
        const elements = {
            el: el('div', 'pci-prop'),
            labelEl: el('span', 'pci-label'),
            valueEl: el('span', 'pci-value pci-v-obj'),
            swatchEl: null,
            text: '',
            cls: 'obj',
            target: null,
            codeEl: null,
            copyEl: null,
            code: ''
        };
        elements.valueEl.appendChild(document.createTextNode(''));
        elements.el.append(elements.labelEl, elements.valueEl);
        elements.valueEl.addEventListener('click', () => {
            if (elements.target) {
                this.onSelect?.(elements.target);
            } else if (elements.el.classList.contains('pci-code-row')) {
                const key = `${section.key}\0${row.key}`;
                if (this._expanded.has(key)) this._expanded.delete(key);
                else this._expanded.add(key);
                this.refresh();
            }
        });
        section.rows.set(row.key, elements);
        return elements;
    }
}

export { PropertyView };
