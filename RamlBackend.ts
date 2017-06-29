import {MockBackend, MockConnection} from "@angular/http/testing";
import {loadApiSync} from "raml-1-parser/dist/raml1/artifacts/raml10parser";
import {Api, Method, TypeDeclaration} from "raml-1-parser/dist/raml1/artifacts/raml10parserapi";
import {parseRAMLSync} from "raml-1-parser";
import {Request, RequestMethod, Response, ResponseOptions} from "@angular/http";
import {extract, parse} from "query-string";


interface URIParams {

  [paramName: string]: any

}

class RequestValidator {

  private expectedQueryParams: string[] = [];

  constructor(method: Method) {
    method.queryParameters().forEach(param => this.expectedQueryParams.push(param.name()));
  }

  private parseQueryString(url: string): object {
    return parse(extract(url));
  }

  public matches(request: Request): string {
    if (this.expectedQueryParams.length > 0) {
      const actualQueryParams = this.parseQueryString(request.url);
      for (const paramName in actualQueryParams) {
        if (this.expectedQueryParams.indexOf(paramName) == -1) {
          return "undeclared query parameter [invalid] found in request";
        }
      }
    }
    return null;
  }

}

class MatchResult {

  constructor(
    readonly uriParams: URIParams,
    readonly response: Response,
    readonly requestValidator
  ) {}

}

function uriPatternToRegexp(uriPattern: string): [string[], RegExp] {
  let remainingUriPattern = uriPattern, openingBracketIdx, closingBracketIdx, paramName;
  const uriParamNames: string[] = [];

  while((openingBracketIdx = remainingUriPattern.indexOf("{")) !== -1) {
    remainingUriPattern = remainingUriPattern.substring(openingBracketIdx + 1);
    closingBracketIdx = remainingUriPattern.indexOf("}");
    paramName = remainingUriPattern.substring(0, closingBracketIdx);
    uriParamNames.push(paramName);
    remainingUriPattern = remainingUriPattern.substring(closingBracketIdx + 1);
  }

  const tmp = uriPattern.replace(/\{\w+\}/g, "(.*)");
  return [uriParamNames, new RegExp(tmp)];
}

export class URIPattern {

  private pattern: RegExp;

  private paramNames: string[];

  constructor(uriPattern: string) {
    let patternMatch = uriPatternToRegexp(uriPattern);
    this.paramNames = patternMatch[0];
    this.pattern = patternMatch[1];
  }

  public matches(uri: string): URIParams {
    const matches = this.pattern.test(uri);
    const arr = this.pattern.exec(uri);
    const paramMap: URIParams = {};
    if (arr === null) {
      return paramMap;
    }
    for (let i = 0; i < this.paramNames.length; ++i) {
      paramMap[this.paramNames[i]] = arr[i + 1];
    }
    return matches ? paramMap : null;
  }

}

export class RequestPattern {

  private expectedUri: URIPattern;

  constructor(
    expectedUri: string,
    readonly expectedMethod: string
  ) {
    this.expectedUri = new URIPattern(expectedUri);
  }

  public matches(request: Request): URIParams {
    const actualMethod = RequestMethod[request.method].toLowerCase();
    const uriParams = this.expectedUri.matches(request.url);
    if (! (actualMethod === this.expectedMethod
      && uriParams !== null)) {
      return null;
    }
    return uriParams;
  }
}

interface RequestMatchEntry {

  requestPattern: RequestPattern;

  response: Response;

  requestValidator: RequestValidator;

}

function lookupExampleResponseBody(respBodyDef: TypeDeclaration): string {
  if (respBodyDef === undefined) {
    return null;
  }
  if (respBodyDef.example() === null) {
    return respBodyDef.examples()[0].value();
  } else {
    return respBodyDef.example().value();
  }
}

function buildRequestPatterns(api: Api): RequestMatchEntry[] {
  const entries : RequestMatchEntry[] = [];
  for (const i in api.allResources()) {
    const resource =  api.allResources()[i];
    for (const j in resource.methods()) {
      const method = resource.methods()[j];
      const pattern = new RequestPattern(resource.absoluteUri(), method.method());
      const response = new Response(new ResponseOptions({
        status: new Number(method.responses()[0].code().value()).valueOf(),
        body: lookupExampleResponseBody(method.responses()[0].body()[0])
      }));
      entries.push({
        requestPattern: pattern,
        response: response,
        requestValidator: new RequestValidator(method)
      });
    }
  }
  return entries;
}

export class RamlBackend extends MockBackend {

  private api: Api;

  private matchEntries: RequestMatchEntry[] = [];

  constructor() {
    super();
    this.connections.subscribe(this.handleConnection.bind(this));
  }


  private findMatchingResponse(request: Request): MatchResult {
    for (const i in this.matchEntries) {
      const entry = this.matchEntries[i];
      let uriParams = entry.requestPattern.matches(request);
      if (uriParams !== null) {
        return new MatchResult(uriParams, entry.response, entry.requestValidator);
      }
    }
    throw new Error("no matching request pattern found");
  }
  private handleConnection(conn: MockConnection) {
    const request = conn.request;
    let response;

    const matchResult = this.findMatchingResponse(request);
    let errorMessage = matchResult.requestValidator.matches(request);
    if (errorMessage !== null) {
      response = new Response(new ResponseOptions({
        status: 401,
        body: JSON.stringify({message: errorMessage})
      }));
    } else {
      response = matchResult.response;
    }
    conn.mockRespond(response);
  }

  public get endpoints(): string[] {
    const endpoints = [];
    this.api.allResources().forEach(i => endpoints.push(i.absoluteUri()));
    return endpoints;
  }

  public loadRAMLFromPath(path: string): RamlBackend {
    this.api = loadApiSync(path);
    this.matchEntries = buildRequestPatterns(this.api);
    return this;
  }

  public loadRAML(content: string): RamlBackend {
    this.api = parseRAMLSync(content) as Api;
    this.matchEntries = buildRequestPatterns(this.api);
    return this;
  }

}
