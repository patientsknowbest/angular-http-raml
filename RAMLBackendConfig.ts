import {Behavior, DefaultRequestValidator, NoopRequestValidator, RAMLBackend, RequestPattern} from "./RAMLBackend";
// import {loadApiSync} from "raml-1-parser/dist/raml1/artifacts/raml10parser";
import {Api, Method, Response as ResponseDef, TypeDeclaration} from "raml-1-parser/dist/raml1/artifacts/raml10parserapi";
import {parseRAMLSync, loadApiSync} from "raml-1-parser";
import {Request, RequestMethod, Response, ResponseOptions} from "@angular/http";
import URL = require("url-parse");
// import * as RAML from "./raml-1-parser";

export class InvalidStubbingError extends Error {

}

export class ResponseSetter {

  constructor(
    private owner: RAMLBackendConfig,
    private onReady: (response: Response) => void
  ) {}

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

  static initWithFile(pathToRAMLFile: string): RAMLBackendConfig {
    const api = loadApiSync(pathToRAMLFile, {
    fsResolver: {
    	content: function(path){ 
            var xhttp = new XMLHttpRequest(), request = xhttp;
            xhttp.open("GET", path, false);
            xhttp.send();
            if (request.status === 200) {
                return request.responseText;
            }
        },
    	list: function(path){ throw "list dir: " + path; }
    }
});
    return new RAMLBackendConfig(api);
  }

  private static findBestDummyResponse(responses: ResponseDef[]): ResponseDef {
    let bestFittingResp: ResponseDef = null;
    for (const i in responses) {
      const candidate = responses[i];
      const statusCode = Number.parseInt(candidate.code().value());
      if (200 <= statusCode && statusCode < 300) {
        if (bestFittingResp === null) {
          bestFittingResp = candidate;
        } else if (Number.parseInt(bestFittingResp.code().value()) > statusCode) {
          bestFittingResp = candidate;
        }
      }
    }
    return bestFittingResp;
  }

  private defined: Behavior[] = [];

  private stubbed: Behavior[] = [];

  private expected: Behavior[] = [];

  private pendingBehaviorSpecification: PendingBehaviorSpecification = null;

  private findRequestBodySchema(method: Method): any {
    if (method.body().length > 0 && method.body()[0].type().length > 0) {
      const rawSchema = method.body()[0].type()[0].toString();
      try {
        return JSON.parse(rawSchema);
      } catch (e) {
        const typeName = rawSchema.trim();
        for (const t in this.api.types()) {
          const typeDecl = this.api.types()[t];
          if (typeDecl.name() === typeName) {
            return JSON.parse(typeDecl.type()[0].toString());
          }
        }
      }
    } else{
      return null;
    }
  }

  constructor(private api: Api) {
    const entries : Behavior[] = [];
    for (const i in this.api.allResources()) {
      const resource =  this.api.allResources()[i];
      const resourceUri = resource.absoluteUri();
      for (const j in resource.methods()) {
        const method = resource.methods()[j];
        const schema = this.findRequestBodySchema(method);

        // console.log("validation result", ajv.validate(JSON.parse(method.body()[0].type()[0].toString()), {prop:true}));
        // console.log("validation errors", ajv.errors)

        const pattern = new RequestPattern(resourceUri, method.method(), schema);
        const responseDefinition: ResponseDef = RAMLBackendConfig.findBestDummyResponse(method.responses());
        const response = this.buildResponseFromDefinition(responseDefinition);
        entries.push({
          requestPattern: pattern,
          response: response,
          requestValidator: new DefaultRequestValidator(method)
        });
      }
    }
    this.defined = entries;
  }

  private buildResponseFromDefinition(responseDefinition: ResponseDef, exampleIdentifier?: string) {
    return new Response(new ResponseOptions({
      status: new Number(responseDefinition.code().value()).valueOf(),
      body: this.lookupExampleResponseBody(responseDefinition.body()[0], exampleIdentifier)
    }));
  }

  public stubAll(): RAMLBackendConfig {
    this.defined.forEach(behavior => this.stubbed.push(behavior));
    return this;
  }

  private lookupExampleResponseBody(respBodyDef: TypeDeclaration, exampleIdentifier?: string): string {
    function throwError() {
      throw new InvalidStubbingError("could not find example [" + exampleIdentifier + "]");
    }
    if (respBodyDef === undefined) {
      if (exampleIdentifier != null) {
        throwError();
      }
      return null;
    }
    const exampleDefs = respBodyDef.examples();
    if (exampleIdentifier != null) {
      if (exampleDefs == null || exampleDefs.length === 0) {
        throwError();
      }
      for (const i in exampleDefs) {
        const example = exampleDefs[i];
        if (example.name() === exampleIdentifier) {
          return example.value();
        }
      }
      throwError();
    }
    if (respBodyDef.example() === null) {
      return exampleDefs[0].value();
    } else {
      return respBodyDef.example().value();
    }
  }

  public lookupResponse(statusCode: number, exampleIdentifier: string): Response {
    const possibleResponseDefs = this.lookupResponseDefsByRequest(this.pendingBehaviorSpecification.request);
    for (const i in possibleResponseDefs) {
      if (Number.parseInt(possibleResponseDefs[i].code().value()) === statusCode) {
        return this.buildResponseFromDefinition(possibleResponseDefs[i], exampleIdentifier);
      }
    }
    throw new InvalidStubbingError("there is no response defined with status code " + statusCode + " in the RAML file");
  }

  private lookupResponseDefsByRequest(request: Request): ResponseDef[] {
    for (const i in this.api.resources()) {
      const res = this.api.resources()[i];
      for (const j in res.methods()) {
        const method = res.methods()[j];
        const pattern = new RequestPattern(res.absoluteUri(), method.method(), this.findRequestBodySchema(method));
        if (pattern.matches(request)) {
          return method.responses();
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

  private absoluteUri(path: string): string {
    return this.api.baseUri().value() + path;
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
    const path = this.relativePath(request.url), method =  RequestMethod[request.method];

    let validationError;
    for (const i in this.defined)  {
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
    throw new InvalidStubbingError("found no declaration of request ["+ method.toUpperCase()
      + " " + path + "] in RAML - refusing to stub");
  }

  public createBackend(): RAMLBackend {
    return new RAMLBackend(this.stubbed, this.expected);
  }

}
