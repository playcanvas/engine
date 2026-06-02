import { Button, Panel } from '@playcanvas/pcui/react';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    return (
        <Panel headerText='Asset'>
            <Button text='Previous' onClick={() => observer.emit('previous')} />
            <Button text='Next' onClick={() => observer.emit('next')} />
        </Panel>
    );
}
