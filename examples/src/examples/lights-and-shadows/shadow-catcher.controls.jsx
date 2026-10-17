import { BindingTwoWay, BooleanInput, LabelGroup, Panel } from '@playcanvas/pcui/react';

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
            <Panel headerText='Settings'>
                <LabelGroup text='Enable'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.catcher' }}
                    />
                </LabelGroup>
                <LabelGroup text='Affect Scene'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.affectScene' }}
                    />
                </LabelGroup>
                <LabelGroup text='Rotate'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.rotate' }}
                    />
                </LabelGroup>
                <LabelGroup text='DOF'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.dof' }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
