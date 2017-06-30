import {Behavior, DefaultRequestValidator, NoopRequestValidator, RAMLBackend, RequestPattern} from "./RAMLBackend";
import {loadApiSync} from "raml-1-parser/dist/raml1/artifacts/raml10parser";
import {Api, TypeDeclaration} from "raml-1-parser/dist/raml1/artifacts/raml10parserapi";
import {parseRAMLSync} from "raml-1-parser";
import {Request, RequestMethod, Response, ResponseOptions} from "@angular/http";

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
        const response = new Response(new ResponseOptions({
          status: new Number(method.responses()[0].code().value()).valueOf(),
          body: this.lookupExampleResponseBody(method.responses()[0].body()[0])
        }));
        entries.push({
          requestPattern: pattern,
          response: response,
          requestValidator: new DefaultRequestValidator(method)
        });
      }
    }
    this.defined = entries;
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

  private onStubResponseAvailable(requestPattern: RequestPattern, response: Response) {
    this.stubbed.push({
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

  public whenGET(uri: string): ResponseSetter {
    return this.when("get", uri);
  }

  public whenHEAD(uri: string): ResponseSetter {
    return this.when("head", uri);
  }

  public whenPOST(uri: string): ResponseSetter {
    return this.when("post", uri);
  }

  public when(method: string, path: string) {
    let validationError;
    const req = new Request({
      method: method,
      url: this.api.baseUri().value() + path
    });
    if (this.pendingRequest !== null) {
      const pendingReqDescr = RequestMethod[this.pendingRequest.method].toUpperCase() + " " + this.pendingRequest.url;
      const reqDescr = RequestMethod[req.method].toUpperCase() + " " + req.url;
      throw new InvalidStubbingError("unfinished behavior definition: cannot configure "
        + reqDescr + " before setting the response for " + pendingReqDescr);
    }
    this.pendingRequest = req;
    for (const i in this.defined)  {
      const behavior = this.defined[i];
      if (behavior.requestPattern.matches(req)) {
        if ((validationError = behavior.requestValidator.matches(req)) === null) {
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
