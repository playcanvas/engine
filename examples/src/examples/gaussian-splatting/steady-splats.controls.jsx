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
                    type='number'
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'renderer' }}
                    value={observer.get('renderer') ?? 4}
                    options={[
                        { v: 4, t: 'SteadySplats' },
                        { v: 2, t: 'Raster (GPU Sort)' },
                        { v: 1, t: 'Raster (CPU Sort)' }
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
