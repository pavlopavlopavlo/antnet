const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: './client/src/index.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].[contenthash].js',
      clean: true
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env', '@babel/preset-react']
            }
          }
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        },
        {
          test: /\.(vert|frag|glsl)$/,
          use: 'raw-loader'
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './client/public/index.html',
        favicon: './client/public/favicon.ico'
      })
    ],
    devServer: {
      static: path.join(__dirname, 'dist'),
      compress: true,
      port: 3000,
      hot: true,
      proxy: {
        '/api': 'http://localhost:5000',
        '/socket.io': {
          target: 'http://localhost:5000',
          ws: true
        }
      }
    },
    mode: isProduction ? 'production' : 'development',
    devtool: isProduction ? 'source-map' : 'eval-source-map'
  };
};
