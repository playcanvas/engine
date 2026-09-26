import { BRACKET_COLORS } from './styles.js';
import { setTip } from './tooltip.js';

// the width of one bracket lane in the gutter left of a row, and the space after the last lane
const LANE_WIDTH = 10;
const GUTTER_GAP = 2;

/**
 * @typedef {object} ListCell
 * @ignore
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
 * @ignore
 * @property {string} key - A key unique within the list, stable across refreshes.
 * @property {*} item - The subject selected when the row is clicked.
 * @property {string} name - The text the filter matches against.
 * @property {(filter: string) => boolean} [matches] - Decides whether the row matches the lower-cased
 * filter, for rows that match on more than their name. Called only while a filter is set.
 * @property {ListCell[]} cells - The cells, left to right.
 * @property {number} [indent] - The indentation level.
 * @property {ListGuides} [guides] - The brackets drawn in a gutter left of the row, which group
 * runs of rows without indenting them.
 * @property {*} [preview] - What hovering the row reports through {@link ListView#onHover}, such
 * as the render target of a pass. A link cell inside the row reports its own target instead while
 * it is hovered.
 * @property {boolean} [dim] - Whether the row is shown dimmed.
 * @property {string} [title] - A tooltip for the whole row.
 */

/**
 * The brackets a row shows in the gutter on its left. A bracket spans a run of rows in one lane,
 * each lane a nesting level, and marks the row it belongs to with a tick pointing at the row.
 *
 * @typedef {object} ListGuides
 * @ignore
 * @property {number} lanes - The lanes the gutter holds. The same on every row of a list, so the
 * rows stay aligned.
 * @property {Array<'start'|'mid'|'end'|null>} segments - What each lane shows on this row: the top
 * end of a bracket, its middle, its bottom end, or nothing.
 * @property {number} tick - The lane of the bracket this row owns, or -1 when it owns none.
 */

/**
 * @typedef {object} ListEntry
 * @ignore
 * @property {HTMLElement} el - The row element.
 * @property {HTMLElement[]} cells - The cell elements.
 * @property {ListRow} row - The row last rendered.
 * @property {number} indent - The indentation last rendered.
 * @property {string} guides - The brackets last rendered, as a signature.
 */

/**
 * The background layers drawing a row's brackets: a one pixel line per lane, the full height of the
 * row in the middle of a bracket and half of it at either end, so brackets meeting in one lane stay
 * apart, and a tick from the owned bracket's line across the rest of the gutter.
 *
 * @param {ListGuides} guides - The brackets.
 * @returns {{ image: string, position: string, size: string }|null} The layers, or null for none.
 */
function guideStyle(guides) {
    const images = [];
    const positions = [];
    const sizes = [];
    const layer = (lane, position, size) => {
        const color = BRACKET_COLORS[lane % BRACKET_COLORS.length];
        images.push(`linear-gradient(${color}, ${color})`);
        positions.push(position);
        sizes.push(size);
    };
    guides.segments.forEach((segment, lane) => {
        if (!segment) return;
        const x = lane * LANE_WIDTH + LANE_WIDTH / 2;
        if (segment === 'mid') layer(lane, `${x}px 0`, '1px 100%');
        else if (segment === 'start') layer(lane, `${x}px 100%`, '1px 50%');
        else layer(lane, `${x}px 0`, '1px 50%');
    });
    if (guides.tick >= 0) {
        const x = guides.tick * LANE_WIDTH + LANE_WIDTH / 2;
        layer(guides.tick, `${x}px 50%`, `${guides.lanes * LANE_WIDTH - x}px 1px`);
    }
    return images.length ? { image: images.join(', '), position: positions.join(', '), size: sizes.join(', ') } : null;
}

/**
 * A flat, selectable list of rows with cells. Rows are keyed and reconciled in place, so a list
 * rebuilt from scratch a couple of times a second keeps its selection and scroll position and only
 * touches the text that changed.
 *
 * @ignore
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
     * Called when the pointer enters a link, with the link element and a function reading the
     * link's current target, and with nulls when it leaves. The target is read through the
     * function because a refresh can point the same element at a new target while it is hovered.
     *
     * @type {((el: HTMLElement|null, target: (() => *)|null) => void)|undefined}
     */
    onHover;

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

            const shown = !filter || (row.matches ? row.matches(filter) : row.name.toLowerCase().includes(filter));
            const display = shown ? '' : 'none';
            if (entry.el.style.display !== display) entry.el.style.display = display;
            if (shown) visible++;

            const indent = row.indent ?? 0;
            const guides = row.guides ? `${row.guides.lanes}|${row.guides.segments.join(',')}|${row.guides.tick}` : '';
            if (entry.indent !== indent || entry.guides !== guides) {
                entry.indent = indent;
                entry.guides = guides;
                const gutter = row.guides ? row.guides.lanes * LANE_WIDTH + GUTTER_GAP : 0;
                entry.el.style.paddingLeft = `${gutter + indent * 14 + 6}px`;
                const style = row.guides ? guideStyle(row.guides) : null;
                entry.el.style.backgroundImage = style?.image ?? '';
                entry.el.style.backgroundPosition = style?.position ?? '';
                entry.el.style.backgroundSize = style?.size ?? '';
                entry.el.style.backgroundRepeat = style ? 'no-repeat' : '';
            }
            const title = row.title ?? '';
            if ((entry.el.dataset.tip ?? '') !== title) setTip(entry.el, title);

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
            if ((cellEl.dataset.tip ?? '') !== title) setTip(cellEl, title);
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
        const target = () => entry.row.cells[index]?.target;
        cellEl.addEventListener('pointerenter', () => {
            if (target() !== undefined) this.onHover?.(cellEl, target);
        });
        // still inside the row, which may preview something of its own
        cellEl.addEventListener('pointerleave', () => this._hoverRow(entry));
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

        const entry = { el: rowEl, cells: [], row, indent: -1, guides: '' };
        rowEl.addEventListener('pointerenter', () => this._hoverRow(entry));
        rowEl.addEventListener('pointerleave', () => this.onHover?.(null, null));
        this._entries.set(row.key, entry);
        return entry;
    }

    /**
     * Reports the row the pointer is over, when it previews something, or that nothing is hovered.
     *
     * @param {ListEntry} entry - The row entry.
     * @private
     */
    _hoverRow(entry) {
        if (entry.row.preview !== undefined && entry.row.preview !== null) {
            this.onHover?.(entry.el, () => entry.row.preview);
        } else {
            this.onHover?.(null, null);
        }
    }
}

export { ListView };
