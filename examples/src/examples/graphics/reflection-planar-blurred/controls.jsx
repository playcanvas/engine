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
            <Panel headerText='Blurred Planar Reflection'>
                <LabelGroup text='Resolution'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.resolution' }}
                        min={0.1}
                        max={1.0}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Blur Amount'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.blurAmount' }}
                        min={0}
                        max={1.0}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.intensity' }}
                        min={0}
                        max={1.0}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Fade Strength'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.fadeStrength' }}
                        min={0.1}
                        max={5.0}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Angle Fade'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.angleFade' }}
                        min={0.1}
                        max={1.0}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Height Range'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.heightRange' }}
                        min={0.001}
                        max={1.0}
                        precision={3}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
