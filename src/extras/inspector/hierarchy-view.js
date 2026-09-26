import { Entity } from '../../framework/entity.js';

import { setTip } from './tooltip.js';

/** @import { GraphNode } from '../../scene/graph-node.js' */

/**
 * What the hierarchy filter matches its text against: a node's name, the type of one of its
 * components, or the name of one of its scripts.
 *
 * @typedef {'name'|'component'|'script'} FilterBy
 * @ignore
 */

/**
 * @param {GraphNode} node - A node.
 * @returns {string[]} The names of the scripts on it.
 */
function scriptNames(node) {
    const scripts = /** @type {any} */ (node).c?.script?.scripts ?? [];
    return scripts.map((script) => {
        const ctor = script.constructor;
        return String(ctor.scriptName ?? ctor.__name ?? ctor.name ?? '');
    });
}

/**
 * @param {GraphNode} node - A node.
 * @returns {string[]} The types of the components on it.
 */
function componentTypes(node) {
    return node instanceof Entity ? Object.keys(node.c) : [];
}

/**
 * @param {GraphNode} node - A node.
 * @param {string} text - The lower-cased filter text.
 * @param {FilterBy} by - What the text matches.
 * @returns {boolean} Whether the node matches.
 */
function matchesFilter(node, text, by) {
    const values = by === 'component' ? componentTypes(node) : by === 'script' ? scriptNames(node) : [node.name || ''];
    return values.some(value => value.toLowerCase().includes(text));
}

/**
 * The distinct component types or script names in a hierarchy, sorted, to suggest while filtering
 * by them.
 *
 * @param {GraphNode|null} root - The root of the hierarchy.
 * @param {FilterBy} by - What to collect: 'component' or 'script'.
 * @returns {string[]} The values, empty when filtering by name.
 */
function filterSuggestions(root, by) {
    if (!root || by === 'name') return [];
    const values = new Set();
    root.forEach((node) => {
        for (const value of by === 'component' ? componentTypes(node) : scriptNames(node)) values.add(value);
    });
    return [...values].sort();
}

/**
 * @typedef {object} HierarchyEntry
 * @ignore
 * @property {HTMLElement} el - The node container, holding the row and the children container.
 * @property {HTMLElement} row - The clickable row.
 * @property {HTMLElement} arrowEl - The expand and collapse arrow.
 * @property {HTMLInputElement} toggleEl - The checkbox bound to the node's own enabled flag.
 * @property {HTMLElement} nameEl - The name label.
 * @property {HTMLElement} badgesEl - The component badges.
 * @property {HTMLElement} countEl - The number of children.
 * @property {HTMLElement} totalEl - The number of nodes in the whole subtree below the node.
 * @property {HTMLElement} childrenEl - The container the child entries live in.
 * @property {string|undefined} name - The name last rendered.
 * @property {string|undefined} badges - The badge text last rendered.
 * @property {number} depth - The depth last rendered.
 * @property {boolean} match - Whether the entry matched the filter on the last refresh.
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
 * A tree view over a {@link GraphNode} hierarchy. Rows are keyed by node and reconciled in place on
 * every refresh, so the expansion state, the selection and the scroll position survive the scene
 * changing underneath. Collapsed subtrees are not materialized, which keeps large scenes cheap.
 *
 * @ignore
 */
class HierarchyView {
    /**
     * The element the tree is rendered into.
     *
     * @type {HTMLElement}
     */
    container;

    /**
     * Called with the newly selected node, or null when the selection is cleared.
     *
     * @type {(node: GraphNode|null) => void}
     */
    onSelect;

    /**
     * Called after a node's enabled flag was flipped from its checkbox.
     *
     * @type {((node: GraphNode) => void)|undefined}
     */
    onToggle;

    /**
     * Decides which nodes get no enabled checkbox. Defaults to none.
     *
     * @type {(node: GraphNode) => boolean}
     */
    isLocked = () => false;

    /**
     * The root of the rendered hierarchy.
     *
     * @type {GraphNode|null}
     */
    root = null;

    /**
     * The selected node.
     *
     * @type {GraphNode|null}
     */
    selected = null;

    /**
     * Case-insensitive filter text. Nodes that match, and their ancestors, stay visible.
     *
     * @type {string}
     */
    filter = '';

    /**
     * What the filter text matches: node names, component types or script names.
     *
     * @type {FilterBy}
     */
    filterBy = 'name';

    /**
     * The number of nodes in the hierarchy as of the last refresh.
     *
     * @type {number}
     */
    nodeCount = 0;

    /**
     * The number of entities in the hierarchy as of the last refresh.
     *
     * @type {number}
     */
    entityCount = 0;

    /**
     * @type {Map<GraphNode, HierarchyEntry>}
     * @private
     */
    _entries = new Map();

    /**
     * @type {WeakSet<GraphNode>}
     * @private
     */
    _expanded = new WeakSet();

    /**
     * @type {Set<GraphNode>}
     * @private
     */
    _seen = new Set();

    /**
     * The number of nodes below each node, counted on every refresh.
     *
     * @type {Map<GraphNode, number>}
     * @private
     */
    _descendants = new Map();

    /**
     * @param {HTMLElement} container - The element to render into.
     * @param {(node: GraphNode|null) => void} onSelect - The selection callback.
     */
    constructor(container, onSelect) {
        this.container = container;
        this.onSelect = onSelect;
    }

    /**
     * Replaces the hierarchy being shown.
     *
     * @param {GraphNode|null} root - The new root.
     */
    setRoot(root) {
        this.root = root;
        this.container.textContent = '';
        this._entries.clear();
        this._expanded = new WeakSet();
        if (root) {
            this._expanded.add(root);
        }
        this.select(null);
    }

    /**
     * Counts the nodes of a subtree, recording for each node how many are below it, and totals
     * the nodes and entities of the hierarchy on the way.
     *
     * @param {GraphNode} node - The root of the subtree.
     * @returns {number} The number of nodes below it.
     * @private
     */
    _countSubtree(node) {
        this.nodeCount++;
        if (node instanceof Entity) this.entityCount++;
        let below = 0;
        for (const child of node.children) below += 1 + this._countSubtree(child);
        this._descendants.set(node, below);
        return below;
    }

    /**
     * Synchronizes the rendered tree with the hierarchy.
     */
    refresh() {
        this._seen.clear();
        this.nodeCount = 0;
        this.entityCount = 0;

        const root = this.root;
        if (root) {
            this._descendants.clear();
            this._countSubtree(root);

            this._visit(root, 0, this.filter.trim().toLowerCase());
            const entry = this._entries.get(root);
            if (entry.el.parentNode !== this.container) {
                this.container.appendChild(entry.el);
            }
        }

        for (const [node, entry] of this._entries) {
            if (!this._seen.has(node)) {
                entry.el.remove();
                this._entries.delete(node);
            }
        }

        if (this.selected && !this._seen.has(this.selected)) {
            const selected = this.selected;
            const entry = this._entries.get(selected);
            if (!entry) {
                // the node was destroyed or moved into a collapsed subtree
                let alive = false;
                root?.forEach((node) => {
                    if (node === selected) alive = true;
                });
                if (!alive) this.select(null);
            }
        }
    }

    /**
     * Selects a node, expanding its ancestors and scrolling it into view.
     *
     * @param {GraphNode|null} node - The node, or null to clear the selection.
     */
    select(node) {
        const previous = this._entries.get(this.selected);
        previous?.row.classList.remove('pci-selected');

        this.selected = node;

        if (node) {
            for (let parent = node.parent; parent; parent = parent.parent) {
                this._expanded.add(parent);
            }
            this.refresh();
            const entry = this._entries.get(node);
            if (entry) {
                entry.row.classList.add('pci-selected');
                entry.row.scrollIntoView?.({ block: 'nearest' });
            }
        }

        this.onSelect?.(node);
    }

    /**
     * Toggles the expansion of a node.
     *
     * @param {GraphNode} node - The node.
     * @param {boolean} [recursive] - Apply the new state to the whole subtree.
     */
    toggle(node, recursive = false) {
        const expanded = !this._expanded.has(node);
        const apply = (n) => {
            if (expanded) this._expanded.add(n);
            else this._expanded.delete(n);
        };
        if (recursive) node.forEach(apply);
        else apply(node);
        this.refresh();
    }

    /**
     * Renders a node and, when expanded or filtering, its subtree.
     *
     * @param {GraphNode} node - The node.
     * @param {number} depth - The depth of the node below the root.
     * @param {string} filter - The lower-cased filter text, empty for none.
     * @returns {boolean} Whether the node or one of its descendants matches the filter.
     * @private
     */
    _visit(node, depth, filter) {
        const entry = this._entries.get(node) ?? this._createEntry(node);
        this._seen.add(node);

        const isEntity = node instanceof Entity;
        const name = node.name;

        if (entry.name !== name) {
            entry.name = name;
            entry.nameEl.textContent = name || '(unnamed)';
        }
        if (entry.depth !== depth) {
            entry.depth = depth;
            entry.row.style.paddingLeft = `${depth * 14 + 4}px`;
        }

        const badges = isEntity ? Object.keys(node.c).join(' ') : '';
        if (entry.badges !== badges) {
            entry.badges = badges;
            entry.badgesEl.textContent = '';
            for (const badge of badges ? badges.split(' ') : []) {
                const badgeEl = el('span', 'pci-badge');
                badgeEl.textContent = badge;
                entry.badgesEl.appendChild(badgeEl);
            }
        }

        entry.row.classList.toggle('pci-disabled', !node.enabled);
        entry.row.classList.toggle('pci-graphnode', !isEntity);
        entry.row.classList.toggle('pci-selected', node === this.selected);

        // the checkbox shows the node's own flag; the dimming above reflects the whole ancestry
        const own = node._enabled;
        if (entry.toggleEl.checked !== own) entry.toggleEl.checked = own;
        const toggleVisibility = this.isLocked(node) ? 'hidden' : '';
        if (entry.toggleEl.style.visibility !== toggleVisibility) {
            entry.toggleEl.style.visibility = toggleVisibility;
        }

        // children are materialized only when shown, or when a filter needs to match them
        const children = node.children;
        const childCount = children.length;
        const expanded = this._expanded.has(node);
        let anyChildMatch = false;

        if (childCount > 0 && (expanded || filter)) {
            let cursor = entry.childrenEl.firstChild;
            for (let i = 0; i < childCount; i++) {
                const child = children[i];
                if (this._visit(child, depth + 1, filter)) anyChildMatch = true;
                const childEl = this._entries.get(child).el;
                if (childEl !== cursor) {
                    entry.childrenEl.insertBefore(childEl, cursor);
                } else {
                    cursor = cursor.nextSibling;
                }
            }
        } else if (entry.childrenEl.firstChild) {
            entry.childrenEl.textContent = '';
        }

        const selfMatch = !filter || matchesFilter(node, filter, this.filterBy);
        const match = selfMatch || anyChildMatch;
        const open = childCount > 0 && (expanded || (filter && anyChildMatch));

        this._setDisplay(entry.el, match);
        this._setDisplay(entry.childrenEl, !!open);
        entry.row.classList.toggle('pci-match', !!filter && selfMatch);

        const arrow = childCount === 0 ? '' : (open ? '▾' : '▸');
        if (entry.arrowEl.textContent !== arrow) entry.arrowEl.textContent = arrow;

        const count = childCount > 0 ? String(childCount) : '';
        if (entry.countEl.textContent !== count) entry.countEl.textContent = count;
        const total = childCount > 0 ? String(this._descendants.get(node) ?? 0) : '';
        if (entry.totalEl.textContent !== total) entry.totalEl.textContent = total;

        entry.match = match;
        return match;
    }

    /**
     * @param {HTMLElement} element - The element.
     * @param {boolean} shown - Whether it is shown.
     * @private
     */
    _setDisplay(element, shown) {
        const display = shown ? '' : 'none';
        if (element.style.display !== display) element.style.display = display;
    }

    /**
     * @param {GraphNode} node - The node.
     * @returns {HierarchyEntry} The new entry.
     * @private
     */
    _createEntry(node) {
        const toggleEl = /** @type {HTMLInputElement} */ (document.createElement('input'));
        toggleEl.type = 'checkbox';
        toggleEl.className = 'pci-toggle';
        setTip(toggleEl, 'Enabled');

        const entry = {
            el: el('div', 'pci-node'),
            row: el('div', 'pci-row'),
            arrowEl: el('span', 'pci-arrow'),
            toggleEl,
            nameEl: el('span', 'pci-name'),
            badgesEl: el('span', 'pci-badges'),
            countEl: el('span', 'pci-count'),
            totalEl: el('span', 'pci-count pci-count-total'),
            childrenEl: el('div', 'pci-children'),
            name: undefined,
            badges: undefined,
            depth: -1,
            match: true
        };

        setTip(entry.countEl, 'Children');
        setTip(entry.totalEl, 'All nodes below, however deep');
        entry.row.append(entry.arrowEl, entry.toggleEl, entry.nameEl, entry.badgesEl, entry.countEl, entry.totalEl);
        entry.el.append(entry.row, entry.childrenEl);

        entry.arrowEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle(node, e.altKey);
        });

        // the checkbox must not select the row or toggle its expansion
        toggleEl.addEventListener('click', e => e.stopPropagation());
        toggleEl.addEventListener('dblclick', e => e.stopPropagation());
        toggleEl.addEventListener('change', () => {
            node.enabled = toggleEl.checked;
            this.refresh();
            this.onToggle?.(node);
        });
        entry.row.addEventListener('click', () => this.select(node));
        entry.row.addEventListener('dblclick', e => this.toggle(node, e.altKey));

        this._entries.set(node, entry);
        return entry;
    }
}

export { HierarchyView, filterSuggestions, matchesFilter };
