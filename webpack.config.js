const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');

// WARNING: This is a legacy webpack config
// For new builds use the modern build system in /build directory

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: './src/legacy/index.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'bundle.[contenthash].js',
      chunkFilename: '[name].[contenthash].js',
      publicPath: '/'
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true
            }
          }
        }
      ]
    },
    optimization: {
      minimize: isProduction,
      minimizer: [new TerserPlugin()],
      splitChunks: {
        chunks: 'all',
        minSize: 20000,
        maxAsyncRequests: 30,
        maxInitialRequests: 30
      }
    }
  };
};
