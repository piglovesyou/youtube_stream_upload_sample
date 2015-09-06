var express = require('express');
var app = express();
var fs = require('fs');
var stream = require('stream');
var util = require('util');
var http = require('http');


// app.get('/', function(req, res) {
//   res.write('<h1>yeah</h1>');
//   res.write('<form method="post" action="upload" enctype="multipart/form-data">');
//     res.write('<input type="file" name="fff" />');
//     res.write('<input type="submit" value="booom!" />');
//   res.write('</form>');
//   res.end()
// });
// app.post('/upload', function(req, res) {
//   console.log(req.pause());
//   setTimeout(function() {
//     res.write('done');
//     res.end();
//   }, 3000);
// 
//   // req.pipe(new UpperTransformer()).pipe(res);
//   // req.on('data', function(chunk) {});
//   // req.on('end', function() {
//   //   console.log('end-----------------')
//   //   res.write('done');
//   //   res.end();
//   // }, 2000)
//   // req.on('data', function(chunk) {
//   //   size += chunk.length / 1024;
//   //   console.log(chunk.length / 1024 + 'KB, total:', size);
//   // });
//   // req.on('end', function() {
//   //   console.log('end---------')
//   //   res.write('done.');
//   //   res.end();
//   // });
// });
// http.createServer(app).listen(3000);



function UpperTransformer() {
  stream.Transform.call(this);
  this.size = 0;
};
util.inherits(UpperTransformer, stream.Transform);
UpperTransformer.prototype._transform = function(chunk, enc, cb) {
  console.log(chunk.length / 1024 + 'K, total:' + ((this.size += chunk.length / 1024) + 'K'));
  var upperChunk = chunk.toString().toUpperCase();
  this.push(upperChunk);
  cb();
};
UpperTransformer.prototype._flush = function(done) {
  console.log('......')
  done();
};

var total = 0;
var shorten = new stream.Transform({objectMode: true});
shorten._transform = function(chunk, enc, cb) {
  total += chunk.length;
  console.log(chunk.length / 1024 + 'K', total / 1024);
  this.push(chunk.slice(0, 128) + '\n');
  cb();
};


var lazy = new stream.Transform({objectMode: true});
lazy._transform = function(chunk, enc, cb) {
  setTimeout((function() {
    this.push(chunk);
    cb();
  }).bind(this), 100)
};


var r = fs.createReadStream('file.txt');
var w = fs.createWriteStream('out.txt');
r.pipe(shorten)
// .pipe(lazy)
.pipe(w);

setInterval(function() {
  console.log(r.isPaused());
}, 1)
