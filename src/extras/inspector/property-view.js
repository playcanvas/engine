import { setTip } from './tooltip.js';

/** @import { Described } from './describe.js' */
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
 * @property {number} depth - How far the row is indented.
 * @property {boolean} group - Whether the row is drawn with a divider above it.
 * @property {boolean} groupEnd - Whether the row is drawn with a divider below it.
 * @property {HTMLElement|null} actionsEl - The buttons of the row, if any.
 * @property {string} actionsSignature - What the buttons last rendered, to rebuild them only on change.
 * @property {Described['actions']|null} actions - The actions the buttons run, kept current each refresh.
 * @property {HTMLElement} caretEl - The caret of a row that expands, its own click target.
 * @property {(() => void)|null} select - What clicking the row chooses, kept current each refresh.
 */

/**
 * @typedef {object} SectionElements
 * @ignore
 * @property {HTMLElement} el - The section.
 * @property {HTMLElement} titleEl - The clickable title.
 * @property {HTMLElement} rowsEl - The container the rows live in.
 * @property {Map<string, RowElements>} rows - The rows by key.
 */

// where the first indent guide sits, and how far apart the levels are, in CSS pixels
const INDENT_BASE = 8;
const INDENT_STEP = 14;

// one muted tone per level, cycling, so a deeply opened row can be read back to its parent
const INDENT_COLORS = ['#3f4a5f', '#4a4459', '#3f5450', '#55503f'];

/** @type {{ image: string, position: string }[]} */
const indentGuideCache = [];

/**
 * The background that draws one vertical guide per indent level of a row, in the manner of a code
 * editor. Rows are flat siblings, so the guides are painted per row rather than drawn around a
 * container. Built once per depth, of which there are only a handful.
 *
 * @param {number} depth - How far the row is indented.
 * @returns {{ image: string, position: string }|null} The layers and where they sit, or null when
 * the row is not indented.
 */
function indentGuides(depth) {
    if (depth <= 0) return null;
    let guides = indentGuideCache[depth];
    if (!guides) {
        const layers = [];
        const positions = [];
        for (let i = 0; i < depth; i++) {
            const color = INDENT_COLORS[i % INDENT_COLORS.length];
            layers.push(`linear-gradient(${color}, ${color})`);
            positions.push(`${INDENT_BASE + i * INDENT_STEP}px 0`);
        }
        guides = { image: layers.join(', '), position: positions.join(', ') };
        indentGuideCache[depth] = guides;
    }
    return guides;
}

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
 * rate only touches the text that actually changed and never resets the scroll position, the
 * collapsed sections or the rows opened in place.
 *
 * A value carrying `expand` opens under its own row, to any depth, and one carrying `code` opens
 * as a numbered block of text. Both are built on every refresh, so they follow the live object.
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
     * Keys of the rows opened in place, as section key and row key.
     *
     * @type {Set<string>}
     * @private
     */
    _expanded = new Set();

    /**
     * How deep a chain of expanded rows may go, in case a model ever builds a cycle.
     *
     * @type {number}
     * @private
     */
    _maxDepth = 8;

    /**
     * How far each subject was scrolled when it was last shown, so following a link to another tab
     * and coming back lands where it left off. Object keys are held weakly, so remembering where a
     * texture or an entity was read does not keep it alive.
     *
     * @type {WeakMap<object, number>}
     * @private
     */
    _scrollByObject = new WeakMap();

    /**
     * The same, for subjects identified by a key rather than by the object itself, such as the
     * render passes of a frame, which are recreated every frame.
     *
     * @type {Map<*, number>}
     * @private
     */
    _scrollByKey = new Map();

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
        const changed = key !== this._key || !subject;
        if (changed) {
            this._saveScroll(this._key);
            this._key = subject ? key : null;
            this.container.textContent = '';
            this._sections.clear();
            this._emptyEl = null;
        }
        this._subject = subject;
        this._buildModel = buildModel ?? null;
        this.refresh();

        // the rows are rebuilt by now, so the remembered position has something to scroll to
        if (changed) this.container.scrollTop = subject ? this._loadScroll(key) : 0;
    }

    /**
     * @param {*} key - The subject key to remember the current position of, if any.
     * @private
     */
    _saveScroll(key) {
        const top = this.container.scrollTop;
        if (key === null || key === undefined) return;
        if (typeof key === 'object') this._scrollByObject.set(key, top);
        else this._scrollByKey.set(key, top);
    }

    /**
     * @param {*} key - The subject key.
     * @returns {number} How far it was scrolled when last shown, or the top.
     * @private
     */
    _loadScroll(key) {
        const top = typeof key === 'object' && key !== null ?
            this._scrollByObject.get(key) : this._scrollByKey.get(key);
        return top ?? 0;
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

        for (const row of this._flatten(section.key, rows, 0, '')) {
            const elements = section.rows.get(row.key) ?? this._createRow(section, row);
            seen.add(row.key);

            if (elements.labelEl.textContent !== row.label) {
                elements.labelEl.textContent = row.label;
            }
            const depth = row.depth ?? 0;
            if (elements.depth !== depth) {
                elements.depth = depth;
                const guides = indentGuides(depth);
                elements.el.classList.toggle('pci-indent', depth > 0);
                elements.el.style.paddingLeft = depth ? `${INDENT_BASE + depth * INDENT_STEP}px` : '';
                elements.el.style.backgroundImage = guides?.image ?? '';
                elements.el.style.backgroundPosition = guides?.position ?? '';
                elements.el.style.backgroundSize = guides ? '1px 100%' : '';
                elements.el.style.backgroundRepeat = guides ? 'no-repeat' : '';
            }
            const group = !!row.group;
            if (elements.group !== group) {
                elements.group = group;
                elements.el.classList.toggle('pci-group', group);
            }
            const groupEnd = !!row.groupEnd;
            if (elements.groupEnd !== groupEnd) {
                elements.groupEnd = groupEnd;
                elements.el.classList.toggle('pci-group-end', groupEnd);
            }

            const { text, cls = 'obj', target = null, swatch, code } = row.value;
            const hasCode = typeof code === 'string';
            const expandable = hasCode || !!row.value.expand;
            const expanded = expandable && this._expanded.has(`${section.key}\0${row.key}`);
            const caret = expandable ? `${expanded ? '▾' : '▸'} ` : '';
            if (elements.caretEl.textContent !== caret) elements.caretEl.textContent = caret;
            if (elements.text !== text) {
                elements.text = text;
                elements.valueEl.lastChild.textContent = text;
            }
            elements.el.classList.toggle('pci-expandable', expandable);
            elements.select = row.value.select ?? null;
            elements.el.classList.toggle('pci-selectable', !!elements.select);
            elements.el.classList.toggle('pci-active', !!row.value.active);
            this._renderCode(section, elements, hasCode ? code : null, expanded);
            this._renderActions(elements, row.value.actions ?? null);
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
     * The rows to show for a list of model rows: each row, followed by the rows of whatever it
     * expands into while it is open. Keys are prefixed by their parent so that a label repeated at
     * two depths, such as the material of two mesh instances, stays distinct.
     *
     * @param {string} sectionKey - The key of the section being rendered.
     * @param {PropertyRow[]} rows - The rows to flatten.
     * @param {number} depth - The depth the rows sit at.
     * @param {string} prefix - The key of the row they expand from.
     * @returns {PropertyRow[]} The flattened rows.
     * @private
     */
    _flatten(sectionKey, rows, depth, prefix) {
        const out = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const key = prefix ? `${prefix}/${row.key}` : row.key;
            const rowDepth = depth + (row.depth ?? 0);
            out.push({ ...row, key, depth: rowDepth });

            const expanded = row.value.expand && this._expanded.has(`${sectionKey}\0${key}`);
            if (expanded && rowDepth < this._maxDepth) {
                let children;
                try {
                    children = row.value.expand();
                } catch (e) {
                    children = [{ key: 'error', label: '', value: { text: `<${e?.message ?? e}>`, cls: 'err' } }];
                }
                out.push(...this._flatten(sectionKey, children, rowDepth + 1, key));
            }

            // close the collection under its last entry, which is the last row that entry opened
            if (row.group && !rows[i + 1]?.group) {
                out[out.length - 1].groupEnd = true;
            }
        }
        return out;
    }

    /**
     * Keeps the buttons of a row in step with its value. The buttons are rebuilt only when their text
     * or state changes, and always run the actions of the latest refresh, whose closures hold the
     * current state.
     *
     * @param {RowElements} elements - The row.
     * @param {Described['actions']|null} actions - The actions, or null for a row without any.
     * @private
     */
    _renderActions(elements, actions) {
        elements.actions = actions;
        const signature = actions ? actions.map(action => `${action.text}:${action.disabled ? 1 : 0}`).join('|') : '';
        if (elements.actionsSignature === signature) return;
        elements.actionsSignature = signature;
        elements.actionsEl?.remove();
        elements.actionsEl = null;
        if (!actions?.length) return;

        const wrap = el('span', 'pci-actions');
        actions.forEach((action, index) => {
            const button = /** @type {HTMLButtonElement} */ (el('button', 'pci-action'));
            button.textContent = action.text;
            setTip(button, action.title ?? '');
            button.disabled = !!action.disabled;
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                elements.actions?.[index]?.run();
                this.refresh();
            });
            wrap.appendChild(button);
        });
        elements.actionsEl = wrap;
        elements.el.appendChild(wrap);
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
            setTip(elements.copyEl, 'Copy to the clipboard');
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
        // indent the block with its row, so it reads as part of the same level
        const indent = `${INDENT_BASE + elements.depth * INDENT_STEP}px`;
        if (elements.codeEl.style.marginLeft !== indent) elements.codeEl.style.marginLeft = indent;
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
            code: '',
            depth: -1,
            group: false,
            groupEnd: false,
            actionsEl: null,
            actionsSignature: '',
            actions: null,
            caretEl: el('span', 'pci-caret'),
            select: null
        };
        elements.valueEl.append(elements.caretEl, document.createTextNode(''));
        elements.el.append(elements.labelEl, elements.valueEl);
        // the whole row takes the click, so a choice can be made anywhere on it
        elements.el.addEventListener('click', (e) => {
            const expandable = elements.el.classList.contains('pci-expandable');
            const toggle = () => {
                const key = `${section.key}\0${row.key}`;
                if (this._expanded.has(key)) this._expanded.delete(key);
                else this._expanded.add(key);
                this.refresh();
            };
            // the caret always opens; elsewhere a choice wins over a link, and a link over opening,
            // which only the value reacts to
            if (expandable && e.target === elements.caretEl) {
                toggle();
            } else if (elements.select) {
                elements.select();
                this.refresh();
            } else if (elements.valueEl.contains(/** @type {Node} */ (e.target))) {
                if (elements.target) {
                    this.onSelect?.(elements.target);
                } else if (expandable) {
                    toggle();
                }
            }
        });
        section.rows.set(row.key, elements);
        return elements;
    }
}

export { PropertyView };
