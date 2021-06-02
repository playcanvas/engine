import React, { useState } from 'react';

// @ts-ignore: library file import
import { Container, Button, Label, TextAreaInput } from '@playcanvas/pcui/pcui-react';

interface MenuProps {
    lintErrors: boolean,
    hasEditedFiles: boolean,
    playButtonRef: any
}
const Menu = (props: MenuProps) => {

    let mouseTimeout: any = null;
    let clickFullscreenListener: EventListener = null;
    const [showEmbedContainer, setShowEmbedContainer] = useState(false);

    return <Container id='menu'>
        <Container id='menu-buttons'>
            <img src='https://playcanvas.com/viewer/static/playcanvas-logo.png' />
            <Button icon='E256' text='' onClick={() => {
                const tweetText = encodeURI(`Check out this @playcanvas engine example! ${location.href.replace('#/', '')}`);
                window.open(`https://twitter.com/intent/tweet?text=${tweetText}`);
            }}/>
            <Button icon='E236' text='' id='embed-button' onClick={() => {
                setShowEmbedContainer(!document.getElementById('menu-embed-container'));
                document.getElementById('embed-button').classList.toggle('selected');
            }}/>
            <Button icon='E259' text='' onClick={() => {
                window.open("https://github.com/playcanvas/engine");
            }}/>
            <Button icon='E127' text='' id='fullscreen-button' onClick={() => {
                if (clickFullscreenListener) {
                    document.querySelector('iframe').contentDocument.removeEventListener('mousemove', clickFullscreenListener);
                }
                document.querySelector('#canvas-container').classList.toggle('fullscreen');
                const app = document.querySelector('#appInner');
                app.classList.toggle('fullscreen');
                if (app.classList.contains('fullscreen')) {
                    clickFullscreenListener = () => {
                        console.log('here');
                        app.classList.add('active');
                        if (mouseTimeout) {
                            window.clearTimeout(mouseTimeout);
                        }
                        mouseTimeout = setTimeout(() => {
                            app.classList.remove('active');
                        }, 2000);
                    };
                    console.log(clickFullscreenListener);
                    document.querySelector('iframe').contentDocument.addEventListener('mousemove', clickFullscreenListener);
                }
            }}/>
            <Button id='play-button' enabled={!props.lintErrors && props.hasEditedFiles} icon='E131' text='' ref={props.playButtonRef} />
        </Container>
        { showEmbedContainer && <Container id='menu-embed-container'>
            <Label text='Copy this iframe to embed the current example in your webpage:' />
            <TextAreaInput enabled={false} value={`<iframe src="${location.href.replace('#/', '#/iframe/')}" frameborder="0"></iframe>`}/>
        </Container> }
    </Container>;
};

export default Menu;
