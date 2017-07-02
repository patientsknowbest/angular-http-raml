import {Behavior, DefaultRequestValidator, NoopRequestValidator, RAMLBackend, RequestPattern} from "./RAMLBackend";
import {loadApiSync} from "raml-1-parser/dist/raml1/artifacts/raml10parser";
import {Api, TypeDeclaration, Response as ResponseDef} from "raml-1-parser/dist/raml1/artifacts/raml10parserapi";
import {parseRAMLSync} from "raml-1-parser";
import {Request, RequestMethod, Response, ResponseOptions} from "@angular/http";
import URL = require("url-parse");
import {ResourceMap} from "typedoc/dist/lib/output/utils/resources/stack";


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

  public thenRespondWith(statusCode: number): RAMLBackendConfig {
    const response = this.owner.lookupResponseByCode(statusCode);
    this.onReady(response);
    return this.owner;
  }

}

export class RAMLBackendConfig {

  static initWithFile(pathToRAMLFile: string): RAMLBackendConfig {
    const api = loadApiSync(pathToRAMLFile);
    return new RAMLBackendConfig(api);
  }

  static initWithDefinition(definition: string): RAMLBackendConfig {
    const api = parseRAMLSync(definition) as Api;
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

  private pendingRequest: Request = null;

  constructor(private api: Api) {
    const entries : Behavior[] = [];
    for (const i in this.api.allResources()) {
      const resource =  this.api.allResources()[i];
      const resourceUri = resource.absoluteUri();
      for (const j in resource.methods()) {
        const method = resource.methods()[j];
        const pattern = new RequestPattern(resourceUri, method.method());
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

  private buildResponseFromDefinition(responseDefinition: ResponseDef) {
    return new Response(new ResponseOptions({
      status: new Number(responseDefinition.code().value()).valueOf(),
      body: this.lookupExampleResponseBody(responseDefinition.body()[0])
    }));
  }

  public stubAll(): RAMLBackendConfig {
    this.defined.forEach(behavior => this.stubbed.push(behavior));
    return this;
  }

  private lookupExampleResponseBody(respBodyDef: TypeDeclaration): string {
    if (respBodyDef === undefined) {
      return null;
    }
    if (respBodyDef.example() === null) {
      return respBodyDef.examples()[0].value();
    } else {
      return respBodyDef.example().value();
    }
  }

  public lookupResponseByCode(statusCode: number): Response {
    const possibleResponseDefs = this.lookupResponseDefsByRequest(this.pendingRequest);
    for (const i in possibleResponseDefs) {
      if (Number.parseInt(possibleResponseDefs[i].code().value()) === statusCode) {
        return this.buildResponseFromDefinition(possibleResponseDefs[i]);
      }
    }
    throw new InvalidStubbingError("there is no response defined with status code " + statusCode + " in the RAML file");
  }

  private lookupResponseDefsByRequest(request: Request): ResponseDef[] {
    for (const i in this.api.resources()) {
      const res = this.api.resources()[i];
      for (const j in res.methods()) {
        const pattern = new RequestPattern(res.absoluteUri(), res.methods()[j].method());
        if (pattern.matches(request)) {
          return res.methods()[j].responses();
        }
      }
    }
    throw "not found";
  }

  private onStubResponseAvailable(requestPattern: RequestPattern, response: Response) {
    this.stubbed.unshift({
      response: response,
      requestPattern: requestPattern,
      requestValidator: new NoopRequestValidator()
    });
    this.pendingRequest = null;
  }

  private onMockResponseAvailable(behavior: Behavior) {
    this.expected.push(behavior);
    this.pendingRequest = null;
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

  private markRequestAsPending(req: Request) {
    if (this.pendingRequest !== null) {
      const pendingReqDescr = RequestMethod[this.pendingRequest.method].toUpperCase() + " " + this.pendingRequest.url;
      const reqDescr = RequestMethod[req.method].toUpperCase() + " " + req.url;
      throw new InvalidStubbingError("unfinished behavior definition: cannot configure "
        + reqDescr + " before setting the response for " + pendingReqDescr);
    }
    this.pendingRequest = req;
  }

  private relativePath(absoluteUri: string): string {
    const url = new URL(absoluteUri);
    return url.pathname + url.query + url.hash;
  }

  public whenRequestIs(request: Request): ResponseSetter {
    const path = this.relativePath(request.url), method =  RequestMethod[request.method];

    let validationError;
    this.markRequestAsPending(request);
    for (const i in this.defined)  {
      const behavior = this.defined[i];
      if (behavior.requestPattern.matches(request)) {
        if ((validationError = behavior.requestValidator.matches(request)) === null) {
          return new ResponseSetter(this, response => this.onStubResponseAvailable(new RequestPattern(path, method), response));
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
