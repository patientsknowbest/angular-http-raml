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
// export class IncludeType extends Type {
//
//   constructor() {
//     super("!include", {
//       resolve: function() {
//         console.log("resolve called with ", arguments)
//       }
//     });
//   }
//
// }
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
var rootFilePath;
exports.IncludeType = new js_yaml_1.Type("!include", {
    kind: "scalar",
    construct: function (pathToRAMLFile) {
        pathToRAMLFile = relPathToAbs(pathToRAMLFile, rootFilePath);
        var request = new XMLHttpRequest();
        request.open('GET', pathToRAMLFile, false);
        request.send(null);
        if (request.status === 200) {
            var api = js_yaml_1.safeLoad(request.responseText, {
                schema: js_yaml_1.Schema.create([exports.IncludeType])
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
});
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
        rootFilePath = pathToRAMLFile;
        var request = new XMLHttpRequest();
        request.open('GET', pathToRAMLFile, false); // `false` makes the request synchronous
        request.send(null);
        if (request.status === 200) {
            var api = js_yaml_1.safeLoad(request.responseText, {
                schema: js_yaml_1.Schema.create([exports.IncludeType])
            });
            return new RAMLBackendConfig(api);
        }
        throw new Error("failed to GET " + pathToRAMLFile + ": " + request.status);
    };
    RAMLBackendConfig.findBestDummyResponse = function (responses) {
        var bestFittingResp = null, bestFittingRespCode = null;
        console.log("looking for responses: ", Object.keys(responses));
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
        console.log("looking for response with statusCode=" + statusCode + " in ", Object.keys(possibleResponseDefs));
        for (var code in possibleResponseDefs) {
            if (Number.parseInt(code) === statusCode) {
                console.log("creating response, def: ", possibleResponseDefs[code]);
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
                        console.log("adding to possibleResponseDefs: " + statusCode + " -> ", res[method].responses[statusCode]);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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LEdBQUcsR0FBRyxJQUFJLEdBQUcsOEJBQThCLENBQUMsQ0FBQztJQUNuRCxDQUFDO0lBRU0seUNBQWEsR0FBcEI7UUFDRSxNQUFNLENBQUMsSUFBSSx5QkFBVyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUFFSCx3QkFBQztBQUFELENBN1JBLEFBNlJDO0FBM1JRLGtDQUFnQixHQUFhLENBQUMsT0FBTyxFQUFFLFNBQVMsRUFBRSxTQUFTO0lBQ2xFLFdBQVcsRUFBRSxPQUFPLEVBQUUsV0FBVyxDQUFDLENBQUM7QUFIeEIsOENBQWlCIiwiZmlsZSI6IlJBTUxCYWNrZW5kQ29uZmlnLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtCZWhhdmlvciwgRGVmYXVsdFJlcXVlc3RWYWxpZGF0b3IsIE5vb3BSZXF1ZXN0VmFsaWRhdG9yLCBSQU1MQmFja2VuZCwgUmVxdWVzdFBhdHRlcm59IGZyb20gXCIuL1JBTUxCYWNrZW5kXCI7XG5pbXBvcnQge3NhZmVMb2FkLCBUeXBlLCBTY2hlbWF9IGZyb20gXCJqcy15YW1sXCI7XG5pbXBvcnQge1JlcXVlc3QsIFJlcXVlc3RNZXRob2QsIFJlc3BvbnNlLCBSZXNwb25zZU9wdGlvbnN9IGZyb20gXCJAYW5ndWxhci9odHRwXCI7XG5pbXBvcnQgVVJMID0gcmVxdWlyZShcInVybC1wYXJzZVwiKTtcblxuLy8gZXhwb3J0IGNsYXNzIEluY2x1ZGVUeXBlIGV4dGVuZHMgVHlwZSB7XG4vL1xuLy8gICBjb25zdHJ1Y3RvcigpIHtcbi8vICAgICBzdXBlcihcIiFpbmNsdWRlXCIsIHtcbi8vICAgICAgIHJlc29sdmU6IGZ1bmN0aW9uKCkge1xuLy8gICAgICAgICBjb25zb2xlLmxvZyhcInJlc29sdmUgY2FsbGVkIHdpdGggXCIsIGFyZ3VtZW50cylcbi8vICAgICAgIH1cbi8vICAgICB9KTtcbi8vICAgfVxuLy9cbi8vIH1cblxuZXhwb3J0IGNsYXNzIEludmFsaWRTdHViYmluZ0Vycm9yIGV4dGVuZHMgRXJyb3Ige1xuXG59XG5cbmV4cG9ydCBjbGFzcyBSZXNwb25zZVNldHRlciB7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBvd25lcjogUkFNTEJhY2tlbmRDb25maWcsXG4gICAgICAgICAgICAgIHByaXZhdGUgb25SZWFkeTogKHJlc3BvbnNlOiBSZXNwb25zZSkgPT4gdm9pZCkge1xuICB9XG5cbiAgcHVibGljIHRoZW5SZXNwb25kKHJlc3BvbnNlOiBSZXNwb25zZSk6IFJBTUxCYWNrZW5kQ29uZmlnIHtcbiAgICB0aGlzLm9uUmVhZHkocmVzcG9uc2UpO1xuICAgIHJldHVybiB0aGlzLm93bmVyO1xuICB9XG5cbiAgcHVibGljIHRoZW5SZXNwb25kV2l0aChzdGF0dXNDb2RlOiBudW1iZXIsIGV4YW1wbGVJZGVudGlmaWVyPzogc3RyaW5nKTogUkFNTEJhY2tlbmRDb25maWcge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gdGhpcy5vd25lci5sb29rdXBSZXNwb25zZShzdGF0dXNDb2RlLCBleGFtcGxlSWRlbnRpZmllcik7XG4gICAgdGhpcy5vblJlYWR5KHJlc3BvbnNlKTtcbiAgICByZXR1cm4gdGhpcy5vd25lcjtcbiAgfVxuXG59XG5cbmludGVyZmFjZSBQZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uIHtcblxuICBwcmVtYXRjaGVkQmVoYXZpb3I6IEJlaGF2aW9yO1xuXG4gIHJlcXVlc3Q6IFJlcXVlc3Q7XG5cbiAgLy8gcmVzcG9uc2VQYXR0ZXJuQ2FuZGlkYXRlczogTWV0aG9kW107XG5cbn1cblxuZnVuY3Rpb24gcmVsUGF0aFRvQWJzIChzUmVsUGF0aCwgY3VycmVudFBhdGggPSBsb2NhdGlvbi5wYXRobmFtZSkge1xuICB2YXIgblVwTG4sIHNEaXIgPSBcIlwiLCBzUGF0aCA9IGN1cnJlbnRQYXRoLnJlcGxhY2UoL1teXFwvXSokLywgc1JlbFBhdGgucmVwbGFjZSgvKFxcL3xeKSg/OlxcLj9cXC8rKSsvZywgXCIkMVwiKSk7XG4gIGZvciAodmFyIG5FbmQsIG5TdGFydCA9IDA7IG5FbmQgPSBzUGF0aC5pbmRleE9mKFwiLy4uL1wiLCBuU3RhcnQpLCBuRW5kID4gLTE7IG5TdGFydCA9IG5FbmQgKyBuVXBMbikge1xuICAgIG5VcExuID0gL15cXC8oPzpcXC5cXC5cXC8pKi8uZXhlYyhzUGF0aC5zbGljZShuRW5kKSlbMF0ubGVuZ3RoO1xuICAgIHNEaXIgPSAoc0RpciArIHNQYXRoLnN1YnN0cmluZyhuU3RhcnQsIG5FbmQpKS5yZXBsYWNlKG5ldyBSZWdFeHAoXCIoPzpcXFxcXFwvK1teXFxcXFxcL10qKXswLFwiICsgKChuVXBMbiAtIDEpIC8gMykgKyBcIn0kXCIpLCBcIi9cIik7XG4gIH1cbiAgcmV0dXJuIHNEaXIgKyBzUGF0aC5zdWJzdHIoblN0YXJ0KTtcbn1cblxubGV0IHJvb3RGaWxlUGF0aDtcblxuZXhwb3J0IGNvbnN0IEluY2x1ZGVUeXBlID0gbmV3IFR5cGUoXCIhaW5jbHVkZVwiLCB7XG4gIGtpbmQ6IFwic2NhbGFyXCIsXG4gIGNvbnN0cnVjdDogZnVuY3Rpb24ocGF0aFRvUkFNTEZpbGUpIHtcbiAgICBwYXRoVG9SQU1MRmlsZSA9IHJlbFBhdGhUb0FicyhwYXRoVG9SQU1MRmlsZSwgcm9vdEZpbGVQYXRoKTtcbiAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHJlcXVlc3Qub3BlbignR0VUJywgcGF0aFRvUkFNTEZpbGUsIGZhbHNlKTtcbiAgICByZXF1ZXN0LnNlbmQobnVsbCk7XG4gICAgaWYgKHJlcXVlc3Quc3RhdHVzID09PSAyMDApIHtcbiAgICAgIGNvbnN0IGFwaSA9IHNhZmVMb2FkKHJlcXVlc3QucmVzcG9uc2VUZXh0LCB7XG4gICAgICAgIHNjaGVtYTogU2NoZW1hLmNyZWF0ZShbSW5jbHVkZVR5cGVdKVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gYXBpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBFcnJvcihyZXF1ZXN0LnN0YXR1cyArIFwiOiBHRVQgXCIgKyBwYXRoVG9SQU1MRmlsZSk7XG4gICAgfVxuICB9LFxuICByZXNvbHZlOiBmdW5jdGlvbihwYXRoOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufSk7XG5cbmV4cG9ydCBjbGFzcyBSQU1MQmFja2VuZENvbmZpZyB7XG5cbiAgc3RhdGljIHRvcExldmVsS2V5d29yZHM6IHN0cmluZ1tdID0gW1widGl0bGVcIiwgXCJ2ZXJzaW9uXCIsIFwiYmFzZVVyaVwiLFxuICBcIm1lZGlhVHlwZVwiLCBcInR5cGVzXCIsIFwic2VjdXJlZEJ5XCJdO1xuXG5cbiAgc3RhdGljIGluaXRXaXRoRmlsZShwYXRoVG9SQU1MRmlsZTogc3RyaW5nKTogUkFNTEJhY2tlbmRDb25maWcge1xuICAgIHJvb3RGaWxlUGF0aCA9IHBhdGhUb1JBTUxGaWxlO1xuICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgcmVxdWVzdC5vcGVuKCdHRVQnLCBwYXRoVG9SQU1MRmlsZSwgZmFsc2UpOyAgLy8gYGZhbHNlYCBtYWtlcyB0aGUgcmVxdWVzdCBzeW5jaHJvbm91c1xuICAgIHJlcXVlc3Quc2VuZChudWxsKTtcblxuICAgIGlmIChyZXF1ZXN0LnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICBjb25zdCBhcGkgPSBzYWZlTG9hZChyZXF1ZXN0LnJlc3BvbnNlVGV4dCwge1xuICAgICAgICBzY2hlbWE6IFNjaGVtYS5jcmVhdGUoW0luY2x1ZGVUeXBlXSlcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIG5ldyBSQU1MQmFja2VuZENvbmZpZyhhcGkpO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJmYWlsZWQgdG8gR0VUIFwiICsgcGF0aFRvUkFNTEZpbGUgKyBcIjogXCIgKyByZXF1ZXN0LnN0YXR1cyk7XG4gIH1cblxuICBwcml2YXRlIHN0YXRpYyBmaW5kQmVzdER1bW15UmVzcG9uc2UocmVzcG9uc2VzKSA6IHtzdGF0dXNDb2RlOiBudW1iZXIsIHJlc3BvbnNlRGVmaW5pdGlvbjogYW55fSB7XG4gICAgbGV0IGJlc3RGaXR0aW5nUmVzcCA9IG51bGwsIGJlc3RGaXR0aW5nUmVzcENvZGUgPSBudWxsO1xuICAgIGNvbnNvbGUubG9nKFwibG9va2luZyBmb3IgcmVzcG9uc2VzOiBcIiwgT2JqZWN0LmtleXMocmVzcG9uc2VzKSlcbiAgICBmb3IgKGNvbnN0IGNvZGUgaW4gcmVzcG9uc2VzKSB7XG4gICAgICBjb25zdCBjYW5kaWRhdGUgPSByZXNwb25zZXNbY29kZV07XG4gICAgICBjb25zdCBzdGF0dXNDb2RlID0gTnVtYmVyLnBhcnNlSW50KGNvZGUpO1xuICAgICAgaWYgKDIwMCA8PSBzdGF0dXNDb2RlICYmIHN0YXR1c0NvZGUgPCAzMDApIHtcbiAgICAgICAgaWYgKGJlc3RGaXR0aW5nUmVzcENvZGUgPT09IG51bGwgfHwgYmVzdEZpdHRpbmdSZXNwQ29kZSA+IHN0YXR1c0NvZGUpIHtcbiAgICAgICAgICBiZXN0Rml0dGluZ1Jlc3AgPSBjYW5kaWRhdGU7XG4gICAgICAgICAgYmVzdEZpdHRpbmdSZXNwQ29kZSA9IHN0YXR1c0NvZGU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtzdGF0dXNDb2RlOiBiZXN0Rml0dGluZ1Jlc3BDb2RlLCByZXNwb25zZURlZmluaXRpb246IGJlc3RGaXR0aW5nUmVzcCB8fCB7fX07XG4gIH1cblxuICBwcml2YXRlIGRlZmluZWQ6IEJlaGF2aW9yW10gPSBbXTtcblxuICBwcml2YXRlIHN0dWJiZWQ6IEJlaGF2aW9yW10gPSBbXTtcblxuICBwcml2YXRlIGV4cGVjdGVkOiBCZWhhdmlvcltdID0gW107XG5cbiAgcHJpdmF0ZSBwZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uOiBQZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uID0gbnVsbDtcblxuICBwcml2YXRlIGZpbmRSZXF1ZXN0Qm9keVNjaGVtYShtZXRob2QpOiBhbnkge1xuICAgIGlmIChtZXRob2RbXCJib2R5XCJdICYmIG1ldGhvZFtcImJvZHlcIl1bXCJ0eXBlXCJdKSB7XG4gICAgICBjb25zdCByYXdTY2hlbWEgPSBtZXRob2RbXCJib2R5XCJdW1widHlwZVwiXTtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiByYXdTY2hlbWE7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnN0IHR5cGVOYW1lID0gcmF3U2NoZW1hLnRyaW0oKTtcbiAgICAgICAgZm9yIChjb25zdCB0IGluIHRoaXMuYXBpW1widHlwZXNcIl0pIHtcbiAgICAgICAgICBpZiAodCA9PT0gdHlwZU5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKHRoaXMuYXBpW1widHlwZXNcIl1bdF0udG9TdHJpbmcoKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYWJzb2x1dGVVcmkocmVsYXRpdmVVcmk6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuYXBpW1wiYmFzZVVyaVwiXSArIHJlbGF0aXZlVXJpO1xuICB9XG5cbiAgcHJpdmF0ZSBpc0tleXdvcmQoY2FuZGlkYXRlOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBmb3IgKGxldCBpIGluIFJBTUxCYWNrZW5kQ29uZmlnLnRvcExldmVsS2V5d29yZHMpIHtcbiAgICAgIGlmIChSQU1MQmFja2VuZENvbmZpZy50b3BMZXZlbEtleXdvcmRzW2ldID09PSBjYW5kaWRhdGUpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHByaXZhdGUgYWxsUmVzb3VyY2VzKGFwaTogYW55KTogYW55IHtcbiAgICBjb25zdCBydmFsID0ge307XG4gICAgZm9yICh2YXIgaSBpbiBhcGkpIHtcbiAgICAgIGlmICghdGhpcy5pc0tleXdvcmQoaSkpIHtcbiAgICAgICAgcnZhbFtpXSA9IGFwaVtpXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJ2YWw7XG4gIH1cblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGFwaSkge1xuICAgIGNvbnN0IGVudHJpZXM6IEJlaGF2aW9yW10gPSBbXTtcbiAgICBjb25zdCBhbGxSZXNvdXJjZXMgPSB0aGlzLmFsbFJlc291cmNlcyh0aGlzLmFwaSk7XG4gICAgZm9yIChjb25zdCBpIGluIGFsbFJlc291cmNlcykge1xuICAgICAgY29uc3QgcmVzb3VyY2UgPSBhbGxSZXNvdXJjZXNbaV07XG4gICAgICBjb25zdCByZXNvdXJjZVVyaSA9IHRoaXMuYWJzb2x1dGVVcmkoaSk7XG4gICAgICBmb3IgKGNvbnN0IG1ldGhvZE5hbWUgaW4gcmVzb3VyY2UpIHtcbiAgICAgICAgY29uc3QgbWV0aG9kID0gcmVzb3VyY2VbbWV0aG9kTmFtZV07XG4gICAgICAgIGNvbnN0IHNjaGVtYSA9IHRoaXMuZmluZFJlcXVlc3RCb2R5U2NoZW1hKG1ldGhvZCk7XG5cbiAgICAgICAgY29uc3QgcGF0dGVybiA9IG5ldyBSZXF1ZXN0UGF0dGVybihyZXNvdXJjZVVyaSwgbWV0aG9kTmFtZSwgc2NoZW1hKTtcbiAgICAgICAgY29uc3Qge3N0YXR1c0NvZGUsIHJlc3BvbnNlRGVmaW5pdGlvbn0gPSBSQU1MQmFja2VuZENvbmZpZy5maW5kQmVzdER1bW15UmVzcG9uc2UobWV0aG9kW1wicmVzcG9uc2VzXCJdKTtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSB0aGlzLmJ1aWxkUmVzcG9uc2VGcm9tRGVmaW5pdGlvbihzdGF0dXNDb2RlLCByZXNwb25zZURlZmluaXRpb24pO1xuICAgICAgICBlbnRyaWVzLnB1c2goe1xuICAgICAgICAgIHJlcXVlc3RQYXR0ZXJuOiBwYXR0ZXJuLFxuICAgICAgICAgIHJlc3BvbnNlOiByZXNwb25zZSxcbiAgICAgICAgICByZXF1ZXN0VmFsaWRhdG9yOiBuZXcgRGVmYXVsdFJlcXVlc3RWYWxpZGF0b3IobWV0aG9kKVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5kZWZpbmVkID0gZW50cmllcztcbiAgfVxuXG4gIHByaXZhdGUgYnVpbGRSZXNwb25zZUZyb21EZWZpbml0aW9uKHN0YXR1c0NvZGUsIHJlc3BvbnNlRGVmaW5pdGlvbiwgZXhhbXBsZUlkZW50aWZpZXI/OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKG5ldyBSZXNwb25zZU9wdGlvbnMoe1xuICAgICAgc3RhdHVzOiBzdGF0dXNDb2RlLFxuICAgICAgYm9keTogdGhpcy5sb29rdXBFeGFtcGxlUmVzcG9uc2VCb2R5KHJlc3BvbnNlRGVmaW5pdGlvbltcImJvZHlcIl0sIGV4YW1wbGVJZGVudGlmaWVyKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyBzdHViQWxsKCk6IFJBTUxCYWNrZW5kQ29uZmlnIHtcbiAgICB0aGlzLmRlZmluZWQuZm9yRWFjaChiZWhhdmlvciA9PiB0aGlzLnN0dWJiZWQucHVzaChiZWhhdmlvcikpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcHJpdmF0ZSBsb29rdXBFeGFtcGxlUmVzcG9uc2VCb2R5KHJlc3BCb2R5RGVmLCBleGFtcGxlSWRlbnRpZmllcj86IHN0cmluZyk6IHN0cmluZyB7XG4gICAgZnVuY3Rpb24gdGhyb3dFcnJvcigpIHtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcImNvdWxkIG5vdCBmaW5kIGV4YW1wbGUgW1wiICsgZXhhbXBsZUlkZW50aWZpZXIgKyBcIl1cIik7XG4gICAgfVxuXG4gICAgaWYgKHJlc3BCb2R5RGVmID09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKGV4YW1wbGVJZGVudGlmaWVyICE9IG51bGwpIHtcbiAgICAgICAgdGhyb3dFcnJvcigpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGV4YW1wbGVEZWZzID0gcmVzcEJvZHlEZWZbXCJleGFtcGxlc1wiXTtcbiAgICBpZiAoZXhhbXBsZUlkZW50aWZpZXIgIT0gbnVsbCkge1xuICAgICAgaWYgKGV4YW1wbGVEZWZzID09IG51bGwgfHwgZXhhbXBsZURlZnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93RXJyb3IoKTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgZXhhbXBsZU5hbWUgaW4gZXhhbXBsZURlZnMpIHtcbiAgICAgICAgaWYgKGV4YW1wbGVOYW1lID09PSBleGFtcGxlSWRlbnRpZmllcikge1xuICAgICAgICAgIHJldHVybiBleGFtcGxlRGVmc1tleGFtcGxlTmFtZV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRocm93RXJyb3IoKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3BCb2R5RGVmW1wiZXhhbXBsZVwiXTtcbiAgfVxuXG4gIHB1YmxpYyBsb29rdXBSZXNwb25zZShzdGF0dXNDb2RlOiBudW1iZXIsIGV4YW1wbGVJZGVudGlmaWVyOiBzdHJpbmcpOiBSZXNwb25zZSB7XG4gICAgY29uc3QgcG9zc2libGVSZXNwb25zZURlZnMgPSB0aGlzLmxvb2t1cFJlc3BvbnNlRGVmc0J5UmVxdWVzdCh0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ucmVxdWVzdCk7XG4gICAgY29uc29sZS5sb2coYGxvb2tpbmcgZm9yIHJlc3BvbnNlIHdpdGggc3RhdHVzQ29kZT0ke3N0YXR1c0NvZGV9IGluIGAsIE9iamVjdC5rZXlzKHBvc3NpYmxlUmVzcG9uc2VEZWZzKSk7XG4gICAgZm9yIChjb25zdCBjb2RlIGluIHBvc3NpYmxlUmVzcG9uc2VEZWZzKSB7XG4gICAgICBpZiAoTnVtYmVyLnBhcnNlSW50KGNvZGUpID09PSBzdGF0dXNDb2RlKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiY3JlYXRpbmcgcmVzcG9uc2UsIGRlZjogXCIsIHBvc3NpYmxlUmVzcG9uc2VEZWZzW2NvZGVdKVxuICAgICAgICByZXR1cm4gdGhpcy5idWlsZFJlc3BvbnNlRnJvbURlZmluaXRpb24oc3RhdHVzQ29kZSwgcG9zc2libGVSZXNwb25zZURlZnNbY29kZV0sIGV4YW1wbGVJZGVudGlmaWVyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwidGhlcmUgaXMgbm8gcmVzcG9uc2UgZGVmaW5lZCB3aXRoIHN0YXR1cyBjb2RlIFwiICsgc3RhdHVzQ29kZSArIFwiIGluIHRoZSBSQU1MIGZpbGVcIik7XG4gIH1cblxuICBwcml2YXRlIGxvb2t1cFJlc3BvbnNlRGVmc0J5UmVxdWVzdChyZXF1ZXN0OiBSZXF1ZXN0KTogYW55IHtcbiAgICBmb3IgKGNvbnN0IGkgaW4gdGhpcy5hbGxSZXNvdXJjZXModGhpcy5hcGkpKSB7XG4gICAgICBjb25zdCByZXMgPSB0aGlzLmFsbFJlc291cmNlcyh0aGlzLmFwaSlbaV07XG4gICAgICBsZXQgbWV0aG9kcyA9IE9iamVjdC5rZXlzKHJlcyk7XG4gICAgICBmb3IgKGNvbnN0IG1ldGhvZE5hbWUgaW4gbWV0aG9kcykge1xuICAgICAgICBjb25zdCBtZXRob2QgPSBtZXRob2RzW21ldGhvZE5hbWVdO1xuICAgICAgICBjb25zdCBwYXR0ZXJuID0gbmV3IFJlcXVlc3RQYXR0ZXJuKHRoaXMuYWJzb2x1dGVVcmkoaSksIG1ldGhvZCwgdGhpcy5maW5kUmVxdWVzdEJvZHlTY2hlbWEocmVzW21ldGhvZF0pKTtcbiAgICAgICAgaWYgKHBhdHRlcm4ubWF0Y2hlcyhyZXF1ZXN0KSkge1xuICAgICAgICAgIGNvbnN0IHJ2YWwgPSB7fTtcbiAgICAgICAgICBmb3IgKGxldCBzdGF0dXNDb2RlIGluIHJlc1ttZXRob2RdLnJlc3BvbnNlcykge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYGFkZGluZyB0byBwb3NzaWJsZVJlc3BvbnNlRGVmczogJHtzdGF0dXNDb2RlfSAtPiBgLCByZXNbbWV0aG9kXS5yZXNwb25zZXNbc3RhdHVzQ29kZV0pXG4gICAgICAgICAgICBydmFsW3N0YXR1c0NvZGVdID0gcmVzW21ldGhvZF0ucmVzcG9uc2VzW3N0YXR1c0NvZGVdIHx8IHt9O1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gcnZhbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBcIm5vdCBmb3VuZFwiO1xuICB9XG5cbiAgcHJpdmF0ZSBvblN0dWJSZXNwb25zZUF2YWlsYWJsZShyZXF1ZXN0UGF0dGVybjogUmVxdWVzdFBhdHRlcm4sIHJlc3BvbnNlOiBSZXNwb25zZSkge1xuICAgIC8vIHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbi5wcmVtYXRjaGVkQmVoYXZpb3IuO1xuICAgIHRoaXMuc3R1YmJlZC51bnNoaWZ0KHtcbiAgICAgIHJlc3BvbnNlOiByZXNwb25zZSxcbiAgICAgIHJlcXVlc3RQYXR0ZXJuOiByZXF1ZXN0UGF0dGVybixcbiAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IG5ldyBOb29wUmVxdWVzdFZhbGlkYXRvcigpXG4gICAgfSk7XG4gICAgdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uID0gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgb25Nb2NrUmVzcG9uc2VBdmFpbGFibGUoYmVoYXZpb3I6IEJlaGF2aW9yKSB7XG4gICAgdGhpcy5leHBlY3RlZC5wdXNoKGJlaGF2aW9yKTtcbiAgICB0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24gPSBudWxsO1xuICB9XG5cbiAgcHVibGljIHdoZW5HRVQodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwiZ2V0XCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuSEVBRCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJoZWFkXCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuUE9TVCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJwb3N0XCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuUFVUKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcInB1dFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlbkRFTEVURSh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJkZWxldGVcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5QQVRDSCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJwYXRjaFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlbk9QVElPTlModXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwib3B0aW9uc1wiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwcml2YXRlIG1hcmtSZXF1ZXN0QXNQZW5kaW5nKHJlcTogUmVxdWVzdCwgYmVoYXZpb3I6IEJlaGF2aW9yKSB7XG4gICAgaWYgKHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgcGVuZGluZ1JlcURlc2NyID0gUmVxdWVzdE1ldGhvZFt0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ucmVxdWVzdC5tZXRob2RdLnRvVXBwZXJDYXNlKClcbiAgICAgICAgKyBcIiBcIiArIHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbi5yZXF1ZXN0LnVybDtcbiAgICAgIGNvbnN0IHJlcURlc2NyID0gUmVxdWVzdE1ldGhvZFtyZXEubWV0aG9kXS50b1VwcGVyQ2FzZSgpICsgXCIgXCIgKyByZXEudXJsO1xuICAgICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwidW5maW5pc2hlZCBiZWhhdmlvciBkZWZpbml0aW9uOiBjYW5ub3QgY29uZmlndXJlIFwiXG4gICAgICAgICsgcmVxRGVzY3IgKyBcIiBiZWZvcmUgc2V0dGluZyB0aGUgcmVzcG9uc2UgZm9yIFwiICsgcGVuZGluZ1JlcURlc2NyKTtcbiAgICB9XG4gICAgdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uID0ge1xuICAgICAgcmVxdWVzdDogcmVxLFxuICAgICAgcHJlbWF0Y2hlZEJlaGF2aW9yOiBiZWhhdmlvclxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIHJlbGF0aXZlUGF0aChhYnNvbHV0ZVVyaTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCB1cmwgPSBuZXcgVVJMKGFic29sdXRlVXJpKTtcbiAgICByZXR1cm4gdXJsLnBhdGhuYW1lICsgdXJsLnF1ZXJ5ICsgdXJsLmhhc2g7XG4gIH1cblxuICBwdWJsaWMgd2hlblJlcXVlc3RJcyhyZXF1ZXN0OiBSZXF1ZXN0KTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIGNvbnN0IHBhdGggPSB0aGlzLnJlbGF0aXZlUGF0aChyZXF1ZXN0LnVybCksIG1ldGhvZCA9IFJlcXVlc3RNZXRob2RbcmVxdWVzdC5tZXRob2RdO1xuXG4gICAgbGV0IHZhbGlkYXRpb25FcnJvcjtcbiAgICBmb3IgKGNvbnN0IGkgaW4gdGhpcy5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBiZWhhdmlvciA9IHRoaXMuZGVmaW5lZFtpXTtcbiAgICAgIGlmIChiZWhhdmlvci5yZXF1ZXN0UGF0dGVybi5tYXRjaGVzKHJlcXVlc3QpKSB7XG4gICAgICAgIHRoaXMubWFya1JlcXVlc3RBc1BlbmRpbmcocmVxdWVzdCwgYmVoYXZpb3IpO1xuICAgICAgICBpZiAoKHZhbGlkYXRpb25FcnJvciA9IGJlaGF2aW9yLnJlcXVlc3RWYWxpZGF0b3IubWF0Y2hlcyhyZXF1ZXN0KSkgPT09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gbmV3IFJlc3BvbnNlU2V0dGVyKHRoaXMsIHJlc3BvbnNlID0+IHRoaXMub25TdHViUmVzcG9uc2VBdmFpbGFibGUobmV3IFJlcXVlc3RQYXR0ZXJuKHBhdGgsIG1ldGhvZCwgbnVsbCksIHJlc3BvbnNlKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKHZhbGlkYXRpb25FcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwiZm91bmQgbm8gZGVjbGFyYXRpb24gb2YgcmVxdWVzdCBbXCIgKyBtZXRob2QudG9VcHBlckNhc2UoKVxuICAgICAgKyBcIiBcIiArIHBhdGggKyBcIl0gaW4gUkFNTCAtIHJlZnVzaW5nIHRvIHN0dWJcIik7XG4gIH1cblxuICBwdWJsaWMgY3JlYXRlQmFja2VuZCgpOiBSQU1MQmFja2VuZCB7XG4gICAgcmV0dXJuIG5ldyBSQU1MQmFja2VuZCh0aGlzLnN0dWJiZWQsIHRoaXMuZXhwZWN0ZWQpO1xuICB9XG5cbn1cbiJdfQ==
