/**
 * @typedef {object} ListCell
 * @property {string} text - The text.
 * @property {string} [cls] - Extra classes, e.g. 'pci-cell-name'.
 * @property {string} [title] - A tooltip.
 * @property {*} [target] - A link target. Clicking the cell calls {@link ListView#onLink} with it
 * instead of selecting the row.
 * @property {boolean} [toggle] - Render the cell as a checkbox instead of text. Changing it calls
 * {@link ListView#onToggle} with the row's item and the new state, without selecting the row.
 * @property {boolean} [checked] - The state of a checkbox cell.
 * @property {boolean} [disabled] - Whether a checkbox cell is disabled.
 */

/**
 * @typedef {object} ListRow
 * @property {string} key - A key unique within the list, stable across refreshes.
 * @property {*} item - The subject selected when the row is clicked.
 * @property {string} name - The text the filter matches against.
 * @property {ListCell[]} cells - The cells, left to right.
 * @property {number} [indent] - The indentation level.
 * @property {boolean} [dim] - Whether the row is shown dimmed.
 * @property {string} [title] - A tooltip for the whole row.
 */

/**
 * @typedef {object} ListEntry
 * @property {HTMLElement} el - The row element.
 * @property {HTMLElement[]} cells - The cell elements.
 * @property {ListRow} row - The row last rendered.
 * @property {number} indent - The indentation last rendered.
 */

/**
 * A flat, selectable list of rows with cells. Rows are keyed and reconciled in place, so a list
 * rebuilt from scratch a couple of times a second keeps its selection and scroll position and only
 * touches the text that changed.
 */
class ListView {
    /**
     * The element the list is rendered into.
     *
     * @type {HTMLElement}
     */
    container;

    /**
     * Called with the selected item and its row key, or null when the selection is cleared.
     *
     * @type {(item: *, key: string|null) => void}
     */
    onSelect;

    /**
     * Called with the target of a link cell when it is clicked.
     *
     * @type {((target: *) => void)|undefined}
     */
    onLink;

    /**
     * Called with a row's item and the new state when one of its checkbox cells changes.
     *
     * @type {((item: *, checked: boolean) => void)|undefined}
     */
    onToggle;

    /**
     * Case-insensitive filter on the rows' names.
     *
     * @type {string}
     */
    filter = '';

    /**
     * The key of the selected row, or null.
     *
     * @type {string|null}
     */
    selectedKey = null;

    /**
     * The number of rows shown after filtering, as of the last render.
     *
     * @type {number}
     */
    visibleCount = 0;

    /**
     * @type {ListRow[]}
     * @private
     */
    _rows = [];

    /**
     * @type {Map<string, ListEntry>}
     * @private
     */
    _entries = new Map();

    /**
     * @param {HTMLElement} container - The element to render into.
     * @param {(item: *, key: string|null) => void} onSelect - The selection callback.
     * @param {(target: *) => void} [onLink] - The link callback.
     */
    constructor(container, onSelect, onLink) {
        this.container = container;
        this.onSelect = onSelect;
        this.onLink = onLink;
    }

    /**
     * The number of rows before filtering.
     *
     * @type {number}
     */
    get rowCount() {
        return this._rows.length;
    }

    /**
     * The item of the selected row, or null when nothing is selected or the row is gone.
     *
     * @type {*}
     */
    get selected() {
        return this._rows.find(row => row.key === this.selectedKey)?.item ?? null;
    }

    /**
     * Replaces the rows and re-renders.
     *
     * @param {ListRow[]} rows - The rows, in display order.
     */
    setRows(rows) {
        this._rows = rows;
        this.render();
    }

    /**
     * Selects a row by key.
     *
     * @param {string|null} key - The row key, or null to clear the selection.
     */
    select(key) {
        this.selectedKey = key;
        this.render();
        const row = this._rows.find(r => r.key === key);
        this._entries.get(key)?.el.scrollIntoView?.({ block: 'nearest' });
        this.onSelect?.(row?.item ?? null, row ? key : null);
    }

    /**
     * Selects the first row whose item is the given object.
     *
     * @param {*} item - The item.
     * @returns {boolean} Whether a row was found.
     */
    selectItem(item) {
        const row = this._rows.find(r => r.item === item);
        if (!row) return false;
        this.select(row.key);
        return true;
    }

    /**
     * Synchronizes the DOM with the rows.
     */
    render() {
        const filter = this.filter.trim().toLowerCase();
        const seen = new Set();
        let cursor = this.container.firstChild;
        let visible = 0;

        for (const row of this._rows) {
            const entry = this._entries.get(row.key) ?? this._createEntry(row);
            entry.row = row;
            seen.add(row.key);

            this._syncCells(entry, row.cells);

            const shown = !filter || row.name.toLowerCase().includes(filter);
            const display = shown ? '' : 'none';
            if (entry.el.style.display !== display) entry.el.style.display = display;
            if (shown) visible++;

            const indent = row.indent ?? 0;
            if (entry.indent !== indent) {
                entry.indent = indent;
                entry.el.style.paddingLeft = `${indent * 14 + 6}px`;
            }
            const title = row.title ?? '';
            if (entry.el.title !== title) entry.el.title = title;

            entry.el.classList.toggle('pci-selected', row.key === this.selectedKey);
            entry.el.classList.toggle('pci-dim', !!row.dim);

            if (entry.el !== cursor) {
                this.container.insertBefore(entry.el, cursor);
            } else {
                cursor = cursor.nextSibling;
            }
        }

        for (const [key, entry] of this._entries) {
            if (!seen.has(key)) {
                entry.el.remove();
                this._entries.delete(key);
            }
        }

        this.visibleCount = visible;
    }

    /**
     * @param {ListEntry} entry - The row entry.
     * @param {ListCell[]} cells - The cells to show.
     * @private
     */
    _syncCells(entry, cells) {
        while (entry.cells.length > cells.length) {
            entry.cells.pop().remove();
        }

        cells.forEach((cell, i) => {
            let cellEl = entry.cells[i];
            const wantInput = !!cell.toggle;
            if (cellEl && (cellEl.tagName === 'INPUT') !== wantInput) {
                cellEl.remove();
                cellEl = undefined;
            }
            if (!cellEl) {
                cellEl = wantInput ? this._createToggleCell(entry, i) : this._createTextCell(entry, i);
                const next = entry.cells[i + 1] ?? null;
                entry.el.insertBefore(cellEl, next);
                entry.cells[i] = cellEl;
            }

            if (wantInput) {
                const input = /** @type {HTMLInputElement} */ (cellEl);
                const checked = !!cell.checked;
                if (input.checked !== checked) input.checked = checked;
                const disabled = !!cell.disabled;
                if (input.disabled !== disabled) input.disabled = disabled;
            } else {
                const cls = `pci-cell ${cell.cls ?? ''}${cell.target !== undefined ? ' pci-link' : ''}`;
                if (cellEl.className !== cls) cellEl.className = cls;
                if (cellEl.textContent !== cell.text) cellEl.textContent = cell.text;
            }
            const title = cell.title ?? '';
            if (cellEl.title !== title) cellEl.title = title;
        });
    }

    /**
     * @param {ListEntry} entry - The row entry.
     * @param {number} index - The cell index.
     * @returns {HTMLElement} A text cell, clicking a link cell calls {@link onLink}.
     * @private
     */
    _createTextCell(entry, index) {
        const cellEl = document.createElement('span');
        cellEl.addEventListener('click', (e) => {
            const current = entry.row.cells[index];
            if (current && current.target !== undefined) {
                e.stopPropagation();
                this.onLink?.(current.target);
            }
        });
        return cellEl;
    }

    /**
     * @param {ListEntry} entry - The row entry.
     * @param {number} index - The cell index.
     * @returns {HTMLInputElement} A checkbox cell that reports through {@link onToggle}.
     * @private
     */
    _createToggleCell(entry, index) {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'pci-toggle pci-cell-toggle';
        input.addEventListener('click', e => e.stopPropagation());
        input.addEventListener('dblclick', e => e.stopPropagation());
        input.addEventListener('change', () => {
            if (entry.row.cells[index]?.toggle) this.onToggle?.(entry.row.item, input.checked);
        });
        return input;
    }

    /**
     * @param {ListRow} row - The row.
     * @returns {ListEntry} The new entry.
     * @private
     */
    _createEntry(row) {
        const rowEl = document.createElement('div');
        rowEl.className = 'pci-lrow';
        rowEl.addEventListener('click', () => this.select(row.key));

        const entry = { el: rowEl, cells: [], row, indent: -1 };
        this._entries.set(row.key, entry);
        return entry;
    }
}

export { ListView };
