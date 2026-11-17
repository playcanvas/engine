import {
    BindingTwoWay,
    BooleanInput,
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
            <Panel headerText='Depth of Field'>
                <LabelGroup text='Enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.dof.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='Blur Radius'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.dof.blurRadius' }}
                        min={1}
                        max={20}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Blur Rings'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.dof.blurRings' }}
                        min={2}
                        max={10}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Blur Ring Points'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.dof.blurRingPoints' }}
                        min={2}
                        max={10}
                        precision={0}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
