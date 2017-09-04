import {safeLoad, Schema, Type} from "js-yaml";

function syncGet(path: string): string {
  var request = new XMLHttpRequest();
  request.open('GET', path, false);
  request.send(null);
  if (request.status === 200) {
    return request.responseText;
  } else {
    throw Error(request.status + ": GET " + path);
  }
}

export class YAMLFileLoader {

  private currentDocumentPath;

  constructor(pathToYAMLFile: string) {
    this.currentDocumentPath = pathToYAMLFile;
  }

  public loadFile(): any {
    const api = safeLoad(syncGet(this.currentDocumentPath), {
      schema: Schema.create([new IncludeType(this.currentDocumentPath)])
    });
    return api;
  }

}

export class IncludeType extends Type {

  private relPathToAbs(sRelPath) {
    var nUpLn, sDir = "", sPath = this.parentDocumentPath.replace(/[^\/]*$/, sRelPath.replace(/(\/|^)(?:\.?\/+)+/g, "$1"));
    for (var nEnd, nStart = 0; nEnd = sPath.indexOf("/../", nStart), nEnd > -1; nStart = nEnd + nUpLn) {
      nUpLn = /^\/(?:\.\.\/)*/.exec(sPath.slice(nEnd))[0].length;
      sDir = (sDir + sPath.substring(nStart, nEnd)).replace(new RegExp("(?:\\\/+[^\\\/]*){0," + ((nUpLn - 1) / 3) + "}$"), "/");
    }
    return sDir + sPath.substr(nStart);
  }

  constructor(private parentDocumentPath) {
    super("!include", {
      kind: "scalar",
      construct: function (pathToRAMLFile) {
        return safeLoad(syncGet(this.relPathToAbs(pathToRAMLFile)), {
          schema: Schema.create([new IncludeType(pathToRAMLFile)])
        });
      },
      resolve: function (path: string) {
        return true;
      }
    });
  }
}
