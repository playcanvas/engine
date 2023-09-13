import { Component } from 'react';
import { BindingTwoWay, BooleanInput, Container, Label, LabelGroup, Panel, TextInput } from '@playcanvas/pcui/react';
import { Link } from 'react-router-dom';
import { Observer } from '@playcanvas/observer';
import examples from './helpers/example-data.mjs';
import { MIN_DESKTOP_WIDTH } from './constants.mjs';
import { thumbnailPath } from '../assetPath.mjs';
import { jsx } from './jsx.mjs';
import { getOrientation } from './utils.mjs';

/**
 * @typedef {object} Props
 */

/**
 * @typedef {object} State
 * @property {Record<string, Record<string, object>>} defaultCategories - todo
 * @property {Record<string, Record<string, object>>|null} filteredCategories - todo
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
        collapsed: window.top.innerWidth < MIN_DESKTOP_WIDTH,
        orientation: getOrientation(),
    }

    componentDidMount() {
        // PCUI should just have a "onHeaderClick" but can't find anything
        const sideBar = document.getElementById("sideBar");
        const sideBarHeader = sideBar.querySelector('.pcui-panel-header');
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
        window.addEventListener('hashchange', () => {
            this.mergeState({ hash: location.hash });
        });
        this.state.observer.on('largeThumbnails:set', () => {
            /** @type {HTMLElement} */
            let topNavItem;
            let minTopNavItemDistance = Number.MAX_VALUE;
            document.querySelectorAll('.nav-item').forEach((nav) => {
                const navItemDistance = Math.abs(120 - nav.getBoundingClientRect().top);
                if (navItemDistance < minTopNavItemDistance) {
                    minTopNavItemDistance = navItemDistance;
                    topNavItem = nav;
                }
            });
            sideBar.classList.toggle('small-thumbnails');
            topNavItem.scrollIntoView();
        });
        sideBar.classList.add('visible');
        // when first opening the examples browser via a specific example, scroll it into view
        if (!window._scrolledToExample) {
            const examplePath = location.hash.split('/');
            document.getElementById(`link-${examplePath[1]}-${examplePath[2]}`)?.scrollIntoView();
            window._scrolledToExample = true;
        }
    }


    /**
     * @param {Partial<State>} state - The partial state to update.
     */
    mergeState(state) {
        this.setState({ ...this.state, ...state});
    }

    toggleCollapse() {
        const { collapsed } = this.state;
        this.mergeState({
            collapsed: !collapsed,
        });
        // console.log("SideBar#toggleCollapse> was ", collapsed);
    }

    onLayoutChange() {
        if (!this.state.filteredCategories && document.body.offsetWidth < MIN_DESKTOP_WIDTH) {
            // @ts-ignore
            //const sideBar = document.getElementById('sideBar');
            //if (sideBar) {
            //    sideBar.ui.collapsed = true;
            //}
        }

        this.mergeState({
            orientation: getOrientation(),
        });
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
                        updatedCategories[category].examples[example] = title;
                    }
                }
            });
        });
        this.mergeState({ filteredCategories: updatedCategories });
    }
    onClickExample() {
        //this.mergeState({ collapsed: true });
        // console.log("load new example", category, example);
        const { pc } = window;
        if (pc) {
            pc.app?.destroy();
            // pc.app = null, but we don't have a setter for that in ES6
            // We need to know if we can render Controls, using frame count now.
            // The ready check happens in ./examples.mjs Example#renderControls
            pc.app.frame = 0;
        }
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
                jsx("ul", {
                    className: "category-nav"
                },
                Object.keys(categories[category].examples).sort((a, b) => (a > b ? 1 : -1)).map((example) => {
                    //console.log({ category, example });
                    const isSelected = new RegExp(`/${category}/${example}$`).test(hash);
                    const className = `nav-item ${isSelected ? 'selected' : null}`;
                    return jsx(Link, {
                        key: example,
                        to: `/${category}/${example}`,
                        onClick: this.onClickExample.bind(this),
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
        //console.log("SideBar#render> state", JSON.stringify(this.state, null, 2));
        const { observer, collapsed, orientation } = this.state;
        const panelOptions = {
            headerText: "EXAMPLES",
            collapsible: true,
            collapsed: false,
            id: 'sideBar',
            //class: ,
            class: [
                'small-thumbnails',
                collapsed ? 'collapsed' : null
            ]
        };
        if (orientation === 'portrait') {
            // console.log("DO PORTRAIT OPTIONS");
            panelOptions.class = 'small-thumbnails';
            panelOptions.collapsed = collapsed;
        }
        return jsx(
            Panel, panelOptions,
            jsx(TextInput, {
                class: 'filter-input',
                keyChange: true,
                placeholder: "Filter...",
                onChange: this.onChangeFilter.bind(this),
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
            ),
        )
    }
}
