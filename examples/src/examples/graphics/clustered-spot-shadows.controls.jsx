import {
    BindingTwoWay,
    BooleanInput,
    Button,
    Label,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';

import * as pc from 'playcanvas';

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
            <Panel headerText='Atlas'>
                <LabelGroup text='Resolution'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.shadowAtlasResolution' }}
                        min={256}
                        max={4096}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Split'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.atlasSplit' }}
                        type='number'
                        options={[
                            { v: 0, t: 'Automatic' },
                            { v: 1, t: '7 Shadows' },
                            { v: 2, t: '12 Shadows' },
                            { v: 3, t: '16 Shadows' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Filter'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.shadowType' }}
                        type='number'
                        options={[
                            { v: pc.SHADOW_PCF1_32F, t: 'PCF1_32F' },
                            { v: pc.SHADOW_PCF3_32F, t: 'PCF3_32F' },
                            { v: pc.SHADOW_PCF5_32F, t: 'PCF5_32F' },
                            { v: pc.SHADOW_PCF1_16F, t: 'PCF1_16F' },
                            { v: pc.SHADOW_PCF3_16F, t: 'PCF3_16F' },
                            { v: pc.SHADOW_PCF5_16F, t: 'PCF5_16F' }
                        ]}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Lights'>
                <LabelGroup text='Shadows On'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.shadowsEnabled' }}
                        value={observer.get('settings.shadowsEnabled')}
                    />
                </LabelGroup>
                <LabelGroup text='Cookies On'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.cookiesEnabled' }}
                        value={observer.get('settings.cookiesEnabled')}
                    />
                </LabelGroup>
                <LabelGroup text='Static'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.static' }}
                        value={observer.get('settings.static')}
                    />
                </LabelGroup>
                <LabelGroup text='Shadow Intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.shadowIntensity' }}
                        min={0}
                        max={1}
                        value={observer.get('settings.shadowIntensity')}
                    />
                </LabelGroup>
                <LabelGroup text='Cookie Intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.cookieIntensity' }}
                        min={0}
                        max={1}
                        value={observer.get('settings.cookieIntensity')}
                    />
                </LabelGroup>
                <Button text='Add Light' onClick={() => observer.emit('add')} />
                <Button text='Remove Light' onClick={() => observer.emit('remove')} />
                <LabelGroup text='Light Count'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.numLights' }}
                        value={observer.get('settings.numLights')}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Debug'>
                <LabelGroup text='Cells'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.debug' }}
                        value={observer.get('settings.debug')}
                    />
                </LabelGroup>
                <LabelGroup text='Atlas'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.debugAtlas' }}
                        value={observer.get('settings.debugAtlas')}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
