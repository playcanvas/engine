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
    const categories = props.categories;
    const [filteredCategories, setFilteredCategories] = useState(categories);
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
            sideBar.classList.toggle('small-thumbnails');
        });
    });

    return (
        <Container id='sideBar' class='small-thumbnails'>
            <div className='panel-toggle' />
            <Panel headerText="EXAMPLES" collapsible={document.body.offsetWidth < 601} id='sideBar-panel' collapsed={document.body.offsetWidth < 601}>
                <TextInput class='filter-input' keyChange placeholder="Filter..." onChange={(filter: string) => {
                    const reg = (filter && filter.length > 0) ? new RegExp(filter, 'i') : null;
                    if (!reg) {
                        setFilteredCategories(categories);
                        return;
                    }
                    const updatedCategories: any = {};
                    Object.keys(categories).forEach((category: string) => {
                        if (categories[category].name.search(reg) !== -1) {
                            updatedCategories[category] = categories[category];
                            return null;
                        }
                        Object.keys(categories[category].examples).forEach((example: string) => {
                            if (categories[category].examples[example].constructor.NAME.search(reg) !== -1) {
                                if (!updatedCategories[category]) {
                                    updatedCategories[category] = {
                                        name: categories[category].name,
                                        examples: {
                                            [example]: categories[category].examples[example]
                                        }
                                    };
                                } else {
                                    updatedCategories[category].examples[example] = categories[category].examples[example];
                                }
                            }
                        });
                    });
                    setFilteredCategories(updatedCategories);
                }}/>
                <LabelGroup text='Large thumbnails:'>
                    <BooleanInput type='toggle'  binding={new BindingTwoWay()} link={{ observer, path: 'largeThumbnails' }} />
                </LabelGroup>
                <Container class='sideBar-contents'>
                    {
                        Object.keys(filteredCategories).sort((a: string, b:string) => (a > b ? 1 : -1)).map((category: string) => {
                            return <Panel key={category} class="categoryPanel" headerText={filteredCategories[category].name} collapsible={true} collapsed={false}>
                                <ul className="category-nav">
                                    {
                                        Object.keys(filteredCategories[category].examples).sort((a: string, b:string) => (a > b ? 1 : -1)).map((example: string) => {
                                            const isSelected = new RegExp(`/${category}/${example}$`).test(hash);
                                            const className = `nav-item ${isSelected ? 'selected' : ''}`;
                                            return <Link key={example} to={`/${category}/${example}`}>
                                                <div className={className}>
                                                    <img src={`./thumbnails/${category}_${example}.png`} />
                                                    <div className='nav-item-text'>{filteredCategories[category].examples[example].constructor.NAME.toUpperCase()}</div>
                                                </div>
                                            </Link>;
                                        })
                                    }
                                </ul>
                            </Panel>;
                        })
                    }
                    {
                        Object.keys(filteredCategories).length === 0 && <Label text='No results'/>
                    }
                </Container>
            </Panel>
        </Container>
    );
};

export default SideBar;
