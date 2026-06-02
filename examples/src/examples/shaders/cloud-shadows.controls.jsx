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
            <Panel headerText='Cloud Shadows'>
                <LabelGroup text='Speed'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.speed' }}
                        min={0}
                        max={0.2}
                        precision={3}
                    />
                </LabelGroup>
                <LabelGroup text='Direction'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.direction' }}
                        min={0}
                        max={360}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.intensity' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Scale'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.scale' }}
                        min={0.01}
                        max={0.5}
                        precision={3}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
