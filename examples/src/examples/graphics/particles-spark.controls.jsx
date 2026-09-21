import { BindingTwoWay, LabelGroup, Panel, SliderInput } from '@playcanvas/pcui/react';

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
            <Panel headerText='Emission'>
                <LabelGroup text='Rate'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.rate' }}
                        min={0.002}
                        max={0.2}
                        step={0.001}
                        precision={3}
                    />
                </LabelGroup>
                <LabelGroup text='Rate 2'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.rate2' }}
                        min={0.002}
                        max={0.2}
                        step={0.001}
                        precision={3}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
