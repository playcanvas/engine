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
            <Panel headerText='Ink Outline'>
                <LabelGroup text='Enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.outline.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='Width'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.outline.width' }}
                        min={1}
                        max={4}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Depth Threshold'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.outline.depthThreshold' }}
                        min={0.002}
                        max={0.1}
                        precision={3}
                    />
                </LabelGroup>
                <LabelGroup text='Color Threshold'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.outline.colorThreshold' }}
                        min={0.05}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.outline.intensity' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Rendering'>
                <LabelGroup text='MSAA'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.rendering.msaa' }}
                    />
                </LabelGroup>
                <LabelGroup text='TAA'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.rendering.taa' }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
