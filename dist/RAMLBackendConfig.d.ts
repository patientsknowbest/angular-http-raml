import { RAMLBackend } from "./RAMLBackend";
import { Api } from "raml-1-parser/dist/raml1/artifacts/raml10parserapi";
import { Request, Response } from "@angular/http";
export declare class InvalidStubbingError extends Error {
}
export declare class ResponseSetter {
    private owner;
    private onReady;
    constructor(owner: RAMLBackendConfig, onReady: (response: Response) => void);
    thenRespond(response: Response): RAMLBackendConfig;
    thenRespondWith(statusCode: number, exampleIdentifier?: string): RAMLBackendConfig;
}
export declare class RAMLBackendConfig {
    private api;
    static initWithFile(pathToRAMLFile: string): RAMLBackendConfig;
    static initWithDefinition(definition: string): RAMLBackendConfig;
    private static findBestDummyResponse(responses);
    private defined;
    private stubbed;
    private expected;
    private pendingBehaviorSpecification;
    private findRequestBodySchema(method);
    constructor(api: Api);
    private buildResponseFromDefinition(responseDefinition, exampleIdentifier?);
    stubAll(): RAMLBackendConfig;
    private lookupExampleResponseBody(respBodyDef, exampleIdentifier?);
    lookupResponse(statusCode: number, exampleIdentifier: string): Response;
    private lookupResponseDefsByRequest(request);
    private onStubResponseAvailable(requestPattern, response);
    private onMockResponseAvailable(behavior);
    private absoluteUri(path);
    whenGET(uri: string): ResponseSetter;
    whenHEAD(uri: string): ResponseSetter;
    whenPOST(uri: string): ResponseSetter;
    whenPUT(uri: string): ResponseSetter;
    whenDELETE(uri: string): ResponseSetter;
    whenPATCH(uri: string): ResponseSetter;
    whenOPTIONS(uri: string): ResponseSetter;
    private markRequestAsPending(req, behavior);
    private relativePath(absoluteUri);
    whenRequestIs(request: Request): ResponseSetter;
    createBackend(): RAMLBackend;
}
