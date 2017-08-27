/// <reference types="js-yaml" />
import { Type } from "js-yaml";
export declare class YAMLFileLoader {
    private currentDocumentPath;
    constructor(pathToYAMLFile: string);
    loadFile(): any;
}
export declare class IncludeType extends Type {
    private parentDocumentPath;
    private relPathToAbs(sRelPath);
    constructor(parentDocumentPath: any);
}
