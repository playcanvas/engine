import { Panel } from '@playcanvas/pcui/react';
import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

import { fragment, jsx } from '../jsx.mjs';

/**
 * @import { ComponentProps, ReactElement, ReactNode } from 'react'
 */

const CATEGORY_PANEL_ID = 'category-panel-';

/**
 * @param {object} props - Component properties.
 * @param {string} props.category - Category name.
 * @param {boolean} props.collapsed - Whether the category is collapsed.
 * @param {() => void} [props.onExpandAll] - Show all categories instead of sharing this category.
 * @param {ComponentProps<typeof Panel>['parent']} [props.parent] - Parent PCUI container.
 * @param {ReactNode} [props.children] - Example links.
 * @returns {ReactElement} Category panel with a share or expand-all control in its header.
 */
function CategoryPanel({ category, collapsed, onExpandAll, parent, children }) {
    const id = `${CATEGORY_PANEL_ID}${category}`;
    const [header, setHeader] = useState(/** @type {Element | null} */ (null));

    // PCUI creates the header outside the React children container.
    useLayoutEffect(() => {
        setHeader(document.getElementById(id)?.querySelector('.pcui-panel-header') ?? null);
    }, [id]);

    const icon = jsx('svg', {
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        width: 16,
        height: 16,
        'aria-hidden': true
    }, onExpandAll ? jsx('path', { d: 'M8 7l4-4 4 4M12 3v6M8 17l4 4 4-4M12 15v6' }) : fragment(
        jsx('circle', { cx: 18, cy: 5, r: 3 }),
        jsx('circle', { cx: 6, cy: 12, r: 3 }),
        jsx('circle', { cx: 18, cy: 19, r: 3 }),
        jsx('line', { x1: 8.59, y1: 13.51, x2: 15.42, y2: 17.49 }),
        jsx('line', { x1: 15.41, y1: 6.51, x2: 8.59, y2: 10.49 })
    ));
    const control = onExpandAll ? jsx('button', {
        type: 'button',
        className: 'category-share',
        title: 'Show all categories',
        'aria-label': 'Show all categories',
        onClick: (event) => {
            event.stopPropagation();
            onExpandAll();
        }
    }, icon) : jsx(Link, {
        to: `/${category}`,
        className: 'category-share',
        title: 'Share category',
        'aria-label': `Share ${category.split('-').join(' ')} category`,
        onClick: event => event.stopPropagation()
    }, icon);

    return fragment(
        jsx(Panel, {
            id,
            parent,
            class: 'categoryPanel',
            headerText: category.split('-').join(' ').toUpperCase(),
            collapsible: true,
            collapsed
        }, children),
        header && createPortal(control, header)
    );
}

export { CATEGORY_PANEL_ID, CategoryPanel };
