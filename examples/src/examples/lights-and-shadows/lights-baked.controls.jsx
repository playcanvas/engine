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
            <Panel headerText='Lights'>
                <LabelGroup text='🟢 Omni'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.lights.omni' }}
                        value={observer.get('data.lights.omni')}
                    />
                </LabelGroup>
                <LabelGroup text='🔴 Spot'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.lights.spot' }}
                        value={observer.get('data.lights.spot')}
                    />
                </LabelGroup>
                <LabelGroup text='🟡 Directional'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.lights.directional' }}
                        value={observer.get('data.lights.directional')}
                    />
                </LabelGroup>
                <LabelGroup text='    🟡 Soft'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.lights.soft' }}
                        value={observer.get('data.lights.soft')}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
