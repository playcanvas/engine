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
            <Panel headerText='Depth Edge Detection'>
                <LabelGroup text='Threshold'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.threshold' }}
                        min={0.1}
                        max={50}
                        precision={1}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
