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
            <Panel headerText='Scene Rendering'>
                <LabelGroup text='resolution'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.scene.scale' }}
                        min={0.5}
                        max={1}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Bloom'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.scene.bloom' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='TAA'>
                <LabelGroup text='enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.taa.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='sharpness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.scene.sharpness' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='jitter'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.taa.jitter' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
