import { Observer } from '@playcanvas/observer';
import { BindingTwoWay, BooleanInput, Container, Label, LabelGroup, Panel, TextInput } from '@playcanvas/pcui/react';
import { Component } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { exampleMetaData } from '../../../cache/metadata.mjs';
import { VERSION } from '../constants.mjs';
import { iframe } from '../iframe.mjs';
import { jsx } from '../jsx.mjs';
import { thumbnailPath } from '../paths.mjs';
import { getHashPath, patchState, readState } from '../url-state.mjs';
import { getLayout } from '../utils.mjs';

/** @import { ReactElement } from 'react' */

/**
 * @typedef {object} Props
 * @property {{ pathname: string, hash: string }} location - The router location.
 * @property {'mobile'|'desktop'} [layout] - Current layout.
 * @property {null|'examples'|'code'|'controls'|'description'} [mobilePanel] - Active mobile panel.
 * @property {(mobilePanel: null|'examples'|'code'|'controls'|'description') => void} [setMobilePanel] - Set active mobile panel.
 * @property {(event: PointerEvent | import('react').PointerEvent<HTMLElement>) => void} [onMobilePanelDragStart] - Start mobile panel drag.
 */

/**
 * @typedef {object} State
 * @property {Record<string, Record<string, object>>} defaultCategories - The default categories.
 * @property {Record<string, Record<string, object>>|null} filteredCategories - The filtered categories.
 * @property {Observer} observer - The observer.
 * @property {boolean} collapsed - Collapsed or not.
 * @property {string} filterText - The current filter.
 * @property {'mobile'|'desktop'} layout - Current layout.
 */

/**
 * @type {typeof Component<Props, State>}
 */
const TypedComponent = Component;

/**
 * @returns {Record<string, { examples: Record<string, string> }>} - The category files.
 */
function getDefaultExampleFiles() {
    /** @type {Record<string, { examples: Record<string, string> }>} */
    const categories = {};
    for (let i = 0; i < exampleMetaData.length; i++) {
        const { categoryKebab, exampleNameKebab, hidden } = exampleMetaData[i];

        // hidden examples are always built and reachable via URL, but are only listed in the
        // sidebar during development (`npm run develop`), not in production builds (`npm run build`)
        if (hidden && process.env.NODE_ENV !== 'development') {
            continue;
        }

        if (!categories[categoryKebab]) {
            categories[categoryKebab] = { examples: {} };
        }

        categories[categoryKebab].examples[exampleNameKebab] = exampleNameKebab;
    }
    return categories;
}

/**
 * Split a filter string into exact-match `category:`/`example:` tags and fuzzy free-text terms.
 *
 * @param {string} filter - Filter string.
 * @returns {{ cats: string[], exs: string[], text: string }} Parsed tags and joined free text.
 */
function parseFilter(filter) {
    /** @type {string[]} */
    const cats = [];
    /** @type {string[]} */
    const exs = [];
    /** @type {string[]} */
    const terms = [];
    filter.trim().split(/\s+/).forEach((tok) => {
        const tag = /^(category|example):(.+)$/i.exec(tok);
        if (!tag) {
            if (tok) {
                terms.push(tok);
            }
            return;
        }
        (tag[1].toLowerCase() === 'category' ? cats : exs).push(tag[2].toLowerCase());
    });
    // whitespace between free-text terms stays fuzzy, preserving the old behavior
    return { cats, exs, text: terms.join('.*') };
}

/**
 * @param {Record<string, Record<string, any>>} defaultCategories - Default categories.
 * @param {string} filter - Filter string.
 * @returns {Record<string, Record<string, any>> | null} Filtered categories.
 */
function filterCategories(defaultCategories, filter) {
    const { cats, exs, text } = parseFilter(filter);
    if (!cats.length && !exs.length && !text) {
        return null;
    }
    const reg = text ? new RegExp(text, 'i') : null;

    /** @type {Record<string, Record<string, any>>} */
    const updatedCategories = {};
    Object.keys(defaultCategories).forEach((category) => {
        // category: tags require an exact (case-insensitive) category name
        if (cats.length && !cats.includes(category.toLowerCase())) {
            return;
        }
        Object.keys(defaultCategories[category].examples).forEach((example) => {
            const title = defaultCategories[category].examples[example];
            // example: tags require an exact (case-insensitive) example name
            if (exs.length && !exs.includes(example.toLowerCase())) {
                return;
            }
            // any remaining free text fuzzy-matches the category or example name
            if (reg && category.search(reg) === -1 && title.search(reg) === -1) {
                return;
            }
            if (!updatedCategories[category]) {
                updatedCategories[category] = { ...defaultCategories[category], examples: {} };
            }
            updatedCategories[category].examples[example] = title;
        });
    });
    return updatedCategories;
}

const createState = () => {
    const ui = readState().ui ?? {};
    const filter = typeof ui.filter === 'string' ? ui.filter : '';
    const largeThumbnails = typeof ui.largeThumbnails === 'boolean' ? ui.largeThumbnails : false;
    const collapsed = typeof ui.sideBarCollapsed === 'boolean' ?
        ui.sideBarCollapsed :
        localStorage.getItem('sideBarCollapsed') === 'true' || getLayout() === 'mobile';
    const defaultCategories = getDefaultExampleFiles();
    return {
        defaultCategories,
        filteredCategories: filterCategories(defaultCategories, filter),
        filterText: filter,
        observer: new Observer({ largeThumbnails }),
        collapsed,
        layout: getLayout()
    };
};

class SideBar extends TypedComponent {
    /** @type {State} */
    state = createState();

    /** @type {HTMLElement | null} */
    _sideBar = null;

    /** @type {string} */
    _sideBarLayout = '';

    /** @type {{ unbind: () => void } | null} */
    _largeThumbnailsHandle = null;

    /**
     * @param {Props} props - Component properties.
     */
    constructor(props) {
        super(props);
        this._onLayoutChange = this._onLayoutChange.bind(this);
        this._onClickExample = this._onClickExample.bind(this);
        this._onLargeThumbnailsSet = this._onLargeThumbnailsSet.bind(this);
    }

    setupSideBar() {
        const sideBar = document.getElementById('sideBar');
        const layout = this.props.layout ?? this.state.layout;
        if (!sideBar || (this._sideBar === sideBar && this._sideBarLayout === layout)) {
            return;
        }
        this._sideBar = sideBar;
        this._sideBarLayout = layout;
        const drag = this.props.onMobilePanelDragStart;
        sideBar.onpointerdown = layout === 'mobile' && drag ? event => drag(event) : null;

        // PCUI should just have a "onHeaderClick" but can't find anything
        const sideBarHeader = /** @type {HTMLElement | null} */ (
            /** @type {unknown} */ (sideBar.querySelector('.pcui-panel-header'))
        );
        if (sideBarHeader) {
            sideBarHeader.onclick = layout === 'mobile' ? null : () => this.toggleCollapse();
            sideBarHeader.onpointerdown = null;
        }
        this.setupControlPanelToggleButton();
    }

    componentDidMount() {
        this._largeThumbnailsHandle = this.state.observer.on('largeThumbnails:set', this._onLargeThumbnailsSet);
        this.setupSideBar();
        window.addEventListener('resize', this._onLayoutChange);
        window.addEventListener('orientationchange', this._onLayoutChange);
    }

    componentDidUpdate() {
        this.setupSideBar();
    }

    componentWillUnmount() {
        this._largeThumbnailsHandle?.unbind();
        this._largeThumbnailsHandle = null;
        window.removeEventListener('resize', this._onLayoutChange);
        window.removeEventListener('orientationchange', this._onLayoutChange);
    }

    _onLargeThumbnailsSet() {
        patchState({ ui: { largeThumbnails: this.state.observer.get('largeThumbnails') === true } });
        const sideBar = document.getElementById('sideBar');
        if (!sideBar) {
            return;
        }
        let minTopNavItemDistance = Number.MAX_VALUE;

        const navItems = /** @type {NodeListOf<HTMLElement>} */ (
            /** @type {unknown} */ (document.querySelectorAll('.nav-item'))
        );
        for (let i = 0; i < navItems.length; i++) {
            const nav = navItems[i];
            const navItemDistance = Math.abs(120 - nav.getBoundingClientRect().top);
            if (navItemDistance < minTopNavItemDistance) {
                minTopNavItemDistance = navItemDistance;
                sideBar.classList.toggle('small-thumbnails');
                nav.scrollIntoView();
                break;
            }
        }
    }

    setupControlPanelToggleButton() {
        // set up the control panel toggle button
        const sideBar = document.getElementById('sideBar');
        if (!sideBar) {
            return;
        }
        sideBar.classList.add('visible');
        // when first opening the examples browser via a specific example, scroll it into view
        // @ts-ignore
        if (!window._scrolledToExample) {
            const examplePath = getHashPath().split('/');
            document.getElementById(`link-${examplePath[1]}-${examplePath[2]}`)?.scrollIntoView();
            // @ts-ignore
            window._scrolledToExample = true;
        }
    }

    /**
     * @param {Partial<State>} state - The partial state to update.
     */
    mergeState(state) {
        // new state is always calculated from the current state,
        // avoiding any potential issues with asynchronous updates
        this.setState(prevState => ({ ...prevState, ...state }));
    }

    toggleCollapse() {
        const { collapsed } = this.state;
        localStorage.setItem('sideBarCollapsed', `${!collapsed}`);
        this.mergeState({ collapsed: !collapsed });
        patchState({ ui: { sideBarCollapsed: !collapsed } });
    }

    _onLayoutChange() {
        this.mergeState({ layout: getLayout() });
    }

    /**
     * @param {string} filter - The filter string.
     */
    onChangeFilter(filter) {
        const { defaultCategories } = this.state;
        this.mergeState({
            filterText: filter,
            filteredCategories: filterCategories(defaultCategories, filter)
        });
        patchState({ ui: { filter } });
    }

    clearFilter() {
        this.onChangeFilter('');
    }

    /**
     * @param {import("react").MouseEvent<HTMLAnchorElement, MouseEvent>} e - The event.
     * @param {string} path - The path of example.
     */
    _onClickExample(e, path) {
        if (path === iframe.path) {
            iframe.fire('hotReload');
        } else {
            iframe.fire('destroy');
        }
    }

    renderContents() {
        const categories = this.state.filteredCategories || this.state.defaultCategories;
        if (Object.keys(categories).length === 0) {
            return jsx(Label, { text: 'No results' });
        }
        const { pathname } = this.props.location;
        return Object.keys(categories)
        .sort((a, b) => (a > b ? 1 : -1))
        .map((category) => {
            return jsx(
                Panel,
                {
                    key: category,
                    class: 'categoryPanel',
                    headerText: category.split('-').join(' ').toUpperCase(),
                    collapsible: true,
                    collapsed: false
                },
                jsx(
                    'ul',
                    {
                        className: 'category-nav'
                    },
                    Object.keys(categories[category].examples)
                    .sort((a, b) => (a > b ? 1 : -1))
                    .map((example) => {
                        const path = `/${category}/${example}`;
                        const isSelected = pathname === path;
                        const className = `nav-item ${isSelected ? 'selected' : ''}`;
                        return jsx(
                            Link,
                            {
                                key: example,
                                to: path,
                                onClick: e => this._onClickExample(e, path)
                            },
                            jsx(
                                'div',
                                { className: className, id: `link-${category}-${example}` },
                                jsx('img', {
                                    className: 'small-thumbnail',
                                    loading: 'lazy',
                                    src: `${thumbnailPath}${category}_${example}_small.webp`
                                }),
                                jsx('img', {
                                    className: 'large-thumbnail',
                                    loading: 'lazy',
                                    src: `${thumbnailPath}${category}_${example}_large.webp`
                                }),
                                jsx(
                                    'div',
                                    {
                                        className: 'nav-item-text'
                                    },
                                    example.split('-').join(' ').toUpperCase()
                                )
                            )
                        );
                    })
                )
            );
        });
    }

    render() {
        const { observer, collapsed } = this.state;
        const layout = this.props.layout ?? this.state.layout;
        const smallThumbnails = observer.get('largeThumbnails') !== true;
        const panelOptions = {
            headerText: `EXAMPLES - v${VERSION}`,
            collapsible: true,
            collapsed: false,
            id: 'sideBar',
            class: [...(smallThumbnails ? ['small-thumbnails'] : []), ...(collapsed ? ['collapsed'] : [])]
        };
        if (layout === 'mobile') {
            if (this.props.mobilePanel !== 'examples') {
                return null;
            }
            panelOptions.headerText = `EXAMPLES - v${VERSION}`;
            panelOptions.class = ['mobile-sheet', 'small-thumbnails'];
            panelOptions.collapsible = false;
            panelOptions.collapsed = false;
        }
        return jsx(
            Panel,
            // @ts-ignore
            panelOptions,
            jsx(
                Container,
                { class: ['filter-container', ...(this.state.filterText ? ['has-filter-text'] : [])] },
                jsx(/** @type {any} */ (TextInput), {
                    class: 'filter-input',
                    keyChange: true,
                    placeholder: 'Filter, category:, example:',
                    value: this.state.filterText,
                    onChange: this.onChangeFilter.bind(this)
                }),
                this.state.filterText ? jsx(
                    'div',
                    {
                        className: 'filter-clear',
                        onClick: this.clearFilter.bind(this)
                    },
                    '\u2715'
                ) : null
            ),
            layout !== 'mobile' && jsx(
                LabelGroup,
                { text: 'Large thumbnails:' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'largeThumbnails' }
                })
            ),
            jsx(Container, { id: 'sideBar-contents' }, this.renderContents())
        );
    }
}

/**
 * @param {Omit<Props, 'location'>} props - Component properties.
 * @returns {ReactElement} The SideBar component with router location.
 */
function SideBarWithRouter(props) {
    const location = useLocation();
    return jsx(SideBar, { ...props, location });
}

export { SideBarWithRouter as SideBar };
