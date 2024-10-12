const path = require('path');

module.exports = {
  mode: 'production', // Define o modo como 'development' ou 'production'
  entry: './src/app.js', // Arquivo de entrada
  output: {
    filename: 'bundle.js', // Nome do arquivo de saída
    path: path.resolve(__dirname, 'public/dist'),  // Diretório de saída
    publicPath: '/dist/', // Define onde o bundle será servido pelo DevServer
  },
  module: {
    rules: [
      {
        test: /\.m?js$/, // Processa arquivos .js
        exclude: /(node_modules)/, // Exclui node_modules
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'], // Usa o preset-env para transpilação ES6+
          }
        }
      }
    ]
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'), // Serve arquivos estáticos, como index.html
    },
    compress: true, // Habilita compressão gzip
    port: 9000, // Porta do servidor local
  },
  resolve: {
    extensions: ['.js'], // Resolve arquivos .js
  },
};