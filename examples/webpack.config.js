const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

const config = {
    mode: process.env.ENVIRONMENT || 'development',    entry: './src/app/index.tsx',
    output: {
        path: path.resolve(__dirname, 'dist/static'),
        publicPath: process.env.PUBLIC_PATH || undefined,
        filename: process.env.ENVIRONMENT === 'production' ? 'bundle.[contenthash].js' : 'bundle.js'
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /\.tsx?$/,
                use: [
                    {

                        loader: "babel-loader",
                        options: {
                            presets: [
                                "@babel/preset-env",
                                "@babel/preset-react"
                            ],
                            plugins: [
                                "@babel/plugin-proposal-class-properties"
                            ]
                        }
                    },
                    'awesome-typescript-loader'
                ]
            },
            {
                test: /\.jsx?$/,
                use: [
                    {

                        loader: "babel-loader",
                        options: {
                            presets: [
                                "@babel/preset-env",
                                "@babel/preset-react"
                            ],
                            plugins: [
                                "@babel/plugin-proposal-class-properties"
                            ]
                        }
                    },
                    'awesome-typescript-loader'
                ],
                include: [
                    path.resolve(__dirname, '../javascript-error-overlay/src')
                ]
            }
        ]
    },
    resolve: {
        modules: [
            path.resolve(__dirname, 'src'),
            'node_modules'
        ],
        alias: {
            lib: path.resolve(__dirname, 'lib')
        },
        extensions: ['.tsx', '.ts', '.js', '.css']
    },
    devtool: process.env.ENVIRONMENT === 'production' ? 'source-map' : 'eval-source-map',
    context: __dirname,
    target: 'web',
    devServer: {
        proxy: {
            '/api': 'http://localhost:3000'
        },
        contentBase: path.join(__dirname, 'public'),
        compress: true,
        historyApiFallback: true,
        hot: true,
        https: false,
        noInfo: true
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: 'src/app/index.ejs',
            filename: '../index.html',
            hasPublicPath: !!process.env.PUBLIC_PATH
        }),
        new CopyWebpackPlugin({
            patterns: [
                { from: 'src/wasm-loader.js', to: '' },
                { from: 'assets', to: 'assets' },
                { from: 'src/lib', to: 'lib' },
                { from: '../scripts', to: 'scripts' }
            ]
        }),
        new webpack.DefinePlugin({
            __PUBLIC_PATH__: JSON.stringify(process.env.PUBLIC_PATH)
        }),
        new webpack.ProvidePlugin({
            'React': 'react'
        }),
        new MonacoWebpackPlugin({
            languages: ['javascript', 'typescript']
        })
    ]
};

if (process.env.ENGINE_PATH) {
    config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
            /^playcanvas\/build\/playcanvas\.js$/,
            path.resolve(__dirname, process.env.ENGINE_PATH)
        )
    );
}

if (process.env.EXTRAS_PATH) {
    config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
            /^playcanvas\/build\/playcanvas-extras\.js$/,
            path.resolve(__dirname, process.env.EXTRAS_PATH)
        )
    );
}

if (process.env.ANALYZE_BUNDLE) {
    config.plugins.push(
        new BundleAnalyzerPlugin()
    );
}

module.exports = config;
