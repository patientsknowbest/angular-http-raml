module.exports = {
    entry: "./dist/RAMLBackendConfig.js",
    output: {
        filename:"./dist/index.js",
        //library: "my-lib",
        libraryTarget: "commonjs"
    },
  module: {
    loaders: [
      {
        test: /\.json$/,
        loader: 'json-loader'
      }
    ]
  }
}
