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
function syncGet(path) {
    var request = new XMLHttpRequest();
    request.open('GET', path, false);
    request.send(null);
    if (request.status === 200) {
        return request.responseText;
    }
    else {
        throw Error(request.status + ": GET " + this.currentDocumentPath);
    }
}
var YAMLFileLoader = (function () {
    function YAMLFileLoader(pathToYAMLFile) {
        this.currentDocumentPath = pathToYAMLFile;
    }
    YAMLFileLoader.prototype.loadFile = function () {
        var api = js_yaml_1.safeLoad(syncGet(this.currentDocumentPath), {
            schema: js_yaml_1.Schema.create([new IncludeType(this.currentDocumentPath)])
        });
        return api;
    };
    return YAMLFileLoader;
}());
var IncludeType = (function (_super) {
    __extends(IncludeType, _super);
    function IncludeType(parentDocumentPath) {
        var _this = _super.call(this, "!include", {
            kind: "scalar",
            construct: function (pathToRAMLFile) {
                return js_yaml_1.safeLoad(syncGet(this.relPathToAbs(pathToRAMLFile)), {
                    schema: js_yaml_1.Schema.create([new IncludeType(pathToRAMLFile)])
                });
            },
            resolve: function (path) {
                return true;
            }
        }) || this;
        _this.parentDocumentPath = parentDocumentPath;
        return _this;
    }
    IncludeType.prototype.relPathToAbs = function (sRelPath) {
        var nUpLn, sDir = "", sPath = this.parentDocumentPath.replace(/[^\/]*$/, sRelPath.replace(/(\/|^)(?:\.?\/+)+/g, "$1"));
        for (var nEnd, nStart = 0; nEnd = sPath.indexOf("/../", nStart), nEnd > -1; nStart = nEnd + nUpLn) {
            nUpLn = /^\/(?:\.\.\/)*/.exec(sPath.slice(nEnd))[0].length;
            sDir = (sDir + sPath.substring(nStart, nEnd)).replace(new RegExp("(?:\\\/+[^\\\/]*){0," + ((nUpLn - 1) / 3) + "}$"), "/");
        }
        return sDir + sPath.substr(nStart);
    };
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFDLG9CQUFvQixDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztnQkFDN0MsRUFBRSxDQUFDLENBQUMsQ0FBQyxlQUFlLEdBQUcsUUFBUSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7b0JBQzVFLE1BQU0sQ0FBQyxJQUFJLGNBQWMsQ0FBQyxJQUFJLEVBQUUsVUFBQSxRQUFRLElBQUksT0FBQSxLQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSw0QkFBYyxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLEVBQUUsUUFBUSxDQUFDLEVBQTlFLENBQThFLENBQUMsQ0FBQztnQkFDOUgsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDTixNQUFNLElBQUksb0JBQW9CLENBQUMsZUFBZSxDQUFDLENBQUM7Z0JBQ2xELENBQUM7WUFDSCxDQUFDO1FBQ0gsQ0FBQztRQUNELE1BQU0sSUFBSSxvQkFBb0IsQ0FBQyxtQ0FBbUMsR0FBRyxNQUFNLENBQUMsV0FBVyxFQUFFO2NBQ3JGLEdBQUcsR0FBRyxJQUFJLEdBQUcsOEJBQThCLENBQUMsQ0FBQztJQUNuRCxDQUFDO0lBRU0seUNBQWEsR0FBcEI7UUFDRSxNQUFNLENBQUMsSUFBSSx5QkFBVyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUFFSCx3QkFBQztBQUFELENBL1FBLEFBK1FDO0FBN1FRLGtDQUFnQixHQUFhLENBQUMsT0FBTyxFQUFFLFNBQVMsRUFBRSxTQUFTO0lBQ2hFLFdBQVcsRUFBRSxPQUFPLEVBQUUsV0FBVyxDQUFDLENBQUM7QUFIMUIsOENBQWlCIiwiZmlsZSI6IlJBTUxCYWNrZW5kQ29uZmlnLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtCZWhhdmlvciwgRGVmYXVsdFJlcXVlc3RWYWxpZGF0b3IsIE5vb3BSZXF1ZXN0VmFsaWRhdG9yLCBSQU1MQmFja2VuZCwgUmVxdWVzdFBhdHRlcm59IGZyb20gXCIuL1JBTUxCYWNrZW5kXCI7XG5pbXBvcnQge3NhZmVMb2FkLCBTY2hlbWEsIFR5cGV9IGZyb20gXCJqcy15YW1sXCI7XG5pbXBvcnQge1JlcXVlc3QsIFJlcXVlc3RNZXRob2QsIFJlc3BvbnNlLCBSZXNwb25zZU9wdGlvbnN9IGZyb20gXCJAYW5ndWxhci9odHRwXCI7XG5pbXBvcnQgVVJMID0gcmVxdWlyZShcInVybC1wYXJzZVwiKTtcblxuZXhwb3J0IGNsYXNzIEludmFsaWRTdHViYmluZ0Vycm9yIGV4dGVuZHMgRXJyb3Ige1xuXG59XG5cbmV4cG9ydCBjbGFzcyBSZXNwb25zZVNldHRlciB7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBvd25lcjogUkFNTEJhY2tlbmRDb25maWcsXG4gICAgICAgICAgICAgIHByaXZhdGUgb25SZWFkeTogKHJlc3BvbnNlOiBSZXNwb25zZSkgPT4gdm9pZCkge1xuICB9XG5cbiAgcHVibGljIHRoZW5SZXNwb25kKHJlc3BvbnNlOiBSZXNwb25zZSk6IFJBTUxCYWNrZW5kQ29uZmlnIHtcbiAgICB0aGlzLm9uUmVhZHkocmVzcG9uc2UpO1xuICAgIHJldHVybiB0aGlzLm93bmVyO1xuICB9XG5cbiAgcHVibGljIHRoZW5SZXNwb25kV2l0aChzdGF0dXNDb2RlOiBudW1iZXIsIGV4YW1wbGVJZGVudGlmaWVyPzogc3RyaW5nKTogUkFNTEJhY2tlbmRDb25maWcge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gdGhpcy5vd25lci5sb29rdXBSZXNwb25zZShzdGF0dXNDb2RlLCBleGFtcGxlSWRlbnRpZmllcik7XG4gICAgdGhpcy5vblJlYWR5KHJlc3BvbnNlKTtcbiAgICByZXR1cm4gdGhpcy5vd25lcjtcbiAgfVxuXG59XG5cbmZ1bmN0aW9uIHN5bmNHZXQocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgcmVxdWVzdC5vcGVuKCdHRVQnLCBwYXRoLCBmYWxzZSk7XG4gIHJlcXVlc3Quc2VuZChudWxsKTtcbiAgaWYgKHJlcXVlc3Quc3RhdHVzID09PSAyMDApIHtcbiAgICByZXR1cm4gcmVxdWVzdC5yZXNwb25zZVRleHQ7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgRXJyb3IocmVxdWVzdC5zdGF0dXMgKyBcIjogR0VUIFwiICsgdGhpcy5jdXJyZW50RG9jdW1lbnRQYXRoKTtcbiAgfVxufVxuXG5pbnRlcmZhY2UgUGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiB7XG5cbiAgcHJlbWF0Y2hlZEJlaGF2aW9yOiBCZWhhdmlvcjtcblxuICByZXF1ZXN0OiBSZXF1ZXN0O1xuXG4gIC8vIHJlc3BvbnNlUGF0dGVybkNhbmRpZGF0ZXM6IE1ldGhvZFtdO1xuXG59XG5cbmNsYXNzIFlBTUxGaWxlTG9hZGVyIHtcblxuICBwcml2YXRlIGN1cnJlbnREb2N1bWVudFBhdGg7XG5cbiAgY29uc3RydWN0b3IocGF0aFRvWUFNTEZpbGU6IHN0cmluZykge1xuICAgIHRoaXMuY3VycmVudERvY3VtZW50UGF0aCA9IHBhdGhUb1lBTUxGaWxlO1xuICB9XG5cbiAgcHVibGljIGxvYWRGaWxlKCk6IGFueSB7XG4gICAgICBjb25zdCBhcGkgPSBzYWZlTG9hZChzeW5jR2V0KHRoaXMuY3VycmVudERvY3VtZW50UGF0aCksIHtcbiAgICAgICAgc2NoZW1hOiBTY2hlbWEuY3JlYXRlKFtuZXcgSW5jbHVkZVR5cGUodGhpcy5jdXJyZW50RG9jdW1lbnRQYXRoKV0pXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBhcGk7XG4gIH1cblxufVxuXG5leHBvcnQgY2xhc3MgSW5jbHVkZVR5cGUgZXh0ZW5kcyBUeXBlIHtcblxuICBwcml2YXRlIHJlbFBhdGhUb0FicyhzUmVsUGF0aCkge1xuICAgIHZhciBuVXBMbiwgc0RpciA9IFwiXCIsIHNQYXRoID0gdGhpcy5wYXJlbnREb2N1bWVudFBhdGgucmVwbGFjZSgvW15cXC9dKiQvLCBzUmVsUGF0aC5yZXBsYWNlKC8oXFwvfF4pKD86XFwuP1xcLyspKy9nLCBcIiQxXCIpKTtcbiAgICBmb3IgKHZhciBuRW5kLCBuU3RhcnQgPSAwOyBuRW5kID0gc1BhdGguaW5kZXhPZihcIi8uLi9cIiwgblN0YXJ0KSwgbkVuZCA+IC0xOyBuU3RhcnQgPSBuRW5kICsgblVwTG4pIHtcbiAgICAgIG5VcExuID0gL15cXC8oPzpcXC5cXC5cXC8pKi8uZXhlYyhzUGF0aC5zbGljZShuRW5kKSlbMF0ubGVuZ3RoO1xuICAgICAgc0RpciA9IChzRGlyICsgc1BhdGguc3Vic3RyaW5nKG5TdGFydCwgbkVuZCkpLnJlcGxhY2UobmV3IFJlZ0V4cChcIig/OlxcXFxcXC8rW15cXFxcXFwvXSopezAsXCIgKyAoKG5VcExuIC0gMSkgLyAzKSArIFwifSRcIiksIFwiL1wiKTtcbiAgICB9XG4gICAgcmV0dXJuIHNEaXIgKyBzUGF0aC5zdWJzdHIoblN0YXJ0KTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcGFyZW50RG9jdW1lbnRQYXRoKSB7XG4gICAgc3VwZXIoXCIhaW5jbHVkZVwiLCB7XG4gICAgICBraW5kOiBcInNjYWxhclwiLFxuICAgICAgY29uc3RydWN0OiBmdW5jdGlvbiAocGF0aFRvUkFNTEZpbGUpIHtcbiAgICAgICAgcmV0dXJuIHNhZmVMb2FkKHN5bmNHZXQodGhpcy5yZWxQYXRoVG9BYnMocGF0aFRvUkFNTEZpbGUpKSwge1xuICAgICAgICAgIHNjaGVtYTogU2NoZW1hLmNyZWF0ZShbbmV3IEluY2x1ZGVUeXBlKHBhdGhUb1JBTUxGaWxlKV0pXG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICAgIHJlc29sdmU6IGZ1bmN0aW9uIChwYXRoOiBzdHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFJBTUxCYWNrZW5kQ29uZmlnIHtcblxuICBzdGF0aWMgdG9wTGV2ZWxLZXl3b3Jkczogc3RyaW5nW10gPSBbXCJ0aXRsZVwiLCBcInZlcnNpb25cIiwgXCJiYXNlVXJpXCIsXG4gICAgXCJtZWRpYVR5cGVcIiwgXCJ0eXBlc1wiLCBcInNlY3VyZWRCeVwiXTtcblxuXG4gIHN0YXRpYyBpbml0V2l0aEZpbGUocGF0aFRvUkFNTEZpbGU6IHN0cmluZyk6IFJBTUxCYWNrZW5kQ29uZmlnIHtcbiAgICBjb25zdCBhcGkgPSBuZXcgWUFNTEZpbGVMb2FkZXIocGF0aFRvUkFNTEZpbGUpLmxvYWRGaWxlKCk7XG4gICAgcmV0dXJuIG5ldyBSQU1MQmFja2VuZENvbmZpZyhhcGkpO1xuICB9XG5cbiAgcHJpdmF0ZSBzdGF0aWMgZmluZEJlc3REdW1teVJlc3BvbnNlKHJlc3BvbnNlcyk6IHsgc3RhdHVzQ29kZTogbnVtYmVyLCByZXNwb25zZURlZmluaXRpb246IGFueSB9IHtcbiAgICBsZXQgYmVzdEZpdHRpbmdSZXNwID0gbnVsbCwgYmVzdEZpdHRpbmdSZXNwQ29kZSA9IG51bGw7XG4gICAgZm9yIChjb25zdCBjb2RlIGluIHJlc3BvbnNlcykge1xuICAgICAgY29uc3QgY2FuZGlkYXRlID0gcmVzcG9uc2VzW2NvZGVdO1xuICAgICAgY29uc3Qgc3RhdHVzQ29kZSA9IE51bWJlci5wYXJzZUludChjb2RlKTtcbiAgICAgIGlmICgyMDAgPD0gc3RhdHVzQ29kZSAmJiBzdGF0dXNDb2RlIDwgMzAwKSB7XG4gICAgICAgIGlmIChiZXN0Rml0dGluZ1Jlc3BDb2RlID09PSBudWxsIHx8IGJlc3RGaXR0aW5nUmVzcENvZGUgPiBzdGF0dXNDb2RlKSB7XG4gICAgICAgICAgYmVzdEZpdHRpbmdSZXNwID0gY2FuZGlkYXRlO1xuICAgICAgICAgIGJlc3RGaXR0aW5nUmVzcENvZGUgPSBzdGF0dXNDb2RlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7c3RhdHVzQ29kZTogYmVzdEZpdHRpbmdSZXNwQ29kZSwgcmVzcG9uc2VEZWZpbml0aW9uOiBiZXN0Rml0dGluZ1Jlc3AgfHwge319O1xuICB9XG5cbiAgcHJpdmF0ZSBkZWZpbmVkOiBCZWhhdmlvcltdID0gW107XG5cbiAgcHJpdmF0ZSBzdHViYmVkOiBCZWhhdmlvcltdID0gW107XG5cbiAgcHJpdmF0ZSBleHBlY3RlZDogQmVoYXZpb3JbXSA9IFtdO1xuXG4gIHByaXZhdGUgcGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbjogUGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiA9IG51bGw7XG5cbiAgcHJpdmF0ZSBmaW5kUmVxdWVzdEJvZHlTY2hlbWEobWV0aG9kKTogYW55IHtcbiAgICBpZiAobWV0aG9kW1wiYm9keVwiXSAmJiBtZXRob2RbXCJib2R5XCJdW1widHlwZVwiXSkge1xuICAgICAgY29uc3QgcmF3U2NoZW1hID0gbWV0aG9kW1wiYm9keVwiXVtcInR5cGVcIl07XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gcmF3U2NoZW1hO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zdCB0eXBlTmFtZSA9IHJhd1NjaGVtYS50cmltKCk7XG4gICAgICAgIGZvciAoY29uc3QgdCBpbiB0aGlzLmFwaVtcInR5cGVzXCJdKSB7XG4gICAgICAgICAgaWYgKHQgPT09IHR5cGVOYW1lKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5wYXJzZSh0aGlzLmFwaVtcInR5cGVzXCJdW3RdLnRvU3RyaW5nKCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFic29sdXRlVXJpKHJlbGF0aXZlVXJpOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLmFwaVtcImJhc2VVcmlcIl0gKyByZWxhdGl2ZVVyaTtcbiAgfVxuXG4gIHByaXZhdGUgaXNLZXl3b3JkKGNhbmRpZGF0ZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgZm9yIChsZXQgaSBpbiBSQU1MQmFja2VuZENvbmZpZy50b3BMZXZlbEtleXdvcmRzKSB7XG4gICAgICBpZiAoUkFNTEJhY2tlbmRDb25maWcudG9wTGV2ZWxLZXl3b3Jkc1tpXSA9PT0gY2FuZGlkYXRlKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBwcml2YXRlIGFsbFJlc291cmNlcyhhcGk6IGFueSk6IGFueSB7XG4gICAgY29uc3QgcnZhbCA9IHt9O1xuICAgIGZvciAodmFyIGkgaW4gYXBpKSB7XG4gICAgICBpZiAoIXRoaXMuaXNLZXl3b3JkKGkpKSB7XG4gICAgICAgIHJ2YWxbaV0gPSBhcGlbaV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBydmFsO1xuICB9XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBhcGkpIHtcbiAgICBjb25zdCBlbnRyaWVzOiBCZWhhdmlvcltdID0gW107XG4gICAgY29uc3QgYWxsUmVzb3VyY2VzID0gdGhpcy5hbGxSZXNvdXJjZXModGhpcy5hcGkpO1xuICAgIGZvciAoY29uc3QgaSBpbiBhbGxSZXNvdXJjZXMpIHtcbiAgICAgIGNvbnN0IHJlc291cmNlID0gYWxsUmVzb3VyY2VzW2ldO1xuICAgICAgY29uc3QgcmVzb3VyY2VVcmkgPSB0aGlzLmFic29sdXRlVXJpKGkpO1xuICAgICAgZm9yIChjb25zdCBtZXRob2ROYW1lIGluIHJlc291cmNlKSB7XG4gICAgICAgIGNvbnN0IG1ldGhvZCA9IHJlc291cmNlW21ldGhvZE5hbWVdO1xuICAgICAgICBjb25zdCBzY2hlbWEgPSB0aGlzLmZpbmRSZXF1ZXN0Qm9keVNjaGVtYShtZXRob2QpO1xuXG4gICAgICAgIGNvbnN0IHBhdHRlcm4gPSBuZXcgUmVxdWVzdFBhdHRlcm4ocmVzb3VyY2VVcmksIG1ldGhvZE5hbWUsIHNjaGVtYSk7XG4gICAgICAgIGNvbnN0IHtzdGF0dXNDb2RlLCByZXNwb25zZURlZmluaXRpb259ID0gUkFNTEJhY2tlbmRDb25maWcuZmluZEJlc3REdW1teVJlc3BvbnNlKG1ldGhvZFtcInJlc3BvbnNlc1wiXSk7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gdGhpcy5idWlsZFJlc3BvbnNlRnJvbURlZmluaXRpb24oc3RhdHVzQ29kZSwgcmVzcG9uc2VEZWZpbml0aW9uKTtcbiAgICAgICAgZW50cmllcy5wdXNoKHtcbiAgICAgICAgICByZXF1ZXN0UGF0dGVybjogcGF0dGVybixcbiAgICAgICAgICByZXNwb25zZTogcmVzcG9uc2UsXG4gICAgICAgICAgcmVxdWVzdFZhbGlkYXRvcjogbmV3IERlZmF1bHRSZXF1ZXN0VmFsaWRhdG9yKG1ldGhvZClcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuZGVmaW5lZCA9IGVudHJpZXM7XG4gIH1cblxuICBwcml2YXRlIGJ1aWxkUmVzcG9uc2VGcm9tRGVmaW5pdGlvbihzdGF0dXNDb2RlLCByZXNwb25zZURlZmluaXRpb24sIGV4YW1wbGVJZGVudGlmaWVyPzogc3RyaW5nKSB7XG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShuZXcgUmVzcG9uc2VPcHRpb25zKHtcbiAgICAgIHN0YXR1czogc3RhdHVzQ29kZSxcbiAgICAgIGJvZHk6IHRoaXMubG9va3VwRXhhbXBsZVJlc3BvbnNlQm9keShyZXNwb25zZURlZmluaXRpb25bXCJib2R5XCJdLCBleGFtcGxlSWRlbnRpZmllcilcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgc3R1YkFsbCgpOiBSQU1MQmFja2VuZENvbmZpZyB7XG4gICAgdGhpcy5kZWZpbmVkLmZvckVhY2goYmVoYXZpb3IgPT4gdGhpcy5zdHViYmVkLnB1c2goYmVoYXZpb3IpKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHByaXZhdGUgbG9va3VwRXhhbXBsZVJlc3BvbnNlQm9keShyZXNwQm9keURlZiwgZXhhbXBsZUlkZW50aWZpZXI/OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGZ1bmN0aW9uIHRocm93RXJyb3IoKSB7XG4gICAgICB0aHJvdyBuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJjb3VsZCBub3QgZmluZCBleGFtcGxlIFtcIiArIGV4YW1wbGVJZGVudGlmaWVyICsgXCJdXCIpO1xuICAgIH1cblxuICAgIGlmIChyZXNwQm9keURlZiA9PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmIChleGFtcGxlSWRlbnRpZmllciAhPSBudWxsKSB7XG4gICAgICAgIHRocm93RXJyb3IoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBleGFtcGxlRGVmcyA9IHJlc3BCb2R5RGVmW1wiZXhhbXBsZXNcIl07XG4gICAgaWYgKGV4YW1wbGVJZGVudGlmaWVyICE9IG51bGwpIHtcbiAgICAgIGlmIChleGFtcGxlRGVmcyA9PSBudWxsIHx8IGV4YW1wbGVEZWZzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvd0Vycm9yKCk7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGV4YW1wbGVOYW1lIGluIGV4YW1wbGVEZWZzKSB7XG4gICAgICAgIGlmIChleGFtcGxlTmFtZSA9PT0gZXhhbXBsZUlkZW50aWZpZXIpIHtcbiAgICAgICAgICByZXR1cm4gZXhhbXBsZURlZnNbZXhhbXBsZU5hbWVdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aHJvd0Vycm9yKCk7XG4gICAgfVxuICAgIHJldHVybiByZXNwQm9keURlZltcImV4YW1wbGVcIl07XG4gIH1cblxuICBwdWJsaWMgbG9va3VwUmVzcG9uc2Uoc3RhdHVzQ29kZTogbnVtYmVyLCBleGFtcGxlSWRlbnRpZmllcjogc3RyaW5nKTogUmVzcG9uc2Uge1xuICAgIGNvbnN0IHBvc3NpYmxlUmVzcG9uc2VEZWZzID0gdGhpcy5sb29rdXBSZXNwb25zZURlZnNCeVJlcXVlc3QodGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uLnJlcXVlc3QpO1xuICAgIGZvciAoY29uc3QgY29kZSBpbiBwb3NzaWJsZVJlc3BvbnNlRGVmcykge1xuICAgICAgaWYgKE51bWJlci5wYXJzZUludChjb2RlKSA9PT0gc3RhdHVzQ29kZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5idWlsZFJlc3BvbnNlRnJvbURlZmluaXRpb24oc3RhdHVzQ29kZSwgcG9zc2libGVSZXNwb25zZURlZnNbY29kZV0sIGV4YW1wbGVJZGVudGlmaWVyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwidGhlcmUgaXMgbm8gcmVzcG9uc2UgZGVmaW5lZCB3aXRoIHN0YXR1cyBjb2RlIFwiICsgc3RhdHVzQ29kZSArIFwiIGluIHRoZSBSQU1MIGZpbGVcIik7XG4gIH1cblxuICBwcml2YXRlIGxvb2t1cFJlc3BvbnNlRGVmc0J5UmVxdWVzdChyZXF1ZXN0OiBSZXF1ZXN0KTogYW55IHtcbiAgICBmb3IgKGNvbnN0IGkgaW4gdGhpcy5hbGxSZXNvdXJjZXModGhpcy5hcGkpKSB7XG4gICAgICBjb25zdCByZXMgPSB0aGlzLmFsbFJlc291cmNlcyh0aGlzLmFwaSlbaV07XG4gICAgICBsZXQgbWV0aG9kcyA9IE9iamVjdC5rZXlzKHJlcyk7XG4gICAgICBmb3IgKGNvbnN0IG1ldGhvZE5hbWUgaW4gbWV0aG9kcykge1xuICAgICAgICBjb25zdCBtZXRob2QgPSBtZXRob2RzW21ldGhvZE5hbWVdO1xuICAgICAgICBjb25zdCBwYXR0ZXJuID0gbmV3IFJlcXVlc3RQYXR0ZXJuKHRoaXMuYWJzb2x1dGVVcmkoaSksIG1ldGhvZCwgdGhpcy5maW5kUmVxdWVzdEJvZHlTY2hlbWEocmVzW21ldGhvZF0pKTtcbiAgICAgICAgaWYgKHBhdHRlcm4ubWF0Y2hlcyhyZXF1ZXN0KSkge1xuICAgICAgICAgIGNvbnN0IHJ2YWwgPSB7fTtcbiAgICAgICAgICBmb3IgKGxldCBzdGF0dXNDb2RlIGluIHJlc1ttZXRob2RdLnJlc3BvbnNlcykge1xuICAgICAgICAgICAgcnZhbFtzdGF0dXNDb2RlXSA9IHJlc1ttZXRob2RdLnJlc3BvbnNlc1tzdGF0dXNDb2RlXSB8fCB7fTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHJ2YWw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgXCJub3QgZm91bmRcIjtcbiAgfVxuXG4gIHByaXZhdGUgb25TdHViUmVzcG9uc2VBdmFpbGFibGUocmVxdWVzdFBhdHRlcm46IFJlcXVlc3RQYXR0ZXJuLCByZXNwb25zZTogUmVzcG9uc2UpIHtcbiAgICAvLyB0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ucHJlbWF0Y2hlZEJlaGF2aW9yLjtcbiAgICB0aGlzLnN0dWJiZWQudW5zaGlmdCh7XG4gICAgICByZXNwb25zZTogcmVzcG9uc2UsXG4gICAgICByZXF1ZXN0UGF0dGVybjogcmVxdWVzdFBhdHRlcm4sXG4gICAgICByZXF1ZXN0VmFsaWRhdG9yOiBuZXcgTm9vcFJlcXVlc3RWYWxpZGF0b3IoKVxuICAgIH0pO1xuICAgIHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiA9IG51bGw7XG4gIH1cblxuICBwcml2YXRlIG9uTW9ja1Jlc3BvbnNlQXZhaWxhYmxlKGJlaGF2aW9yOiBCZWhhdmlvcikge1xuICAgIHRoaXMuZXhwZWN0ZWQucHVzaChiZWhhdmlvcik7XG4gICAgdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uID0gbnVsbDtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuR0VUKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcImdldFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlbkhFQUQodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwiaGVhZFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlblBPU1QodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwicG9zdFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlblBVVCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJwdXRcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5ERUxFVEUodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwiZGVsZXRlXCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuUEFUQ0godXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwicGF0Y2hcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5PUFRJT05TKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcIm9wdGlvbnNcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBtYXJrUmVxdWVzdEFzUGVuZGluZyhyZXE6IFJlcXVlc3QsIGJlaGF2aW9yOiBCZWhhdmlvcikge1xuICAgIGlmICh0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24gIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IHBlbmRpbmdSZXFEZXNjciA9IFJlcXVlc3RNZXRob2RbdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uLnJlcXVlc3QubWV0aG9kXS50b1VwcGVyQ2FzZSgpXG4gICAgICAgICsgXCIgXCIgKyB0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ucmVxdWVzdC51cmw7XG4gICAgICBjb25zdCByZXFEZXNjciA9IFJlcXVlc3RNZXRob2RbcmVxLm1ldGhvZF0udG9VcHBlckNhc2UoKSArIFwiIFwiICsgcmVxLnVybDtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcInVuZmluaXNoZWQgYmVoYXZpb3IgZGVmaW5pdGlvbjogY2Fubm90IGNvbmZpZ3VyZSBcIlxuICAgICAgICArIHJlcURlc2NyICsgXCIgYmVmb3JlIHNldHRpbmcgdGhlIHJlc3BvbnNlIGZvciBcIiArIHBlbmRpbmdSZXFEZXNjcik7XG4gICAgfVxuICAgIHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiA9IHtcbiAgICAgIHJlcXVlc3Q6IHJlcSxcbiAgICAgIHByZW1hdGNoZWRCZWhhdmlvcjogYmVoYXZpb3JcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSByZWxhdGl2ZVBhdGgoYWJzb2x1dGVVcmk6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgdXJsID0gbmV3IFVSTChhYnNvbHV0ZVVyaSk7XG4gICAgcmV0dXJuIHVybC5wYXRobmFtZSArIHVybC5xdWVyeSArIHVybC5oYXNoO1xuICB9XG5cbiAgcHVibGljIHdoZW5SZXF1ZXN0SXMocmVxdWVzdDogUmVxdWVzdCk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICBjb25zdCBwYXRoID0gdGhpcy5yZWxhdGl2ZVBhdGgocmVxdWVzdC51cmwpLCBtZXRob2QgPSBSZXF1ZXN0TWV0aG9kW3JlcXVlc3QubWV0aG9kXTtcblxuICAgIGxldCB2YWxpZGF0aW9uRXJyb3I7XG4gICAgZm9yIChjb25zdCBpIGluIHRoaXMuZGVmaW5lZCkge1xuICAgICAgY29uc3QgYmVoYXZpb3IgPSB0aGlzLmRlZmluZWRbaV07XG4gICAgICBpZiAoYmVoYXZpb3IucmVxdWVzdFBhdHRlcm4ubWF0Y2hlcyhyZXF1ZXN0KSkge1xuICAgICAgICB0aGlzLm1hcmtSZXF1ZXN0QXNQZW5kaW5nKHJlcXVlc3QsIGJlaGF2aW9yKTtcbiAgICAgICAgaWYgKCh2YWxpZGF0aW9uRXJyb3IgPSBiZWhhdmlvci5yZXF1ZXN0VmFsaWRhdG9yLm1hdGNoZXMocmVxdWVzdCkpID09PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZVNldHRlcih0aGlzLCByZXNwb25zZSA9PiB0aGlzLm9uU3R1YlJlc3BvbnNlQXZhaWxhYmxlKG5ldyBSZXF1ZXN0UGF0dGVybihwYXRoLCBtZXRob2QsIG51bGwpLCByZXNwb25zZSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcih2YWxpZGF0aW9uRXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRocm93IG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcImZvdW5kIG5vIGRlY2xhcmF0aW9uIG9mIHJlcXVlc3QgW1wiICsgbWV0aG9kLnRvVXBwZXJDYXNlKClcbiAgICAgICsgXCIgXCIgKyBwYXRoICsgXCJdIGluIFJBTUwgLSByZWZ1c2luZyB0byBzdHViXCIpO1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZUJhY2tlbmQoKTogUkFNTEJhY2tlbmQge1xuICAgIHJldHVybiBuZXcgUkFNTEJhY2tlbmQodGhpcy5zdHViYmVkLCB0aGlzLmV4cGVjdGVkKTtcbiAgfVxuXG59XG4iXX0=
