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
            <Panel headerText='Detail Maps'>
                <LabelGroup text='Diffuse'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.diffuse' }}
                    />
                </LabelGroup>
                <LabelGroup text='Normal'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.normal' }}
                    />
                </LabelGroup>
                <LabelGroup text='AO'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.ao' }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
