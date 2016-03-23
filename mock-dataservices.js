var express = require('express');

var port = 8077;

var app = express();

app.post('*', function(req, resp) {
  resp.sendStatus(200);
});

app.listen(8077);
