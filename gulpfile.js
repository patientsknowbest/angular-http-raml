const gulp = require("gulp");
const tsc = require("gulp-typescript");
const sourcemaps = require("gulp-sourcemaps");
const jasmine = require("gulp-jasmine");
const typedoc = require("gulp-typedoc");



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


gulp.task("typedoc", ["compile"], (done) => {
  return gulp
    .src(["./RAMLBackend.ts"])
    .pipe(typedoc({
      module: "commonjs",
      target: "es5",
      out: "docs/",
      name: "My project title"
    }))
    ;
});
