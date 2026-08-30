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
            <Panel headerText='Layers'>
                <LabelGroup text='World'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.world' }}
                    />
                </LabelGroup>
                <LabelGroup text='X-Ray'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.xray' }}
                    />
                </LabelGroup>
                <LabelGroup text='Character'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.character' }}
                    />
                </LabelGroup>
                <LabelGroup text='Front'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.front' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Options'>
                <LabelGroup text='Front clears depth'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.frontClearDepth' }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
