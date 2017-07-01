import {MockBackend, MockConnection} from "@angular/http/testing";
import {Method} from "raml-1-parser/dist/raml1/artifacts/raml10parserapi";
import {Request, RequestMethod, Response, ResponseOptions} from "@angular/http";
import {extract, parse} from "query-string";

interface URIParams {

  [paramName: string]: any

}

export interface RequestValidator {

  matches(request: Request): string;

}

export class DefaultRequestValidator implements RequestValidator {

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
          return "undeclared query parameter [" + paramName + "] found in request";
        }
      }
    }
    return null;
  }

}

export class NoopRequestValidator {

  public matches(request: Request): string {
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
    if (arr === null) {
      return null;
    }
    const paramMap: URIParams = {};
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
    if (! (actualMethod.toLowerCase() === this.expectedMethod.toLowerCase()
      && uriParams !== null)) {
      return null;
    }
    return uriParams;
  }

}

export interface Behavior {

  requestPattern: RequestPattern;

  response: Response;

  requestValidator? : RequestValidator;

}

export class RAMLBackend extends MockBackend {

  constructor(private stubbed: Behavior[] = [], private expected: Behavior[] = []) {
    super();
    this.connections.subscribe(this.handleConnection.bind(this));
  }


  private findMatchingResponse(request: Request): MatchResult {
    for (const i in this.stubbed) {
      const entry = this.stubbed[i];
      const uriParams = entry.requestPattern.matches(request);
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

}
