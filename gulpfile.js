var gulp = require('gulp');
var jshint = require('gulp-jshint');

var jsFiles = [
  'bin/**/*.js',
  'lib/**/*.js',
  'test/**/*.js',
  '*.js'
];

gulp.task('jshint', function() {
  var stream = gulp.src(jsFiles)
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));

  if (process.env.CI) {
    stream = stream.pipe(jshint.reporter('fail'));
  }

  return stream;
});

gulp.task('jshint-watch', ['jshint'], function(cb){
  console.log('Watching files for changes...');
  gulp.watch(jsFiles, ['jshint']);
});

gulp.task('default', ['jshint']);