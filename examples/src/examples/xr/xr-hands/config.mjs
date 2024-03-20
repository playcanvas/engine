/**
 * @type {import('../../../../types.mjs').ExampleConfig}
 */
export default {
    FILES: {
        'ui.html': /* html */`
            <div class='container'>
                <div class='button' data-xr='immersive-ar'>AR</div>
                <div class='button' data-xr='immersive-vr'>VR</div>
            </div>
            <div class='message'></div>
        `,
        'ui.css': /* css */`
            body {
                font-family: 'Helvetica Neue', Arial, Helvetica, sans-serif;
            }
            .container {
                display: flex;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                width: auto;
                height: auto;
                flex-wrap: nowrap;
                justify-content: center;
                align-items: center;
            }
            .container > .button {
                padding: 32px;
                margin: 8px;
                color: #fff;
                background-color: rgba(0, 0, 0, 0.5);
                font-size: 24px;
                font-weight: bold;
                opacity: 0.3;
                cursor: default;
            }
            .container > .button.active {
                opacity: 1;
                cursor: pointer;
            }
            .container > .button.active:hover {
                background-color: rgba(0, 0, 0, 1);
            }
            .message {
                position: absolute;
                margin: 8px;
                bottom: 0;
                right: 0;
                padding: 8px 16px;
                color: #fff;
                background-color: rgba(0, 0, 0, 0.5);
            }
            @media only screen and (max-width: 600px) {
                .message {
                    bottom: 80px;
                }
            }
        `
    }
};
