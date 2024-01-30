import { Component } from 'react';
import { BindingTwoWay, BooleanInput, Container, Label, LabelGroup, Panel, TextInput } from '@playcanvas/pcui/react';
import { Link } from 'react-router-dom';
import { Observer } from '@playcanvas/observer';
import examples from './helpers/example-data.mjs';
import { MIN_DESKTOP_WIDTH } from './constants.mjs';
import { thumbnailPath } from '../assetPath.mjs';
import { jsx } from './jsx.mjs';
import { getOrientation } from './utils.mjs';
import { iframeDestroy } from './iframeUtils.mjs';

// eslint-disable-next-line jsdoc/require-property
/**
 * @typedef {object} Props
 */

/**
 * @typedef {object} State
 * @property {Record<string, Record<string, object>>} defaultCategories - The default categories.
 * @property {Record<string, Record<string, object>>|null} filteredCategories - The filtered categories.
 * @property {string} hash - The hash.
 * @property {Observer} observer - The observer.
 * @property {boolean} collapsed - Collapsed or not.
 * @property {string} orientation - Current orientation.
 */

/**
 * @type {typeof Component<Props, State>}
 */
const TypedComponent = Component;

export class SideBar extends TypedComponent {
    /** @type {State} */
    state = {
        defaultCategories: examples.categories,
        filteredCategories: null,
        hash: location.hash,
        observer: new Observer({ largeThumbnails: false }),
        // @ts-ignore
        collapsed: localStorage.getItem('sideBarCollapsed') === 'true' || window.top.innerWidth < MIN_DESKTOP_WIDTH,
        orientation: getOrientation()
    };

    componentDidMount() {
        // PCUI should just have a "onHeaderClick" but can't find anything
        const sideBar = document.getElementById("sideBar");
        if (!sideBar) {
            return;
        }

        /** @type {HTMLElement | null} */
        const sideBarHeader = sideBar.querySelector('.pcui-panel-header');
        if (!sideBarHeader) {
            return;
        }
        sideBarHeader.onclick = () => this.toggleCollapse();
        this.setupControlPanelToggleButton();
        // setup events
        this.onLayoutChange = this.onLayoutChange.bind(this);
        window.addEventListener("resize", this.onLayoutChange);
        window.addEventListener("orientationchange", this.onLayoutChange);
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.onLayoutChange);
        window.removeEventListener("orientationchange", this.onLayoutChange);
    }

    setupControlPanelToggleButton() {
        // set up the control panel toggle button
        const sideBar = document.getElementById('sideBar');
        if (!sideBar) {
            return;
        }
        window.addEventListener('hashchange', () => {
            this.mergeState({ hash: location.hash });
        });
        this.state.observer.on('largeThumbnails:set', () => {
            let minTopNavItemDistance = Number.MAX_VALUE;

            /** @type {NodeListOf<HTMLElement>} */
            const navItems = document.querySelectorAll('.nav-item');
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
        });
        sideBar.classList.add('visible');
        // when first opening the examples browser via a specific example, scroll it into view
        // @ts-ignore
        if (!window._scrolledToExample) {
            const examplePath = location.hash.split('/');
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
    }

    onLayoutChange() {
        this.mergeState({ orientation: getOrientation() });
    }

    /**
     * @param {string} filter - The filter string.
     */
    onChangeFilter(filter) {
        const { defaultCategories } = this.state;
        // Turn a filter like 'mes dec' (for mesh decals) into 'mes.*dec', because the examples
        // show "MESH DECALS" but internally it's just "MeshDecals".
        filter = filter.replace(/\s/g, ".*");
        const reg = (filter && filter.length > 0) ? new RegExp(filter, 'i') : null;
        if (!reg) {
            this.mergeState({ filteredCategories: defaultCategories });
            return;
        }
        /** @type {Record<string, Record<string, object>>} */
        const updatedCategories = {};
        Object.keys(defaultCategories).forEach((category) => {
            if (category.search(reg) !== -1) {
                updatedCategories[category] = defaultCategories[category];
                return null;
            }
            Object.keys(defaultCategories[category].examples).forEach((example) => {
                // @ts-ignore
                const title = defaultCategories[category].examples[example];
                if (title.search(reg) !== -1) {
                    if (!updatedCategories[category]) {
                        updatedCategories[category] = {
                            name: defaultCategories[category].name,
                            examples: {
                                [example]: title
                            }
                        };
                    } else {
                        // @ts-ignore
                        updatedCategories[category].examples[example] = title;
                    }
                }
            });
        });
        this.mergeState({ filteredCategories: updatedCategories });
    }

    onClickExample() {
        iframeDestroy();
    }

    renderContents() {
        const categories = this.state.filteredCategories || this.state.defaultCategories;
        if (Object.keys(categories).length === 0) {
            return jsx(Label, { text: 'No results' });
        }
        const { hash } = this.state;
        return Object.keys(categories).sort((a, b) => (a > b ? 1 : -1)).map((category) => {
            return jsx(
                Panel,
                {
                    key: category,
                    class: "categoryPanel",
                    headerText: category.split('-').join(' ').toUpperCase(),
                    collapsible: true,
                    collapsed: false
                },
                jsx("ul",
                    {
                        className: "category-nav"
                    },
                    Object.keys(categories[category].examples).sort((a, b) => (a > b ? 1 : -1)).map((example) => {
                        const isSelected = new RegExp(`/${category}/${example}$`).test(hash);
                        const className = `nav-item ${isSelected ? 'selected' : null}`;
                        return jsx(Link,
                                   {
                                       key: example,
                                       to: `/${category}/${example}`,
                                       onClick: this.onClickExample.bind(this)
                                   },
                                   jsx("div", { className: className, id: `link-${category}-${example}` },
                                       jsx(
                                           "img",
                                           {
                                               className: 'small-thumbnail',
                                               loading: "lazy",
                                               src: thumbnailPath + `${category}_${example}_small.png`
                                           }
                                       ),
                                       jsx("img", {
                                           className: 'large-thumbnail',
                                           loading: "lazy",
                                           src: thumbnailPath + `${category}_${example}_large.png`
                                       }),
                                       jsx(
                                           "div",
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
        const { observer, collapsed, orientation } = this.state;
        const panelOptions = {
            headerText: "EXAMPLES",
            collapsible: true,
            collapsed: false,
            id: 'sideBar',
            class: [
                'small-thumbnails',
                collapsed ? 'collapsed' : null
            ]
        };
        if (orientation === 'portrait') {
            panelOptions.class = ['small-thumbnails'];
            panelOptions.collapsed = collapsed;
        }
        return jsx(
            // @ts-ignore
            Panel, panelOptions,
            jsx(TextInput, {
                class: 'filter-input',
                keyChange: true,
                placeholder: "Filter...",
                onChange: this.onChangeFilter.bind(this)
            }),
            jsx(LabelGroup, { text: 'Large thumbnails:' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'largeThumbnails' }
                })
            ),
            jsx(Container, { id: 'sideBar-contents' },
                this.renderContents()
            )
        );
    }
}
