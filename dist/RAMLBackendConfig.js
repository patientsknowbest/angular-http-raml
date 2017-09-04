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
var http_1 = require("@angular/http");
var RAMLLoader_1 = require("./RAMLLoader");
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
var RAMLBackendConfig = (function () {
    function RAMLBackendConfig(api) {
        this.api = api;
        this.defined = [];
        this.stubbed = [];
        this.expected = [];
        this.pendingBehaviorSpecification = null;
        this.loadDefinedBehaviors();
    }
    RAMLBackendConfig.initWithFile = function (pathToRAMLFile) {
        var api = new RAMLLoader_1.YAMLFileLoader(pathToRAMLFile).loadFile();
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
    RAMLBackendConfig.prototype.getSchema = function (type) {
        if (!type) {
            return {};
        }
        if (typeof type === 'object') {
            return type;
        }
        var rawSchema = type;
        try {
            if (typeof JSON.parse(rawSchema) === 'object') {
                return rawSchema;
            }
        }
        catch (e) {
            var typeName = rawSchema.trim();
            for (var t in this.api["types"]) {
                if (t === typeName) {
                    return this.api["types"][t];
                }
            }
        }
    };
    RAMLBackendConfig.prototype.findRequestBodySchema = function (method) {
        if (method.body && method.body.type) {
            return this.getSchema(method.body.type);
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
    RAMLBackendConfig.prototype.loadDefinedBehaviors = function () {
        var entries = [];
        var allResources = this.allResources(this.api);
        for (var i in allResources) {
            var resource = allResources[i];
            var resourceUri = this.absoluteUri(i);
            for (var methodName in resource) {
                var method = resource[methodName];
                var schema = this.findRequestBodySchema(method);
                var pattern = new RAMLBackend_1.RequestPattern(resourceUri, methodName, schema, this.buildResponsePatterns(method.responses));
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
                var pattern = new RAMLBackend_1.RequestPattern(this.absoluteUri(i), method, this.findRequestBodySchema(res[method]), this.buildResponsePatterns(res[method].responses));
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
    RAMLBackendConfig.prototype.buildResponsePatterns = function (responses) {
        var rval = [];
        for (var statusCode in responses) {
            if (responses[statusCode] !== null) {
                rval.push(new RAMLBackend_1.ResponsePattern(Number(statusCode), this.getSchema((responses[statusCode].body || {}).type)));
            }
        }
        return rval;
    };
    RAMLBackendConfig.prototype.onStubResponseAvailable = function (requestPattern, response) {
        var respPattern = requestPattern.findResponsePatternByStatusCode(response.status);
        if (respPattern !== null) {
            if (!respPattern.matches(response)) {
                throw new InvalidStubbingError("invalid stub response body");
            }
        }
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
    RAMLBackendConfig.prototype.baseUri = function (baseUri) {
        if (this.stubbed.length > 0) {
            throw new InvalidStubbingError("cannot change baseUri after stubs are defined");
        }
        this.api["baseUri"] = baseUri;
        this.loadDefinedBehaviors();
        return this;
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
        var _loop_1 = function (i) {
            var behavior = this_1.defined[i];
            if (behavior.requestPattern.matches(request)) {
                this_1.markRequestAsPending(request, behavior);
                if ((validationError = behavior.requestValidator.matches(request)) === null) {
                    return { value: new ResponseSetter(this_1, function (response) { return _this.onStubResponseAvailable(new RAMLBackend_1.RequestPattern(path, method, null, behavior.requestPattern.responsePatterns), response); }) };
                }
                else {
                    throw new InvalidStubbingError(validationError);
                }
            }
        };
        var this_1 = this;
        for (var i in this.defined) {
            var state_1 = _loop_1(i);
            if (typeof state_1 === "object")
                return state_1.value;
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFDLENBQUM7SUFDbkQsQ0FBQztJQUVNLHlDQUFhLEdBQXBCO1FBQ0UsTUFBTSxDQUFDLElBQUkseUJBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUN0RCxDQUFDO0lBRUgsd0JBQUM7QUFBRCxDQTVUQSxBQTRUQztBQTFUUSxrQ0FBZ0IsR0FBYSxDQUFDLE9BQU8sRUFBRSxTQUFTLEVBQUUsU0FBUztJQUNoRSxXQUFXLEVBQUUsT0FBTyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0FBSDFCLDhDQUFpQiIsImZpbGUiOiJSQU1MQmFja2VuZENvbmZpZy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7QmVoYXZpb3IsIERlZmF1bHRSZXF1ZXN0VmFsaWRhdG9yLCBOb29wUmVxdWVzdFZhbGlkYXRvciwgUkFNTEJhY2tlbmQsIFJlcXVlc3RQYXR0ZXJuLCBSZXNwb25zZVBhdHRlcm59IGZyb20gXCIuL1JBTUxCYWNrZW5kXCI7XG5pbXBvcnQge1JlcXVlc3QsIFJlcXVlc3RNZXRob2QsIFJlc3BvbnNlLCBSZXNwb25zZU9wdGlvbnN9IGZyb20gXCJAYW5ndWxhci9odHRwXCI7XG5pbXBvcnQge1lBTUxGaWxlTG9hZGVyfSBmcm9tIFwiLi9SQU1MTG9hZGVyXCI7XG5pbXBvcnQgVVJMID0gcmVxdWlyZShcInVybC1wYXJzZVwiKTtcblxuZXhwb3J0IGNsYXNzIEludmFsaWRTdHViYmluZ0Vycm9yIGV4dGVuZHMgRXJyb3Ige1xuXG59XG5cbmV4cG9ydCBjbGFzcyBSZXNwb25zZVNldHRlciB7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBvd25lcjogUkFNTEJhY2tlbmRDb25maWcsXG4gICAgICAgICAgICAgIHByaXZhdGUgb25SZWFkeTogKHJlc3BvbnNlOiBSZXNwb25zZSkgPT4gdm9pZCkge1xuICB9XG5cbiAgcHVibGljIHRoZW5SZXNwb25kKHJlc3BvbnNlOiBSZXNwb25zZSk6IFJBTUxCYWNrZW5kQ29uZmlnIHtcbiAgICB0aGlzLm9uUmVhZHkocmVzcG9uc2UpO1xuICAgIHJldHVybiB0aGlzLm93bmVyO1xuICB9XG5cbiAgcHVibGljIHRoZW5SZXNwb25kV2l0aChzdGF0dXNDb2RlOiBudW1iZXIsIGV4YW1wbGVJZGVudGlmaWVyPzogc3RyaW5nKTogUkFNTEJhY2tlbmRDb25maWcge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gdGhpcy5vd25lci5sb29rdXBSZXNwb25zZShzdGF0dXNDb2RlLCBleGFtcGxlSWRlbnRpZmllcik7XG4gICAgdGhpcy5vblJlYWR5KHJlc3BvbnNlKTtcbiAgICByZXR1cm4gdGhpcy5vd25lcjtcbiAgfVxuXG59XG5cbmludGVyZmFjZSBQZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uIHtcblxuICBwcmVtYXRjaGVkQmVoYXZpb3I6IEJlaGF2aW9yO1xuXG4gIHJlcXVlc3Q6IFJlcXVlc3Q7XG5cbiAgLy8gcmVzcG9uc2VQYXR0ZXJuQ2FuZGlkYXRlczogTWV0aG9kW107XG5cbn1cblxuZXhwb3J0IGNsYXNzIFJBTUxCYWNrZW5kQ29uZmlnIHtcblxuICBzdGF0aWMgdG9wTGV2ZWxLZXl3b3Jkczogc3RyaW5nW10gPSBbXCJ0aXRsZVwiLCBcInZlcnNpb25cIiwgXCJiYXNlVXJpXCIsXG4gICAgXCJtZWRpYVR5cGVcIiwgXCJ0eXBlc1wiLCBcInNlY3VyZWRCeVwiXTtcblxuXG4gIHN0YXRpYyBpbml0V2l0aEZpbGUocGF0aFRvUkFNTEZpbGU6IHN0cmluZyk6IFJBTUxCYWNrZW5kQ29uZmlnIHtcbiAgICBjb25zdCBhcGkgPSBuZXcgWUFNTEZpbGVMb2FkZXIocGF0aFRvUkFNTEZpbGUpLmxvYWRGaWxlKCk7XG4gICAgcmV0dXJuIG5ldyBSQU1MQmFja2VuZENvbmZpZyhhcGkpO1xuICB9XG5cbiAgcHJpdmF0ZSBzdGF0aWMgZmluZEJlc3REdW1teVJlc3BvbnNlKHJlc3BvbnNlcyk6IHsgc3RhdHVzQ29kZTogbnVtYmVyLCByZXNwb25zZURlZmluaXRpb246IGFueSB9IHtcbiAgICBsZXQgYmVzdEZpdHRpbmdSZXNwID0gbnVsbCwgYmVzdEZpdHRpbmdSZXNwQ29kZSA9IG51bGw7XG4gICAgZm9yIChjb25zdCBjb2RlIGluIHJlc3BvbnNlcykge1xuICAgICAgY29uc3QgY2FuZGlkYXRlID0gcmVzcG9uc2VzW2NvZGVdO1xuICAgICAgY29uc3Qgc3RhdHVzQ29kZSA9IE51bWJlci5wYXJzZUludChjb2RlKTtcbiAgICAgIGlmICgyMDAgPD0gc3RhdHVzQ29kZSAmJiBzdGF0dXNDb2RlIDwgMzAwKSB7XG4gICAgICAgIGlmIChiZXN0Rml0dGluZ1Jlc3BDb2RlID09PSBudWxsIHx8IGJlc3RGaXR0aW5nUmVzcENvZGUgPiBzdGF0dXNDb2RlKSB7XG4gICAgICAgICAgYmVzdEZpdHRpbmdSZXNwID0gY2FuZGlkYXRlO1xuICAgICAgICAgIGJlc3RGaXR0aW5nUmVzcENvZGUgPSBzdGF0dXNDb2RlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7c3RhdHVzQ29kZTogYmVzdEZpdHRpbmdSZXNwQ29kZSwgcmVzcG9uc2VEZWZpbml0aW9uOiBiZXN0Rml0dGluZ1Jlc3AgfHwge319O1xuICB9XG5cbiAgcHJpdmF0ZSBkZWZpbmVkOiBCZWhhdmlvcltdID0gW107XG5cbiAgcHJpdmF0ZSBzdHViYmVkOiBCZWhhdmlvcltdID0gW107XG5cbiAgcHJpdmF0ZSBleHBlY3RlZDogQmVoYXZpb3JbXSA9IFtdO1xuXG4gIHByaXZhdGUgcGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbjogUGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiA9IG51bGw7XG5cbiAgcHJpdmF0ZSBnZXRTY2hlbWEodHlwZTogc3RyaW5nKTogYW55IHtcbiAgICBpZiAoIXR5cGUpIHtcbiAgICAgIHJldHVybiB7fTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB0eXBlID09PSAnb2JqZWN0Jykge1xuICAgICAgcmV0dXJuIHR5cGU7XG4gICAgfVxuICAgIGNvbnN0IHJhd1NjaGVtYSA9IHR5cGU7XG4gICAgdHJ5IHtcbiAgICAgIGlmICh0eXBlb2YgSlNPTi5wYXJzZShyYXdTY2hlbWEpID09PSAnb2JqZWN0Jykge1xuICAgICAgICByZXR1cm4gcmF3U2NoZW1hO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnN0IHR5cGVOYW1lID0gcmF3U2NoZW1hLnRyaW0oKTtcbiAgICAgIGZvciAoY29uc3QgdCBpbiB0aGlzLmFwaVtcInR5cGVzXCJdKSB7XG4gICAgICAgIGlmICh0ID09PSB0eXBlTmFtZSkge1xuICAgICAgICAgIHJldHVybiB0aGlzLmFwaVtcInR5cGVzXCJdW3RdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBmaW5kUmVxdWVzdEJvZHlTY2hlbWEobWV0aG9kKTogYW55IHtcbiAgICBpZiAobWV0aG9kLmJvZHkgJiYgbWV0aG9kLmJvZHkudHlwZSkge1xuICAgICAgcmV0dXJuIHRoaXMuZ2V0U2NoZW1hKG1ldGhvZC5ib2R5LnR5cGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFic29sdXRlVXJpKHJlbGF0aXZlVXJpOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLmFwaVtcImJhc2VVcmlcIl0gKyByZWxhdGl2ZVVyaTtcbiAgfVxuXG4gIHByaXZhdGUgaXNLZXl3b3JkKGNhbmRpZGF0ZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgZm9yIChsZXQgaSBpbiBSQU1MQmFja2VuZENvbmZpZy50b3BMZXZlbEtleXdvcmRzKSB7XG4gICAgICBpZiAoUkFNTEJhY2tlbmRDb25maWcudG9wTGV2ZWxLZXl3b3Jkc1tpXSA9PT0gY2FuZGlkYXRlKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBwcml2YXRlIGFsbFJlc291cmNlcyhhcGk6IGFueSk6IGFueSB7XG4gICAgY29uc3QgcnZhbCA9IHt9O1xuICAgIGZvciAodmFyIGkgaW4gYXBpKSB7XG4gICAgICBpZiAoIXRoaXMuaXNLZXl3b3JkKGkpKSB7XG4gICAgICAgIHJ2YWxbaV0gPSBhcGlbaV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBydmFsO1xuICB9XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBhcGkpIHtcbiAgICB0aGlzLmxvYWREZWZpbmVkQmVoYXZpb3JzKCk7XG4gIH1cblxuICBwcml2YXRlIGxvYWREZWZpbmVkQmVoYXZpb3JzKCkge1xuICAgIGNvbnN0IGVudHJpZXM6IEJlaGF2aW9yW10gPSBbXTtcbiAgICBjb25zdCBhbGxSZXNvdXJjZXMgPSB0aGlzLmFsbFJlc291cmNlcyh0aGlzLmFwaSk7XG4gICAgZm9yIChjb25zdCBpIGluIGFsbFJlc291cmNlcykge1xuICAgICAgY29uc3QgcmVzb3VyY2UgPSBhbGxSZXNvdXJjZXNbaV07XG4gICAgICBjb25zdCByZXNvdXJjZVVyaSA9IHRoaXMuYWJzb2x1dGVVcmkoaSk7XG4gICAgICBmb3IgKGNvbnN0IG1ldGhvZE5hbWUgaW4gcmVzb3VyY2UpIHtcbiAgICAgICAgY29uc3QgbWV0aG9kID0gcmVzb3VyY2VbbWV0aG9kTmFtZV07XG4gICAgICAgIGNvbnN0IHNjaGVtYSA9IHRoaXMuZmluZFJlcXVlc3RCb2R5U2NoZW1hKG1ldGhvZCk7XG5cbiAgICAgICAgY29uc3QgcGF0dGVybiA9IG5ldyBSZXF1ZXN0UGF0dGVybihyZXNvdXJjZVVyaSwgbWV0aG9kTmFtZSwgc2NoZW1hLCB0aGlzLmJ1aWxkUmVzcG9uc2VQYXR0ZXJucyhtZXRob2QucmVzcG9uc2VzKSk7XG4gICAgICAgIGNvbnN0IHtzdGF0dXNDb2RlLCByZXNwb25zZURlZmluaXRpb259ID0gUkFNTEJhY2tlbmRDb25maWcuZmluZEJlc3REdW1teVJlc3BvbnNlKG1ldGhvZFtcInJlc3BvbnNlc1wiXSk7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gdGhpcy5idWlsZFJlc3BvbnNlRnJvbURlZmluaXRpb24oc3RhdHVzQ29kZSwgcmVzcG9uc2VEZWZpbml0aW9uKTtcbiAgICAgICAgZW50cmllcy5wdXNoKHtcbiAgICAgICAgICByZXF1ZXN0UGF0dGVybjogcGF0dGVybixcbiAgICAgICAgICByZXNwb25zZTogcmVzcG9uc2UsXG4gICAgICAgICAgcmVxdWVzdFZhbGlkYXRvcjogbmV3IERlZmF1bHRSZXF1ZXN0VmFsaWRhdG9yKG1ldGhvZClcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuZGVmaW5lZCA9IGVudHJpZXM7XG4gIH1cblxuICBwcml2YXRlIGJ1aWxkUmVzcG9uc2VGcm9tRGVmaW5pdGlvbihzdGF0dXNDb2RlLCByZXNwb25zZURlZmluaXRpb24sIGV4YW1wbGVJZGVudGlmaWVyPzogc3RyaW5nKSB7XG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShuZXcgUmVzcG9uc2VPcHRpb25zKHtcbiAgICAgIHN0YXR1czogc3RhdHVzQ29kZSxcbiAgICAgIGJvZHk6IHRoaXMubG9va3VwRXhhbXBsZVJlc3BvbnNlQm9keShyZXNwb25zZURlZmluaXRpb25bXCJib2R5XCJdLCBleGFtcGxlSWRlbnRpZmllcilcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgc3R1YkFsbCgpOiBSQU1MQmFja2VuZENvbmZpZyB7XG4gICAgdGhpcy5kZWZpbmVkLmZvckVhY2goYmVoYXZpb3IgPT4gdGhpcy5zdHViYmVkLnB1c2goYmVoYXZpb3IpKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHByaXZhdGUgbG9va3VwRXhhbXBsZVJlc3BvbnNlQm9keShyZXNwQm9keURlZiwgZXhhbXBsZUlkZW50aWZpZXI/OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGZ1bmN0aW9uIHRocm93RXJyb3IoKSB7XG4gICAgICB0aHJvdyBuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJjb3VsZCBub3QgZmluZCBleGFtcGxlIFtcIiArIGV4YW1wbGVJZGVudGlmaWVyICsgXCJdXCIpO1xuICAgIH1cblxuICAgIGlmIChyZXNwQm9keURlZiA9PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmIChleGFtcGxlSWRlbnRpZmllciAhPSBudWxsKSB7XG4gICAgICAgIHRocm93RXJyb3IoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBleGFtcGxlRGVmcyA9IHJlc3BCb2R5RGVmW1wiZXhhbXBsZXNcIl07XG4gICAgaWYgKGV4YW1wbGVJZGVudGlmaWVyICE9IG51bGwpIHtcbiAgICAgIGlmIChleGFtcGxlRGVmcyA9PSBudWxsIHx8IGV4YW1wbGVEZWZzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvd0Vycm9yKCk7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGV4YW1wbGVOYW1lIGluIGV4YW1wbGVEZWZzKSB7XG4gICAgICAgIGlmIChleGFtcGxlTmFtZSA9PT0gZXhhbXBsZUlkZW50aWZpZXIpIHtcbiAgICAgICAgICByZXR1cm4gZXhhbXBsZURlZnNbZXhhbXBsZU5hbWVdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aHJvd0Vycm9yKCk7XG4gICAgfVxuICAgIHJldHVybiByZXNwQm9keURlZltcImV4YW1wbGVcIl07XG4gIH1cblxuICBwdWJsaWMgbG9va3VwUmVzcG9uc2Uoc3RhdHVzQ29kZTogbnVtYmVyLCBleGFtcGxlSWRlbnRpZmllcjogc3RyaW5nKTogUmVzcG9uc2Uge1xuICAgIGNvbnN0IHBvc3NpYmxlUmVzcG9uc2VEZWZzID0gdGhpcy5sb29rdXBSZXNwb25zZURlZnNCeVJlcXVlc3QodGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uLnJlcXVlc3QpO1xuICAgIGZvciAoY29uc3QgY29kZSBpbiBwb3NzaWJsZVJlc3BvbnNlRGVmcykge1xuICAgICAgaWYgKE51bWJlci5wYXJzZUludChjb2RlKSA9PT0gc3RhdHVzQ29kZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5idWlsZFJlc3BvbnNlRnJvbURlZmluaXRpb24oc3RhdHVzQ29kZSwgcG9zc2libGVSZXNwb25zZURlZnNbY29kZV0sIGV4YW1wbGVJZGVudGlmaWVyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwidGhlcmUgaXMgbm8gcmVzcG9uc2UgZGVmaW5lZCB3aXRoIHN0YXR1cyBjb2RlIFwiICsgc3RhdHVzQ29kZSArIFwiIGluIHRoZSBSQU1MIGZpbGVcIik7XG4gIH1cblxuICBwcml2YXRlIGxvb2t1cFJlc3BvbnNlRGVmc0J5UmVxdWVzdChyZXF1ZXN0OiBSZXF1ZXN0KTogYW55IHtcbiAgICBmb3IgKGNvbnN0IGkgaW4gdGhpcy5hbGxSZXNvdXJjZXModGhpcy5hcGkpKSB7XG4gICAgICBjb25zdCByZXMgPSB0aGlzLmFsbFJlc291cmNlcyh0aGlzLmFwaSlbaV07XG4gICAgICBsZXQgbWV0aG9kcyA9IE9iamVjdC5rZXlzKHJlcyk7XG4gICAgICBmb3IgKGNvbnN0IG1ldGhvZE5hbWUgaW4gbWV0aG9kcykge1xuICAgICAgICBjb25zdCBtZXRob2QgPSBtZXRob2RzW21ldGhvZE5hbWVdO1xuICAgICAgICBjb25zdCBwYXR0ZXJuID0gbmV3IFJlcXVlc3RQYXR0ZXJuKHRoaXMuYWJzb2x1dGVVcmkoaSksXG4gICAgICAgICAgbWV0aG9kLFxuICAgICAgICAgIHRoaXMuZmluZFJlcXVlc3RCb2R5U2NoZW1hKHJlc1ttZXRob2RdKSxcbiAgICAgICAgICB0aGlzLmJ1aWxkUmVzcG9uc2VQYXR0ZXJucyhyZXNbbWV0aG9kXS5yZXNwb25zZXMpXG4gICAgICAgICk7XG4gICAgICAgIGlmIChwYXR0ZXJuLm1hdGNoZXMocmVxdWVzdCkpIHtcbiAgICAgICAgICBjb25zdCBydmFsID0ge307XG4gICAgICAgICAgZm9yIChsZXQgc3RhdHVzQ29kZSBpbiByZXNbbWV0aG9kXS5yZXNwb25zZXMpIHtcbiAgICAgICAgICAgIHJ2YWxbc3RhdHVzQ29kZV0gPSByZXNbbWV0aG9kXS5yZXNwb25zZXNbc3RhdHVzQ29kZV0gfHwge307XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBydmFsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRocm93IFwibm90IGZvdW5kXCI7XG4gIH1cblxuICBwcml2YXRlIGJ1aWxkUmVzcG9uc2VQYXR0ZXJucyhyZXNwb25zZXM6IGFueSk6IFJlc3BvbnNlUGF0dGVybltdIHtcbiAgICBjb25zdCBydmFsOiBSZXNwb25zZVBhdHRlcm5bXSA9IFtdO1xuICAgIGZvciAoY29uc3Qgc3RhdHVzQ29kZSBpbiByZXNwb25zZXMpIHtcbiAgICAgIGlmIChyZXNwb25zZXNbc3RhdHVzQ29kZV0gIT09IG51bGwpIHtcbiAgICAgICAgcnZhbC5wdXNoKG5ldyBSZXNwb25zZVBhdHRlcm4oTnVtYmVyKHN0YXR1c0NvZGUpLCB0aGlzLmdldFNjaGVtYSgocmVzcG9uc2VzW3N0YXR1c0NvZGVdLmJvZHkgfHwge30pLnR5cGUpKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBydmFsO1xuICB9XG5cbiAgcHJpdmF0ZSBvblN0dWJSZXNwb25zZUF2YWlsYWJsZShyZXF1ZXN0UGF0dGVybjogUmVxdWVzdFBhdHRlcm4sIHJlc3BvbnNlOiBSZXNwb25zZSkge1xuICAgIGNvbnN0IHJlc3BQYXR0ZXJuOiBSZXNwb25zZVBhdHRlcm4gPSByZXF1ZXN0UGF0dGVybi5maW5kUmVzcG9uc2VQYXR0ZXJuQnlTdGF0dXNDb2RlKHJlc3BvbnNlLnN0YXR1cyk7XG4gICAgaWYgKHJlc3BQYXR0ZXJuICE9PSBudWxsKSB7XG4gICAgICBpZiAoIXJlc3BQYXR0ZXJuLm1hdGNoZXMocmVzcG9uc2UpKSB7XG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcImludmFsaWQgc3R1YiByZXNwb25zZSBib2R5XCIpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnN0dWJiZWQudW5zaGlmdCh7XG4gICAgICByZXNwb25zZTogcmVzcG9uc2UsXG4gICAgICByZXF1ZXN0UGF0dGVybjogcmVxdWVzdFBhdHRlcm4sXG4gICAgICByZXF1ZXN0VmFsaWRhdG9yOiBuZXcgTm9vcFJlcXVlc3RWYWxpZGF0b3IoKVxuICAgIH0pO1xuICAgIHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiA9IG51bGw7XG4gIH1cblxuICBwcml2YXRlIG9uTW9ja1Jlc3BvbnNlQXZhaWxhYmxlKGJlaGF2aW9yOiBCZWhhdmlvcikge1xuICAgIHRoaXMuZXhwZWN0ZWQucHVzaChiZWhhdmlvcik7XG4gICAgdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uID0gbnVsbDtcbiAgfVxuXG4gIHB1YmxpYyBiYXNlVXJpKGJhc2VVcmk6IHN0cmluZyk6IFJBTUxCYWNrZW5kQ29uZmlnIHtcbiAgICBpZiAodGhpcy5zdHViYmVkLmxlbmd0aCA+IDApIHtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcImNhbm5vdCBjaGFuZ2UgYmFzZVVyaSBhZnRlciBzdHVicyBhcmUgZGVmaW5lZFwiKTtcbiAgICB9XG4gICAgdGhpcy5hcGlbXCJiYXNlVXJpXCJdID0gYmFzZVVyaTtcbiAgICB0aGlzLmxvYWREZWZpbmVkQmVoYXZpb3JzKCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBwdWJsaWMgd2hlbkdFVCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJnZXRcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5IRUFEKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcImhlYWRcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5QT1NUKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcInBvc3RcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5QVVQodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwicHV0XCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuREVMRVRFKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcImRlbGV0ZVwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlblBBVENIKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcInBhdGNoXCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuT1BUSU9OUyh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJvcHRpb25zXCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHByaXZhdGUgbWFya1JlcXVlc3RBc1BlbmRpbmcocmVxOiBSZXF1ZXN0LCBiZWhhdmlvcjogQmVoYXZpb3IpIHtcbiAgICBpZiAodGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBwZW5kaW5nUmVxRGVzY3IgPSBSZXF1ZXN0TWV0aG9kW3RoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbi5yZXF1ZXN0Lm1ldGhvZF0udG9VcHBlckNhc2UoKVxuICAgICAgICArIFwiIFwiICsgdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uLnJlcXVlc3QudXJsO1xuICAgICAgY29uc3QgcmVxRGVzY3IgPSBSZXF1ZXN0TWV0aG9kW3JlcS5tZXRob2RdLnRvVXBwZXJDYXNlKCkgKyBcIiBcIiArIHJlcS51cmw7XG4gICAgICB0aHJvdyBuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJ1bmZpbmlzaGVkIGJlaGF2aW9yIGRlZmluaXRpb246IGNhbm5vdCBjb25maWd1cmUgXCJcbiAgICAgICAgKyByZXFEZXNjciArIFwiIGJlZm9yZSBzZXR0aW5nIHRoZSByZXNwb25zZSBmb3IgXCIgKyBwZW5kaW5nUmVxRGVzY3IpO1xuICAgIH1cbiAgICB0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24gPSB7XG4gICAgICByZXF1ZXN0OiByZXEsXG4gICAgICBwcmVtYXRjaGVkQmVoYXZpb3I6IGJlaGF2aW9yXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgcmVsYXRpdmVQYXRoKGFic29sdXRlVXJpOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHVybCA9IG5ldyBVUkwoYWJzb2x1dGVVcmkpO1xuICAgIHJldHVybiB1cmwucGF0aG5hbWUgKyB1cmwucXVlcnkgKyB1cmwuaGFzaDtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuUmVxdWVzdElzKHJlcXVlc3Q6IFJlcXVlc3QpOiBSZXNwb25zZVNldHRlciB7XG4gICAgY29uc3QgcGF0aCA9IHRoaXMucmVsYXRpdmVQYXRoKHJlcXVlc3QudXJsKSwgbWV0aG9kID0gUmVxdWVzdE1ldGhvZFtyZXF1ZXN0Lm1ldGhvZF07XG5cbiAgICBsZXQgdmFsaWRhdGlvbkVycm9yO1xuICAgIGZvciAoY29uc3QgaSBpbiB0aGlzLmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGJlaGF2aW9yID0gdGhpcy5kZWZpbmVkW2ldO1xuICAgICAgaWYgKGJlaGF2aW9yLnJlcXVlc3RQYXR0ZXJuLm1hdGNoZXMocmVxdWVzdCkpIHtcbiAgICAgICAgdGhpcy5tYXJrUmVxdWVzdEFzUGVuZGluZyhyZXF1ZXN0LCBiZWhhdmlvcik7XG4gICAgICAgIGlmICgodmFsaWRhdGlvbkVycm9yID0gYmVoYXZpb3IucmVxdWVzdFZhbGlkYXRvci5tYXRjaGVzKHJlcXVlc3QpKSA9PT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiBuZXcgUmVzcG9uc2VTZXR0ZXIodGhpcywgcmVzcG9uc2UgPT4gdGhpcy5vblN0dWJSZXNwb25zZUF2YWlsYWJsZShcbiAgICAgICAgICAgIG5ldyBSZXF1ZXN0UGF0dGVybihwYXRoLCBtZXRob2QsIG51bGwsIGJlaGF2aW9yLnJlcXVlc3RQYXR0ZXJuLnJlc3BvbnNlUGF0dGVybnMpLCByZXNwb25zZSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcih2YWxpZGF0aW9uRXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRocm93IG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcImZvdW5kIG5vIGRlY2xhcmF0aW9uIG9mIHJlcXVlc3QgW1wiICsgbWV0aG9kLnRvVXBwZXJDYXNlKClcbiAgICAgICsgXCIgXCIgKyBwYXRoICsgXCJdIGluIFJBTUwgLSByZWZ1c2luZyB0byBzdHViXCIpO1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZUJhY2tlbmQoKTogUkFNTEJhY2tlbmQge1xuICAgIHJldHVybiBuZXcgUkFNTEJhY2tlbmQodGhpcy5zdHViYmVkLCB0aGlzLmV4cGVjdGVkKTtcbiAgfVxuXG59XG4iXX0=
