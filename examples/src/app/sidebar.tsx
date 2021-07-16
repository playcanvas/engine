import React, { useState, useEffect } from 'react';
// @ts-ignore: library file import
import { Container, Panel, TextInput, Label, LabelGroup, BooleanInput } from '@playcanvas/pcui/pcui-react';
// @ts-ignore: library file import
import { Link } from "react-router-dom";
// @ts-ignore: library file import
import { BindingTwoWay, Observer } from '@playcanvas/pcui/pcui-binding';

interface SideBarProps {
    categories: any
}

const SideBar = (props: SideBarProps) => {
    const defaultCategories = props.categories;
    const [filteredCategories, setFilteredCategories] = useState(null);
    const [hash, setHash] = useState(location.hash);
    const observer = new Observer({ largeThumbnails: false });
    useEffect(() => {
        // set up the control panel toggle button
        const sideBar = document.getElementById('sideBar');
        const panelToggleDiv = sideBar.querySelector('.panel-toggle');
        panelToggleDiv.addEventListener('click', function () {
            sideBar.classList.toggle('collapsed');
        });

        window.addEventListener('hashchange', () => {
            setHash(location.hash);
        });

        observer.on('largeThumbnails:set', () => {
            let topNavItem: HTMLElement;
            let minTopNavItemDistance = Number.MAX_VALUE;
            document.querySelectorAll('.nav-item').forEach((nav: HTMLElement) => {
                const navItemDistance = Math.abs(120 - nav.getBoundingClientRect().top);
                if (navItemDistance < minTopNavItemDistance) {
                    minTopNavItemDistance = navItemDistance;
                    topNavItem = nav;
                }
            });
            sideBar.classList.toggle('small-thumbnails');
            topNavItem.scrollIntoView();
        });

        const sideBarPanel = document.getElementById('sideBar-panel');
        if (!filteredCategories && document.body.offsetWidth < 601) {
            // @ts-ignore
            sideBarPanel.ui.collapsed = true;
        }
        sideBar.classList.add('visible');

        // when first opening the examples browser via a specific example, scroll it into view
        if (!(window as any)._scrolledToExample) {
            const examplePath = location.hash.split('/');
            document.getElementById(`link-${examplePath[1]}-${examplePath[2]}`)?.scrollIntoView();
            (window as any)._scrolledToExample = true;
        }
    });

    const categories = filteredCategories || defaultCategories;
    return (
        <Container id='sideBar' class='small-thumbnails'>
            <div className='panel-toggle' />
            <Panel headerText="EXAMPLES" collapsible={document.body.offsetWidth < 601} id='sideBar-panel'>
                <TextInput class='filter-input' keyChange placeholder="Filter..." onChange={(filter: string) => {
                    const reg = (filter && filter.length > 0) ? new RegExp(filter, 'i') : null;
                    if (!reg) {
                        setFilteredCategories(defaultCategories);
                        return;
                    }
                    const updatedCategories: any = {};
                    Object.keys(defaultCategories).forEach((category: string) => {
                        if (defaultCategories[category].name.search(reg) !== -1) {
                            updatedCategories[category] = defaultCategories[category];
                            return null;
                        }
                        Object.keys(defaultCategories[category].examples).forEach((example: string) => {
                            if (defaultCategories[category].examples[example].constructor.NAME.search(reg) !== -1) {
                                if (!updatedCategories[category]) {
                                    updatedCategories[category] = {
                                        name: defaultCategories[category].name,
                                        examples: {
                                            [example]: defaultCategories[category].examples[example]
                                        }
                                    };
                                } else {
                                    updatedCategories[category].examples[example] = defaultCategories[category].examples[example];
                                }
                            }
                        });
                    });
                    setFilteredCategories(updatedCategories);
                }}/>
                <LabelGroup text='Large thumbnails:'>
                    <BooleanInput type='toggle'  binding={new BindingTwoWay()} link={{ observer, path: 'largeThumbnails' }} />
                </LabelGroup>
                <Container id='sideBar-contents'>
                    {
                        Object.keys(categories).sort((a: string, b:string) => (a > b ? 1 : -1)).map((category: string) => {
                            return <Panel key={category} class="categoryPanel" headerText={categories[category].name} collapsible={true} collapsed={false}>
                                <ul className="category-nav">
                                    {
                                        Object.keys(categories[category].examples).sort((a: string, b:string) => (a > b ? 1 : -1)).map((example: string) => {
                                            const isSelected = new RegExp(`/${category}/${example}$`).test(hash);
                                            const className = `nav-item ${isSelected ? 'selected' : ''}`;
                                            return <Link key={example} to={`/${category}/${example}`} onClick={() => {
                                                const sideBarPanel = document.getElementById('sideBar-panel');
                                                // @ts-ignore
                                                sideBarPanel.ui.collapsed = true;
                                            }}>
                                                <div className={className} id={`link-${category}-${example}`}>
                                                    <img src={`./thumbnails/${category}_${example}.png`} />
                                                    <div className='nav-item-text'>{categories[category].examples[example].constructor.NAME.toUpperCase()}</div>
                                                </div>
                                            </Link>;
                                        })
                                    }
                                </ul>
                            </Panel>;
                        })
                    }
                    {
                        Object.keys(categories).length === 0 && <Label text='No results'/>
                    }
                </Container>
            </Panel>
        </Container>
    );
};

export default SideBar;
