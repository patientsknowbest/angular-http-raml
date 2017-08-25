import {Behavior, DefaultRequestValidator, NoopRequestValidator, RAMLBackend, RequestPattern} from "./RAMLBackend";
import {safeLoad, Schema, Type} from "js-yaml";
import {Request, RequestMethod, Response, ResponseOptions} from "@angular/http";
import URL = require("url-parse");

export class InvalidStubbingError extends Error {

}

export class ResponseSetter {

  constructor(private owner: RAMLBackendConfig,
              private onReady: (response: Response) => void) {
  }

  public thenRespond(response: Response): RAMLBackendConfig {
    this.onReady(response);
    return this.owner;
  }

  public thenRespondWith(statusCode: number, exampleIdentifier?: string): RAMLBackendConfig {
    const response = this.owner.lookupResponse(statusCode, exampleIdentifier);
    this.onReady(response);
    return this.owner;
  }

}

interface PendingBehaviorSpecification {

  prematchedBehavior: Behavior;

  request: Request;

  // responsePatternCandidates: Method[];

}

function relPathToAbs(sRelPath, currentPath = location.pathname) {
  var nUpLn, sDir = "", sPath = currentPath.replace(/[^\/]*$/, sRelPath.replace(/(\/|^)(?:\.?\/+)+/g, "$1"));
  for (var nEnd, nStart = 0; nEnd = sPath.indexOf("/../", nStart), nEnd > -1; nStart = nEnd + nUpLn) {
    nUpLn = /^\/(?:\.\.\/)*/.exec(sPath.slice(nEnd))[0].length;
    sDir = (sDir + sPath.substring(nStart, nEnd)).replace(new RegExp("(?:\\\/+[^\\\/]*){0," + ((nUpLn - 1) / 3) + "}$"), "/");
  }
  return sDir + sPath.substr(nStart);
}

class YAMLFileLoader {

  private currentDocumentPath;

  constructor(pathToYAMLFile: string) {
    this.currentDocumentPath = pathToYAMLFile;
  }

  public loadFile(): any {
    this.currentDocumentPath = relPathToAbs(this.currentDocumentPath, rootFilePath);
    var request = new XMLHttpRequest();
    request.open('GET', this.currentDocumentPath, false);
    request.send(null);
    if (request.status === 200) {
      const api = safeLoad(request.responseText, {
        schema: Schema.create([new IncludeType()])
      });
      return api;
    } else {
      throw Error(request.status + ": GET " + this.currentDocumentPath);
    }
  }

}

let rootFilePath;

export class IncludeType extends Type {

  constructor() {
    super("!include", {
      kind: "scalar",
      construct: function (pathToRAMLFile) {
        pathToRAMLFile = relPathToAbs(pathToRAMLFile, rootFilePath);
        var request = new XMLHttpRequest();
        request.open('GET', pathToRAMLFile, false);
        request.send(null);
        if (request.status === 200) {
          const api = safeLoad(request.responseText, {
            schema: Schema.create([new IncludeType()])
          });
          return api;
        } else {
          throw Error(request.status + ": GET " + pathToRAMLFile);
        }
      },
      resolve: function (path: string) {
        return true;
      }
    });
  }
}

export class RAMLBackendConfig {

  static topLevelKeywords: string[] = ["title", "version", "baseUri",
    "mediaType", "types", "securedBy"];


  static initWithFile(pathToRAMLFile: string): RAMLBackendConfig {
    rootFilePath = pathToRAMLFile;
    var request = new XMLHttpRequest();
    request.open('GET', pathToRAMLFile, false);  // `false` makes the request synchronous
    request.send(null);

    if (request.status === 200) {
      const api = safeLoad(request.responseText, {
        schema: Schema.create([new IncludeType()])
      });
      return new RAMLBackendConfig(api);
    }
    throw new Error("failed to GET " + pathToRAMLFile + ": " + request.status);
  }

  private static findBestDummyResponse(responses): { statusCode: number, responseDefinition: any } {
    let bestFittingResp = null, bestFittingRespCode = null;
    for (const code in responses) {
      const candidate = responses[code];
      const statusCode = Number.parseInt(code);
      if (200 <= statusCode && statusCode < 300) {
        if (bestFittingRespCode === null || bestFittingRespCode > statusCode) {
          bestFittingResp = candidate;
          bestFittingRespCode = statusCode;
        }
      }
    }
    return {statusCode: bestFittingRespCode, responseDefinition: bestFittingResp || {}};
  }

  private defined: Behavior[] = [];

  private stubbed: Behavior[] = [];

  private expected: Behavior[] = [];

  private pendingBehaviorSpecification: PendingBehaviorSpecification = null;

  private findRequestBodySchema(method): any {
    if (method["body"] && method["body"]["type"]) {
      const rawSchema = method["body"]["type"];
      try {
        return rawSchema;
      } catch (e) {
        const typeName = rawSchema.trim();
        for (const t in this.api["types"]) {
          if (t === typeName) {
            return JSON.parse(this.api["types"][t].toString());
          }
        }
      }
    } else {
      return null;
    }
  }

  private absoluteUri(relativeUri: string): string {
    return this.api["baseUri"] + relativeUri;
  }

  private isKeyword(candidate: string): boolean {
    for (let i in RAMLBackendConfig.topLevelKeywords) {
      if (RAMLBackendConfig.topLevelKeywords[i] === candidate) {
        return true;
      }
    }
    return false;
  }

  private allResources(api: any): any {
    const rval = {};
    for (var i in api) {
      if (!this.isKeyword(i)) {
        rval[i] = api[i];
      }
    }
    return rval;
  }

  constructor(private api) {
    const entries: Behavior[] = [];
    const allResources = this.allResources(this.api);
    for (const i in allResources) {
      const resource = allResources[i];
      const resourceUri = this.absoluteUri(i);
      for (const methodName in resource) {
        const method = resource[methodName];
        const schema = this.findRequestBodySchema(method);

        const pattern = new RequestPattern(resourceUri, methodName, schema);
        const {statusCode, responseDefinition} = RAMLBackendConfig.findBestDummyResponse(method["responses"]);
        const response = this.buildResponseFromDefinition(statusCode, responseDefinition);
        entries.push({
          requestPattern: pattern,
          response: response,
          requestValidator: new DefaultRequestValidator(method)
        });
      }
    }
    this.defined = entries;
  }

  private buildResponseFromDefinition(statusCode, responseDefinition, exampleIdentifier?: string) {
    return new Response(new ResponseOptions({
      status: statusCode,
      body: this.lookupExampleResponseBody(responseDefinition["body"], exampleIdentifier)
    }));
  }

  public stubAll(): RAMLBackendConfig {
    this.defined.forEach(behavior => this.stubbed.push(behavior));
    return this;
  }

  private lookupExampleResponseBody(respBodyDef, exampleIdentifier?: string): string {
    function throwError() {
      throw new InvalidStubbingError("could not find example [" + exampleIdentifier + "]");
    }

    if (respBodyDef == undefined) {
      if (exampleIdentifier != null) {
        throwError();
      }
      return null;
    }
    const exampleDefs = respBodyDef["examples"];
    if (exampleIdentifier != null) {
      if (exampleDefs == null || exampleDefs.length === 0) {
        throwError();
      }
      for (const exampleName in exampleDefs) {
        if (exampleName === exampleIdentifier) {
          return exampleDefs[exampleName];
        }
      }
      throwError();
    }
    return respBodyDef["example"];
  }

  public lookupResponse(statusCode: number, exampleIdentifier: string): Response {
    const possibleResponseDefs = this.lookupResponseDefsByRequest(this.pendingBehaviorSpecification.request);
    for (const code in possibleResponseDefs) {
      if (Number.parseInt(code) === statusCode) {
        return this.buildResponseFromDefinition(statusCode, possibleResponseDefs[code], exampleIdentifier);
      }
    }
    throw new InvalidStubbingError("there is no response defined with status code " + statusCode + " in the RAML file");
  }

  private lookupResponseDefsByRequest(request: Request): any {
    for (const i in this.allResources(this.api)) {
      const res = this.allResources(this.api)[i];
      let methods = Object.keys(res);
      for (const methodName in methods) {
        const method = methods[methodName];
        const pattern = new RequestPattern(this.absoluteUri(i), method, this.findRequestBodySchema(res[method]));
        if (pattern.matches(request)) {
          const rval = {};
          for (let statusCode in res[method].responses) {
            rval[statusCode] = res[method].responses[statusCode] || {};
          }
          return rval;
        }
      }
    }
    throw "not found";
  }

  private onStubResponseAvailable(requestPattern: RequestPattern, response: Response) {
    // this.pendingBehaviorSpecification.prematchedBehavior.;
    this.stubbed.unshift({
      response: response,
      requestPattern: requestPattern,
      requestValidator: new NoopRequestValidator()
    });
    this.pendingBehaviorSpecification = null;
  }

  private onMockResponseAvailable(behavior: Behavior) {
    this.expected.push(behavior);
    this.pendingBehaviorSpecification = null;
  }

  public whenGET(uri: string): ResponseSetter {
    return this.whenRequestIs(new Request({
      method: "get",
      url: this.absoluteUri(uri)
    }));
  }

  public whenHEAD(uri: string): ResponseSetter {
    return this.whenRequestIs(new Request({
      method: "head",
      url: this.absoluteUri(uri)
    }));
  }

  public whenPOST(uri: string): ResponseSetter {
    return this.whenRequestIs(new Request({
      method: "post",
      url: this.absoluteUri(uri)
    }));
  }

  public whenPUT(uri: string): ResponseSetter {
    return this.whenRequestIs(new Request({
      method: "put",
      url: this.absoluteUri(uri)
    }));
  }

  public whenDELETE(uri: string): ResponseSetter {
    return this.whenRequestIs(new Request({
      method: "delete",
      url: this.absoluteUri(uri)
    }));
  }

  public whenPATCH(uri: string): ResponseSetter {
    return this.whenRequestIs(new Request({
      method: "patch",
      url: this.absoluteUri(uri)
    }));
  }

  public whenOPTIONS(uri: string): ResponseSetter {
    return this.whenRequestIs(new Request({
      method: "options",
      url: this.absoluteUri(uri)
    }));
  }

  private markRequestAsPending(req: Request, behavior: Behavior) {
    if (this.pendingBehaviorSpecification !== null) {
      const pendingReqDescr = RequestMethod[this.pendingBehaviorSpecification.request.method].toUpperCase()
        + " " + this.pendingBehaviorSpecification.request.url;
      const reqDescr = RequestMethod[req.method].toUpperCase() + " " + req.url;
      throw new InvalidStubbingError("unfinished behavior definition: cannot configure "
        + reqDescr + " before setting the response for " + pendingReqDescr);
    }
    this.pendingBehaviorSpecification = {
      request: req,
      prematchedBehavior: behavior
    };
  }

  private relativePath(absoluteUri: string): string {
    const url = new URL(absoluteUri);
    return url.pathname + url.query + url.hash;
  }

  public whenRequestIs(request: Request): ResponseSetter {
    const path = this.relativePath(request.url), method = RequestMethod[request.method];

    let validationError;
    for (const i in this.defined) {
      const behavior = this.defined[i];
      if (behavior.requestPattern.matches(request)) {
        this.markRequestAsPending(request, behavior);
        if ((validationError = behavior.requestValidator.matches(request)) === null) {
          return new ResponseSetter(this, response => this.onStubResponseAvailable(new RequestPattern(path, method, null), response));
        } else {
          throw new InvalidStubbingError(validationError);
        }
      }
    }
    throw new InvalidStubbingError("found no declaration of request [" + method.toUpperCase()
      + " " + path + "] in RAML - refusing to stub");
  }

  public createBackend(): RAMLBackend {
    return new RAMLBackend(this.stubbed, this.expected);
  }

}
