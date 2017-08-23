import { MockBackend } from "@angular/http/testing";
import { Request, Response } from "@angular/http";
export declare class MalformedRequestError extends Error {
    constructor(failureReason: any[]);
}
export interface URIParams {
    [paramName: string]: any;
}
export interface RequestValidator {
    matches(request: Request): string;
}
export declare class DefaultRequestValidator implements RequestValidator {
    private expectedQueryParams;
    constructor(method: any);
    private parseQueryString(url);
    matches(request: Request): string;
}
export declare class NoopRequestValidator {
    matches(request: Request): string;
}
export declare class URIPattern {
    private pattern;
    private paramNames;
    constructor(uriPattern: string);
    matches(uri: string): URIParams;
}
export declare class RequestPattern {
    readonly expectedMethod: string;
    private readonly schema;
    private expectedUri;
    constructor(expectedUri: string, expectedMethod: string, schema: any);
    matches(request: Request): URIParams;
}
export interface Behavior {
    requestPattern: RequestPattern;
    response: Response;
    requestValidator?: RequestValidator;
}
export declare class RAMLBackend extends MockBackend {
    private stubbed;
    private expected;
    constructor(stubbed?: Behavior[], expected?: Behavior[]);
    private findMatchingResponse(request);
    private handleConnection(conn);
}
