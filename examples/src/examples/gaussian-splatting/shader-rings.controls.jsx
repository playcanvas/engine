import {
    BindingTwoWay,
    LabelGroup,
    Panel,
    SliderInput
} from '@playcanvas/pcui/react';

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
            <Panel headerText='Rings'>
                <LabelGroup text='Width (px)'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'ringWidth' }}
                        min={1}
                        max={10}
                        precision={1}
                        step={0.5}
                    />
                </LabelGroup>
                <LabelGroup text='Alpha'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'ringAlpha' }}
                        min={0.05}
                        max={1}
                        precision={2}
                        step={0.05}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
