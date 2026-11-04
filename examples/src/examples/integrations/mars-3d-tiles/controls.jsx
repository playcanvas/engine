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
            <Panel headerText='Tiles'>
                <LabelGroup text='Error Target'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.tiles.errorTarget' }}
                        min={1}
                        max={32}
                        precision={0}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Lighting'>
                <LabelGroup text='Sun Elevation'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.sun.elevation' }}
                        min={5}
                        max={85}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Sun Azimuth'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.sun.azimuth' }}
                        min={0}
                        max={360}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Haze'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.fog.density' }}
                        min={0}
                        max={0.02}
                        precision={4}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Rover'>
                <LabelGroup text='Speed'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.rover.speed' }}
                        min={0}
                        max={2}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
