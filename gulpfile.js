const gulp = require("gulp");
const tsc = require("gulp-typescript");
const sourcemaps = require("gulp-sourcemaps");
const jasmine = require("gulp-jasmine");




gulp.task("compile", (done) => {
  const tsconfig = require("./tsconfig.json");
  const tsPath = tsconfig.include;
  const compilerOptions = tsconfig.compilerOptions;
  compilerOptions.isolatedModules = false;
  const tsProject = tsc.createProject(compilerOptions);

  const tsResult = gulp.src(tsPath)
    .pipe(sourcemaps.init())
    .pipe(tsProject());

  tsResult.js
    .pipe(sourcemaps.write())
    .pipe(gulp.dest("dist"))
    .on("end", done);
});

gulp.task("test-compile", (done) => {
  const tsconfig = require("./tsconfig.json");
  const tsPath = tsconfig.include;
  const compilerOptions = tsconfig.compilerOptions;
  compilerOptions.isolatedModules = false;
  const tsProject = tsc.createProject(compilerOptions);

  const tsResult = gulp.src(tsPath)
  // .pipe(noop()).on("end", done);
    .pipe(sourcemaps.init())
    .pipe(tsProject());

  tsResult.js
    .pipe(sourcemaps.write())
    .pipe(gulp.dest("dist"))
    .on("end", done);
});


gulp.task("test", ["test-compile"], (done) => {
  gulp.src("dist/*.spec.js").pipe(jasmine());
});
