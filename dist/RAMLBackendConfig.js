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
exports.IncludeType = new js_yaml_1.Type("!include", {
    kind: "scalar",
    construct: function (data) {
        console.log("construct called with ", arguments);
    },
    resolve: function () {
        console.log("resolve called with ", arguments);
    },
    instanceOf: exports.IncludeType
});
var RAMLBackendConfig = (function () {
    function RAMLBackendConfig(api) {
        this.api = api;
        this.defined = [];
        this.stubbed = [];
        this.expected = [];
        this.pendingBehaviorSpecification = null;
        console.log(typeof api, api);
        var entries = [];
        var allResources = this.allResources(this.api);
        for (var i in allResources) {
            var resource = allResources[i];
            var resourceUri = this.absoluteUri(i);
            console.log("resource:", resource, i, allResources);
            for (var methodName in resource) {
                var method = resource[methodName];
                var schema = this.findRequestBodySchema(method);
                console.log("method: ", method);
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
        var request = new XMLHttpRequest();
        request.open('GET', pathToRAMLFile, false); // `false` makes the request synchronous
        request.send(null);
        if (request.status === 200) {
            var api = js_yaml_1.safeLoad(request.responseText, {
                schema: js_yaml_1.Schema.create([exports.IncludeType])
            });
            console.log(pathToRAMLFile, api);
            return new RAMLBackendConfig(api);
        }
        throw new Error("failed to GET " + pathToRAMLFile + ": " + request.status);
    };
    RAMLBackendConfig.findBestDummyResponse = function (responses) {
        var bestFittingResp = null, bestFittingRespCode = null;
        console.log(responses);
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
                return JSON.parse(rawSchema);
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
        for (var code in possibleResponseDefs) {
            if (Number.parseInt(code) === statusCode) {
                return this.buildResponseFromDefinition(possibleResponseDefs[code], exampleIdentifier);
            }
        }
        throw new InvalidStubbingError("there is no response defined with status code " + statusCode + " in the RAML file");
    };
    RAMLBackendConfig.prototype.lookupResponseDefsByRequest = function (request) {
        for (var i in this.api.resources()) {
            var res = this.api.resources()[i];
            for (var j in res.methods()) {
                var method = res.methods()[j];
                var pattern = new RAMLBackend_1.RequestPattern(res.absoluteUri(), method.method(), this.findRequestBodySchema(method));
                if (pattern.matches(request)) {
                    return method.responses();
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
    RAMLBackendConfig.topLevelKeywords = ["title", "version", "baseUri",
        "mediaType", "types", "securedBy"];
    return RAMLBackendConfig;
}());
exports.RAMLBackendConfig = RAMLBackendConfig;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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RCxBQWtTQyxJQUFBO0FBbFNZLDhDQUFpQiIsImZpbGUiOiJSQU1MQmFja2VuZENvbmZpZy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7QmVoYXZpb3IsIERlZmF1bHRSZXF1ZXN0VmFsaWRhdG9yLCBOb29wUmVxdWVzdFZhbGlkYXRvciwgUkFNTEJhY2tlbmQsIFJlcXVlc3RQYXR0ZXJufSBmcm9tIFwiLi9SQU1MQmFja2VuZFwiO1xuaW1wb3J0IHtzYWZlTG9hZCwgVHlwZSwgU2NoZW1hfSBmcm9tIFwianMteWFtbFwiO1xuaW1wb3J0IHtSZXF1ZXN0LCBSZXF1ZXN0TWV0aG9kLCBSZXNwb25zZSwgUmVzcG9uc2VPcHRpb25zfSBmcm9tIFwiQGFuZ3VsYXIvaHR0cFwiO1xuaW1wb3J0IFVSTCA9IHJlcXVpcmUoXCJ1cmwtcGFyc2VcIik7XG5cbi8vIGV4cG9ydCBjbGFzcyBJbmNsdWRlVHlwZSBleHRlbmRzIFR5cGUge1xuLy9cbi8vICAgY29uc3RydWN0b3IoKSB7XG4vLyAgICAgc3VwZXIoXCIhaW5jbHVkZVwiLCB7XG4vLyAgICAgICByZXNvbHZlOiBmdW5jdGlvbigpIHtcbi8vICAgICAgICAgY29uc29sZS5sb2coXCJyZXNvbHZlIGNhbGxlZCB3aXRoIFwiLCBhcmd1bWVudHMpXG4vLyAgICAgICB9XG4vLyAgICAgfSk7XG4vLyAgIH1cbi8vXG4vLyB9XG5cbmV4cG9ydCBjbGFzcyBJbnZhbGlkU3R1YmJpbmdFcnJvciBleHRlbmRzIEVycm9yIHtcblxufVxuXG5leHBvcnQgY2xhc3MgUmVzcG9uc2VTZXR0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgb3duZXI6IFJBTUxCYWNrZW5kQ29uZmlnLFxuICAgICAgICAgICAgICBwcml2YXRlIG9uUmVhZHk6IChyZXNwb25zZTogUmVzcG9uc2UpID0+IHZvaWQpIHtcbiAgfVxuXG4gIHB1YmxpYyB0aGVuUmVzcG9uZChyZXNwb25zZTogUmVzcG9uc2UpOiBSQU1MQmFja2VuZENvbmZpZyB7XG4gICAgdGhpcy5vblJlYWR5KHJlc3BvbnNlKTtcbiAgICByZXR1cm4gdGhpcy5vd25lcjtcbiAgfVxuXG4gIHB1YmxpYyB0aGVuUmVzcG9uZFdpdGgoc3RhdHVzQ29kZTogbnVtYmVyLCBleGFtcGxlSWRlbnRpZmllcj86IHN0cmluZyk6IFJBTUxCYWNrZW5kQ29uZmlnIHtcbiAgICBjb25zdCByZXNwb25zZSA9IHRoaXMub3duZXIubG9va3VwUmVzcG9uc2Uoc3RhdHVzQ29kZSwgZXhhbXBsZUlkZW50aWZpZXIpO1xuICAgIHRoaXMub25SZWFkeShyZXNwb25zZSk7XG4gICAgcmV0dXJuIHRoaXMub3duZXI7XG4gIH1cblxufVxuXG5pbnRlcmZhY2UgUGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiB7XG5cbiAgcHJlbWF0Y2hlZEJlaGF2aW9yOiBCZWhhdmlvcjtcblxuICByZXF1ZXN0OiBSZXF1ZXN0O1xuXG4gIC8vIHJlc3BvbnNlUGF0dGVybkNhbmRpZGF0ZXM6IE1ldGhvZFtdO1xuXG59XG5cbmV4cG9ydCBjb25zdCBJbmNsdWRlVHlwZSA9IG5ldyBUeXBlKFwiIWluY2x1ZGVcIiwge1xuICBraW5kOiBcInNjYWxhclwiLFxuICBjb25zdHJ1Y3Q6IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICBjb25zb2xlLmxvZyhcImNvbnN0cnVjdCBjYWxsZWQgd2l0aCBcIiwgYXJndW1lbnRzKVxuICB9LFxuICByZXNvbHZlOiBmdW5jdGlvbigpIHtcbiAgICBjb25zb2xlLmxvZyhcInJlc29sdmUgY2FsbGVkIHdpdGggXCIsIGFyZ3VtZW50cylcbiAgfSxcbiAgaW5zdGFuY2VPZjogSW5jbHVkZVR5cGVcbn0pO1xuXG5cbmV4cG9ydCBjbGFzcyBSQU1MQmFja2VuZENvbmZpZyB7XG5cbiAgc3RhdGljIHRvcExldmVsS2V5d29yZHM6IHN0cmluZ1tdID0gW1widGl0bGVcIiwgXCJ2ZXJzaW9uXCIsIFwiYmFzZVVyaVwiLFxuICBcIm1lZGlhVHlwZVwiLCBcInR5cGVzXCIsIFwic2VjdXJlZEJ5XCJdO1xuXG5cbiAgc3RhdGljIGluaXRXaXRoRmlsZShwYXRoVG9SQU1MRmlsZTogc3RyaW5nKTogUkFNTEJhY2tlbmRDb25maWcge1xuICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgcmVxdWVzdC5vcGVuKCdHRVQnLCBwYXRoVG9SQU1MRmlsZSwgZmFsc2UpOyAgLy8gYGZhbHNlYCBtYWtlcyB0aGUgcmVxdWVzdCBzeW5jaHJvbm91c1xuICAgIHJlcXVlc3Quc2VuZChudWxsKTtcblxuICAgIGlmIChyZXF1ZXN0LnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICBjb25zdCBhcGkgPSBzYWZlTG9hZChyZXF1ZXN0LnJlc3BvbnNlVGV4dCwge1xuICAgICAgICBzY2hlbWE6IFNjaGVtYS5jcmVhdGUoW0luY2x1ZGVUeXBlXSlcbiAgICAgIH0pO1xuICAgICAgY29uc29sZS5sb2cocGF0aFRvUkFNTEZpbGUsIGFwaSlcbiAgICAgIHJldHVybiBuZXcgUkFNTEJhY2tlbmRDb25maWcoYXBpKTtcbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiZmFpbGVkIHRvIEdFVCBcIiArIHBhdGhUb1JBTUxGaWxlICsgXCI6IFwiICsgcmVxdWVzdC5zdGF0dXMpO1xuICB9XG5cbiAgcHJpdmF0ZSBzdGF0aWMgZmluZEJlc3REdW1teVJlc3BvbnNlKHJlc3BvbnNlcykge1xuICAgIGxldCBiZXN0Rml0dGluZ1Jlc3AgPSBudWxsLCBiZXN0Rml0dGluZ1Jlc3BDb2RlID0gbnVsbDtcbiAgICBjb25zb2xlLmxvZyhyZXNwb25zZXMpXG4gICAgY29uc29sZS5sb2coXCJsb29raW5nIGZvciByZXNwb25zZXM6IFwiLCBPYmplY3Qua2V5cyhyZXNwb25zZXMpKVxuICAgIGZvciAoY29uc3QgY29kZSBpbiByZXNwb25zZXMpIHtcbiAgICAgIGNvbnN0IGNhbmRpZGF0ZSA9IHJlc3BvbnNlc1tjb2RlXTtcbiAgICAgIGNvbnN0IHN0YXR1c0NvZGUgPSBOdW1iZXIucGFyc2VJbnQoY29kZSk7XG4gICAgICBpZiAoMjAwIDw9IHN0YXR1c0NvZGUgJiYgc3RhdHVzQ29kZSA8IDMwMCkge1xuICAgICAgICBpZiAoYmVzdEZpdHRpbmdSZXNwID09PSBudWxsKSB7XG4gICAgICAgICAgYmVzdEZpdHRpbmdSZXNwID0gY2FuZGlkYXRlO1xuICAgICAgICAgIGJlc3RGaXR0aW5nUmVzcENvZGUgPSBzdGF0dXNDb2RlO1xuICAgICAgICB9IGVsc2UgaWYgKGJlc3RGaXR0aW5nUmVzcENvZGUgPiBzdGF0dXNDb2RlKSB7XG4gICAgICAgICAgYmVzdEZpdHRpbmdSZXNwID0gY2FuZGlkYXRlO1xuICAgICAgICAgIGJlc3RGaXR0aW5nUmVzcENvZGUgPSBzdGF0dXNDb2RlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBiZXN0Rml0dGluZ1Jlc3AgfHwge307XG4gIH1cblxuICBwcml2YXRlIGRlZmluZWQ6IEJlaGF2aW9yW10gPSBbXTtcblxuICBwcml2YXRlIHN0dWJiZWQ6IEJlaGF2aW9yW10gPSBbXTtcblxuICBwcml2YXRlIGV4cGVjdGVkOiBCZWhhdmlvcltdID0gW107XG5cbiAgcHJpdmF0ZSBwZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uOiBQZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uID0gbnVsbDtcblxuICBwcml2YXRlIGZpbmRSZXF1ZXN0Qm9keVNjaGVtYShtZXRob2QpOiBhbnkge1xuICAgIGlmIChtZXRob2RbXCJib2R5XCJdICYmIG1ldGhvZFtcImJvZHlcIl1bXCJ0eXBlXCJdKSB7XG4gICAgICBjb25zdCByYXdTY2hlbWEgPSBtZXRob2RbXCJib2R5XCJdW1widHlwZVwiXTtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBKU09OLnBhcnNlKHJhd1NjaGVtYSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnN0IHR5cGVOYW1lID0gcmF3U2NoZW1hLnRyaW0oKTtcbiAgICAgICAgZm9yIChjb25zdCB0IGluIHRoaXMuYXBpW1widHlwZXNcIl0pIHtcbiAgICAgICAgICBpZiAodCA9PT0gdHlwZU5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKHRoaXMuYXBpW1widHlwZXNcIl1bdF0udG9TdHJpbmcoKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYWJzb2x1dGVVcmkocmVsYXRpdmVVcmk6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuYXBpW1wiYmFzZVVyaVwiXSArIHJlbGF0aXZlVXJpO1xuICB9XG5cbiAgcHJpdmF0ZSBpc0tleXdvcmQoY2FuZGlkYXRlOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBmb3IgKGxldCBpIGluIFJBTUxCYWNrZW5kQ29uZmlnLnRvcExldmVsS2V5d29yZHMpIHtcbiAgICAgIGlmIChSQU1MQmFja2VuZENvbmZpZy50b3BMZXZlbEtleXdvcmRzW2ldID09PSBjYW5kaWRhdGUpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHByaXZhdGUgYWxsUmVzb3VyY2VzKGFwaTogYW55KTogYW55IHtcbiAgICBjb25zdCBydmFsID0ge307XG4gICAgZm9yICh2YXIgaSBpbiBhcGkpIHtcbiAgICAgIGlmICghdGhpcy5pc0tleXdvcmQoaSkpIHtcbiAgICAgICAgcnZhbFtpXSA9IGFwaVtpXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJ2YWw7XG4gIH1cblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGFwaSkge1xuICAgIGNvbnNvbGUubG9nKHR5cGVvZiBhcGksIGFwaSlcbiAgICBjb25zdCBlbnRyaWVzOiBCZWhhdmlvcltdID0gW107XG4gICAgY29uc3QgYWxsUmVzb3VyY2VzID0gdGhpcy5hbGxSZXNvdXJjZXModGhpcy5hcGkpO1xuICAgIGZvciAoY29uc3QgaSBpbiBhbGxSZXNvdXJjZXMpIHtcbiAgICAgIGNvbnN0IHJlc291cmNlID0gYWxsUmVzb3VyY2VzW2ldO1xuICAgICAgY29uc3QgcmVzb3VyY2VVcmkgPSB0aGlzLmFic29sdXRlVXJpKGkpO1xuICAgICAgY29uc29sZS5sb2coXCJyZXNvdXJjZTpcIiwgcmVzb3VyY2UsIGksIGFsbFJlc291cmNlcylcbiAgICAgIGZvciAoY29uc3QgbWV0aG9kTmFtZSBpbiByZXNvdXJjZSkge1xuICAgICAgICBjb25zdCBtZXRob2QgPSByZXNvdXJjZVttZXRob2ROYW1lXTtcbiAgICAgICAgY29uc3Qgc2NoZW1hID0gdGhpcy5maW5kUmVxdWVzdEJvZHlTY2hlbWEobWV0aG9kKTtcblxuICAgICAgICBjb25zb2xlLmxvZyhcIm1ldGhvZDogXCIsIG1ldGhvZClcblxuICAgICAgICBjb25zdCBwYXR0ZXJuID0gbmV3IFJlcXVlc3RQYXR0ZXJuKHJlc291cmNlVXJpLCBtZXRob2ROYW1lLCBzY2hlbWEpO1xuICAgICAgICBjb25zdCByZXNwb25zZURlZmluaXRpb24gPSBSQU1MQmFja2VuZENvbmZpZy5maW5kQmVzdER1bW15UmVzcG9uc2UobWV0aG9kW1wicmVzcG9uc2VzXCJdKTtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSB0aGlzLmJ1aWxkUmVzcG9uc2VGcm9tRGVmaW5pdGlvbihyZXNwb25zZURlZmluaXRpb24pO1xuICAgICAgICBlbnRyaWVzLnB1c2goe1xuICAgICAgICAgIHJlcXVlc3RQYXR0ZXJuOiBwYXR0ZXJuLFxuICAgICAgICAgIHJlc3BvbnNlOiByZXNwb25zZSxcbiAgICAgICAgICByZXF1ZXN0VmFsaWRhdG9yOiBuZXcgRGVmYXVsdFJlcXVlc3RWYWxpZGF0b3IobWV0aG9kKVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5kZWZpbmVkID0gZW50cmllcztcbiAgfVxuXG4gIHByaXZhdGUgYnVpbGRSZXNwb25zZUZyb21EZWZpbml0aW9uKHJlc3BvbnNlRGVmaW5pdGlvbiwgZXhhbXBsZUlkZW50aWZpZXI/OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKG5ldyBSZXNwb25zZU9wdGlvbnMoe1xuICAgICAgc3RhdHVzOiAyMDAsIC8vIFRPRE9cbiAgICAgIGJvZHk6IHRoaXMubG9va3VwRXhhbXBsZVJlc3BvbnNlQm9keShyZXNwb25zZURlZmluaXRpb25bXCJib2R5XCJdLCBleGFtcGxlSWRlbnRpZmllcilcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgc3R1YkFsbCgpOiBSQU1MQmFja2VuZENvbmZpZyB7XG4gICAgdGhpcy5kZWZpbmVkLmZvckVhY2goYmVoYXZpb3IgPT4gdGhpcy5zdHViYmVkLnB1c2goYmVoYXZpb3IpKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHByaXZhdGUgbG9va3VwRXhhbXBsZVJlc3BvbnNlQm9keShyZXNwQm9keURlZjogVHlwZURlY2xhcmF0aW9uLCBleGFtcGxlSWRlbnRpZmllcj86IHN0cmluZyk6IHN0cmluZyB7XG4gICAgZnVuY3Rpb24gdGhyb3dFcnJvcigpIHtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcImNvdWxkIG5vdCBmaW5kIGV4YW1wbGUgW1wiICsgZXhhbXBsZUlkZW50aWZpZXIgKyBcIl1cIik7XG4gICAgfVxuXG4gICAgaWYgKHJlc3BCb2R5RGVmID09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKGV4YW1wbGVJZGVudGlmaWVyICE9IG51bGwpIHtcbiAgICAgICAgdGhyb3dFcnJvcigpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGV4YW1wbGVEZWZzID0gcmVzcEJvZHlEZWZbXCJleGFtcGxlc1wiXTtcbiAgICBpZiAoZXhhbXBsZUlkZW50aWZpZXIgIT0gbnVsbCkge1xuICAgICAgaWYgKGV4YW1wbGVEZWZzID09IG51bGwgfHwgZXhhbXBsZURlZnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93RXJyb3IoKTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgaSBpbiBleGFtcGxlRGVmcykge1xuICAgICAgICBjb25zdCBleGFtcGxlID0gZXhhbXBsZURlZnNbaV07XG4gICAgICAgIGlmIChleGFtcGxlLm5hbWUoKSA9PT0gZXhhbXBsZUlkZW50aWZpZXIpIHtcbiAgICAgICAgICByZXR1cm4gZXhhbXBsZS52YWx1ZSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aHJvd0Vycm9yKCk7XG4gICAgfVxuICAgIGlmIChyZXNwQm9keURlZltcImV4YW1wbGVcIl0gPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBleGFtcGxlRGVmc1swXS52YWx1ZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcmVzcEJvZHlEZWZbXCJleGFtcGxlXCJdO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBsb29rdXBSZXNwb25zZShzdGF0dXNDb2RlOiBudW1iZXIsIGV4YW1wbGVJZGVudGlmaWVyOiBzdHJpbmcpOiBSZXNwb25zZSB7XG4gICAgY29uc3QgcG9zc2libGVSZXNwb25zZURlZnMgPSB0aGlzLmxvb2t1cFJlc3BvbnNlRGVmc0J5UmVxdWVzdCh0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ucmVxdWVzdCk7XG4gICAgZm9yIChjb25zdCBjb2RlIGluIHBvc3NpYmxlUmVzcG9uc2VEZWZzKSB7XG4gICAgICBpZiAoTnVtYmVyLnBhcnNlSW50KGNvZGUpID09PSBzdGF0dXNDb2RlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJ1aWxkUmVzcG9uc2VGcm9tRGVmaW5pdGlvbihwb3NzaWJsZVJlc3BvbnNlRGVmc1tjb2RlXSwgZXhhbXBsZUlkZW50aWZpZXIpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJ0aGVyZSBpcyBubyByZXNwb25zZSBkZWZpbmVkIHdpdGggc3RhdHVzIGNvZGUgXCIgKyBzdGF0dXNDb2RlICsgXCIgaW4gdGhlIFJBTUwgZmlsZVwiKTtcbiAgfVxuXG4gIHByaXZhdGUgbG9va3VwUmVzcG9uc2VEZWZzQnlSZXF1ZXN0KHJlcXVlc3Q6IFJlcXVlc3QpOiBSZXNwb25zZURlZltdIHtcbiAgICBmb3IgKGNvbnN0IGkgaW4gdGhpcy5hcGkucmVzb3VyY2VzKCkpIHtcbiAgICAgIGNvbnN0IHJlcyA9IHRoaXMuYXBpLnJlc291cmNlcygpW2ldO1xuICAgICAgZm9yIChjb25zdCBqIGluIHJlcy5tZXRob2RzKCkpIHtcbiAgICAgICAgY29uc3QgbWV0aG9kID0gcmVzLm1ldGhvZHMoKVtqXTtcbiAgICAgICAgY29uc3QgcGF0dGVybiA9IG5ldyBSZXF1ZXN0UGF0dGVybihyZXMuYWJzb2x1dGVVcmkoKSwgbWV0aG9kLm1ldGhvZCgpLCB0aGlzLmZpbmRSZXF1ZXN0Qm9keVNjaGVtYShtZXRob2QpKTtcbiAgICAgICAgaWYgKHBhdHRlcm4ubWF0Y2hlcyhyZXF1ZXN0KSkge1xuICAgICAgICAgIHJldHVybiBtZXRob2QucmVzcG9uc2VzKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgXCJub3QgZm91bmRcIjtcbiAgfVxuXG4gIHByaXZhdGUgb25TdHViUmVzcG9uc2VBdmFpbGFibGUocmVxdWVzdFBhdHRlcm46IFJlcXVlc3RQYXR0ZXJuLCByZXNwb25zZTogUmVzcG9uc2UpIHtcbiAgICAvLyB0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ucHJlbWF0Y2hlZEJlaGF2aW9yLjtcbiAgICB0aGlzLnN0dWJiZWQudW5zaGlmdCh7XG4gICAgICByZXNwb25zZTogcmVzcG9uc2UsXG4gICAgICByZXF1ZXN0UGF0dGVybjogcmVxdWVzdFBhdHRlcm4sXG4gICAgICByZXF1ZXN0VmFsaWRhdG9yOiBuZXcgTm9vcFJlcXVlc3RWYWxpZGF0b3IoKVxuICAgIH0pO1xuICAgIHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiA9IG51bGw7XG4gIH1cblxuICBwcml2YXRlIG9uTW9ja1Jlc3BvbnNlQXZhaWxhYmxlKGJlaGF2aW9yOiBCZWhhdmlvcikge1xuICAgIHRoaXMuZXhwZWN0ZWQucHVzaChiZWhhdmlvcik7XG4gICAgdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uID0gbnVsbDtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuR0VUKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcImdldFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlbkhFQUQodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwiaGVhZFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlblBPU1QodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwicG9zdFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlblBVVCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJwdXRcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5ERUxFVEUodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwiZGVsZXRlXCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuUEFUQ0godXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwicGF0Y2hcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5PUFRJT05TKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcIm9wdGlvbnNcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBtYXJrUmVxdWVzdEFzUGVuZGluZyhyZXE6IFJlcXVlc3QsIGJlaGF2aW9yOiBCZWhhdmlvcikge1xuICAgIGlmICh0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24gIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IHBlbmRpbmdSZXFEZXNjciA9IFJlcXVlc3RNZXRob2RbdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uLnJlcXVlc3QubWV0aG9kXS50b1VwcGVyQ2FzZSgpXG4gICAgICAgICsgXCIgXCIgKyB0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ucmVxdWVzdC51cmw7XG4gICAgICBjb25zdCByZXFEZXNjciA9IFJlcXVlc3RNZXRob2RbcmVxLm1ldGhvZF0udG9VcHBlckNhc2UoKSArIFwiIFwiICsgcmVxLnVybDtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcInVuZmluaXNoZWQgYmVoYXZpb3IgZGVmaW5pdGlvbjogY2Fubm90IGNvbmZpZ3VyZSBcIlxuICAgICAgICArIHJlcURlc2NyICsgXCIgYmVmb3JlIHNldHRpbmcgdGhlIHJlc3BvbnNlIGZvciBcIiArIHBlbmRpbmdSZXFEZXNjcik7XG4gICAgfVxuICAgIHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiA9IHtcbiAgICAgIHJlcXVlc3Q6IHJlcSxcbiAgICAgIHByZW1hdGNoZWRCZWhhdmlvcjogYmVoYXZpb3JcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSByZWxhdGl2ZVBhdGgoYWJzb2x1dGVVcmk6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgdXJsID0gbmV3IFVSTChhYnNvbHV0ZVVyaSk7XG4gICAgcmV0dXJuIHVybC5wYXRobmFtZSArIHVybC5xdWVyeSArIHVybC5oYXNoO1xuICB9XG5cbiAgcHVibGljIHdoZW5SZXF1ZXN0SXMocmVxdWVzdDogUmVxdWVzdCk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICBjb25zdCBwYXRoID0gdGhpcy5yZWxhdGl2ZVBhdGgocmVxdWVzdC51cmwpLCBtZXRob2QgPSBSZXF1ZXN0TWV0aG9kW3JlcXVlc3QubWV0aG9kXTtcblxuICAgIGxldCB2YWxpZGF0aW9uRXJyb3I7XG4gICAgZm9yIChjb25zdCBpIGluIHRoaXMuZGVmaW5lZCkge1xuICAgICAgY29uc3QgYmVoYXZpb3IgPSB0aGlzLmRlZmluZWRbaV07XG4gICAgICBpZiAoYmVoYXZpb3IucmVxdWVzdFBhdHRlcm4ubWF0Y2hlcyhyZXF1ZXN0KSkge1xuICAgICAgICB0aGlzLm1hcmtSZXF1ZXN0QXNQZW5kaW5nKHJlcXVlc3QsIGJlaGF2aW9yKTtcbiAgICAgICAgaWYgKCh2YWxpZGF0aW9uRXJyb3IgPSBiZWhhdmlvci5yZXF1ZXN0VmFsaWRhdG9yLm1hdGNoZXMocmVxdWVzdCkpID09PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZVNldHRlcih0aGlzLCByZXNwb25zZSA9PiB0aGlzLm9uU3R1YlJlc3BvbnNlQXZhaWxhYmxlKG5ldyBSZXF1ZXN0UGF0dGVybihwYXRoLCBtZXRob2QsIG51bGwpLCByZXNwb25zZSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcih2YWxpZGF0aW9uRXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRocm93IG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcImZvdW5kIG5vIGRlY2xhcmF0aW9uIG9mIHJlcXVlc3QgW1wiICsgbWV0aG9kLnRvVXBwZXJDYXNlKClcbiAgICAgICsgXCIgXCIgKyBwYXRoICsgXCJdIGluIFJBTUwgLSByZWZ1c2luZyB0byBzdHViXCIpO1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZUJhY2tlbmQoKTogUkFNTEJhY2tlbmQge1xuICAgIHJldHVybiBuZXcgUkFNTEJhY2tlbmQodGhpcy5zdHViYmVkLCB0aGlzLmV4cGVjdGVkKTtcbiAgfVxuXG59XG4iXX0=
