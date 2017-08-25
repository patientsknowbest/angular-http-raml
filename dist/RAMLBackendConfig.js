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
                var responseDefinition = RAMLBackendConfig.findBestDummyResponse(method["responses"]);
                var response = this.buildResponseFromDefinition(responseDefinition);
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
                if (bestFittingResp === null) {
                    bestFittingResp = candidate;
                    bestFittingRespCode = statusCode;
                }
                else if (bestFittingRespCode > statusCode) {
                    bestFittingResp = candidate;
                    bestFittingRespCode = statusCode;
                }
            }
        }
        return bestFittingResp || {};
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
    RAMLBackendConfig.prototype.buildResponseFromDefinition = function (responseDefinition, exampleIdentifier) {
        return new http_1.Response(new http_1.ResponseOptions({
            status: 200,
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
            for (var i in exampleDefs) {
                var example = exampleDefs[i];
                if (example.name() === exampleIdentifier) {
                    return example.value();
                }
            }
            throwError();
        }
        if (respBodyDef["example"] === null) {
            return exampleDefs[0].value();
        }
        else {
            return respBodyDef["example"];
        }
    };
    RAMLBackendConfig.prototype.lookupResponse = function (statusCode, exampleIdentifier) {
        var possibleResponseDefs = this.lookupResponseDefsByRequest(this.pendingBehaviorSpecification.request);
        console.log("looking for response with statusCode=" + statusCode + " in ", Object.keys(possibleResponseDefs));
        for (var code in possibleResponseDefs) {
            if (Number.parseInt(code) === statusCode) {
                console.log("creating response, def: ", possibleResponseDefs[code]);
                return this.buildResponseFromDefinition(possibleResponseDefs[code], exampleIdentifier);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUksT0FBQSxLQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSw0QkFBYyxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLEVBQUUsUUFBUSxDQUFDLEVBQTlFLENBQThFLENBQUMsQ0FBQztnQkFDOUgsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDTixNQUFNLElBQUksb0JBQW9CLENBQUMsZUFBZSxDQUFDLENBQUM7Z0JBQ2xELENBQUM7WUFDSCxDQUFDO1FBQ0gsQ0FBQztRQUNELE1BQU0sSUFBSSxvQkFBb0IsQ0FBQyxtQ0FBbUMsR0FBRyxNQUFNLENBQUMsV0FBVyxFQUFFO2NBQ3JGLEdBQUcsR0FBRyxJQUFJLEdBQUcsOEJBQThCLENBQUMsQ0FBQztJQUNuRCxDQUFDO0lBRU0seUNBQWEsR0FBcEI7UUFDRSxNQUFNLENBQUMsSUFBSSx5QkFBVyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUFFSCx3QkFBQztBQUFELENBclNBLEFBcVNDO0FBblNRLGtDQUFnQixHQUFhLENBQUMsT0FBTyxFQUFFLFNBQVMsRUFBRSxTQUFTO0lBQ2xFLFdBQVcsRUFBRSxPQUFPLEVBQUUsV0FBVyxDQUFDLENBQUM7QUFIeEIsOENBQWlCIiwiZmlsZSI6IlJBTUxCYWNrZW5kQ29uZmlnLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtCZWhhdmlvciwgRGVmYXVsdFJlcXVlc3RWYWxpZGF0b3IsIE5vb3BSZXF1ZXN0VmFsaWRhdG9yLCBSQU1MQmFja2VuZCwgUmVxdWVzdFBhdHRlcm59IGZyb20gXCIuL1JBTUxCYWNrZW5kXCI7XG5pbXBvcnQge3NhZmVMb2FkLCBUeXBlLCBTY2hlbWF9IGZyb20gXCJqcy15YW1sXCI7XG5pbXBvcnQge1JlcXVlc3QsIFJlcXVlc3RNZXRob2QsIFJlc3BvbnNlLCBSZXNwb25zZU9wdGlvbnN9IGZyb20gXCJAYW5ndWxhci9odHRwXCI7XG5pbXBvcnQgVVJMID0gcmVxdWlyZShcInVybC1wYXJzZVwiKTtcblxuLy8gZXhwb3J0IGNsYXNzIEluY2x1ZGVUeXBlIGV4dGVuZHMgVHlwZSB7XG4vL1xuLy8gICBjb25zdHJ1Y3RvcigpIHtcbi8vICAgICBzdXBlcihcIiFpbmNsdWRlXCIsIHtcbi8vICAgICAgIHJlc29sdmU6IGZ1bmN0aW9uKCkge1xuLy8gICAgICAgICBjb25zb2xlLmxvZyhcInJlc29sdmUgY2FsbGVkIHdpdGggXCIsIGFyZ3VtZW50cylcbi8vICAgICAgIH1cbi8vICAgICB9KTtcbi8vICAgfVxuLy9cbi8vIH1cblxuZXhwb3J0IGNsYXNzIEludmFsaWRTdHViYmluZ0Vycm9yIGV4dGVuZHMgRXJyb3Ige1xuXG59XG5cbmV4cG9ydCBjbGFzcyBSZXNwb25zZVNldHRlciB7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBvd25lcjogUkFNTEJhY2tlbmRDb25maWcsXG4gICAgICAgICAgICAgIHByaXZhdGUgb25SZWFkeTogKHJlc3BvbnNlOiBSZXNwb25zZSkgPT4gdm9pZCkge1xuICB9XG5cbiAgcHVibGljIHRoZW5SZXNwb25kKHJlc3BvbnNlOiBSZXNwb25zZSk6IFJBTUxCYWNrZW5kQ29uZmlnIHtcbiAgICB0aGlzLm9uUmVhZHkocmVzcG9uc2UpO1xuICAgIHJldHVybiB0aGlzLm93bmVyO1xuICB9XG5cbiAgcHVibGljIHRoZW5SZXNwb25kV2l0aChzdGF0dXNDb2RlOiBudW1iZXIsIGV4YW1wbGVJZGVudGlmaWVyPzogc3RyaW5nKTogUkFNTEJhY2tlbmRDb25maWcge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gdGhpcy5vd25lci5sb29rdXBSZXNwb25zZShzdGF0dXNDb2RlLCBleGFtcGxlSWRlbnRpZmllcik7XG4gICAgdGhpcy5vblJlYWR5KHJlc3BvbnNlKTtcbiAgICByZXR1cm4gdGhpcy5vd25lcjtcbiAgfVxuXG59XG5cbmludGVyZmFjZSBQZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uIHtcblxuICBwcmVtYXRjaGVkQmVoYXZpb3I6IEJlaGF2aW9yO1xuXG4gIHJlcXVlc3Q6IFJlcXVlc3Q7XG5cbiAgLy8gcmVzcG9uc2VQYXR0ZXJuQ2FuZGlkYXRlczogTWV0aG9kW107XG5cbn1cblxuZnVuY3Rpb24gcmVsUGF0aFRvQWJzIChzUmVsUGF0aCwgY3VycmVudFBhdGggPSBsb2NhdGlvbi5wYXRobmFtZSkge1xuICB2YXIgblVwTG4sIHNEaXIgPSBcIlwiLCBzUGF0aCA9IGN1cnJlbnRQYXRoLnJlcGxhY2UoL1teXFwvXSokLywgc1JlbFBhdGgucmVwbGFjZSgvKFxcL3xeKSg/OlxcLj9cXC8rKSsvZywgXCIkMVwiKSk7XG4gIGZvciAodmFyIG5FbmQsIG5TdGFydCA9IDA7IG5FbmQgPSBzUGF0aC5pbmRleE9mKFwiLy4uL1wiLCBuU3RhcnQpLCBuRW5kID4gLTE7IG5TdGFydCA9IG5FbmQgKyBuVXBMbikge1xuICAgIG5VcExuID0gL15cXC8oPzpcXC5cXC5cXC8pKi8uZXhlYyhzUGF0aC5zbGljZShuRW5kKSlbMF0ubGVuZ3RoO1xuICAgIHNEaXIgPSAoc0RpciArIHNQYXRoLnN1YnN0cmluZyhuU3RhcnQsIG5FbmQpKS5yZXBsYWNlKG5ldyBSZWdFeHAoXCIoPzpcXFxcXFwvK1teXFxcXFxcL10qKXswLFwiICsgKChuVXBMbiAtIDEpIC8gMykgKyBcIn0kXCIpLCBcIi9cIik7XG4gIH1cbiAgcmV0dXJuIHNEaXIgKyBzUGF0aC5zdWJzdHIoblN0YXJ0KTtcbn1cblxubGV0IHJvb3RGaWxlUGF0aDtcblxuZXhwb3J0IGNvbnN0IEluY2x1ZGVUeXBlID0gbmV3IFR5cGUoXCIhaW5jbHVkZVwiLCB7XG4gIGtpbmQ6IFwic2NhbGFyXCIsXG4gIGNvbnN0cnVjdDogZnVuY3Rpb24ocGF0aFRvUkFNTEZpbGUpIHtcbiAgICBwYXRoVG9SQU1MRmlsZSA9IHJlbFBhdGhUb0FicyhwYXRoVG9SQU1MRmlsZSwgcm9vdEZpbGVQYXRoKTtcbiAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHJlcXVlc3Qub3BlbignR0VUJywgcGF0aFRvUkFNTEZpbGUsIGZhbHNlKTtcbiAgICByZXF1ZXN0LnNlbmQobnVsbCk7XG4gICAgaWYgKHJlcXVlc3Quc3RhdHVzID09PSAyMDApIHtcbiAgICAgIGNvbnN0IGFwaSA9IHNhZmVMb2FkKHJlcXVlc3QucmVzcG9uc2VUZXh0LCB7XG4gICAgICAgIHNjaGVtYTogU2NoZW1hLmNyZWF0ZShbSW5jbHVkZVR5cGVdKVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gYXBpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBFcnJvcihyZXF1ZXN0LnN0YXR1cyArIFwiOiBHRVQgXCIgKyBwYXRoVG9SQU1MRmlsZSk7XG4gICAgfVxuICB9LFxuICByZXNvbHZlOiBmdW5jdGlvbihwYXRoOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufSk7XG5cbmV4cG9ydCBjbGFzcyBSQU1MQmFja2VuZENvbmZpZyB7XG5cbiAgc3RhdGljIHRvcExldmVsS2V5d29yZHM6IHN0cmluZ1tdID0gW1widGl0bGVcIiwgXCJ2ZXJzaW9uXCIsIFwiYmFzZVVyaVwiLFxuICBcIm1lZGlhVHlwZVwiLCBcInR5cGVzXCIsIFwic2VjdXJlZEJ5XCJdO1xuXG5cbiAgc3RhdGljIGluaXRXaXRoRmlsZShwYXRoVG9SQU1MRmlsZTogc3RyaW5nKTogUkFNTEJhY2tlbmRDb25maWcge1xuICAgIHJvb3RGaWxlUGF0aCA9IHBhdGhUb1JBTUxGaWxlO1xuICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgcmVxdWVzdC5vcGVuKCdHRVQnLCBwYXRoVG9SQU1MRmlsZSwgZmFsc2UpOyAgLy8gYGZhbHNlYCBtYWtlcyB0aGUgcmVxdWVzdCBzeW5jaHJvbm91c1xuICAgIHJlcXVlc3Quc2VuZChudWxsKTtcblxuICAgIGlmIChyZXF1ZXN0LnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICBjb25zdCBhcGkgPSBzYWZlTG9hZChyZXF1ZXN0LnJlc3BvbnNlVGV4dCwge1xuICAgICAgICBzY2hlbWE6IFNjaGVtYS5jcmVhdGUoW0luY2x1ZGVUeXBlXSlcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIG5ldyBSQU1MQmFja2VuZENvbmZpZyhhcGkpO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJmYWlsZWQgdG8gR0VUIFwiICsgcGF0aFRvUkFNTEZpbGUgKyBcIjogXCIgKyByZXF1ZXN0LnN0YXR1cyk7XG4gIH1cblxuICBwcml2YXRlIHN0YXRpYyBmaW5kQmVzdER1bW15UmVzcG9uc2UocmVzcG9uc2VzKSB7XG4gICAgbGV0IGJlc3RGaXR0aW5nUmVzcCA9IG51bGwsIGJlc3RGaXR0aW5nUmVzcENvZGUgPSBudWxsO1xuICAgIGNvbnNvbGUubG9nKFwibG9va2luZyBmb3IgcmVzcG9uc2VzOiBcIiwgT2JqZWN0LmtleXMocmVzcG9uc2VzKSlcbiAgICBmb3IgKGNvbnN0IGNvZGUgaW4gcmVzcG9uc2VzKSB7XG4gICAgICBjb25zdCBjYW5kaWRhdGUgPSByZXNwb25zZXNbY29kZV07XG4gICAgICBjb25zdCBzdGF0dXNDb2RlID0gTnVtYmVyLnBhcnNlSW50KGNvZGUpO1xuICAgICAgaWYgKDIwMCA8PSBzdGF0dXNDb2RlICYmIHN0YXR1c0NvZGUgPCAzMDApIHtcbiAgICAgICAgaWYgKGJlc3RGaXR0aW5nUmVzcCA9PT0gbnVsbCkge1xuICAgICAgICAgIGJlc3RGaXR0aW5nUmVzcCA9IGNhbmRpZGF0ZTtcbiAgICAgICAgICBiZXN0Rml0dGluZ1Jlc3BDb2RlID0gc3RhdHVzQ29kZTtcbiAgICAgICAgfSBlbHNlIGlmIChiZXN0Rml0dGluZ1Jlc3BDb2RlID4gc3RhdHVzQ29kZSkge1xuICAgICAgICAgIGJlc3RGaXR0aW5nUmVzcCA9IGNhbmRpZGF0ZTtcbiAgICAgICAgICBiZXN0Rml0dGluZ1Jlc3BDb2RlID0gc3RhdHVzQ29kZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYmVzdEZpdHRpbmdSZXNwIHx8IHt9O1xuICB9XG5cbiAgcHJpdmF0ZSBkZWZpbmVkOiBCZWhhdmlvcltdID0gW107XG5cbiAgcHJpdmF0ZSBzdHViYmVkOiBCZWhhdmlvcltdID0gW107XG5cbiAgcHJpdmF0ZSBleHBlY3RlZDogQmVoYXZpb3JbXSA9IFtdO1xuXG4gIHByaXZhdGUgcGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbjogUGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiA9IG51bGw7XG5cbiAgcHJpdmF0ZSBmaW5kUmVxdWVzdEJvZHlTY2hlbWEobWV0aG9kKTogYW55IHtcbiAgICBpZiAobWV0aG9kW1wiYm9keVwiXSAmJiBtZXRob2RbXCJib2R5XCJdW1widHlwZVwiXSkge1xuICAgICAgY29uc3QgcmF3U2NoZW1hID0gbWV0aG9kW1wiYm9keVwiXVtcInR5cGVcIl07XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gcmF3U2NoZW1hO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zdCB0eXBlTmFtZSA9IHJhd1NjaGVtYS50cmltKCk7XG4gICAgICAgIGZvciAoY29uc3QgdCBpbiB0aGlzLmFwaVtcInR5cGVzXCJdKSB7XG4gICAgICAgICAgaWYgKHQgPT09IHR5cGVOYW1lKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5wYXJzZSh0aGlzLmFwaVtcInR5cGVzXCJdW3RdLnRvU3RyaW5nKCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFic29sdXRlVXJpKHJlbGF0aXZlVXJpOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLmFwaVtcImJhc2VVcmlcIl0gKyByZWxhdGl2ZVVyaTtcbiAgfVxuXG4gIHByaXZhdGUgaXNLZXl3b3JkKGNhbmRpZGF0ZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgZm9yIChsZXQgaSBpbiBSQU1MQmFja2VuZENvbmZpZy50b3BMZXZlbEtleXdvcmRzKSB7XG4gICAgICBpZiAoUkFNTEJhY2tlbmRDb25maWcudG9wTGV2ZWxLZXl3b3Jkc1tpXSA9PT0gY2FuZGlkYXRlKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBwcml2YXRlIGFsbFJlc291cmNlcyhhcGk6IGFueSk6IGFueSB7XG4gICAgY29uc3QgcnZhbCA9IHt9O1xuICAgIGZvciAodmFyIGkgaW4gYXBpKSB7XG4gICAgICBpZiAoIXRoaXMuaXNLZXl3b3JkKGkpKSB7XG4gICAgICAgIHJ2YWxbaV0gPSBhcGlbaV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBydmFsO1xuICB9XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBhcGkpIHtcbiAgICBjb25zdCBlbnRyaWVzOiBCZWhhdmlvcltdID0gW107XG4gICAgY29uc3QgYWxsUmVzb3VyY2VzID0gdGhpcy5hbGxSZXNvdXJjZXModGhpcy5hcGkpO1xuICAgIGZvciAoY29uc3QgaSBpbiBhbGxSZXNvdXJjZXMpIHtcbiAgICAgIGNvbnN0IHJlc291cmNlID0gYWxsUmVzb3VyY2VzW2ldO1xuICAgICAgY29uc3QgcmVzb3VyY2VVcmkgPSB0aGlzLmFic29sdXRlVXJpKGkpO1xuICAgICAgZm9yIChjb25zdCBtZXRob2ROYW1lIGluIHJlc291cmNlKSB7XG4gICAgICAgIGNvbnN0IG1ldGhvZCA9IHJlc291cmNlW21ldGhvZE5hbWVdO1xuICAgICAgICBjb25zdCBzY2hlbWEgPSB0aGlzLmZpbmRSZXF1ZXN0Qm9keVNjaGVtYShtZXRob2QpO1xuXG4gICAgICAgIGNvbnN0IHBhdHRlcm4gPSBuZXcgUmVxdWVzdFBhdHRlcm4ocmVzb3VyY2VVcmksIG1ldGhvZE5hbWUsIHNjaGVtYSk7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlRGVmaW5pdGlvbiA9IFJBTUxCYWNrZW5kQ29uZmlnLmZpbmRCZXN0RHVtbXlSZXNwb25zZShtZXRob2RbXCJyZXNwb25zZXNcIl0pO1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IHRoaXMuYnVpbGRSZXNwb25zZUZyb21EZWZpbml0aW9uKHJlc3BvbnNlRGVmaW5pdGlvbik7XG4gICAgICAgIGVudHJpZXMucHVzaCh7XG4gICAgICAgICAgcmVxdWVzdFBhdHRlcm46IHBhdHRlcm4sXG4gICAgICAgICAgcmVzcG9uc2U6IHJlc3BvbnNlLFxuICAgICAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IG5ldyBEZWZhdWx0UmVxdWVzdFZhbGlkYXRvcihtZXRob2QpXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmRlZmluZWQgPSBlbnRyaWVzO1xuICB9XG5cbiAgcHJpdmF0ZSBidWlsZFJlc3BvbnNlRnJvbURlZmluaXRpb24ocmVzcG9uc2VEZWZpbml0aW9uLCBleGFtcGxlSWRlbnRpZmllcj86IHN0cmluZykge1xuICAgIHJldHVybiBuZXcgUmVzcG9uc2UobmV3IFJlc3BvbnNlT3B0aW9ucyh7XG4gICAgICBzdGF0dXM6IDIwMCwgLy8gVE9ET1xuICAgICAgYm9keTogdGhpcy5sb29rdXBFeGFtcGxlUmVzcG9uc2VCb2R5KHJlc3BvbnNlRGVmaW5pdGlvbltcImJvZHlcIl0sIGV4YW1wbGVJZGVudGlmaWVyKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyBzdHViQWxsKCk6IFJBTUxCYWNrZW5kQ29uZmlnIHtcbiAgICB0aGlzLmRlZmluZWQuZm9yRWFjaChiZWhhdmlvciA9PiB0aGlzLnN0dWJiZWQucHVzaChiZWhhdmlvcikpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcHJpdmF0ZSBsb29rdXBFeGFtcGxlUmVzcG9uc2VCb2R5KHJlc3BCb2R5RGVmLCBleGFtcGxlSWRlbnRpZmllcj86IHN0cmluZyk6IHN0cmluZyB7XG4gICAgZnVuY3Rpb24gdGhyb3dFcnJvcigpIHtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcImNvdWxkIG5vdCBmaW5kIGV4YW1wbGUgW1wiICsgZXhhbXBsZUlkZW50aWZpZXIgKyBcIl1cIik7XG4gICAgfVxuXG4gICAgaWYgKHJlc3BCb2R5RGVmID09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKGV4YW1wbGVJZGVudGlmaWVyICE9IG51bGwpIHtcbiAgICAgICAgdGhyb3dFcnJvcigpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGV4YW1wbGVEZWZzID0gcmVzcEJvZHlEZWZbXCJleGFtcGxlc1wiXTtcbiAgICBpZiAoZXhhbXBsZUlkZW50aWZpZXIgIT0gbnVsbCkge1xuICAgICAgaWYgKGV4YW1wbGVEZWZzID09IG51bGwgfHwgZXhhbXBsZURlZnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93RXJyb3IoKTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgaSBpbiBleGFtcGxlRGVmcykge1xuICAgICAgICBjb25zdCBleGFtcGxlID0gZXhhbXBsZURlZnNbaV07XG4gICAgICAgIGlmIChleGFtcGxlLm5hbWUoKSA9PT0gZXhhbXBsZUlkZW50aWZpZXIpIHtcbiAgICAgICAgICByZXR1cm4gZXhhbXBsZS52YWx1ZSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aHJvd0Vycm9yKCk7XG4gICAgfVxuICAgIGlmIChyZXNwQm9keURlZltcImV4YW1wbGVcIl0gPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBleGFtcGxlRGVmc1swXS52YWx1ZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcmVzcEJvZHlEZWZbXCJleGFtcGxlXCJdO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBsb29rdXBSZXNwb25zZShzdGF0dXNDb2RlOiBudW1iZXIsIGV4YW1wbGVJZGVudGlmaWVyOiBzdHJpbmcpOiBSZXNwb25zZSB7XG4gICAgY29uc3QgcG9zc2libGVSZXNwb25zZURlZnMgPSB0aGlzLmxvb2t1cFJlc3BvbnNlRGVmc0J5UmVxdWVzdCh0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ucmVxdWVzdCk7XG4gICAgY29uc29sZS5sb2coYGxvb2tpbmcgZm9yIHJlc3BvbnNlIHdpdGggc3RhdHVzQ29kZT0ke3N0YXR1c0NvZGV9IGluIGAsIE9iamVjdC5rZXlzKHBvc3NpYmxlUmVzcG9uc2VEZWZzKSk7XG4gICAgZm9yIChjb25zdCBjb2RlIGluIHBvc3NpYmxlUmVzcG9uc2VEZWZzKSB7XG4gICAgICBpZiAoTnVtYmVyLnBhcnNlSW50KGNvZGUpID09PSBzdGF0dXNDb2RlKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiY3JlYXRpbmcgcmVzcG9uc2UsIGRlZjogXCIsIHBvc3NpYmxlUmVzcG9uc2VEZWZzW2NvZGVdKVxuICAgICAgICByZXR1cm4gdGhpcy5idWlsZFJlc3BvbnNlRnJvbURlZmluaXRpb24ocG9zc2libGVSZXNwb25zZURlZnNbY29kZV0sIGV4YW1wbGVJZGVudGlmaWVyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwidGhlcmUgaXMgbm8gcmVzcG9uc2UgZGVmaW5lZCB3aXRoIHN0YXR1cyBjb2RlIFwiICsgc3RhdHVzQ29kZSArIFwiIGluIHRoZSBSQU1MIGZpbGVcIik7XG4gIH1cblxuICBwcml2YXRlIGxvb2t1cFJlc3BvbnNlRGVmc0J5UmVxdWVzdChyZXF1ZXN0OiBSZXF1ZXN0KTogYW55IHtcbiAgICBmb3IgKGNvbnN0IGkgaW4gdGhpcy5hbGxSZXNvdXJjZXModGhpcy5hcGkpKSB7XG4gICAgICBjb25zdCByZXMgPSB0aGlzLmFsbFJlc291cmNlcyh0aGlzLmFwaSlbaV07XG4gICAgICBsZXQgbWV0aG9kcyA9IE9iamVjdC5rZXlzKHJlcyk7XG4gICAgICBmb3IgKGNvbnN0IG1ldGhvZE5hbWUgaW4gbWV0aG9kcykge1xuICAgICAgICBjb25zdCBtZXRob2QgPSBtZXRob2RzW21ldGhvZE5hbWVdO1xuICAgICAgICBjb25zdCBwYXR0ZXJuID0gbmV3IFJlcXVlc3RQYXR0ZXJuKHRoaXMuYWJzb2x1dGVVcmkoaSksIG1ldGhvZCwgdGhpcy5maW5kUmVxdWVzdEJvZHlTY2hlbWEocmVzW21ldGhvZF0pKTtcbiAgICAgICAgaWYgKHBhdHRlcm4ubWF0Y2hlcyhyZXF1ZXN0KSkge1xuICAgICAgICAgIGNvbnN0IHJ2YWwgPSB7fTtcbiAgICAgICAgICBmb3IgKGxldCBzdGF0dXNDb2RlIGluIHJlc1ttZXRob2RdLnJlc3BvbnNlcykge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYGFkZGluZyB0byBwb3NzaWJsZVJlc3BvbnNlRGVmczogJHtzdGF0dXNDb2RlfSAtPiBgLCByZXNbbWV0aG9kXS5yZXNwb25zZXNbc3RhdHVzQ29kZV0pXG4gICAgICAgICAgICBydmFsW3N0YXR1c0NvZGVdID0gcmVzW21ldGhvZF0ucmVzcG9uc2VzW3N0YXR1c0NvZGVdIHx8IHt9O1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gcnZhbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBcIm5vdCBmb3VuZFwiO1xuICB9XG5cbiAgcHJpdmF0ZSBvblN0dWJSZXNwb25zZUF2YWlsYWJsZShyZXF1ZXN0UGF0dGVybjogUmVxdWVzdFBhdHRlcm4sIHJlc3BvbnNlOiBSZXNwb25zZSkge1xuICAgIC8vIHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbi5wcmVtYXRjaGVkQmVoYXZpb3IuO1xuICAgIHRoaXMuc3R1YmJlZC51bnNoaWZ0KHtcbiAgICAgIHJlc3BvbnNlOiByZXNwb25zZSxcbiAgICAgIHJlcXVlc3RQYXR0ZXJuOiByZXF1ZXN0UGF0dGVybixcbiAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IG5ldyBOb29wUmVxdWVzdFZhbGlkYXRvcigpXG4gICAgfSk7XG4gICAgdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uID0gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgb25Nb2NrUmVzcG9uc2VBdmFpbGFibGUoYmVoYXZpb3I6IEJlaGF2aW9yKSB7XG4gICAgdGhpcy5leHBlY3RlZC5wdXNoKGJlaGF2aW9yKTtcbiAgICB0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24gPSBudWxsO1xuICB9XG5cbiAgcHVibGljIHdoZW5HRVQodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwiZ2V0XCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuSEVBRCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJoZWFkXCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuUE9TVCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJwb3N0XCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuUFVUKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcInB1dFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlbkRFTEVURSh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJkZWxldGVcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5QQVRDSCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJwYXRjaFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlbk9QVElPTlModXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwib3B0aW9uc1wiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwcml2YXRlIG1hcmtSZXF1ZXN0QXNQZW5kaW5nKHJlcTogUmVxdWVzdCwgYmVoYXZpb3I6IEJlaGF2aW9yKSB7XG4gICAgaWYgKHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgcGVuZGluZ1JlcURlc2NyID0gUmVxdWVzdE1ldGhvZFt0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ucmVxdWVzdC5tZXRob2RdLnRvVXBwZXJDYXNlKClcbiAgICAgICAgKyBcIiBcIiArIHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbi5yZXF1ZXN0LnVybDtcbiAgICAgIGNvbnN0IHJlcURlc2NyID0gUmVxdWVzdE1ldGhvZFtyZXEubWV0aG9kXS50b1VwcGVyQ2FzZSgpICsgXCIgXCIgKyByZXEudXJsO1xuICAgICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwidW5maW5pc2hlZCBiZWhhdmlvciBkZWZpbml0aW9uOiBjYW5ub3QgY29uZmlndXJlIFwiXG4gICAgICAgICsgcmVxRGVzY3IgKyBcIiBiZWZvcmUgc2V0dGluZyB0aGUgcmVzcG9uc2UgZm9yIFwiICsgcGVuZGluZ1JlcURlc2NyKTtcbiAgICB9XG4gICAgdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uID0ge1xuICAgICAgcmVxdWVzdDogcmVxLFxuICAgICAgcHJlbWF0Y2hlZEJlaGF2aW9yOiBiZWhhdmlvclxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIHJlbGF0aXZlUGF0aChhYnNvbHV0ZVVyaTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCB1cmwgPSBuZXcgVVJMKGFic29sdXRlVXJpKTtcbiAgICByZXR1cm4gdXJsLnBhdGhuYW1lICsgdXJsLnF1ZXJ5ICsgdXJsLmhhc2g7XG4gIH1cblxuICBwdWJsaWMgd2hlblJlcXVlc3RJcyhyZXF1ZXN0OiBSZXF1ZXN0KTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIGNvbnN0IHBhdGggPSB0aGlzLnJlbGF0aXZlUGF0aChyZXF1ZXN0LnVybCksIG1ldGhvZCA9IFJlcXVlc3RNZXRob2RbcmVxdWVzdC5tZXRob2RdO1xuXG4gICAgbGV0IHZhbGlkYXRpb25FcnJvcjtcbiAgICBmb3IgKGNvbnN0IGkgaW4gdGhpcy5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBiZWhhdmlvciA9IHRoaXMuZGVmaW5lZFtpXTtcbiAgICAgIGlmIChiZWhhdmlvci5yZXF1ZXN0UGF0dGVybi5tYXRjaGVzKHJlcXVlc3QpKSB7XG4gICAgICAgIHRoaXMubWFya1JlcXVlc3RBc1BlbmRpbmcocmVxdWVzdCwgYmVoYXZpb3IpO1xuICAgICAgICBpZiAoKHZhbGlkYXRpb25FcnJvciA9IGJlaGF2aW9yLnJlcXVlc3RWYWxpZGF0b3IubWF0Y2hlcyhyZXF1ZXN0KSkgPT09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gbmV3IFJlc3BvbnNlU2V0dGVyKHRoaXMsIHJlc3BvbnNlID0+IHRoaXMub25TdHViUmVzcG9uc2VBdmFpbGFibGUobmV3IFJlcXVlc3RQYXR0ZXJuKHBhdGgsIG1ldGhvZCwgbnVsbCksIHJlc3BvbnNlKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKHZhbGlkYXRpb25FcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwiZm91bmQgbm8gZGVjbGFyYXRpb24gb2YgcmVxdWVzdCBbXCIgKyBtZXRob2QudG9VcHBlckNhc2UoKVxuICAgICAgKyBcIiBcIiArIHBhdGggKyBcIl0gaW4gUkFNTCAtIHJlZnVzaW5nIHRvIHN0dWJcIik7XG4gIH1cblxuICBwdWJsaWMgY3JlYXRlQmFja2VuZCgpOiBSQU1MQmFja2VuZCB7XG4gICAgcmV0dXJuIG5ldyBSQU1MQmFja2VuZCh0aGlzLnN0dWJiZWQsIHRoaXMuZXhwZWN0ZWQpO1xuICB9XG5cbn1cbiJdfQ==
