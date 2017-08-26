"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var RAMLBackend_1 = require("./RAMLBackend");
var js_yaml_1 = require("js-yaml");
var http_1 = require("@angular/http");
var URL = require("url-parse");
var InvalidStubbingError = (function (_super) {
    __extends(InvalidStubbingError, _super);
    function InvalidStubbingError() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return InvalidStubbingError;
}(Error));
exports.InvalidStubbingError = InvalidStubbingError;
var ResponseSetter = (function () {
    function ResponseSetter(owner, onReady) {
        this.owner = owner;
        this.onReady = onReady;
    }
    ResponseSetter.prototype.thenRespond = function (response) {
        this.onReady(response);
        return this.owner;
    };
    ResponseSetter.prototype.thenRespondWith = function (statusCode, exampleIdentifier) {
        var response = this.owner.lookupResponse(statusCode, exampleIdentifier);
        this.onReady(response);
        return this.owner;
    };
    return ResponseSetter;
}());
exports.ResponseSetter = ResponseSetter;
function relPathToAbs(sRelPath, currentPath) {
    if (currentPath === void 0) { currentPath = location.pathname; }
    var nUpLn, sDir = "", sPath = currentPath.replace(/[^\/]*$/, sRelPath.replace(/(\/|^)(?:\.?\/+)+/g, "$1"));
    for (var nEnd, nStart = 0; nEnd = sPath.indexOf("/../", nStart), nEnd > -1; nStart = nEnd + nUpLn) {
        nUpLn = /^\/(?:\.\.\/)*/.exec(sPath.slice(nEnd))[0].length;
        sDir = (sDir + sPath.substring(nStart, nEnd)).replace(new RegExp("(?:\\\/+[^\\\/]*){0," + ((nUpLn - 1) / 3) + "}$"), "/");
    }
    return sDir + sPath.substr(nStart);
}
var YAMLFileLoader = (function () {
    function YAMLFileLoader(pathToYAMLFile) {
        this.currentDocumentPath = pathToYAMLFile;
    }
    YAMLFileLoader.prototype.loadFile = function () {
        var request = new XMLHttpRequest();
        request.open('GET', this.currentDocumentPath, false);
        request.send(null);
        if (request.status === 200) {
            var api = js_yaml_1.safeLoad(request.responseText, {
                schema: js_yaml_1.Schema.create([new IncludeType(this.currentDocumentPath)])
            });
            return api;
        }
        else {
            throw Error(request.status + ": GET " + this.currentDocumentPath);
        }
    };
    return YAMLFileLoader;
}());
var IncludeType = (function (_super) {
    __extends(IncludeType, _super);
    function IncludeType(parentDocumentPath) {
        var _this = _super.call(this, "!include", {
            kind: "scalar",
            construct: function (pathToRAMLFile) {
                pathToRAMLFile = relPathToAbs(pathToRAMLFile, this.parentDocumentPath);
                var request = new XMLHttpRequest();
                request.open('GET', pathToRAMLFile, false);
                request.send(null);
                if (request.status === 200) {
                    var api = js_yaml_1.safeLoad(request.responseText, {
                        schema: js_yaml_1.Schema.create([new IncludeType(pathToRAMLFile)])
                    });
                    return api;
                }
                else {
                    throw Error(request.status + ": GET " + pathToRAMLFile);
                }
            },
            resolve: function (path) {
                return true;
            }
        }) || this;
        _this.parentDocumentPath = parentDocumentPath;
        return _this;
    }
    return IncludeType;
}(js_yaml_1.Type));
exports.IncludeType = IncludeType;
var RAMLBackendConfig = (function () {
    function RAMLBackendConfig(api) {
        this.api = api;
        this.defined = [];
        this.stubbed = [];
        this.expected = [];
        this.pendingBehaviorSpecification = null;
        var entries = [];
        var allResources = this.allResources(this.api);
        for (var i in allResources) {
            var resource = allResources[i];
            var resourceUri = this.absoluteUri(i);
            for (var methodName in resource) {
                var method = resource[methodName];
                var schema = this.findRequestBodySchema(method);
                var pattern = new RAMLBackend_1.RequestPattern(resourceUri, methodName, schema);
                var _a = RAMLBackendConfig.findBestDummyResponse(method["responses"]), statusCode = _a.statusCode, responseDefinition = _a.responseDefinition;
                var response = this.buildResponseFromDefinition(statusCode, responseDefinition);
                entries.push({
                    requestPattern: pattern,
                    response: response,
                    requestValidator: new RAMLBackend_1.DefaultRequestValidator(method)
                });
            }
        }
        this.defined = entries;
    }
    RAMLBackendConfig.initWithFile = function (pathToRAMLFile) {
        var api = new YAMLFileLoader(pathToRAMLFile).loadFile();
        return new RAMLBackendConfig(api);
    };
    RAMLBackendConfig.findBestDummyResponse = function (responses) {
        var bestFittingResp = null, bestFittingRespCode = null;
        for (var code in responses) {
            var candidate = responses[code];
            var statusCode = Number.parseInt(code);
            if (200 <= statusCode && statusCode < 300) {
                if (bestFittingRespCode === null || bestFittingRespCode > statusCode) {
                    bestFittingResp = candidate;
                    bestFittingRespCode = statusCode;
                }
            }
        }
        return { statusCode: bestFittingRespCode, responseDefinition: bestFittingResp || {} };
    };
    RAMLBackendConfig.prototype.findRequestBodySchema = function (method) {
        if (method["body"] && method["body"]["type"]) {
            var rawSchema = method["body"]["type"];
            try {
                return rawSchema;
            }
            catch (e) {
                var typeName = rawSchema.trim();
                for (var t in this.api["types"]) {
                    if (t === typeName) {
                        return JSON.parse(this.api["types"][t].toString());
                    }
                }
            }
        }
        else {
            return null;
        }
    };
    RAMLBackendConfig.prototype.absoluteUri = function (relativeUri) {
        return this.api["baseUri"] + relativeUri;
    };
    RAMLBackendConfig.prototype.isKeyword = function (candidate) {
        for (var i in RAMLBackendConfig.topLevelKeywords) {
            if (RAMLBackendConfig.topLevelKeywords[i] === candidate) {
                return true;
            }
        }
        return false;
    };
    RAMLBackendConfig.prototype.allResources = function (api) {
        var rval = {};
        for (var i in api) {
            if (!this.isKeyword(i)) {
                rval[i] = api[i];
            }
        }
        return rval;
    };
    RAMLBackendConfig.prototype.buildResponseFromDefinition = function (statusCode, responseDefinition, exampleIdentifier) {
        return new http_1.Response(new http_1.ResponseOptions({
            status: statusCode,
            body: this.lookupExampleResponseBody(responseDefinition["body"], exampleIdentifier)
        }));
    };
    RAMLBackendConfig.prototype.stubAll = function () {
        var _this = this;
        this.defined.forEach(function (behavior) { return _this.stubbed.push(behavior); });
        return this;
    };
    RAMLBackendConfig.prototype.lookupExampleResponseBody = function (respBodyDef, exampleIdentifier) {
        function throwError() {
            throw new InvalidStubbingError("could not find example [" + exampleIdentifier + "]");
        }
        if (respBodyDef == undefined) {
            if (exampleIdentifier != null) {
                throwError();
            }
            return null;
        }
        var exampleDefs = respBodyDef["examples"];
        if (exampleIdentifier != null) {
            if (exampleDefs == null || exampleDefs.length === 0) {
                throwError();
            }
            for (var exampleName in exampleDefs) {
                if (exampleName === exampleIdentifier) {
                    return exampleDefs[exampleName];
                }
            }
            throwError();
        }
        return respBodyDef["example"];
    };
    RAMLBackendConfig.prototype.lookupResponse = function (statusCode, exampleIdentifier) {
        var possibleResponseDefs = this.lookupResponseDefsByRequest(this.pendingBehaviorSpecification.request);
        for (var code in possibleResponseDefs) {
            if (Number.parseInt(code) === statusCode) {
                return this.buildResponseFromDefinition(statusCode, possibleResponseDefs[code], exampleIdentifier);
            }
        }
        throw new InvalidStubbingError("there is no response defined with status code " + statusCode + " in the RAML file");
    };
    RAMLBackendConfig.prototype.lookupResponseDefsByRequest = function (request) {
        for (var i in this.allResources(this.api)) {
            var res = this.allResources(this.api)[i];
            var methods = Object.keys(res);
            for (var methodName in methods) {
                var method = methods[methodName];
                var pattern = new RAMLBackend_1.RequestPattern(this.absoluteUri(i), method, this.findRequestBodySchema(res[method]));
                if (pattern.matches(request)) {
                    var rval = {};
                    for (var statusCode in res[method].responses) {
                        rval[statusCode] = res[method].responses[statusCode] || {};
                    }
                    return rval;
                }
            }
        }
        throw "not found";
    };
    RAMLBackendConfig.prototype.onStubResponseAvailable = function (requestPattern, response) {
        // this.pendingBehaviorSpecification.prematchedBehavior.;
        this.stubbed.unshift({
            response: response,
            requestPattern: requestPattern,
            requestValidator: new RAMLBackend_1.NoopRequestValidator()
        });
        this.pendingBehaviorSpecification = null;
    };
    RAMLBackendConfig.prototype.onMockResponseAvailable = function (behavior) {
        this.expected.push(behavior);
        this.pendingBehaviorSpecification = null;
    };
    RAMLBackendConfig.prototype.whenGET = function (uri) {
        return this.whenRequestIs(new http_1.Request({
            method: "get",
            url: this.absoluteUri(uri)
        }));
    };
    RAMLBackendConfig.prototype.whenHEAD = function (uri) {
        return this.whenRequestIs(new http_1.Request({
            method: "head",
            url: this.absoluteUri(uri)
        }));
    };
    RAMLBackendConfig.prototype.whenPOST = function (uri) {
        return this.whenRequestIs(new http_1.Request({
            method: "post",
            url: this.absoluteUri(uri)
        }));
    };
    RAMLBackendConfig.prototype.whenPUT = function (uri) {
        return this.whenRequestIs(new http_1.Request({
            method: "put",
            url: this.absoluteUri(uri)
        }));
    };
    RAMLBackendConfig.prototype.whenDELETE = function (uri) {
        return this.whenRequestIs(new http_1.Request({
            method: "delete",
            url: this.absoluteUri(uri)
        }));
    };
    RAMLBackendConfig.prototype.whenPATCH = function (uri) {
        return this.whenRequestIs(new http_1.Request({
            method: "patch",
            url: this.absoluteUri(uri)
        }));
    };
    RAMLBackendConfig.prototype.whenOPTIONS = function (uri) {
        return this.whenRequestIs(new http_1.Request({
            method: "options",
            url: this.absoluteUri(uri)
        }));
    };
    RAMLBackendConfig.prototype.markRequestAsPending = function (req, behavior) {
        if (this.pendingBehaviorSpecification !== null) {
            var pendingReqDescr = http_1.RequestMethod[this.pendingBehaviorSpecification.request.method].toUpperCase()
                + " " + this.pendingBehaviorSpecification.request.url;
            var reqDescr = http_1.RequestMethod[req.method].toUpperCase() + " " + req.url;
            throw new InvalidStubbingError("unfinished behavior definition: cannot configure "
                + reqDescr + " before setting the response for " + pendingReqDescr);
        }
        this.pendingBehaviorSpecification = {
            request: req,
            prematchedBehavior: behavior
        };
    };
    RAMLBackendConfig.prototype.relativePath = function (absoluteUri) {
        var url = new URL(absoluteUri);
        return url.pathname + url.query + url.hash;
    };
    RAMLBackendConfig.prototype.whenRequestIs = function (request) {
        var _this = this;
        var path = this.relativePath(request.url), method = http_1.RequestMethod[request.method];
        var validationError;
        for (var i in this.defined) {
            var behavior = this.defined[i];
            if (behavior.requestPattern.matches(request)) {
                this.markRequestAsPending(request, behavior);
                if ((validationError = behavior.requestValidator.matches(request)) === null) {
                    return new ResponseSetter(this, function (response) { return _this.onStubResponseAvailable(new RAMLBackend_1.RequestPattern(path, method, null), response); });
                }
                else {
                    throw new InvalidStubbingError(validationError);
                }
            }
        }
        throw new InvalidStubbingError("found no declaration of request [" + method.toUpperCase()
            + " " + path + "] in RAML - refusing to stub");
    };
    RAMLBackendConfig.prototype.createBackend = function () {
        return new RAMLBackend_1.RAMLBackend(this.stubbed, this.expected);
    };
    return RAMLBackendConfig;
}());
RAMLBackendConfig.topLevelKeywords = ["title", "version", "baseUri",
    "mediaType", "types", "securedBy"];
exports.RAMLBackendConfig = RAMLBackendConfig;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL1JBTUxCYWNrZW5kQ29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBLDZDQUFtSDtBQUNuSCxtQ0FBK0M7QUFDL0Msc0NBQWdGO0FBQ2hGLCtCQUFrQztBQUVsQztJQUEwQyx3Q0FBSztJQUEvQzs7SUFFQSxDQUFDO0lBQUQsMkJBQUM7QUFBRCxDQUZBLEFBRUMsQ0FGeUMsS0FBSyxHQUU5QztBQUZZLG9EQUFvQjtBQUlqQztJQUVFLHdCQUFvQixLQUF3QixFQUN4QixPQUFxQztRQURyQyxVQUFLLEdBQUwsS0FBSyxDQUFtQjtRQUN4QixZQUFPLEdBQVAsT0FBTyxDQUE4QjtJQUN6RCxDQUFDO0lBRU0sb0NBQVcsR0FBbEIsVUFBbUIsUUFBa0I7UUFDbkMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN2QixNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztJQUNwQixDQUFDO0lBRU0sd0NBQWUsR0FBdEIsVUFBdUIsVUFBa0IsRUFBRSxpQkFBMEI7UUFDbkUsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsVUFBVSxFQUFFLGlCQUFpQixDQUFDLENBQUM7UUFDMUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN2QixNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztJQUNwQixDQUFDO0lBRUgscUJBQUM7QUFBRCxDQWpCQSxBQWlCQyxJQUFBO0FBakJZLHdDQUFjO0FBNkIzQixzQkFBc0IsUUFBUSxFQUFFLFdBQStCO0lBQS9CLDRCQUFBLEVBQUEsY0FBYyxRQUFRLENBQUMsUUFBUTtJQUM3RCxJQUFJLEtBQUssRUFBRSxJQUFJLEdBQUcsRUFBRSxFQUFFLEtBQUssR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsT0FBTyxDQUFDLG9CQUFvQixFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7SUFD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Q0UsTUFBTSxDQUFDLElBQUkseUJBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUN0RCxDQUFDO0lBRUgsd0JBQUM7QUFBRCxDQS9RQSxBQStRQztBQTdRUSxrQ0FBZ0IsR0FBYSxDQUFDLE9BQU8sRUFBRSxTQUFTLEVBQUUsU0FBUztJQUNoRSxXQUFXLEVBQUUsT0FBTyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0FBSDFCLDhDQUFpQiIsImZpbGUiOiJSQU1MQmFja2VuZENvbmZpZy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7QmVoYXZpb3IsIERlZmF1bHRSZXF1ZXN0VmFsaWRhdG9yLCBOb29wUmVxdWVzdFZhbGlkYXRvciwgUkFNTEJhY2tlbmQsIFJlcXVlc3RQYXR0ZXJufSBmcm9tIFwiLi9SQU1MQmFja2VuZFwiO1xuaW1wb3J0IHtzYWZlTG9hZCwgU2NoZW1hLCBUeXBlfSBmcm9tIFwianMteWFtbFwiO1xuaW1wb3J0IHtSZXF1ZXN0LCBSZXF1ZXN0TWV0aG9kLCBSZXNwb25zZSwgUmVzcG9uc2VPcHRpb25zfSBmcm9tIFwiQGFuZ3VsYXIvaHR0cFwiO1xuaW1wb3J0IFVSTCA9IHJlcXVpcmUoXCJ1cmwtcGFyc2VcIik7XG5cbmV4cG9ydCBjbGFzcyBJbnZhbGlkU3R1YmJpbmdFcnJvciBleHRlbmRzIEVycm9yIHtcblxufVxuXG5leHBvcnQgY2xhc3MgUmVzcG9uc2VTZXR0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgb3duZXI6IFJBTUxCYWNrZW5kQ29uZmlnLFxuICAgICAgICAgICAgICBwcml2YXRlIG9uUmVhZHk6IChyZXNwb25zZTogUmVzcG9uc2UpID0+IHZvaWQpIHtcbiAgfVxuXG4gIHB1YmxpYyB0aGVuUmVzcG9uZChyZXNwb25zZTogUmVzcG9uc2UpOiBSQU1MQmFja2VuZENvbmZpZyB7XG4gICAgdGhpcy5vblJlYWR5KHJlc3BvbnNlKTtcbiAgICByZXR1cm4gdGhpcy5vd25lcjtcbiAgfVxuXG4gIHB1YmxpYyB0aGVuUmVzcG9uZFdpdGgoc3RhdHVzQ29kZTogbnVtYmVyLCBleGFtcGxlSWRlbnRpZmllcj86IHN0cmluZyk6IFJBTUxCYWNrZW5kQ29uZmlnIHtcbiAgICBjb25zdCByZXNwb25zZSA9IHRoaXMub3duZXIubG9va3VwUmVzcG9uc2Uoc3RhdHVzQ29kZSwgZXhhbXBsZUlkZW50aWZpZXIpO1xuICAgIHRoaXMub25SZWFkeShyZXNwb25zZSk7XG4gICAgcmV0dXJuIHRoaXMub3duZXI7XG4gIH1cblxufVxuXG5pbnRlcmZhY2UgUGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiB7XG5cbiAgcHJlbWF0Y2hlZEJlaGF2aW9yOiBCZWhhdmlvcjtcblxuICByZXF1ZXN0OiBSZXF1ZXN0O1xuXG4gIC8vIHJlc3BvbnNlUGF0dGVybkNhbmRpZGF0ZXM6IE1ldGhvZFtdO1xuXG59XG5cbmZ1bmN0aW9uIHJlbFBhdGhUb0FicyhzUmVsUGF0aCwgY3VycmVudFBhdGggPSBsb2NhdGlvbi5wYXRobmFtZSkge1xuICB2YXIgblVwTG4sIHNEaXIgPSBcIlwiLCBzUGF0aCA9IGN1cnJlbnRQYXRoLnJlcGxhY2UoL1teXFwvXSokLywgc1JlbFBhdGgucmVwbGFjZSgvKFxcL3xeKSg/OlxcLj9cXC8rKSsvZywgXCIkMVwiKSk7XG4gIGZvciAodmFyIG5FbmQsIG5TdGFydCA9IDA7IG5FbmQgPSBzUGF0aC5pbmRleE9mKFwiLy4uL1wiLCBuU3RhcnQpLCBuRW5kID4gLTE7IG5TdGFydCA9IG5FbmQgKyBuVXBMbikge1xuICAgIG5VcExuID0gL15cXC8oPzpcXC5cXC5cXC8pKi8uZXhlYyhzUGF0aC5zbGljZShuRW5kKSlbMF0ubGVuZ3RoO1xuICAgIHNEaXIgPSAoc0RpciArIHNQYXRoLnN1YnN0cmluZyhuU3RhcnQsIG5FbmQpKS5yZXBsYWNlKG5ldyBSZWdFeHAoXCIoPzpcXFxcXFwvK1teXFxcXFxcL10qKXswLFwiICsgKChuVXBMbiAtIDEpIC8gMykgKyBcIn0kXCIpLCBcIi9cIik7XG4gIH1cbiAgcmV0dXJuIHNEaXIgKyBzUGF0aC5zdWJzdHIoblN0YXJ0KTtcbn1cblxuY2xhc3MgWUFNTEZpbGVMb2FkZXIge1xuXG4gIHByaXZhdGUgY3VycmVudERvY3VtZW50UGF0aDtcblxuICBjb25zdHJ1Y3RvcihwYXRoVG9ZQU1MRmlsZTogc3RyaW5nKSB7XG4gICAgdGhpcy5jdXJyZW50RG9jdW1lbnRQYXRoID0gcGF0aFRvWUFNTEZpbGU7XG4gIH1cblxuICBwdWJsaWMgbG9hZEZpbGUoKTogYW55IHtcbiAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHJlcXVlc3Qub3BlbignR0VUJywgdGhpcy5jdXJyZW50RG9jdW1lbnRQYXRoLCBmYWxzZSk7XG4gICAgcmVxdWVzdC5zZW5kKG51bGwpO1xuICAgIGlmIChyZXF1ZXN0LnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICBjb25zdCBhcGkgPSBzYWZlTG9hZChyZXF1ZXN0LnJlc3BvbnNlVGV4dCwge1xuICAgICAgICBzY2hlbWE6IFNjaGVtYS5jcmVhdGUoW25ldyBJbmNsdWRlVHlwZSh0aGlzLmN1cnJlbnREb2N1bWVudFBhdGgpXSlcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGFwaTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgRXJyb3IocmVxdWVzdC5zdGF0dXMgKyBcIjogR0VUIFwiICsgdGhpcy5jdXJyZW50RG9jdW1lbnRQYXRoKTtcbiAgICB9XG4gIH1cblxufVxuXG5leHBvcnQgY2xhc3MgSW5jbHVkZVR5cGUgZXh0ZW5kcyBUeXBlIHtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHBhcmVudERvY3VtZW50UGF0aCkge1xuICAgIHN1cGVyKFwiIWluY2x1ZGVcIiwge1xuICAgICAga2luZDogXCJzY2FsYXJcIixcbiAgICAgIGNvbnN0cnVjdDogZnVuY3Rpb24gKHBhdGhUb1JBTUxGaWxlKSB7XG4gICAgICAgIHBhdGhUb1JBTUxGaWxlID0gcmVsUGF0aFRvQWJzKHBhdGhUb1JBTUxGaWxlLCB0aGlzLnBhcmVudERvY3VtZW50UGF0aCk7XG4gICAgICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICAgIHJlcXVlc3Qub3BlbignR0VUJywgcGF0aFRvUkFNTEZpbGUsIGZhbHNlKTtcbiAgICAgICAgcmVxdWVzdC5zZW5kKG51bGwpO1xuICAgICAgICBpZiAocmVxdWVzdC5zdGF0dXMgPT09IDIwMCkge1xuICAgICAgICAgIGNvbnN0IGFwaSA9IHNhZmVMb2FkKHJlcXVlc3QucmVzcG9uc2VUZXh0LCB7XG4gICAgICAgICAgICBzY2hlbWE6IFNjaGVtYS5jcmVhdGUoW25ldyBJbmNsdWRlVHlwZShwYXRoVG9SQU1MRmlsZSldKVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJldHVybiBhcGk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgRXJyb3IocmVxdWVzdC5zdGF0dXMgKyBcIjogR0VUIFwiICsgcGF0aFRvUkFNTEZpbGUpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgcmVzb2x2ZTogZnVuY3Rpb24gKHBhdGg6IHN0cmluZykge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUkFNTEJhY2tlbmRDb25maWcge1xuXG4gIHN0YXRpYyB0b3BMZXZlbEtleXdvcmRzOiBzdHJpbmdbXSA9IFtcInRpdGxlXCIsIFwidmVyc2lvblwiLCBcImJhc2VVcmlcIixcbiAgICBcIm1lZGlhVHlwZVwiLCBcInR5cGVzXCIsIFwic2VjdXJlZEJ5XCJdO1xuXG5cbiAgc3RhdGljIGluaXRXaXRoRmlsZShwYXRoVG9SQU1MRmlsZTogc3RyaW5nKTogUkFNTEJhY2tlbmRDb25maWcge1xuICAgIGNvbnN0IGFwaSA9IG5ldyBZQU1MRmlsZUxvYWRlcihwYXRoVG9SQU1MRmlsZSkubG9hZEZpbGUoKTtcbiAgICByZXR1cm4gbmV3IFJBTUxCYWNrZW5kQ29uZmlnKGFwaSk7XG4gIH1cblxuICBwcml2YXRlIHN0YXRpYyBmaW5kQmVzdER1bW15UmVzcG9uc2UocmVzcG9uc2VzKTogeyBzdGF0dXNDb2RlOiBudW1iZXIsIHJlc3BvbnNlRGVmaW5pdGlvbjogYW55IH0ge1xuICAgIGxldCBiZXN0Rml0dGluZ1Jlc3AgPSBudWxsLCBiZXN0Rml0dGluZ1Jlc3BDb2RlID0gbnVsbDtcbiAgICBmb3IgKGNvbnN0IGNvZGUgaW4gcmVzcG9uc2VzKSB7XG4gICAgICBjb25zdCBjYW5kaWRhdGUgPSByZXNwb25zZXNbY29kZV07XG4gICAgICBjb25zdCBzdGF0dXNDb2RlID0gTnVtYmVyLnBhcnNlSW50KGNvZGUpO1xuICAgICAgaWYgKDIwMCA8PSBzdGF0dXNDb2RlICYmIHN0YXR1c0NvZGUgPCAzMDApIHtcbiAgICAgICAgaWYgKGJlc3RGaXR0aW5nUmVzcENvZGUgPT09IG51bGwgfHwgYmVzdEZpdHRpbmdSZXNwQ29kZSA+IHN0YXR1c0NvZGUpIHtcbiAgICAgICAgICBiZXN0Rml0dGluZ1Jlc3AgPSBjYW5kaWRhdGU7XG4gICAgICAgICAgYmVzdEZpdHRpbmdSZXNwQ29kZSA9IHN0YXR1c0NvZGU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtzdGF0dXNDb2RlOiBiZXN0Rml0dGluZ1Jlc3BDb2RlLCByZXNwb25zZURlZmluaXRpb246IGJlc3RGaXR0aW5nUmVzcCB8fCB7fX07XG4gIH1cblxuICBwcml2YXRlIGRlZmluZWQ6IEJlaGF2aW9yW10gPSBbXTtcblxuICBwcml2YXRlIHN0dWJiZWQ6IEJlaGF2aW9yW10gPSBbXTtcblxuICBwcml2YXRlIGV4cGVjdGVkOiBCZWhhdmlvcltdID0gW107XG5cbiAgcHJpdmF0ZSBwZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uOiBQZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uID0gbnVsbDtcblxuICBwcml2YXRlIGZpbmRSZXF1ZXN0Qm9keVNjaGVtYShtZXRob2QpOiBhbnkge1xuICAgIGlmIChtZXRob2RbXCJib2R5XCJdICYmIG1ldGhvZFtcImJvZHlcIl1bXCJ0eXBlXCJdKSB7XG4gICAgICBjb25zdCByYXdTY2hlbWEgPSBtZXRob2RbXCJib2R5XCJdW1widHlwZVwiXTtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiByYXdTY2hlbWE7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnN0IHR5cGVOYW1lID0gcmF3U2NoZW1hLnRyaW0oKTtcbiAgICAgICAgZm9yIChjb25zdCB0IGluIHRoaXMuYXBpW1widHlwZXNcIl0pIHtcbiAgICAgICAgICBpZiAodCA9PT0gdHlwZU5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKHRoaXMuYXBpW1widHlwZXNcIl1bdF0udG9TdHJpbmcoKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYWJzb2x1dGVVcmkocmVsYXRpdmVVcmk6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuYXBpW1wiYmFzZVVyaVwiXSArIHJlbGF0aXZlVXJpO1xuICB9XG5cbiAgcHJpdmF0ZSBpc0tleXdvcmQoY2FuZGlkYXRlOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBmb3IgKGxldCBpIGluIFJBTUxCYWNrZW5kQ29uZmlnLnRvcExldmVsS2V5d29yZHMpIHtcbiAgICAgIGlmIChSQU1MQmFja2VuZENvbmZpZy50b3BMZXZlbEtleXdvcmRzW2ldID09PSBjYW5kaWRhdGUpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHByaXZhdGUgYWxsUmVzb3VyY2VzKGFwaTogYW55KTogYW55IHtcbiAgICBjb25zdCBydmFsID0ge307XG4gICAgZm9yICh2YXIgaSBpbiBhcGkpIHtcbiAgICAgIGlmICghdGhpcy5pc0tleXdvcmQoaSkpIHtcbiAgICAgICAgcnZhbFtpXSA9IGFwaVtpXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJ2YWw7XG4gIH1cblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGFwaSkge1xuICAgIGNvbnN0IGVudHJpZXM6IEJlaGF2aW9yW10gPSBbXTtcbiAgICBjb25zdCBhbGxSZXNvdXJjZXMgPSB0aGlzLmFsbFJlc291cmNlcyh0aGlzLmFwaSk7XG4gICAgZm9yIChjb25zdCBpIGluIGFsbFJlc291cmNlcykge1xuICAgICAgY29uc3QgcmVzb3VyY2UgPSBhbGxSZXNvdXJjZXNbaV07XG4gICAgICBjb25zdCByZXNvdXJjZVVyaSA9IHRoaXMuYWJzb2x1dGVVcmkoaSk7XG4gICAgICBmb3IgKGNvbnN0IG1ldGhvZE5hbWUgaW4gcmVzb3VyY2UpIHtcbiAgICAgICAgY29uc3QgbWV0aG9kID0gcmVzb3VyY2VbbWV0aG9kTmFtZV07XG4gICAgICAgIGNvbnN0IHNjaGVtYSA9IHRoaXMuZmluZFJlcXVlc3RCb2R5U2NoZW1hKG1ldGhvZCk7XG5cbiAgICAgICAgY29uc3QgcGF0dGVybiA9IG5ldyBSZXF1ZXN0UGF0dGVybihyZXNvdXJjZVVyaSwgbWV0aG9kTmFtZSwgc2NoZW1hKTtcbiAgICAgICAgY29uc3Qge3N0YXR1c0NvZGUsIHJlc3BvbnNlRGVmaW5pdGlvbn0gPSBSQU1MQmFja2VuZENvbmZpZy5maW5kQmVzdER1bW15UmVzcG9uc2UobWV0aG9kW1wicmVzcG9uc2VzXCJdKTtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSB0aGlzLmJ1aWxkUmVzcG9uc2VGcm9tRGVmaW5pdGlvbihzdGF0dXNDb2RlLCByZXNwb25zZURlZmluaXRpb24pO1xuICAgICAgICBlbnRyaWVzLnB1c2goe1xuICAgICAgICAgIHJlcXVlc3RQYXR0ZXJuOiBwYXR0ZXJuLFxuICAgICAgICAgIHJlc3BvbnNlOiByZXNwb25zZSxcbiAgICAgICAgICByZXF1ZXN0VmFsaWRhdG9yOiBuZXcgRGVmYXVsdFJlcXVlc3RWYWxpZGF0b3IobWV0aG9kKVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5kZWZpbmVkID0gZW50cmllcztcbiAgfVxuXG4gIHByaXZhdGUgYnVpbGRSZXNwb25zZUZyb21EZWZpbml0aW9uKHN0YXR1c0NvZGUsIHJlc3BvbnNlRGVmaW5pdGlvbiwgZXhhbXBsZUlkZW50aWZpZXI/OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKG5ldyBSZXNwb25zZU9wdGlvbnMoe1xuICAgICAgc3RhdHVzOiBzdGF0dXNDb2RlLFxuICAgICAgYm9keTogdGhpcy5sb29rdXBFeGFtcGxlUmVzcG9uc2VCb2R5KHJlc3BvbnNlRGVmaW5pdGlvbltcImJvZHlcIl0sIGV4YW1wbGVJZGVudGlmaWVyKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyBzdHViQWxsKCk6IFJBTUxCYWNrZW5kQ29uZmlnIHtcbiAgICB0aGlzLmRlZmluZWQuZm9yRWFjaChiZWhhdmlvciA9PiB0aGlzLnN0dWJiZWQucHVzaChiZWhhdmlvcikpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcHJpdmF0ZSBsb29rdXBFeGFtcGxlUmVzcG9uc2VCb2R5KHJlc3BCb2R5RGVmLCBleGFtcGxlSWRlbnRpZmllcj86IHN0cmluZyk6IHN0cmluZyB7XG4gICAgZnVuY3Rpb24gdGhyb3dFcnJvcigpIHtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcImNvdWxkIG5vdCBmaW5kIGV4YW1wbGUgW1wiICsgZXhhbXBsZUlkZW50aWZpZXIgKyBcIl1cIik7XG4gICAgfVxuXG4gICAgaWYgKHJlc3BCb2R5RGVmID09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKGV4YW1wbGVJZGVudGlmaWVyICE9IG51bGwpIHtcbiAgICAgICAgdGhyb3dFcnJvcigpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGV4YW1wbGVEZWZzID0gcmVzcEJvZHlEZWZbXCJleGFtcGxlc1wiXTtcbiAgICBpZiAoZXhhbXBsZUlkZW50aWZpZXIgIT0gbnVsbCkge1xuICAgICAgaWYgKGV4YW1wbGVEZWZzID09IG51bGwgfHwgZXhhbXBsZURlZnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93RXJyb3IoKTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgZXhhbXBsZU5hbWUgaW4gZXhhbXBsZURlZnMpIHtcbiAgICAgICAgaWYgKGV4YW1wbGVOYW1lID09PSBleGFtcGxlSWRlbnRpZmllcikge1xuICAgICAgICAgIHJldHVybiBleGFtcGxlRGVmc1tleGFtcGxlTmFtZV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRocm93RXJyb3IoKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3BCb2R5RGVmW1wiZXhhbXBsZVwiXTtcbiAgfVxuXG4gIHB1YmxpYyBsb29rdXBSZXNwb25zZShzdGF0dXNDb2RlOiBudW1iZXIsIGV4YW1wbGVJZGVudGlmaWVyOiBzdHJpbmcpOiBSZXNwb25zZSB7XG4gICAgY29uc3QgcG9zc2libGVSZXNwb25zZURlZnMgPSB0aGlzLmxvb2t1cFJlc3BvbnNlRGVmc0J5UmVxdWVzdCh0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ucmVxdWVzdCk7XG4gICAgZm9yIChjb25zdCBjb2RlIGluIHBvc3NpYmxlUmVzcG9uc2VEZWZzKSB7XG4gICAgICBpZiAoTnVtYmVyLnBhcnNlSW50KGNvZGUpID09PSBzdGF0dXNDb2RlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJ1aWxkUmVzcG9uc2VGcm9tRGVmaW5pdGlvbihzdGF0dXNDb2RlLCBwb3NzaWJsZVJlc3BvbnNlRGVmc1tjb2RlXSwgZXhhbXBsZUlkZW50aWZpZXIpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJ0aGVyZSBpcyBubyByZXNwb25zZSBkZWZpbmVkIHdpdGggc3RhdHVzIGNvZGUgXCIgKyBzdGF0dXNDb2RlICsgXCIgaW4gdGhlIFJBTUwgZmlsZVwiKTtcbiAgfVxuXG4gIHByaXZhdGUgbG9va3VwUmVzcG9uc2VEZWZzQnlSZXF1ZXN0KHJlcXVlc3Q6IFJlcXVlc3QpOiBhbnkge1xuICAgIGZvciAoY29uc3QgaSBpbiB0aGlzLmFsbFJlc291cmNlcyh0aGlzLmFwaSkpIHtcbiAgICAgIGNvbnN0IHJlcyA9IHRoaXMuYWxsUmVzb3VyY2VzKHRoaXMuYXBpKVtpXTtcbiAgICAgIGxldCBtZXRob2RzID0gT2JqZWN0LmtleXMocmVzKTtcbiAgICAgIGZvciAoY29uc3QgbWV0aG9kTmFtZSBpbiBtZXRob2RzKSB7XG4gICAgICAgIGNvbnN0IG1ldGhvZCA9IG1ldGhvZHNbbWV0aG9kTmFtZV07XG4gICAgICAgIGNvbnN0IHBhdHRlcm4gPSBuZXcgUmVxdWVzdFBhdHRlcm4odGhpcy5hYnNvbHV0ZVVyaShpKSwgbWV0aG9kLCB0aGlzLmZpbmRSZXF1ZXN0Qm9keVNjaGVtYShyZXNbbWV0aG9kXSkpO1xuICAgICAgICBpZiAocGF0dGVybi5tYXRjaGVzKHJlcXVlc3QpKSB7XG4gICAgICAgICAgY29uc3QgcnZhbCA9IHt9O1xuICAgICAgICAgIGZvciAobGV0IHN0YXR1c0NvZGUgaW4gcmVzW21ldGhvZF0ucmVzcG9uc2VzKSB7XG4gICAgICAgICAgICBydmFsW3N0YXR1c0NvZGVdID0gcmVzW21ldGhvZF0ucmVzcG9uc2VzW3N0YXR1c0NvZGVdIHx8IHt9O1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gcnZhbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBcIm5vdCBmb3VuZFwiO1xuICB9XG5cbiAgcHJpdmF0ZSBvblN0dWJSZXNwb25zZUF2YWlsYWJsZShyZXF1ZXN0UGF0dGVybjogUmVxdWVzdFBhdHRlcm4sIHJlc3BvbnNlOiBSZXNwb25zZSkge1xuICAgIC8vIHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbi5wcmVtYXRjaGVkQmVoYXZpb3IuO1xuICAgIHRoaXMuc3R1YmJlZC51bnNoaWZ0KHtcbiAgICAgIHJlc3BvbnNlOiByZXNwb25zZSxcbiAgICAgIHJlcXVlc3RQYXR0ZXJuOiByZXF1ZXN0UGF0dGVybixcbiAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IG5ldyBOb29wUmVxdWVzdFZhbGlkYXRvcigpXG4gICAgfSk7XG4gICAgdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uID0gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgb25Nb2NrUmVzcG9uc2VBdmFpbGFibGUoYmVoYXZpb3I6IEJlaGF2aW9yKSB7XG4gICAgdGhpcy5leHBlY3RlZC5wdXNoKGJlaGF2aW9yKTtcbiAgICB0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24gPSBudWxsO1xuICB9XG5cbiAgcHVibGljIHdoZW5HRVQodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwiZ2V0XCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuSEVBRCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJoZWFkXCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuUE9TVCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJwb3N0XCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuUFVUKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcInB1dFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlbkRFTEVURSh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJkZWxldGVcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5QQVRDSCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJwYXRjaFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlbk9QVElPTlModXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwib3B0aW9uc1wiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwcml2YXRlIG1hcmtSZXF1ZXN0QXNQZW5kaW5nKHJlcTogUmVxdWVzdCwgYmVoYXZpb3I6IEJlaGF2aW9yKSB7XG4gICAgaWYgKHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgcGVuZGluZ1JlcURlc2NyID0gUmVxdWVzdE1ldGhvZFt0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ucmVxdWVzdC5tZXRob2RdLnRvVXBwZXJDYXNlKClcbiAgICAgICAgKyBcIiBcIiArIHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbi5yZXF1ZXN0LnVybDtcbiAgICAgIGNvbnN0IHJlcURlc2NyID0gUmVxdWVzdE1ldGhvZFtyZXEubWV0aG9kXS50b1VwcGVyQ2FzZSgpICsgXCIgXCIgKyByZXEudXJsO1xuICAgICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwidW5maW5pc2hlZCBiZWhhdmlvciBkZWZpbml0aW9uOiBjYW5ub3QgY29uZmlndXJlIFwiXG4gICAgICAgICsgcmVxRGVzY3IgKyBcIiBiZWZvcmUgc2V0dGluZyB0aGUgcmVzcG9uc2UgZm9yIFwiICsgcGVuZGluZ1JlcURlc2NyKTtcbiAgICB9XG4gICAgdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uID0ge1xuICAgICAgcmVxdWVzdDogcmVxLFxuICAgICAgcHJlbWF0Y2hlZEJlaGF2aW9yOiBiZWhhdmlvclxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIHJlbGF0aXZlUGF0aChhYnNvbHV0ZVVyaTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCB1cmwgPSBuZXcgVVJMKGFic29sdXRlVXJpKTtcbiAgICByZXR1cm4gdXJsLnBhdGhuYW1lICsgdXJsLnF1ZXJ5ICsgdXJsLmhhc2g7XG4gIH1cblxuICBwdWJsaWMgd2hlblJlcXVlc3RJcyhyZXF1ZXN0OiBSZXF1ZXN0KTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIGNvbnN0IHBhdGggPSB0aGlzLnJlbGF0aXZlUGF0aChyZXF1ZXN0LnVybCksIG1ldGhvZCA9IFJlcXVlc3RNZXRob2RbcmVxdWVzdC5tZXRob2RdO1xuXG4gICAgbGV0IHZhbGlkYXRpb25FcnJvcjtcbiAgICBmb3IgKGNvbnN0IGkgaW4gdGhpcy5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBiZWhhdmlvciA9IHRoaXMuZGVmaW5lZFtpXTtcbiAgICAgIGlmIChiZWhhdmlvci5yZXF1ZXN0UGF0dGVybi5tYXRjaGVzKHJlcXVlc3QpKSB7XG4gICAgICAgIHRoaXMubWFya1JlcXVlc3RBc1BlbmRpbmcocmVxdWVzdCwgYmVoYXZpb3IpO1xuICAgICAgICBpZiAoKHZhbGlkYXRpb25FcnJvciA9IGJlaGF2aW9yLnJlcXVlc3RWYWxpZGF0b3IubWF0Y2hlcyhyZXF1ZXN0KSkgPT09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gbmV3IFJlc3BvbnNlU2V0dGVyKHRoaXMsIHJlc3BvbnNlID0+IHRoaXMub25TdHViUmVzcG9uc2VBdmFpbGFibGUobmV3IFJlcXVlc3RQYXR0ZXJuKHBhdGgsIG1ldGhvZCwgbnVsbCksIHJlc3BvbnNlKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKHZhbGlkYXRpb25FcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwiZm91bmQgbm8gZGVjbGFyYXRpb24gb2YgcmVxdWVzdCBbXCIgKyBtZXRob2QudG9VcHBlckNhc2UoKVxuICAgICAgKyBcIiBcIiArIHBhdGggKyBcIl0gaW4gUkFNTCAtIHJlZnVzaW5nIHRvIHN0dWJcIik7XG4gIH1cblxuICBwdWJsaWMgY3JlYXRlQmFja2VuZCgpOiBSQU1MQmFja2VuZCB7XG4gICAgcmV0dXJuIG5ldyBSQU1MQmFja2VuZCh0aGlzLnN0dWJiZWQsIHRoaXMuZXhwZWN0ZWQpO1xuICB9XG5cbn1cbiJdfQ==
