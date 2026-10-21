import { BindingTwoWay, LabelGroup, Panel, SelectInput, SliderInput } from '@playcanvas/pcui/react';

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
        <Panel headerText='Rendering'>
            <LabelGroup text='Renderer'>
                <SelectInput
                    type='string'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'mode' }}
                    value={observer.get('mode') ?? 'steady'}
                    options={[
                        { v: 'steady', t: 'SteadySplats' },
                        { v: 'stochastic', t: 'Stochastic (Native)' },
                        { v: 'gpu-sort', t: 'Raster (GPU Sort)' },
                        { v: 'cpu-sort', t: 'Raster (CPU Sort)' }
                    ]}
                />
            </LabelGroup>
            <LabelGroup text='History Weight'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'historyWeight' }}
                    min={0}
                    max={0.95}
                    precision={2}
                />
            </LabelGroup>
        </Panel>
    );
}
