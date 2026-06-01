import { BindingTwoWay, LabelGroup, Panel, BooleanInput } from '@playcanvas/pcui/react';

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
        <>
            <Panel headerText='Options'>
                <LabelGroup text='Soft'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.soft' }}
                        value={observer.get('data.soft')}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
