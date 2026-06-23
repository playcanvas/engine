import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput,
    Label
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
    const lutOptions = observer.get('lutSelectOptions') ?? [];
    return (
        <>
            <Panel headerText='Color LUT'>
                <LabelGroup text='LUT 1'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lut' }}
                        type='string'
                        options={lutOptions}
                    />
                </LabelGroup>
                <LabelGroup text='Intensity 1'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lutIntensity' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='LUT 2'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lut2' }}
                        type='string'
                        options={lutOptions}
                    />
                </LabelGroup>
                <LabelGroup text='Intensity 2'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lutIntensity2' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Blend'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lutBlend' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Animate'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'lutAnimate' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Settings'>
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
                <LabelGroup text='Splat Budget (M)'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'splatBudget' }}
                        min={0}
                        max={10}
                        precision={2}
                        step={0.05}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Stats'>
                <LabelGroup text='Resolution'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.stats.resolution' }}
                        value={observer.get('data.stats.resolution')}
                    />
                </LabelGroup>
                <LabelGroup text='GSplat Count'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.stats.gsplats' }}
                        value={observer.get('data.stats.gsplats')}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
