import React, { useState, useEffect } from 'react';
import { BindingTwoWay, BooleanInput, Container, Label, LabelGroup, Panel, TextInput } from '@playcanvas/pcui/react';
// @ts-ignore: library file import
import { Link } from "react-router-dom";
import { Observer } from '@playcanvas/observer';
import examples from './helpers/example-data.mjs';
import { MIN_DESKTOP_WIDTH } from './constants.mjs';
import { thumbnailPath } from '../assetPath.mjs';
import { jsx } from '../examples/animation/jsx.mjs';
const toggleSideBar = () => {
    const sideBar = document.getElementById('sideBar');
    sideBar.classList.toggle('collapsed');
};
export const SideBar = () => {
    const defaultCategories = examples.categories;
    const [filteredCategories, setFilteredCategories] = useState(null);
    const [hash, setHash] = useState(location.hash);
    const observer = new Observer({ largeThumbnails: false });
    useEffect(() => {
        // set up the control panel toggle button
        const sideBar = document.getElementById('sideBar');
        const panelToggleDiv = document.querySelector('.sideBar-panel-toggle');
        panelToggleDiv.removeEventListener('click', toggleSideBar);
        panelToggleDiv.addEventListener('click', toggleSideBar);

        window.addEventListener('hashchange', () => {
            setHash(location.hash);
        });

        observer.on('largeThumbnails:set', () => {
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

        if (!filteredCategories && document.body.offsetWidth < MIN_DESKTOP_WIDTH) {
            // @ts-ignore
            sideBar.ui.collapsed = true;
        }
        sideBar.classList.add('visible');

        // when first opening the examples browser via a specific example, scroll it into view
        if (!(window /*as any*/)._scrolledToExample) {
            const examplePath = location.hash.split('/');
            document.getElementById(`link-${examplePath[1]}-${examplePath[2]}`)?.scrollIntoView();
            (window /*as any*/)._scrolledToExample = true;
        }
    });
    const categories = filteredCategories || defaultCategories;
    return (jsx(React.Fragment, null,
        jsx(Panel, { headerText: "EXAMPLES", collapsible: document.body.offsetWidth < MIN_DESKTOP_WIDTH, collapsed: true, id: 'sideBar', class: 'small-thumbnails' },
            jsx(TextInput, {
                class: 'filter-input',
                keyChange: true,
                placeholder: "Filter...",
                onChange: (/** @type {string} */ filter) => {
                    const reg = (filter && filter.length > 0) ? new RegExp(filter, 'i') : null;
                    if (!reg) {
                        setFilteredCategories(defaultCategories);
                        return;
                    }
                    const updatedCategories = {};
                    Object.keys(defaultCategories).forEach((category) => {
                        if (category.search(reg) !== -1) {
                            updatedCategories[category] = defaultCategories[category];
                            return null;
                        }
                        Object.keys(defaultCategories[category].examples).forEach((example) => {
                            if (defaultCategories[category].examples[example].search(reg) !== -1) {
                                if (!updatedCategories[category]) {
                                    updatedCategories[category] = {
                                        name: defaultCategories[category].name,
                                        examples: {
                                            [example]: defaultCategories[category].examples[example]
                                        }
                                    };
                                }
                                else {
                                    updatedCategories[category].examples[example] = defaultCategories[category].examples[example];
                                }
                            }
                        });
                    });
                    setFilteredCategories(updatedCategories);
                } }),
            jsx(LabelGroup, { text: 'Large thumbnails:' },
                jsx(BooleanInput, { type: 'toggle', binding: new BindingTwoWay(), link: { observer, path: 'largeThumbnails' } })),
            jsx(Container, { id: 'sideBar-contents' },
                Object.keys(categories).sort((a, b) => (a > b ? 1 : -1)).map((category) => {
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
                                onClick: () => {
                                    const sideBar = document.getElementById('sideBar');
                                    // @ts-ignore
                                    sideBar.ui.collapsed = true;
                                }
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
                                    jsx("img", { className: 'large-thumbnail', loading: "lazy", src: thumbnailPath + `${category}_${example}_large.png` }),
                                    jsx("div", { className: 'nav-item-text' }, example.split('-').join(' ').toUpperCase())));
                        })));
                }),
                Object.keys(categories).length === 0 && jsx(Label, { text: 'No results' }))),
        jsx("div", {
            className: 'panel-toggle sideBar-panel-toggle'
        })
        )
    );
};
