import { BindingTwoWay, LabelGroup, BooleanInput, Button } from '@playcanvas/pcui/react';

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
        path: 'jogToggle'
    };
    return (
        <>
            <Button text='Jump' onClick={() => observer.emit('jump')} />
            <LabelGroup text='Run: '>
                <BooleanInput type='toggle' binding={binding} link={link} />
            </LabelGroup>
        </>
    );
}
