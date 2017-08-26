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
                pathToRAMLFile = this.relPathToAbs(pathToRAMLFile);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDdEQsQ0FBQztJQUVILHdCQUFDO0FBQUQsQ0EvUUEsQUErUUM7QUE3UVEsa0NBQWdCLEdBQWEsQ0FBQyxPQUFPLEVBQUUsU0FBUyxFQUFFLFNBQVM7SUFDaEUsV0FBVyxFQUFFLE9BQU8sRUFBRSxXQUFXLENBQUMsQ0FBQztBQUgxQiw4Q0FBaUIiLCJmaWxlIjoiUkFNTEJhY2tlbmRDb25maWcuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge0JlaGF2aW9yLCBEZWZhdWx0UmVxdWVzdFZhbGlkYXRvciwgTm9vcFJlcXVlc3RWYWxpZGF0b3IsIFJBTUxCYWNrZW5kLCBSZXF1ZXN0UGF0dGVybn0gZnJvbSBcIi4vUkFNTEJhY2tlbmRcIjtcbmltcG9ydCB7c2FmZUxvYWQsIFNjaGVtYSwgVHlwZX0gZnJvbSBcImpzLXlhbWxcIjtcbmltcG9ydCB7UmVxdWVzdCwgUmVxdWVzdE1ldGhvZCwgUmVzcG9uc2UsIFJlc3BvbnNlT3B0aW9uc30gZnJvbSBcIkBhbmd1bGFyL2h0dHBcIjtcbmltcG9ydCBVUkwgPSByZXF1aXJlKFwidXJsLXBhcnNlXCIpO1xuXG5leHBvcnQgY2xhc3MgSW52YWxpZFN0dWJiaW5nRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG5cbn1cblxuZXhwb3J0IGNsYXNzIFJlc3BvbnNlU2V0dGVyIHtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIG93bmVyOiBSQU1MQmFja2VuZENvbmZpZyxcbiAgICAgICAgICAgICAgcHJpdmF0ZSBvblJlYWR5OiAocmVzcG9uc2U6IFJlc3BvbnNlKSA9PiB2b2lkKSB7XG4gIH1cblxuICBwdWJsaWMgdGhlblJlc3BvbmQocmVzcG9uc2U6IFJlc3BvbnNlKTogUkFNTEJhY2tlbmRDb25maWcge1xuICAgIHRoaXMub25SZWFkeShyZXNwb25zZSk7XG4gICAgcmV0dXJuIHRoaXMub3duZXI7XG4gIH1cblxuICBwdWJsaWMgdGhlblJlc3BvbmRXaXRoKHN0YXR1c0NvZGU6IG51bWJlciwgZXhhbXBsZUlkZW50aWZpZXI/OiBzdHJpbmcpOiBSQU1MQmFja2VuZENvbmZpZyB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSB0aGlzLm93bmVyLmxvb2t1cFJlc3BvbnNlKHN0YXR1c0NvZGUsIGV4YW1wbGVJZGVudGlmaWVyKTtcbiAgICB0aGlzLm9uUmVhZHkocmVzcG9uc2UpO1xuICAgIHJldHVybiB0aGlzLm93bmVyO1xuICB9XG5cbn1cblxuaW50ZXJmYWNlIFBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ge1xuXG4gIHByZW1hdGNoZWRCZWhhdmlvcjogQmVoYXZpb3I7XG5cbiAgcmVxdWVzdDogUmVxdWVzdDtcblxuICAvLyByZXNwb25zZVBhdHRlcm5DYW5kaWRhdGVzOiBNZXRob2RbXTtcblxufVxuXG5jbGFzcyBZQU1MRmlsZUxvYWRlciB7XG5cbiAgcHJpdmF0ZSBjdXJyZW50RG9jdW1lbnRQYXRoO1xuXG4gIGNvbnN0cnVjdG9yKHBhdGhUb1lBTUxGaWxlOiBzdHJpbmcpIHtcbiAgICB0aGlzLmN1cnJlbnREb2N1bWVudFBhdGggPSBwYXRoVG9ZQU1MRmlsZTtcbiAgfVxuXG4gIHB1YmxpYyBsb2FkRmlsZSgpOiBhbnkge1xuICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgcmVxdWVzdC5vcGVuKCdHRVQnLCB0aGlzLmN1cnJlbnREb2N1bWVudFBhdGgsIGZhbHNlKTtcbiAgICByZXF1ZXN0LnNlbmQobnVsbCk7XG4gICAgaWYgKHJlcXVlc3Quc3RhdHVzID09PSAyMDApIHtcbiAgICAgIGNvbnN0IGFwaSA9IHNhZmVMb2FkKHJlcXVlc3QucmVzcG9uc2VUZXh0LCB7XG4gICAgICAgIHNjaGVtYTogU2NoZW1hLmNyZWF0ZShbbmV3IEluY2x1ZGVUeXBlKHRoaXMuY3VycmVudERvY3VtZW50UGF0aCldKVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gYXBpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBFcnJvcihyZXF1ZXN0LnN0YXR1cyArIFwiOiBHRVQgXCIgKyB0aGlzLmN1cnJlbnREb2N1bWVudFBhdGgpO1xuICAgIH1cbiAgfVxuXG59XG5cbmV4cG9ydCBjbGFzcyBJbmNsdWRlVHlwZSBleHRlbmRzIFR5cGUge1xuXG4gIHByaXZhdGUgcmVsUGF0aFRvQWJzKHNSZWxQYXRoKSB7XG4gICAgdmFyIG5VcExuLCBzRGlyID0gXCJcIiwgc1BhdGggPSB0aGlzLnBhcmVudERvY3VtZW50UGF0aC5yZXBsYWNlKC9bXlxcL10qJC8sIHNSZWxQYXRoLnJlcGxhY2UoLyhcXC98XikoPzpcXC4/XFwvKykrL2csIFwiJDFcIikpO1xuICAgIGZvciAodmFyIG5FbmQsIG5TdGFydCA9IDA7IG5FbmQgPSBzUGF0aC5pbmRleE9mKFwiLy4uL1wiLCBuU3RhcnQpLCBuRW5kID4gLTE7IG5TdGFydCA9IG5FbmQgKyBuVXBMbikge1xuICAgICAgblVwTG4gPSAvXlxcLyg/OlxcLlxcLlxcLykqLy5leGVjKHNQYXRoLnNsaWNlKG5FbmQpKVswXS5sZW5ndGg7XG4gICAgICBzRGlyID0gKHNEaXIgKyBzUGF0aC5zdWJzdHJpbmcoblN0YXJ0LCBuRW5kKSkucmVwbGFjZShuZXcgUmVnRXhwKFwiKD86XFxcXFxcLytbXlxcXFxcXC9dKil7MCxcIiArICgoblVwTG4gLSAxKSAvIDMpICsgXCJ9JFwiKSwgXCIvXCIpO1xuICAgIH1cbiAgICByZXR1cm4gc0RpciArIHNQYXRoLnN1YnN0cihuU3RhcnQpO1xuICB9XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBwYXJlbnREb2N1bWVudFBhdGgpIHtcbiAgICBzdXBlcihcIiFpbmNsdWRlXCIsIHtcbiAgICAgIGtpbmQ6IFwic2NhbGFyXCIsXG4gICAgICBjb25zdHJ1Y3Q6IGZ1bmN0aW9uIChwYXRoVG9SQU1MRmlsZSkge1xuICAgICAgICBwYXRoVG9SQU1MRmlsZSA9IHRoaXMucmVsUGF0aFRvQWJzKHBhdGhUb1JBTUxGaWxlKTtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgcmVxdWVzdC5vcGVuKCdHRVQnLCBwYXRoVG9SQU1MRmlsZSwgZmFsc2UpO1xuICAgICAgICByZXF1ZXN0LnNlbmQobnVsbCk7XG4gICAgICAgIGlmIChyZXF1ZXN0LnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICAgICAgY29uc3QgYXBpID0gc2FmZUxvYWQocmVxdWVzdC5yZXNwb25zZVRleHQsIHtcbiAgICAgICAgICAgIHNjaGVtYTogU2NoZW1hLmNyZWF0ZShbbmV3IEluY2x1ZGVUeXBlKHBhdGhUb1JBTUxGaWxlKV0pXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmV0dXJuIGFwaTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBFcnJvcihyZXF1ZXN0LnN0YXR1cyArIFwiOiBHRVQgXCIgKyBwYXRoVG9SQU1MRmlsZSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICByZXNvbHZlOiBmdW5jdGlvbiAocGF0aDogc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBSQU1MQmFja2VuZENvbmZpZyB7XG5cbiAgc3RhdGljIHRvcExldmVsS2V5d29yZHM6IHN0cmluZ1tdID0gW1widGl0bGVcIiwgXCJ2ZXJzaW9uXCIsIFwiYmFzZVVyaVwiLFxuICAgIFwibWVkaWFUeXBlXCIsIFwidHlwZXNcIiwgXCJzZWN1cmVkQnlcIl07XG5cblxuICBzdGF0aWMgaW5pdFdpdGhGaWxlKHBhdGhUb1JBTUxGaWxlOiBzdHJpbmcpOiBSQU1MQmFja2VuZENvbmZpZyB7XG4gICAgY29uc3QgYXBpID0gbmV3IFlBTUxGaWxlTG9hZGVyKHBhdGhUb1JBTUxGaWxlKS5sb2FkRmlsZSgpO1xuICAgIHJldHVybiBuZXcgUkFNTEJhY2tlbmRDb25maWcoYXBpKTtcbiAgfVxuXG4gIHByaXZhdGUgc3RhdGljIGZpbmRCZXN0RHVtbXlSZXNwb25zZShyZXNwb25zZXMpOiB7IHN0YXR1c0NvZGU6IG51bWJlciwgcmVzcG9uc2VEZWZpbml0aW9uOiBhbnkgfSB7XG4gICAgbGV0IGJlc3RGaXR0aW5nUmVzcCA9IG51bGwsIGJlc3RGaXR0aW5nUmVzcENvZGUgPSBudWxsO1xuICAgIGZvciAoY29uc3QgY29kZSBpbiByZXNwb25zZXMpIHtcbiAgICAgIGNvbnN0IGNhbmRpZGF0ZSA9IHJlc3BvbnNlc1tjb2RlXTtcbiAgICAgIGNvbnN0IHN0YXR1c0NvZGUgPSBOdW1iZXIucGFyc2VJbnQoY29kZSk7XG4gICAgICBpZiAoMjAwIDw9IHN0YXR1c0NvZGUgJiYgc3RhdHVzQ29kZSA8IDMwMCkge1xuICAgICAgICBpZiAoYmVzdEZpdHRpbmdSZXNwQ29kZSA9PT0gbnVsbCB8fCBiZXN0Rml0dGluZ1Jlc3BDb2RlID4gc3RhdHVzQ29kZSkge1xuICAgICAgICAgIGJlc3RGaXR0aW5nUmVzcCA9IGNhbmRpZGF0ZTtcbiAgICAgICAgICBiZXN0Rml0dGluZ1Jlc3BDb2RlID0gc3RhdHVzQ29kZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ge3N0YXR1c0NvZGU6IGJlc3RGaXR0aW5nUmVzcENvZGUsIHJlc3BvbnNlRGVmaW5pdGlvbjogYmVzdEZpdHRpbmdSZXNwIHx8IHt9fTtcbiAgfVxuXG4gIHByaXZhdGUgZGVmaW5lZDogQmVoYXZpb3JbXSA9IFtdO1xuXG4gIHByaXZhdGUgc3R1YmJlZDogQmVoYXZpb3JbXSA9IFtdO1xuXG4gIHByaXZhdGUgZXhwZWN0ZWQ6IEJlaGF2aW9yW10gPSBbXTtcblxuICBwcml2YXRlIHBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb246IFBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24gPSBudWxsO1xuXG4gIHByaXZhdGUgZmluZFJlcXVlc3RCb2R5U2NoZW1hKG1ldGhvZCk6IGFueSB7XG4gICAgaWYgKG1ldGhvZFtcImJvZHlcIl0gJiYgbWV0aG9kW1wiYm9keVwiXVtcInR5cGVcIl0pIHtcbiAgICAgIGNvbnN0IHJhd1NjaGVtYSA9IG1ldGhvZFtcImJvZHlcIl1bXCJ0eXBlXCJdO1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIHJhd1NjaGVtYTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc3QgdHlwZU5hbWUgPSByYXdTY2hlbWEudHJpbSgpO1xuICAgICAgICBmb3IgKGNvbnN0IHQgaW4gdGhpcy5hcGlbXCJ0eXBlc1wiXSkge1xuICAgICAgICAgIGlmICh0ID09PSB0eXBlTmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UodGhpcy5hcGlbXCJ0eXBlc1wiXVt0XS50b1N0cmluZygpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhYnNvbHV0ZVVyaShyZWxhdGl2ZVVyaTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5hcGlbXCJiYXNlVXJpXCJdICsgcmVsYXRpdmVVcmk7XG4gIH1cblxuICBwcml2YXRlIGlzS2V5d29yZChjYW5kaWRhdGU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGZvciAobGV0IGkgaW4gUkFNTEJhY2tlbmRDb25maWcudG9wTGV2ZWxLZXl3b3Jkcykge1xuICAgICAgaWYgKFJBTUxCYWNrZW5kQ29uZmlnLnRvcExldmVsS2V5d29yZHNbaV0gPT09IGNhbmRpZGF0ZSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBhbGxSZXNvdXJjZXMoYXBpOiBhbnkpOiBhbnkge1xuICAgIGNvbnN0IHJ2YWwgPSB7fTtcbiAgICBmb3IgKHZhciBpIGluIGFwaSkge1xuICAgICAgaWYgKCF0aGlzLmlzS2V5d29yZChpKSkge1xuICAgICAgICBydmFsW2ldID0gYXBpW2ldO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcnZhbDtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgYXBpKSB7XG4gICAgY29uc3QgZW50cmllczogQmVoYXZpb3JbXSA9IFtdO1xuICAgIGNvbnN0IGFsbFJlc291cmNlcyA9IHRoaXMuYWxsUmVzb3VyY2VzKHRoaXMuYXBpKTtcbiAgICBmb3IgKGNvbnN0IGkgaW4gYWxsUmVzb3VyY2VzKSB7XG4gICAgICBjb25zdCByZXNvdXJjZSA9IGFsbFJlc291cmNlc1tpXTtcbiAgICAgIGNvbnN0IHJlc291cmNlVXJpID0gdGhpcy5hYnNvbHV0ZVVyaShpKTtcbiAgICAgIGZvciAoY29uc3QgbWV0aG9kTmFtZSBpbiByZXNvdXJjZSkge1xuICAgICAgICBjb25zdCBtZXRob2QgPSByZXNvdXJjZVttZXRob2ROYW1lXTtcbiAgICAgICAgY29uc3Qgc2NoZW1hID0gdGhpcy5maW5kUmVxdWVzdEJvZHlTY2hlbWEobWV0aG9kKTtcblxuICAgICAgICBjb25zdCBwYXR0ZXJuID0gbmV3IFJlcXVlc3RQYXR0ZXJuKHJlc291cmNlVXJpLCBtZXRob2ROYW1lLCBzY2hlbWEpO1xuICAgICAgICBjb25zdCB7c3RhdHVzQ29kZSwgcmVzcG9uc2VEZWZpbml0aW9ufSA9IFJBTUxCYWNrZW5kQ29uZmlnLmZpbmRCZXN0RHVtbXlSZXNwb25zZShtZXRob2RbXCJyZXNwb25zZXNcIl0pO1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IHRoaXMuYnVpbGRSZXNwb25zZUZyb21EZWZpbml0aW9uKHN0YXR1c0NvZGUsIHJlc3BvbnNlRGVmaW5pdGlvbik7XG4gICAgICAgIGVudHJpZXMucHVzaCh7XG4gICAgICAgICAgcmVxdWVzdFBhdHRlcm46IHBhdHRlcm4sXG4gICAgICAgICAgcmVzcG9uc2U6IHJlc3BvbnNlLFxuICAgICAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IG5ldyBEZWZhdWx0UmVxdWVzdFZhbGlkYXRvcihtZXRob2QpXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmRlZmluZWQgPSBlbnRyaWVzO1xuICB9XG5cbiAgcHJpdmF0ZSBidWlsZFJlc3BvbnNlRnJvbURlZmluaXRpb24oc3RhdHVzQ29kZSwgcmVzcG9uc2VEZWZpbml0aW9uLCBleGFtcGxlSWRlbnRpZmllcj86IHN0cmluZykge1xuICAgIHJldHVybiBuZXcgUmVzcG9uc2UobmV3IFJlc3BvbnNlT3B0aW9ucyh7XG4gICAgICBzdGF0dXM6IHN0YXR1c0NvZGUsXG4gICAgICBib2R5OiB0aGlzLmxvb2t1cEV4YW1wbGVSZXNwb25zZUJvZHkocmVzcG9uc2VEZWZpbml0aW9uW1wiYm9keVwiXSwgZXhhbXBsZUlkZW50aWZpZXIpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHN0dWJBbGwoKTogUkFNTEJhY2tlbmRDb25maWcge1xuICAgIHRoaXMuZGVmaW5lZC5mb3JFYWNoKGJlaGF2aW9yID0+IHRoaXMuc3R1YmJlZC5wdXNoKGJlaGF2aW9yKSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBwcml2YXRlIGxvb2t1cEV4YW1wbGVSZXNwb25zZUJvZHkocmVzcEJvZHlEZWYsIGV4YW1wbGVJZGVudGlmaWVyPzogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBmdW5jdGlvbiB0aHJvd0Vycm9yKCkge1xuICAgICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwiY291bGQgbm90IGZpbmQgZXhhbXBsZSBbXCIgKyBleGFtcGxlSWRlbnRpZmllciArIFwiXVwiKTtcbiAgICB9XG5cbiAgICBpZiAocmVzcEJvZHlEZWYgPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAoZXhhbXBsZUlkZW50aWZpZXIgIT0gbnVsbCkge1xuICAgICAgICB0aHJvd0Vycm9yKCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgZXhhbXBsZURlZnMgPSByZXNwQm9keURlZltcImV4YW1wbGVzXCJdO1xuICAgIGlmIChleGFtcGxlSWRlbnRpZmllciAhPSBudWxsKSB7XG4gICAgICBpZiAoZXhhbXBsZURlZnMgPT0gbnVsbCB8fCBleGFtcGxlRGVmcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3dFcnJvcigpO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBleGFtcGxlTmFtZSBpbiBleGFtcGxlRGVmcykge1xuICAgICAgICBpZiAoZXhhbXBsZU5hbWUgPT09IGV4YW1wbGVJZGVudGlmaWVyKSB7XG4gICAgICAgICAgcmV0dXJuIGV4YW1wbGVEZWZzW2V4YW1wbGVOYW1lXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhyb3dFcnJvcigpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzcEJvZHlEZWZbXCJleGFtcGxlXCJdO1xuICB9XG5cbiAgcHVibGljIGxvb2t1cFJlc3BvbnNlKHN0YXR1c0NvZGU6IG51bWJlciwgZXhhbXBsZUlkZW50aWZpZXI6IHN0cmluZyk6IFJlc3BvbnNlIHtcbiAgICBjb25zdCBwb3NzaWJsZVJlc3BvbnNlRGVmcyA9IHRoaXMubG9va3VwUmVzcG9uc2VEZWZzQnlSZXF1ZXN0KHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbi5yZXF1ZXN0KTtcbiAgICBmb3IgKGNvbnN0IGNvZGUgaW4gcG9zc2libGVSZXNwb25zZURlZnMpIHtcbiAgICAgIGlmIChOdW1iZXIucGFyc2VJbnQoY29kZSkgPT09IHN0YXR1c0NvZGUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYnVpbGRSZXNwb25zZUZyb21EZWZpbml0aW9uKHN0YXR1c0NvZGUsIHBvc3NpYmxlUmVzcG9uc2VEZWZzW2NvZGVdLCBleGFtcGxlSWRlbnRpZmllcik7XG4gICAgICB9XG4gICAgfVxuICAgIHRocm93IG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcInRoZXJlIGlzIG5vIHJlc3BvbnNlIGRlZmluZWQgd2l0aCBzdGF0dXMgY29kZSBcIiArIHN0YXR1c0NvZGUgKyBcIiBpbiB0aGUgUkFNTCBmaWxlXCIpO1xuICB9XG5cbiAgcHJpdmF0ZSBsb29rdXBSZXNwb25zZURlZnNCeVJlcXVlc3QocmVxdWVzdDogUmVxdWVzdCk6IGFueSB7XG4gICAgZm9yIChjb25zdCBpIGluIHRoaXMuYWxsUmVzb3VyY2VzKHRoaXMuYXBpKSkge1xuICAgICAgY29uc3QgcmVzID0gdGhpcy5hbGxSZXNvdXJjZXModGhpcy5hcGkpW2ldO1xuICAgICAgbGV0IG1ldGhvZHMgPSBPYmplY3Qua2V5cyhyZXMpO1xuICAgICAgZm9yIChjb25zdCBtZXRob2ROYW1lIGluIG1ldGhvZHMpIHtcbiAgICAgICAgY29uc3QgbWV0aG9kID0gbWV0aG9kc1ttZXRob2ROYW1lXTtcbiAgICAgICAgY29uc3QgcGF0dGVybiA9IG5ldyBSZXF1ZXN0UGF0dGVybih0aGlzLmFic29sdXRlVXJpKGkpLCBtZXRob2QsIHRoaXMuZmluZFJlcXVlc3RCb2R5U2NoZW1hKHJlc1ttZXRob2RdKSk7XG4gICAgICAgIGlmIChwYXR0ZXJuLm1hdGNoZXMocmVxdWVzdCkpIHtcbiAgICAgICAgICBjb25zdCBydmFsID0ge307XG4gICAgICAgICAgZm9yIChsZXQgc3RhdHVzQ29kZSBpbiByZXNbbWV0aG9kXS5yZXNwb25zZXMpIHtcbiAgICAgICAgICAgIHJ2YWxbc3RhdHVzQ29kZV0gPSByZXNbbWV0aG9kXS5yZXNwb25zZXNbc3RhdHVzQ29kZV0gfHwge307XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBydmFsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRocm93IFwibm90IGZvdW5kXCI7XG4gIH1cblxuICBwcml2YXRlIG9uU3R1YlJlc3BvbnNlQXZhaWxhYmxlKHJlcXVlc3RQYXR0ZXJuOiBSZXF1ZXN0UGF0dGVybiwgcmVzcG9uc2U6IFJlc3BvbnNlKSB7XG4gICAgLy8gdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uLnByZW1hdGNoZWRCZWhhdmlvci47XG4gICAgdGhpcy5zdHViYmVkLnVuc2hpZnQoe1xuICAgICAgcmVzcG9uc2U6IHJlc3BvbnNlLFxuICAgICAgcmVxdWVzdFBhdHRlcm46IHJlcXVlc3RQYXR0ZXJuLFxuICAgICAgcmVxdWVzdFZhbGlkYXRvcjogbmV3IE5vb3BSZXF1ZXN0VmFsaWRhdG9yKClcbiAgICB9KTtcbiAgICB0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24gPSBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBvbk1vY2tSZXNwb25zZUF2YWlsYWJsZShiZWhhdmlvcjogQmVoYXZpb3IpIHtcbiAgICB0aGlzLmV4cGVjdGVkLnB1c2goYmVoYXZpb3IpO1xuICAgIHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiA9IG51bGw7XG4gIH1cblxuICBwdWJsaWMgd2hlbkdFVCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJnZXRcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5IRUFEKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcImhlYWRcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5QT1NUKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcInBvc3RcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5QVVQodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwicHV0XCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuREVMRVRFKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcImRlbGV0ZVwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlblBBVENIKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcInBhdGNoXCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuT1BUSU9OUyh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJvcHRpb25zXCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHByaXZhdGUgbWFya1JlcXVlc3RBc1BlbmRpbmcocmVxOiBSZXF1ZXN0LCBiZWhhdmlvcjogQmVoYXZpb3IpIHtcbiAgICBpZiAodGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBwZW5kaW5nUmVxRGVzY3IgPSBSZXF1ZXN0TWV0aG9kW3RoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbi5yZXF1ZXN0Lm1ldGhvZF0udG9VcHBlckNhc2UoKVxuICAgICAgICArIFwiIFwiICsgdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uLnJlcXVlc3QudXJsO1xuICAgICAgY29uc3QgcmVxRGVzY3IgPSBSZXF1ZXN0TWV0aG9kW3JlcS5tZXRob2RdLnRvVXBwZXJDYXNlKCkgKyBcIiBcIiArIHJlcS51cmw7XG4gICAgICB0aHJvdyBuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJ1bmZpbmlzaGVkIGJlaGF2aW9yIGRlZmluaXRpb246IGNhbm5vdCBjb25maWd1cmUgXCJcbiAgICAgICAgKyByZXFEZXNjciArIFwiIGJlZm9yZSBzZXR0aW5nIHRoZSByZXNwb25zZSBmb3IgXCIgKyBwZW5kaW5nUmVxRGVzY3IpO1xuICAgIH1cbiAgICB0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24gPSB7XG4gICAgICByZXF1ZXN0OiByZXEsXG4gICAgICBwcmVtYXRjaGVkQmVoYXZpb3I6IGJlaGF2aW9yXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgcmVsYXRpdmVQYXRoKGFic29sdXRlVXJpOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHVybCA9IG5ldyBVUkwoYWJzb2x1dGVVcmkpO1xuICAgIHJldHVybiB1cmwucGF0aG5hbWUgKyB1cmwucXVlcnkgKyB1cmwuaGFzaDtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuUmVxdWVzdElzKHJlcXVlc3Q6IFJlcXVlc3QpOiBSZXNwb25zZVNldHRlciB7XG4gICAgY29uc3QgcGF0aCA9IHRoaXMucmVsYXRpdmVQYXRoKHJlcXVlc3QudXJsKSwgbWV0aG9kID0gUmVxdWVzdE1ldGhvZFtyZXF1ZXN0Lm1ldGhvZF07XG5cbiAgICBsZXQgdmFsaWRhdGlvbkVycm9yO1xuICAgIGZvciAoY29uc3QgaSBpbiB0aGlzLmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGJlaGF2aW9yID0gdGhpcy5kZWZpbmVkW2ldO1xuICAgICAgaWYgKGJlaGF2aW9yLnJlcXVlc3RQYXR0ZXJuLm1hdGNoZXMocmVxdWVzdCkpIHtcbiAgICAgICAgdGhpcy5tYXJrUmVxdWVzdEFzUGVuZGluZyhyZXF1ZXN0LCBiZWhhdmlvcik7XG4gICAgICAgIGlmICgodmFsaWRhdGlvbkVycm9yID0gYmVoYXZpb3IucmVxdWVzdFZhbGlkYXRvci5tYXRjaGVzKHJlcXVlc3QpKSA9PT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiBuZXcgUmVzcG9uc2VTZXR0ZXIodGhpcywgcmVzcG9uc2UgPT4gdGhpcy5vblN0dWJSZXNwb25zZUF2YWlsYWJsZShuZXcgUmVxdWVzdFBhdHRlcm4ocGF0aCwgbWV0aG9kLCBudWxsKSwgcmVzcG9uc2UpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IodmFsaWRhdGlvbkVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJmb3VuZCBubyBkZWNsYXJhdGlvbiBvZiByZXF1ZXN0IFtcIiArIG1ldGhvZC50b1VwcGVyQ2FzZSgpXG4gICAgICArIFwiIFwiICsgcGF0aCArIFwiXSBpbiBSQU1MIC0gcmVmdXNpbmcgdG8gc3R1YlwiKTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVCYWNrZW5kKCk6IFJBTUxCYWNrZW5kIHtcbiAgICByZXR1cm4gbmV3IFJBTUxCYWNrZW5kKHRoaXMuc3R1YmJlZCwgdGhpcy5leHBlY3RlZCk7XG4gIH1cblxufVxuIl19
