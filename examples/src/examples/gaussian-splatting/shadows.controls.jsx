import { BindingTwoWay, BooleanInput, LabelGroup, SelectInput, SliderInput } from '@playcanvas/pcui/react';

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
            <LabelGroup text='Renderer'>
                <SelectInput
                    type='number'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'renderer' }}
                    value={observer.get('renderer') ?? 0}
                    options={[
                        { v: 0, t: 'Auto' },
                        { v: 1, t: 'Raster (CPU Sort)' },
                        { v: 2, t: 'Raster (GPU Sort)' }
                    ]}
                />
            </LabelGroup>
            <LabelGroup text='Shadow Clip'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'alphaClip' }}
                    min={0}
                    max={1}
                    precision={2}
                />
            </LabelGroup>
            <LabelGroup text='Lights'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'numLights' }}
                    min={0}
                    max={6}
                    step={1}
                    precision={0}
                />
            </LabelGroup>
            <LabelGroup text='Animate'>
                <BooleanInput
                    type='toggle'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'shader' }}
                />
            </LabelGroup>
        </>
    );
}
