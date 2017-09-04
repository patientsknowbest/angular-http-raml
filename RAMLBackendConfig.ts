import {Behavior, DefaultRequestValidator, NoopRequestValidator, RAMLBackend, RequestPattern, ResponsePattern} from "./RAMLBackend";
import {Request, RequestMethod, Response, ResponseOptions} from "@angular/http";
import {YAMLFileLoader} from "./RAMLLoader";
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

export class RAMLBackendConfig {

  static topLevelKeywords: string[] = ["title", "version", "baseUri",
    "mediaType", "types", "securedBy"];


  static initWithFile(pathToRAMLFile: string): RAMLBackendConfig {
    const api = new YAMLFileLoader(pathToRAMLFile).loadFile();
    return new RAMLBackendConfig(api);
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

  private getSchema(type: string): any {
    if (!type) {
      return {};
    }
    if (typeof type === 'object') {
      return type;
    }
    const rawSchema = type;
    try {
      if (typeof JSON.parse(rawSchema) === 'object') {
        return rawSchema;
      }
    } catch (e) {
      const typeName = rawSchema.trim();
      for (const t in this.api["types"]) {
        if (t === typeName) {
          return this.api["types"][t];
        }
      }
    }
  }

  private findRequestBodySchema(method): any {
    if (method.body && method.body.type) {
      return this.getSchema(method.body.type);
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
    this.loadDefinedBehaviors();
  }

  private loadDefinedBehaviors() {
    const entries: Behavior[] = [];
    const allResources = this.allResources(this.api);
    for (const i in allResources) {
      const resource = allResources[i];
      const resourceUri = this.absoluteUri(i);
      for (const methodName in resource) {
        const method = resource[methodName];
        const schema = this.findRequestBodySchema(method);

        const pattern = new RequestPattern(resourceUri, methodName, schema, this.buildResponsePatterns(method.responses));
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
        const pattern = new RequestPattern(this.absoluteUri(i),
          method,
          this.findRequestBodySchema(res[method]),
          this.buildResponsePatterns(res[method].responses)
        );
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

  private buildResponsePatterns(responses: any): ResponsePattern[] {
    const rval: ResponsePattern[] = [];
    for (const statusCode in responses) {
      if (responses[statusCode] !== null) {
        rval.push(new ResponsePattern(Number(statusCode), this.getSchema((responses[statusCode].body || {}).type)));
      }
    }
    return rval;
  }

  private onStubResponseAvailable(requestPattern: RequestPattern, response: Response) {
    const respPattern: ResponsePattern = requestPattern.findResponsePatternByStatusCode(response.status);
    if (respPattern !== null) {
      if (!respPattern.matches(response)) {
        throw new InvalidStubbingError("invalid stub response body");
      }
    }
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

  public baseUri(baseUri: string): RAMLBackendConfig {
    if (this.stubbed.length > 0) {
      throw new InvalidStubbingError("cannot change baseUri after stubs are defined");
    }
    this.api["baseUri"] = baseUri;
    this.loadDefinedBehaviors();
    return this;
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
          return new ResponseSetter(this, response => this.onStubResponseAvailable(
            new RequestPattern(path, method, null, behavior.requestPattern.responsePatterns), response));
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
