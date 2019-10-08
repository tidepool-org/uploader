const context = require.context('.', true, /.+\.test\.js$/);
console.log(context);
 
context.keys().forEach(context);
 
module.exports = context;