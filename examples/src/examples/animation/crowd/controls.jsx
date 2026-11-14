import {
    BindingTwoWay,
    BooleanInput,
    Label,
    LabelGroup,
    Panel,
    SelectInput,
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
            <Panel headerText='Crowd'>
                <LabelGroup text='Count'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.count' }}
                        min={1}
                        max={500}
                        precision={0}
                        step={1}
                    />
                </LabelGroup>
                <LabelGroup text='Custom AABB'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.customAabb' }}
                    />
                </LabelGroup>
                <LabelGroup text='Shadows'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.shadows' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Optimizations'>
                <LabelGroup text='Off-screen'>
                    <SelectInput
                        options={[
                            { v: 'full', t: 'Full' },
                            { v: 'state', t: 'State' },
                            { v: 'none', t: 'None' }
                        ]}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.offscreenUpdate' }}
                    />
                </LabelGroup>
                <LabelGroup text='Prediction'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.prediction' }}
                    />
                </LabelGroup>
                <LabelGroup text='Distance LOD'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.lod' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Stats'>
                <LabelGroup text='Anim update'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.stats.animTime' }}
                    />
                </LabelGroup>
                <LabelGroup text='Evaluated'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.stats.evaluated' }}
                    />
                </LabelGroup>
                <LabelGroup text='Off-screen'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.stats.offscreen' }}
                    />
                </LabelGroup>
                <LabelGroup text='LOD skipped'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.stats.skipped' }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
