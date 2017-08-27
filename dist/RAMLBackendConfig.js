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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL1JBTUxCYWNrZW5kQ29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBLDZDQUFvSTtBQUNwSSxzQ0FBZ0Y7QUFDaEYsMkNBQTRDO0FBQzVDLCtCQUFrQztBQUVsQztJQUEwQyx3Q0FBSztJQUEvQzs7SUFFQSxDQUFDO0lBQUQsMkJBQUM7QUFBRCxDQUZBLEFBRUMsQ0FGeUMsS0FBSyxHQUU5QztBQUZZLG9EQUFvQjtBQUlqQztJQUVFLHdCQUFvQixLQUF3QixFQUN4QixPQUFxQztRQURyQyxVQUFLLEdBQUwsS0FBSyxDQUFtQjtRQUN4QixZQUFPLEdBQVAsT0FBTyxDQUE4QjtJQUN6RCxDQUFDO0lBRU0sb0NBQVcsR0FBbEIsVUFBbUIsUUFBa0I7UUFDbkMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN2QixNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztJQUNwQixDQUFDO0lBRU0sd0NBQWUsR0FBdEIsVUFBdUIsVUFBa0IsRUFBRSxpQkFBMEI7UUFDbkUsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsVUFBVSxFQUFFLGlCQUFpQixDQUFDLENBQUM7UUFDMUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN2QixNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztJQUNwQixDQUFDO0lBRUgscUJBQUM7QUFBRCxDQWpCQSxBQWlCQyxJQUFBO0FBakJZLHdDQUFjO0FBNkIzQjtJQXVGRSwyQkFBb0IsR0FBRztRQUFILFFBQUcsR0FBSCxHQUFHLENBQUE7UUE3RGYsWUFBTyxHQUFlLEVBQUUsQ0FBQztRQUV6QixZQUFPLEdBQWUsRUFBRSxDQUFDO1FBRXpCLGFBQVEsR0FBZSxFQUFFLENBQUM7UUFFMUIsaUNBQTRCLEdBQWlDLElBQUksQ0FBQztRQXdEeEUsSUFBTSxPQUFPLEdBQWUsRUFBRSxDQUFDO1FBQy9CLElBQU0sWUFB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QUMsQ0FBQztnQkFDN0MsRUFBRSxDQUFDLENBQUMsQ0FBQyxlQUFlLEdBQUcsUUFBUSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7b0NBQ3JFLElBQUksY0FBYyxTQUFPLFVBQUEsUUFBUSxJQUFJLE9BQUEsS0FBSSxDQUFDLHVCQUF1QixDQUN0RSxJQUFJLDRCQUFjLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxFQURqRCxDQUNpRCxDQUFDO2dCQUNoRyxDQUFDO2dCQUFDLElBQUksQ0FBQyxDQUFDO29CQUNOLE1BQU0sSUFBSSxvQkFBb0IsQ0FBQyxlQUFlLENBQUMsQ0FBQztnQkFDbEQsQ0FBQztZQUNILENBQUM7UUFDSCxDQUFDOztRQVhELEdBQUcsQ0FBQyxDQUFDLElBQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUM7a0NBQWxCLENBQUM7OztTQVdYO1FBQ0QsTUFBTSxJQUFJLG9CQUFvQixDQUFDLG1DQUFtQyxHQUFHLE1BQU0sQ0FBQyxXQUFXLEVBQUU7Y0FDckYsR0FBRyxHQUFHLElBQUksR0FBRyw4QkFBOEIsQ0FBQyxDQUFDO0lBQ25ELENBQUM7SUFFTSx5Q0FBYSxHQUFwQjtRQUNFLE1BQU0sQ0FBQyxJQUFJLHlCQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDdEQsQ0FBQztJQUVILHdCQUFDO0FBQUQsQ0EvU0EsQUErU0M7QUE3U1Esa0NBQWdCLEdBQWEsQ0FBQyxPQUFPLEVBQUUsU0FBUyxFQUFFLFNBQVM7SUFDaEUsV0FBVyxFQUFFLE9BQU8sRUFBRSxXQUFXLENBQUMsQ0FBQztBQUgxQiw4Q0FBaUIiLCJmaWxlIjoiUkFNTEJhY2tlbmRDb25maWcuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge0JlaGF2aW9yLCBEZWZhdWx0UmVxdWVzdFZhbGlkYXRvciwgTm9vcFJlcXVlc3RWYWxpZGF0b3IsIFJBTUxCYWNrZW5kLCBSZXF1ZXN0UGF0dGVybiwgUmVzcG9uc2VQYXR0ZXJufSBmcm9tIFwiLi9SQU1MQmFja2VuZFwiO1xuaW1wb3J0IHtSZXF1ZXN0LCBSZXF1ZXN0TWV0aG9kLCBSZXNwb25zZSwgUmVzcG9uc2VPcHRpb25zfSBmcm9tIFwiQGFuZ3VsYXIvaHR0cFwiO1xuaW1wb3J0IHtZQU1MRmlsZUxvYWRlcn0gZnJvbSBcIi4vUkFNTExvYWRlclwiO1xuaW1wb3J0IFVSTCA9IHJlcXVpcmUoXCJ1cmwtcGFyc2VcIik7XG5cbmV4cG9ydCBjbGFzcyBJbnZhbGlkU3R1YmJpbmdFcnJvciBleHRlbmRzIEVycm9yIHtcblxufVxuXG5leHBvcnQgY2xhc3MgUmVzcG9uc2VTZXR0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgb3duZXI6IFJBTUxCYWNrZW5kQ29uZmlnLFxuICAgICAgICAgICAgICBwcml2YXRlIG9uUmVhZHk6IChyZXNwb25zZTogUmVzcG9uc2UpID0+IHZvaWQpIHtcbiAgfVxuXG4gIHB1YmxpYyB0aGVuUmVzcG9uZChyZXNwb25zZTogUmVzcG9uc2UpOiBSQU1MQmFja2VuZENvbmZpZyB7XG4gICAgdGhpcy5vblJlYWR5KHJlc3BvbnNlKTtcbiAgICByZXR1cm4gdGhpcy5vd25lcjtcbiAgfVxuXG4gIHB1YmxpYyB0aGVuUmVzcG9uZFdpdGgoc3RhdHVzQ29kZTogbnVtYmVyLCBleGFtcGxlSWRlbnRpZmllcj86IHN0cmluZyk6IFJBTUxCYWNrZW5kQ29uZmlnIHtcbiAgICBjb25zdCByZXNwb25zZSA9IHRoaXMub3duZXIubG9va3VwUmVzcG9uc2Uoc3RhdHVzQ29kZSwgZXhhbXBsZUlkZW50aWZpZXIpO1xuICAgIHRoaXMub25SZWFkeShyZXNwb25zZSk7XG4gICAgcmV0dXJuIHRoaXMub3duZXI7XG4gIH1cblxufVxuXG5pbnRlcmZhY2UgUGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiB7XG5cbiAgcHJlbWF0Y2hlZEJlaGF2aW9yOiBCZWhhdmlvcjtcblxuICByZXF1ZXN0OiBSZXF1ZXN0O1xuXG4gIC8vIHJlc3BvbnNlUGF0dGVybkNhbmRpZGF0ZXM6IE1ldGhvZFtdO1xuXG59XG5cbmV4cG9ydCBjbGFzcyBSQU1MQmFja2VuZENvbmZpZyB7XG5cbiAgc3RhdGljIHRvcExldmVsS2V5d29yZHM6IHN0cmluZ1tdID0gW1widGl0bGVcIiwgXCJ2ZXJzaW9uXCIsIFwiYmFzZVVyaVwiLFxuICAgIFwibWVkaWFUeXBlXCIsIFwidHlwZXNcIiwgXCJzZWN1cmVkQnlcIl07XG5cblxuICBzdGF0aWMgaW5pdFdpdGhGaWxlKHBhdGhUb1JBTUxGaWxlOiBzdHJpbmcpOiBSQU1MQmFja2VuZENvbmZpZyB7XG4gICAgY29uc3QgYXBpID0gbmV3IFlBTUxGaWxlTG9hZGVyKHBhdGhUb1JBTUxGaWxlKS5sb2FkRmlsZSgpO1xuICAgIHJldHVybiBuZXcgUkFNTEJhY2tlbmRDb25maWcoYXBpKTtcbiAgfVxuXG4gIHByaXZhdGUgc3RhdGljIGZpbmRCZXN0RHVtbXlSZXNwb25zZShyZXNwb25zZXMpOiB7IHN0YXR1c0NvZGU6IG51bWJlciwgcmVzcG9uc2VEZWZpbml0aW9uOiBhbnkgfSB7XG4gICAgbGV0IGJlc3RGaXR0aW5nUmVzcCA9IG51bGwsIGJlc3RGaXR0aW5nUmVzcENvZGUgPSBudWxsO1xuICAgIGZvciAoY29uc3QgY29kZSBpbiByZXNwb25zZXMpIHtcbiAgICAgIGNvbnN0IGNhbmRpZGF0ZSA9IHJlc3BvbnNlc1tjb2RlXTtcbiAgICAgIGNvbnN0IHN0YXR1c0NvZGUgPSBOdW1iZXIucGFyc2VJbnQoY29kZSk7XG4gICAgICBpZiAoMjAwIDw9IHN0YXR1c0NvZGUgJiYgc3RhdHVzQ29kZSA8IDMwMCkge1xuICAgICAgICBpZiAoYmVzdEZpdHRpbmdSZXNwQ29kZSA9PT0gbnVsbCB8fCBiZXN0Rml0dGluZ1Jlc3BDb2RlID4gc3RhdHVzQ29kZSkge1xuICAgICAgICAgIGJlc3RGaXR0aW5nUmVzcCA9IGNhbmRpZGF0ZTtcbiAgICAgICAgICBiZXN0Rml0dGluZ1Jlc3BDb2RlID0gc3RhdHVzQ29kZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ge3N0YXR1c0NvZGU6IGJlc3RGaXR0aW5nUmVzcENvZGUsIHJlc3BvbnNlRGVmaW5pdGlvbjogYmVzdEZpdHRpbmdSZXNwIHx8IHt9fTtcbiAgfVxuXG4gIHByaXZhdGUgZGVmaW5lZDogQmVoYXZpb3JbXSA9IFtdO1xuXG4gIHByaXZhdGUgc3R1YmJlZDogQmVoYXZpb3JbXSA9IFtdO1xuXG4gIHByaXZhdGUgZXhwZWN0ZWQ6IEJlaGF2aW9yW10gPSBbXTtcblxuICBwcml2YXRlIHBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb246IFBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24gPSBudWxsO1xuXG4gIHByaXZhdGUgZ2V0U2NoZW1hKHR5cGU6IHN0cmluZyk6IGFueSB7XG4gICAgaWYgKCF0eXBlKSB7XG4gICAgICByZXR1cm4ge307XG4gICAgfVxuICAgIGlmICh0eXBlb2YgdHlwZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIHJldHVybiB0eXBlO1xuICAgIH1cbiAgICBjb25zdCByYXdTY2hlbWEgPSB0eXBlO1xuICAgIHRyeSB7XG4gICAgICBpZiAodHlwZW9mIEpTT04ucGFyc2UocmF3U2NoZW1hKSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgcmV0dXJuIHJhd1NjaGVtYTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zdCB0eXBlTmFtZSA9IHJhd1NjaGVtYS50cmltKCk7XG4gICAgICBmb3IgKGNvbnN0IHQgaW4gdGhpcy5hcGlbXCJ0eXBlc1wiXSkge1xuICAgICAgICBpZiAodCA9PT0gdHlwZU5hbWUpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5hcGlbXCJ0eXBlc1wiXVt0XTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZmluZFJlcXVlc3RCb2R5U2NoZW1hKG1ldGhvZCk6IGFueSB7XG4gICAgaWYgKG1ldGhvZC5ib2R5ICYmIG1ldGhvZC5ib2R5LnR5cGUpIHtcbiAgICAgIHJldHVybiB0aGlzLmdldFNjaGVtYShtZXRob2QuYm9keS50eXBlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhYnNvbHV0ZVVyaShyZWxhdGl2ZVVyaTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5hcGlbXCJiYXNlVXJpXCJdICsgcmVsYXRpdmVVcmk7XG4gIH1cblxuICBwcml2YXRlIGlzS2V5d29yZChjYW5kaWRhdGU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGZvciAobGV0IGkgaW4gUkFNTEJhY2tlbmRDb25maWcudG9wTGV2ZWxLZXl3b3Jkcykge1xuICAgICAgaWYgKFJBTUxCYWNrZW5kQ29uZmlnLnRvcExldmVsS2V5d29yZHNbaV0gPT09IGNhbmRpZGF0ZSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBhbGxSZXNvdXJjZXMoYXBpOiBhbnkpOiBhbnkge1xuICAgIGNvbnN0IHJ2YWwgPSB7fTtcbiAgICBmb3IgKHZhciBpIGluIGFwaSkge1xuICAgICAgaWYgKCF0aGlzLmlzS2V5d29yZChpKSkge1xuICAgICAgICBydmFsW2ldID0gYXBpW2ldO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcnZhbDtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgYXBpKSB7XG4gICAgY29uc3QgZW50cmllczogQmVoYXZpb3JbXSA9IFtdO1xuICAgIGNvbnN0IGFsbFJlc291cmNlcyA9IHRoaXMuYWxsUmVzb3VyY2VzKHRoaXMuYXBpKTtcbiAgICBmb3IgKGNvbnN0IGkgaW4gYWxsUmVzb3VyY2VzKSB7XG4gICAgICBjb25zdCByZXNvdXJjZSA9IGFsbFJlc291cmNlc1tpXTtcbiAgICAgIGNvbnN0IHJlc291cmNlVXJpID0gdGhpcy5hYnNvbHV0ZVVyaShpKTtcbiAgICAgIGZvciAoY29uc3QgbWV0aG9kTmFtZSBpbiByZXNvdXJjZSkge1xuICAgICAgICBjb25zdCBtZXRob2QgPSByZXNvdXJjZVttZXRob2ROYW1lXTtcbiAgICAgICAgY29uc3Qgc2NoZW1hID0gdGhpcy5maW5kUmVxdWVzdEJvZHlTY2hlbWEobWV0aG9kKTtcblxuICAgICAgICBjb25zdCBwYXR0ZXJuID0gbmV3IFJlcXVlc3RQYXR0ZXJuKHJlc291cmNlVXJpLCBtZXRob2ROYW1lLCBzY2hlbWEsIHRoaXMuYnVpbGRSZXNwb25zZVBhdHRlcm5zKG1ldGhvZC5yZXNwb25zZXMpKTtcbiAgICAgICAgY29uc3Qge3N0YXR1c0NvZGUsIHJlc3BvbnNlRGVmaW5pdGlvbn0gPSBSQU1MQmFja2VuZENvbmZpZy5maW5kQmVzdER1bW15UmVzcG9uc2UobWV0aG9kW1wicmVzcG9uc2VzXCJdKTtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSB0aGlzLmJ1aWxkUmVzcG9uc2VGcm9tRGVmaW5pdGlvbihzdGF0dXNDb2RlLCByZXNwb25zZURlZmluaXRpb24pO1xuICAgICAgICBlbnRyaWVzLnB1c2goe1xuICAgICAgICAgIHJlcXVlc3RQYXR0ZXJuOiBwYXR0ZXJuLFxuICAgICAgICAgIHJlc3BvbnNlOiByZXNwb25zZSxcbiAgICAgICAgICByZXF1ZXN0VmFsaWRhdG9yOiBuZXcgRGVmYXVsdFJlcXVlc3RWYWxpZGF0b3IobWV0aG9kKVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5kZWZpbmVkID0gZW50cmllcztcbiAgfVxuXG4gIHByaXZhdGUgYnVpbGRSZXNwb25zZUZyb21EZWZpbml0aW9uKHN0YXR1c0NvZGUsIHJlc3BvbnNlRGVmaW5pdGlvbiwgZXhhbXBsZUlkZW50aWZpZXI/OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKG5ldyBSZXNwb25zZU9wdGlvbnMoe1xuICAgICAgc3RhdHVzOiBzdGF0dXNDb2RlLFxuICAgICAgYm9keTogdGhpcy5sb29rdXBFeGFtcGxlUmVzcG9uc2VCb2R5KHJlc3BvbnNlRGVmaW5pdGlvbltcImJvZHlcIl0sIGV4YW1wbGVJZGVudGlmaWVyKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyBzdHViQWxsKCk6IFJBTUxCYWNrZW5kQ29uZmlnIHtcbiAgICB0aGlzLmRlZmluZWQuZm9yRWFjaChiZWhhdmlvciA9PiB0aGlzLnN0dWJiZWQucHVzaChiZWhhdmlvcikpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcHJpdmF0ZSBsb29rdXBFeGFtcGxlUmVzcG9uc2VCb2R5KHJlc3BCb2R5RGVmLCBleGFtcGxlSWRlbnRpZmllcj86IHN0cmluZyk6IHN0cmluZyB7XG4gICAgZnVuY3Rpb24gdGhyb3dFcnJvcigpIHtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcImNvdWxkIG5vdCBmaW5kIGV4YW1wbGUgW1wiICsgZXhhbXBsZUlkZW50aWZpZXIgKyBcIl1cIik7XG4gICAgfVxuXG4gICAgaWYgKHJlc3BCb2R5RGVmID09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKGV4YW1wbGVJZGVudGlmaWVyICE9IG51bGwpIHtcbiAgICAgICAgdGhyb3dFcnJvcigpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGV4YW1wbGVEZWZzID0gcmVzcEJvZHlEZWZbXCJleGFtcGxlc1wiXTtcbiAgICBpZiAoZXhhbXBsZUlkZW50aWZpZXIgIT0gbnVsbCkge1xuICAgICAgaWYgKGV4YW1wbGVEZWZzID09IG51bGwgfHwgZXhhbXBsZURlZnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93RXJyb3IoKTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgZXhhbXBsZU5hbWUgaW4gZXhhbXBsZURlZnMpIHtcbiAgICAgICAgaWYgKGV4YW1wbGVOYW1lID09PSBleGFtcGxlSWRlbnRpZmllcikge1xuICAgICAgICAgIHJldHVybiBleGFtcGxlRGVmc1tleGFtcGxlTmFtZV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRocm93RXJyb3IoKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3BCb2R5RGVmW1wiZXhhbXBsZVwiXTtcbiAgfVxuXG4gIHB1YmxpYyBsb29rdXBSZXNwb25zZShzdGF0dXNDb2RlOiBudW1iZXIsIGV4YW1wbGVJZGVudGlmaWVyOiBzdHJpbmcpOiBSZXNwb25zZSB7XG4gICAgY29uc3QgcG9zc2libGVSZXNwb25zZURlZnMgPSB0aGlzLmxvb2t1cFJlc3BvbnNlRGVmc0J5UmVxdWVzdCh0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ucmVxdWVzdCk7XG4gICAgZm9yIChjb25zdCBjb2RlIGluIHBvc3NpYmxlUmVzcG9uc2VEZWZzKSB7XG4gICAgICBpZiAoTnVtYmVyLnBhcnNlSW50KGNvZGUpID09PSBzdGF0dXNDb2RlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJ1aWxkUmVzcG9uc2VGcm9tRGVmaW5pdGlvbihzdGF0dXNDb2RlLCBwb3NzaWJsZVJlc3BvbnNlRGVmc1tjb2RlXSwgZXhhbXBsZUlkZW50aWZpZXIpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJ0aGVyZSBpcyBubyByZXNwb25zZSBkZWZpbmVkIHdpdGggc3RhdHVzIGNvZGUgXCIgKyBzdGF0dXNDb2RlICsgXCIgaW4gdGhlIFJBTUwgZmlsZVwiKTtcbiAgfVxuXG4gIHByaXZhdGUgbG9va3VwUmVzcG9uc2VEZWZzQnlSZXF1ZXN0KHJlcXVlc3Q6IFJlcXVlc3QpOiBhbnkge1xuICAgIGZvciAoY29uc3QgaSBpbiB0aGlzLmFsbFJlc291cmNlcyh0aGlzLmFwaSkpIHtcbiAgICAgIGNvbnN0IHJlcyA9IHRoaXMuYWxsUmVzb3VyY2VzKHRoaXMuYXBpKVtpXTtcbiAgICAgIGxldCBtZXRob2RzID0gT2JqZWN0LmtleXMocmVzKTtcbiAgICAgIGZvciAoY29uc3QgbWV0aG9kTmFtZSBpbiBtZXRob2RzKSB7XG4gICAgICAgIGNvbnN0IG1ldGhvZCA9IG1ldGhvZHNbbWV0aG9kTmFtZV07XG4gICAgICAgIGNvbnN0IHBhdHRlcm4gPSBuZXcgUmVxdWVzdFBhdHRlcm4odGhpcy5hYnNvbHV0ZVVyaShpKSxcbiAgICAgICAgICBtZXRob2QsXG4gICAgICAgICAgdGhpcy5maW5kUmVxdWVzdEJvZHlTY2hlbWEocmVzW21ldGhvZF0pLFxuICAgICAgICAgIHRoaXMuYnVpbGRSZXNwb25zZVBhdHRlcm5zKHJlc1ttZXRob2RdLnJlc3BvbnNlcylcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKHBhdHRlcm4ubWF0Y2hlcyhyZXF1ZXN0KSkge1xuICAgICAgICAgIGNvbnN0IHJ2YWwgPSB7fTtcbiAgICAgICAgICBmb3IgKGxldCBzdGF0dXNDb2RlIGluIHJlc1ttZXRob2RdLnJlc3BvbnNlcykge1xuICAgICAgICAgICAgcnZhbFtzdGF0dXNDb2RlXSA9IHJlc1ttZXRob2RdLnJlc3BvbnNlc1tzdGF0dXNDb2RlXSB8fCB7fTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHJ2YWw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgXCJub3QgZm91bmRcIjtcbiAgfVxuXG4gIHByaXZhdGUgYnVpbGRSZXNwb25zZVBhdHRlcm5zKHJlc3BvbnNlczogYW55KTogUmVzcG9uc2VQYXR0ZXJuW10ge1xuICAgIGNvbnN0IHJ2YWw6IFJlc3BvbnNlUGF0dGVybltdID0gW107XG4gICAgZm9yIChjb25zdCBzdGF0dXNDb2RlIGluIHJlc3BvbnNlcykge1xuICAgICAgaWYgKHJlc3BvbnNlc1tzdGF0dXNDb2RlXSAhPT0gbnVsbCkge1xuICAgICAgICBydmFsLnB1c2gobmV3IFJlc3BvbnNlUGF0dGVybihOdW1iZXIoc3RhdHVzQ29kZSksIHRoaXMuZ2V0U2NoZW1hKChyZXNwb25zZXNbc3RhdHVzQ29kZV0uYm9keSB8fCB7fSkudHlwZSkpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJ2YWw7XG4gIH1cblxuICBwcml2YXRlIG9uU3R1YlJlc3BvbnNlQXZhaWxhYmxlKHJlcXVlc3RQYXR0ZXJuOiBSZXF1ZXN0UGF0dGVybiwgcmVzcG9uc2U6IFJlc3BvbnNlKSB7XG4gICAgY29uc3QgcmVzcFBhdHRlcm46IFJlc3BvbnNlUGF0dGVybiA9IHJlcXVlc3RQYXR0ZXJuLmZpbmRSZXNwb25zZVBhdHRlcm5CeVN0YXR1c0NvZGUocmVzcG9uc2Uuc3RhdHVzKTtcbiAgICBpZiAocmVzcFBhdHRlcm4gIT09IG51bGwpIHtcbiAgICAgIGlmICghcmVzcFBhdHRlcm4ubWF0Y2hlcyhyZXNwb25zZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwiaW52YWxpZCBzdHViIHJlc3BvbnNlIGJvZHlcIik7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuc3R1YmJlZC51bnNoaWZ0KHtcbiAgICAgIHJlc3BvbnNlOiByZXNwb25zZSxcbiAgICAgIHJlcXVlc3RQYXR0ZXJuOiByZXF1ZXN0UGF0dGVybixcbiAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IG5ldyBOb29wUmVxdWVzdFZhbGlkYXRvcigpXG4gICAgfSk7XG4gICAgdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uID0gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgb25Nb2NrUmVzcG9uc2VBdmFpbGFibGUoYmVoYXZpb3I6IEJlaGF2aW9yKSB7XG4gICAgdGhpcy5leHBlY3RlZC5wdXNoKGJlaGF2aW9yKTtcbiAgICB0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24gPSBudWxsO1xuICB9XG5cbiAgcHVibGljIHdoZW5HRVQodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwiZ2V0XCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuSEVBRCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJoZWFkXCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuUE9TVCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJwb3N0XCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuUFVUKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcInB1dFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlbkRFTEVURSh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJkZWxldGVcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5QQVRDSCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJwYXRjaFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlbk9QVElPTlModXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwib3B0aW9uc1wiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwcml2YXRlIG1hcmtSZXF1ZXN0QXNQZW5kaW5nKHJlcTogUmVxdWVzdCwgYmVoYXZpb3I6IEJlaGF2aW9yKSB7XG4gICAgaWYgKHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgcGVuZGluZ1JlcURlc2NyID0gUmVxdWVzdE1ldGhvZFt0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ucmVxdWVzdC5tZXRob2RdLnRvVXBwZXJDYXNlKClcbiAgICAgICAgKyBcIiBcIiArIHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbi5yZXF1ZXN0LnVybDtcbiAgICAgIGNvbnN0IHJlcURlc2NyID0gUmVxdWVzdE1ldGhvZFtyZXEubWV0aG9kXS50b1VwcGVyQ2FzZSgpICsgXCIgXCIgKyByZXEudXJsO1xuICAgICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwidW5maW5pc2hlZCBiZWhhdmlvciBkZWZpbml0aW9uOiBjYW5ub3QgY29uZmlndXJlIFwiXG4gICAgICAgICsgcmVxRGVzY3IgKyBcIiBiZWZvcmUgc2V0dGluZyB0aGUgcmVzcG9uc2UgZm9yIFwiICsgcGVuZGluZ1JlcURlc2NyKTtcbiAgICB9XG4gICAgdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uID0ge1xuICAgICAgcmVxdWVzdDogcmVxLFxuICAgICAgcHJlbWF0Y2hlZEJlaGF2aW9yOiBiZWhhdmlvclxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIHJlbGF0aXZlUGF0aChhYnNvbHV0ZVVyaTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCB1cmwgPSBuZXcgVVJMKGFic29sdXRlVXJpKTtcbiAgICByZXR1cm4gdXJsLnBhdGhuYW1lICsgdXJsLnF1ZXJ5ICsgdXJsLmhhc2g7XG4gIH1cblxuICBwdWJsaWMgd2hlblJlcXVlc3RJcyhyZXF1ZXN0OiBSZXF1ZXN0KTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIGNvbnN0IHBhdGggPSB0aGlzLnJlbGF0aXZlUGF0aChyZXF1ZXN0LnVybCksIG1ldGhvZCA9IFJlcXVlc3RNZXRob2RbcmVxdWVzdC5tZXRob2RdO1xuXG4gICAgbGV0IHZhbGlkYXRpb25FcnJvcjtcbiAgICBmb3IgKGNvbnN0IGkgaW4gdGhpcy5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBiZWhhdmlvciA9IHRoaXMuZGVmaW5lZFtpXTtcbiAgICAgIGlmIChiZWhhdmlvci5yZXF1ZXN0UGF0dGVybi5tYXRjaGVzKHJlcXVlc3QpKSB7XG4gICAgICAgIHRoaXMubWFya1JlcXVlc3RBc1BlbmRpbmcocmVxdWVzdCwgYmVoYXZpb3IpO1xuICAgICAgICBpZiAoKHZhbGlkYXRpb25FcnJvciA9IGJlaGF2aW9yLnJlcXVlc3RWYWxpZGF0b3IubWF0Y2hlcyhyZXF1ZXN0KSkgPT09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gbmV3IFJlc3BvbnNlU2V0dGVyKHRoaXMsIHJlc3BvbnNlID0+IHRoaXMub25TdHViUmVzcG9uc2VBdmFpbGFibGUoXG4gICAgICAgICAgICBuZXcgUmVxdWVzdFBhdHRlcm4ocGF0aCwgbWV0aG9kLCBudWxsLCBiZWhhdmlvci5yZXF1ZXN0UGF0dGVybi5yZXNwb25zZVBhdHRlcm5zKSwgcmVzcG9uc2UpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IodmFsaWRhdGlvbkVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJmb3VuZCBubyBkZWNsYXJhdGlvbiBvZiByZXF1ZXN0IFtcIiArIG1ldGhvZC50b1VwcGVyQ2FzZSgpXG4gICAgICArIFwiIFwiICsgcGF0aCArIFwiXSBpbiBSQU1MIC0gcmVmdXNpbmcgdG8gc3R1YlwiKTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVCYWNrZW5kKCk6IFJBTUxCYWNrZW5kIHtcbiAgICByZXR1cm4gbmV3IFJBTUxCYWNrZW5kKHRoaXMuc3R1YmJlZCwgdGhpcy5leHBlY3RlZCk7XG4gIH1cblxufVxuIl19
