var gulp = require('gulp');
var jshint = require('gulp-jshint');
var react = require('gulp-react');
var merge = require('merge-stream');

var jsFiles = [
  'lib/**/*.js',
  'test/**/*.js',
  '*.js'
];

var jsxFiles = [
  'lib/**/*.jsx'
];

gulp.task('jshint', function() {
  var js = gulp.src(jsFiles);
  var jsx = gulp.src(jsxFiles)
    .pipe(react());

  var stream = merge(js, jsx)
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));

  if (process.env.CI) {
    stream = stream.pipe(jshint.reporter('fail'));
  }

  return stream;
});

gulp.task('jshint-watch', ['jshint'], function(cb){
  console.log('Watching files for changes...');
  gulp.watch(jsFiles.concat(jsxFiles), ['jshint']);
});

gulp.task('default', ['jshint']);
