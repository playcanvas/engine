import { BindingTwoWay, LabelGroup, SliderInput } from '@playcanvas/pcui/react';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    const binding = new BindingTwoWay();
    const link = {
        observer,
        path: 'blend'
    };
    return (
        <LabelGroup text='blend'>
            <SliderInput binding={binding} link={link} />
        </LabelGroup>
    );
}
