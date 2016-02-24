var context = require.context('./test/browser', true, /\.js$|\.jsx$/); // Load files in /test/browser/ with filename matching * .js
context.keys().forEach(context);
