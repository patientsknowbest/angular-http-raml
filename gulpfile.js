const gulp = require("gulp");
const tsc = require("gulp-typescript");
const sourcemaps = require("gulp-sourcemaps");
const jasmine = require("gulp-jasmine");




const tsconfig = require("./tsconfig.json");
const tsPath = tsconfig.include;
const compilerOptions = tsconfig.compilerOptions;
compilerOptions.isolatedModules = false;
const tsProject = tsc.createProject(compilerOptions);

gulp.task("compile", (done) => {
  const tsResult = gulp.src(tsPath)
  // .pipe(noop()).on("end", done);
    .pipe(sourcemaps.init())
    .pipe(tsProject());

  tsResult.js
    .pipe(sourcemaps.write())
    .pipe(gulp.dest("js"))
    .on("end", done);
});


gulp.task("test", ["compile"], (done) => {
  gulp.src("spec/*.js").pipe(jasmine());
});
