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
var URL = require("url-parse");
var RAMLLoader_1 = require("./RAMLLoader");
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL1JBTUxCYWNrZW5kQ29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBLDZDQUFtSDtBQUNuSCxzQ0FBZ0Y7QUFDaEYsK0JBQWtDO0FBQ2xDLDJDQUE0QztBQUU1QztJQUEwQyx3Q0FBSztJQUEvQzs7SUFFQSxDQUFDO0lBQUQsMkJBQUM7QUFBRCxDQUZBLEFBRUMsQ0FGeUMsS0FBSyxHQUU5QztBQUZZLG9EQUFvQjtBQUlqQztJQUVFLHdCQUFvQixLQUF3QixFQUN4QixPQUFxQztRQURyQyxVQUFLLEdBQUwsS0FBSyxDQUFtQjtRQUN4QixZQUFPLEdBQVAsT0FBTyxDQUE4QjtJQUN6RCxDQUFDO0lBRU0sb0NBQVcsR0FBbEIsVUFBbUIsUUFBa0I7UUFDbkMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN2QixNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztJQUNwQixDQUFDO0lBRU0sd0NBQWUsR0FBdEIsVUFBdUIsVUFBa0IsRUFBRSxpQkFBMEI7UUFDbkUsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsVUFBVSxFQUFFLGlCQUFpQixDQUFDLENBQUM7UUFDMUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN2QixNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztJQUNwQixDQUFDO0lBRUgscUJBQUM7QUFBRCxDQWpCQSxBQWlCQyxJQUFBO0FBakJZLHdDQUFjO0FBNkIzQjtJQTJFRSwyQkFBb0IsR0FBRztRQUFILFFBQUcsR0FBSCxHQUFHLENBQUE7UUFqRGYsWUFBTyxHQUFlLEVBQUUsQ0FBQztRQUV6QixZQUFPLEdBQWUsRUFBRSxDQUFDO1FBRXpCLGFBQVEsR0FBZSxFQUFFLENBQUM7UUFFMUIsaUNBQTRCLEdBQWlDLElBQUksQ0FBQztRQTRDeEUsSUFBTSxPQUFPLEdBQWUsRUFBRSxDQUFDO1FBQy9CLElBQU0sWUFB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TyxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO29CQUM1RSxNQUFNLENBQUMsSUFBSSxjQUFjLENBQUMsSUFBSSxFQUFFLFVBQUEsUUFBUSxJQUFJLE9BQUEsS0FBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksNEJBQWMsQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxFQUFFLFFBQVEsQ0FBQyxFQUE5RSxDQUE4RSxDQUFDLENBQUM7Z0JBQzlILENBQUM7Z0JBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ04sTUFBTSxJQUFJLG9CQUFvQixDQUFDLGVBQWUsQ0FBQyxDQUFDO2dCQUNsRCxDQUFDO1lBQ0gsQ0FBQztRQUNILENBQUM7UUFDRCxNQUFNLElBQUksb0JBQW9CLENBQUMsbUNBQW1DLEdBQUcsTUFBTSxDQUFDLFdBQVcsRUFBRTtjQUNyRixHQUFHLEdBQUcsSUFBSSxHQUFHLDhCQUE4QixDQUFDLENBQUM7SUFDbkQsQ0FBQztJQUVNLHlDQUFhLEdBQXBCO1FBQ0UsTUFBTSxDQUFDLElBQUkseUJBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUN0RCxDQUFDO0lBRUgsd0JBQUM7QUFBRCxDQS9RQSxBQStRQztBQTdRUSxrQ0FBZ0IsR0FBYSxDQUFDLE9BQU8sRUFBRSxTQUFTLEVBQUUsU0FBUztJQUNoRSxXQUFXLEVBQUUsT0FBTyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0FBSDFCLDhDQUFpQiIsImZpbGUiOiJSQU1MQmFja2VuZENvbmZpZy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7QmVoYXZpb3IsIERlZmF1bHRSZXF1ZXN0VmFsaWRhdG9yLCBOb29wUmVxdWVzdFZhbGlkYXRvciwgUkFNTEJhY2tlbmQsIFJlcXVlc3RQYXR0ZXJufSBmcm9tIFwiLi9SQU1MQmFja2VuZFwiO1xuaW1wb3J0IHtSZXF1ZXN0LCBSZXF1ZXN0TWV0aG9kLCBSZXNwb25zZSwgUmVzcG9uc2VPcHRpb25zfSBmcm9tIFwiQGFuZ3VsYXIvaHR0cFwiO1xuaW1wb3J0IFVSTCA9IHJlcXVpcmUoXCJ1cmwtcGFyc2VcIik7XG5pbXBvcnQge1lBTUxGaWxlTG9hZGVyfSBmcm9tIFwiLi9SQU1MTG9hZGVyXCI7XG5cbmV4cG9ydCBjbGFzcyBJbnZhbGlkU3R1YmJpbmdFcnJvciBleHRlbmRzIEVycm9yIHtcblxufVxuXG5leHBvcnQgY2xhc3MgUmVzcG9uc2VTZXR0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgb3duZXI6IFJBTUxCYWNrZW5kQ29uZmlnLFxuICAgICAgICAgICAgICBwcml2YXRlIG9uUmVhZHk6IChyZXNwb25zZTogUmVzcG9uc2UpID0+IHZvaWQpIHtcbiAgfVxuXG4gIHB1YmxpYyB0aGVuUmVzcG9uZChyZXNwb25zZTogUmVzcG9uc2UpOiBSQU1MQmFja2VuZENvbmZpZyB7XG4gICAgdGhpcy5vblJlYWR5KHJlc3BvbnNlKTtcbiAgICByZXR1cm4gdGhpcy5vd25lcjtcbiAgfVxuXG4gIHB1YmxpYyB0aGVuUmVzcG9uZFdpdGgoc3RhdHVzQ29kZTogbnVtYmVyLCBleGFtcGxlSWRlbnRpZmllcj86IHN0cmluZyk6IFJBTUxCYWNrZW5kQ29uZmlnIHtcbiAgICBjb25zdCByZXNwb25zZSA9IHRoaXMub3duZXIubG9va3VwUmVzcG9uc2Uoc3RhdHVzQ29kZSwgZXhhbXBsZUlkZW50aWZpZXIpO1xuICAgIHRoaXMub25SZWFkeShyZXNwb25zZSk7XG4gICAgcmV0dXJuIHRoaXMub3duZXI7XG4gIH1cblxufVxuXG5pbnRlcmZhY2UgUGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiB7XG5cbiAgcHJlbWF0Y2hlZEJlaGF2aW9yOiBCZWhhdmlvcjtcblxuICByZXF1ZXN0OiBSZXF1ZXN0O1xuXG4gIC8vIHJlc3BvbnNlUGF0dGVybkNhbmRpZGF0ZXM6IE1ldGhvZFtdO1xuXG59XG5cbmV4cG9ydCBjbGFzcyBSQU1MQmFja2VuZENvbmZpZyB7XG5cbiAgc3RhdGljIHRvcExldmVsS2V5d29yZHM6IHN0cmluZ1tdID0gW1widGl0bGVcIiwgXCJ2ZXJzaW9uXCIsIFwiYmFzZVVyaVwiLFxuICAgIFwibWVkaWFUeXBlXCIsIFwidHlwZXNcIiwgXCJzZWN1cmVkQnlcIl07XG5cblxuICBzdGF0aWMgaW5pdFdpdGhGaWxlKHBhdGhUb1JBTUxGaWxlOiBzdHJpbmcpOiBSQU1MQmFja2VuZENvbmZpZyB7XG4gICAgY29uc3QgYXBpID0gbmV3IFlBTUxGaWxlTG9hZGVyKHBhdGhUb1JBTUxGaWxlKS5sb2FkRmlsZSgpO1xuICAgIHJldHVybiBuZXcgUkFNTEJhY2tlbmRDb25maWcoYXBpKTtcbiAgfVxuXG4gIHByaXZhdGUgc3RhdGljIGZpbmRCZXN0RHVtbXlSZXNwb25zZShyZXNwb25zZXMpOiB7IHN0YXR1c0NvZGU6IG51bWJlciwgcmVzcG9uc2VEZWZpbml0aW9uOiBhbnkgfSB7XG4gICAgbGV0IGJlc3RGaXR0aW5nUmVzcCA9IG51bGwsIGJlc3RGaXR0aW5nUmVzcENvZGUgPSBudWxsO1xuICAgIGZvciAoY29uc3QgY29kZSBpbiByZXNwb25zZXMpIHtcbiAgICAgIGNvbnN0IGNhbmRpZGF0ZSA9IHJlc3BvbnNlc1tjb2RlXTtcbiAgICAgIGNvbnN0IHN0YXR1c0NvZGUgPSBOdW1iZXIucGFyc2VJbnQoY29kZSk7XG4gICAgICBpZiAoMjAwIDw9IHN0YXR1c0NvZGUgJiYgc3RhdHVzQ29kZSA8IDMwMCkge1xuICAgICAgICBpZiAoYmVzdEZpdHRpbmdSZXNwQ29kZSA9PT0gbnVsbCB8fCBiZXN0Rml0dGluZ1Jlc3BDb2RlID4gc3RhdHVzQ29kZSkge1xuICAgICAgICAgIGJlc3RGaXR0aW5nUmVzcCA9IGNhbmRpZGF0ZTtcbiAgICAgICAgICBiZXN0Rml0dGluZ1Jlc3BDb2RlID0gc3RhdHVzQ29kZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ge3N0YXR1c0NvZGU6IGJlc3RGaXR0aW5nUmVzcENvZGUsIHJlc3BvbnNlRGVmaW5pdGlvbjogYmVzdEZpdHRpbmdSZXNwIHx8IHt9fTtcbiAgfVxuXG4gIHByaXZhdGUgZGVmaW5lZDogQmVoYXZpb3JbXSA9IFtdO1xuXG4gIHByaXZhdGUgc3R1YmJlZDogQmVoYXZpb3JbXSA9IFtdO1xuXG4gIHByaXZhdGUgZXhwZWN0ZWQ6IEJlaGF2aW9yW10gPSBbXTtcblxuICBwcml2YXRlIHBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb246IFBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24gPSBudWxsO1xuXG4gIHByaXZhdGUgZmluZFJlcXVlc3RCb2R5U2NoZW1hKG1ldGhvZCk6IGFueSB7XG4gICAgaWYgKG1ldGhvZFtcImJvZHlcIl0gJiYgbWV0aG9kW1wiYm9keVwiXVtcInR5cGVcIl0pIHtcbiAgICAgIGNvbnN0IHJhd1NjaGVtYSA9IG1ldGhvZFtcImJvZHlcIl1bXCJ0eXBlXCJdO1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIHJhd1NjaGVtYTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc3QgdHlwZU5hbWUgPSByYXdTY2hlbWEudHJpbSgpO1xuICAgICAgICBmb3IgKGNvbnN0IHQgaW4gdGhpcy5hcGlbXCJ0eXBlc1wiXSkge1xuICAgICAgICAgIGlmICh0ID09PSB0eXBlTmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UodGhpcy5hcGlbXCJ0eXBlc1wiXVt0XS50b1N0cmluZygpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhYnNvbHV0ZVVyaShyZWxhdGl2ZVVyaTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5hcGlbXCJiYXNlVXJpXCJdICsgcmVsYXRpdmVVcmk7XG4gIH1cblxuICBwcml2YXRlIGlzS2V5d29yZChjYW5kaWRhdGU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGZvciAobGV0IGkgaW4gUkFNTEJhY2tlbmRDb25maWcudG9wTGV2ZWxLZXl3b3Jkcykge1xuICAgICAgaWYgKFJBTUxCYWNrZW5kQ29uZmlnLnRvcExldmVsS2V5d29yZHNbaV0gPT09IGNhbmRpZGF0ZSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBhbGxSZXNvdXJjZXMoYXBpOiBhbnkpOiBhbnkge1xuICAgIGNvbnN0IHJ2YWwgPSB7fTtcbiAgICBmb3IgKHZhciBpIGluIGFwaSkge1xuICAgICAgaWYgKCF0aGlzLmlzS2V5d29yZChpKSkge1xuICAgICAgICBydmFsW2ldID0gYXBpW2ldO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcnZhbDtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgYXBpKSB7XG4gICAgY29uc3QgZW50cmllczogQmVoYXZpb3JbXSA9IFtdO1xuICAgIGNvbnN0IGFsbFJlc291cmNlcyA9IHRoaXMuYWxsUmVzb3VyY2VzKHRoaXMuYXBpKTtcbiAgICBmb3IgKGNvbnN0IGkgaW4gYWxsUmVzb3VyY2VzKSB7XG4gICAgICBjb25zdCByZXNvdXJjZSA9IGFsbFJlc291cmNlc1tpXTtcbiAgICAgIGNvbnN0IHJlc291cmNlVXJpID0gdGhpcy5hYnNvbHV0ZVVyaShpKTtcbiAgICAgIGZvciAoY29uc3QgbWV0aG9kTmFtZSBpbiByZXNvdXJjZSkge1xuICAgICAgICBjb25zdCBtZXRob2QgPSByZXNvdXJjZVttZXRob2ROYW1lXTtcbiAgICAgICAgY29uc3Qgc2NoZW1hID0gdGhpcy5maW5kUmVxdWVzdEJvZHlTY2hlbWEobWV0aG9kKTtcblxuICAgICAgICBjb25zdCBwYXR0ZXJuID0gbmV3IFJlcXVlc3RQYXR0ZXJuKHJlc291cmNlVXJpLCBtZXRob2ROYW1lLCBzY2hlbWEpO1xuICAgICAgICBjb25zdCB7c3RhdHVzQ29kZSwgcmVzcG9uc2VEZWZpbml0aW9ufSA9IFJBTUxCYWNrZW5kQ29uZmlnLmZpbmRCZXN0RHVtbXlSZXNwb25zZShtZXRob2RbXCJyZXNwb25zZXNcIl0pO1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IHRoaXMuYnVpbGRSZXNwb25zZUZyb21EZWZpbml0aW9uKHN0YXR1c0NvZGUsIHJlc3BvbnNlRGVmaW5pdGlvbik7XG4gICAgICAgIGVudHJpZXMucHVzaCh7XG4gICAgICAgICAgcmVxdWVzdFBhdHRlcm46IHBhdHRlcm4sXG4gICAgICAgICAgcmVzcG9uc2U6IHJlc3BvbnNlLFxuICAgICAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IG5ldyBEZWZhdWx0UmVxdWVzdFZhbGlkYXRvcihtZXRob2QpXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmRlZmluZWQgPSBlbnRyaWVzO1xuICB9XG5cbiAgcHJpdmF0ZSBidWlsZFJlc3BvbnNlRnJvbURlZmluaXRpb24oc3RhdHVzQ29kZSwgcmVzcG9uc2VEZWZpbml0aW9uLCBleGFtcGxlSWRlbnRpZmllcj86IHN0cmluZykge1xuICAgIHJldHVybiBuZXcgUmVzcG9uc2UobmV3IFJlc3BvbnNlT3B0aW9ucyh7XG4gICAgICBzdGF0dXM6IHN0YXR1c0NvZGUsXG4gICAgICBib2R5OiB0aGlzLmxvb2t1cEV4YW1wbGVSZXNwb25zZUJvZHkocmVzcG9uc2VEZWZpbml0aW9uW1wiYm9keVwiXSwgZXhhbXBsZUlkZW50aWZpZXIpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHN0dWJBbGwoKTogUkFNTEJhY2tlbmRDb25maWcge1xuICAgIHRoaXMuZGVmaW5lZC5mb3JFYWNoKGJlaGF2aW9yID0+IHRoaXMuc3R1YmJlZC5wdXNoKGJlaGF2aW9yKSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBwcml2YXRlIGxvb2t1cEV4YW1wbGVSZXNwb25zZUJvZHkocmVzcEJvZHlEZWYsIGV4YW1wbGVJZGVudGlmaWVyPzogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBmdW5jdGlvbiB0aHJvd0Vycm9yKCkge1xuICAgICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwiY291bGQgbm90IGZpbmQgZXhhbXBsZSBbXCIgKyBleGFtcGxlSWRlbnRpZmllciArIFwiXVwiKTtcbiAgICB9XG5cbiAgICBpZiAocmVzcEJvZHlEZWYgPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAoZXhhbXBsZUlkZW50aWZpZXIgIT0gbnVsbCkge1xuICAgICAgICB0aHJvd0Vycm9yKCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgZXhhbXBsZURlZnMgPSByZXNwQm9keURlZltcImV4YW1wbGVzXCJdO1xuICAgIGlmIChleGFtcGxlSWRlbnRpZmllciAhPSBudWxsKSB7XG4gICAgICBpZiAoZXhhbXBsZURlZnMgPT0gbnVsbCB8fCBleGFtcGxlRGVmcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3dFcnJvcigpO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBleGFtcGxlTmFtZSBpbiBleGFtcGxlRGVmcykge1xuICAgICAgICBpZiAoZXhhbXBsZU5hbWUgPT09IGV4YW1wbGVJZGVudGlmaWVyKSB7XG4gICAgICAgICAgcmV0dXJuIGV4YW1wbGVEZWZzW2V4YW1wbGVOYW1lXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhyb3dFcnJvcigpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzcEJvZHlEZWZbXCJleGFtcGxlXCJdO1xuICB9XG5cbiAgcHVibGljIGxvb2t1cFJlc3BvbnNlKHN0YXR1c0NvZGU6IG51bWJlciwgZXhhbXBsZUlkZW50aWZpZXI6IHN0cmluZyk6IFJlc3BvbnNlIHtcbiAgICBjb25zdCBwb3NzaWJsZVJlc3BvbnNlRGVmcyA9IHRoaXMubG9va3VwUmVzcG9uc2VEZWZzQnlSZXF1ZXN0KHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbi5yZXF1ZXN0KTtcbiAgICBmb3IgKGNvbnN0IGNvZGUgaW4gcG9zc2libGVSZXNwb25zZURlZnMpIHtcbiAgICAgIGlmIChOdW1iZXIucGFyc2VJbnQoY29kZSkgPT09IHN0YXR1c0NvZGUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYnVpbGRSZXNwb25zZUZyb21EZWZpbml0aW9uKHN0YXR1c0NvZGUsIHBvc3NpYmxlUmVzcG9uc2VEZWZzW2NvZGVdLCBleGFtcGxlSWRlbnRpZmllcik7XG4gICAgICB9XG4gICAgfVxuICAgIHRocm93IG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcInRoZXJlIGlzIG5vIHJlc3BvbnNlIGRlZmluZWQgd2l0aCBzdGF0dXMgY29kZSBcIiArIHN0YXR1c0NvZGUgKyBcIiBpbiB0aGUgUkFNTCBmaWxlXCIpO1xuICB9XG5cbiAgcHJpdmF0ZSBsb29rdXBSZXNwb25zZURlZnNCeVJlcXVlc3QocmVxdWVzdDogUmVxdWVzdCk6IGFueSB7XG4gICAgZm9yIChjb25zdCBpIGluIHRoaXMuYWxsUmVzb3VyY2VzKHRoaXMuYXBpKSkge1xuICAgICAgY29uc3QgcmVzID0gdGhpcy5hbGxSZXNvdXJjZXModGhpcy5hcGkpW2ldO1xuICAgICAgbGV0IG1ldGhvZHMgPSBPYmplY3Qua2V5cyhyZXMpO1xuICAgICAgZm9yIChjb25zdCBtZXRob2ROYW1lIGluIG1ldGhvZHMpIHtcbiAgICAgICAgY29uc3QgbWV0aG9kID0gbWV0aG9kc1ttZXRob2ROYW1lXTtcbiAgICAgICAgY29uc3QgcGF0dGVybiA9IG5ldyBSZXF1ZXN0UGF0dGVybih0aGlzLmFic29sdXRlVXJpKGkpLCBtZXRob2QsIHRoaXMuZmluZFJlcXVlc3RCb2R5U2NoZW1hKHJlc1ttZXRob2RdKSk7XG4gICAgICAgIGlmIChwYXR0ZXJuLm1hdGNoZXMocmVxdWVzdCkpIHtcbiAgICAgICAgICBjb25zdCBydmFsID0ge307XG4gICAgICAgICAgZm9yIChsZXQgc3RhdHVzQ29kZSBpbiByZXNbbWV0aG9kXS5yZXNwb25zZXMpIHtcbiAgICAgICAgICAgIHJ2YWxbc3RhdHVzQ29kZV0gPSByZXNbbWV0aG9kXS5yZXNwb25zZXNbc3RhdHVzQ29kZV0gfHwge307XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBydmFsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRocm93IFwibm90IGZvdW5kXCI7XG4gIH1cblxuICBwcml2YXRlIG9uU3R1YlJlc3BvbnNlQXZhaWxhYmxlKHJlcXVlc3RQYXR0ZXJuOiBSZXF1ZXN0UGF0dGVybiwgcmVzcG9uc2U6IFJlc3BvbnNlKSB7XG4gICAgLy8gdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uLnByZW1hdGNoZWRCZWhhdmlvci47XG4gICAgdGhpcy5zdHViYmVkLnVuc2hpZnQoe1xuICAgICAgcmVzcG9uc2U6IHJlc3BvbnNlLFxuICAgICAgcmVxdWVzdFBhdHRlcm46IHJlcXVlc3RQYXR0ZXJuLFxuICAgICAgcmVxdWVzdFZhbGlkYXRvcjogbmV3IE5vb3BSZXF1ZXN0VmFsaWRhdG9yKClcbiAgICB9KTtcbiAgICB0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24gPSBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBvbk1vY2tSZXNwb25zZUF2YWlsYWJsZShiZWhhdmlvcjogQmVoYXZpb3IpIHtcbiAgICB0aGlzLmV4cGVjdGVkLnB1c2goYmVoYXZpb3IpO1xuICAgIHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiA9IG51bGw7XG4gIH1cblxuICBwdWJsaWMgd2hlbkdFVCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJnZXRcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5IRUFEKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcImhlYWRcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5QT1NUKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcInBvc3RcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5QVVQodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwicHV0XCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuREVMRVRFKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcImRlbGV0ZVwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlblBBVENIKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcInBhdGNoXCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuT1BUSU9OUyh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJvcHRpb25zXCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHByaXZhdGUgbWFya1JlcXVlc3RBc1BlbmRpbmcocmVxOiBSZXF1ZXN0LCBiZWhhdmlvcjogQmVoYXZpb3IpIHtcbiAgICBpZiAodGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBwZW5kaW5nUmVxRGVzY3IgPSBSZXF1ZXN0TWV0aG9kW3RoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbi5yZXF1ZXN0Lm1ldGhvZF0udG9VcHBlckNhc2UoKVxuICAgICAgICArIFwiIFwiICsgdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uLnJlcXVlc3QudXJsO1xuICAgICAgY29uc3QgcmVxRGVzY3IgPSBSZXF1ZXN0TWV0aG9kW3JlcS5tZXRob2RdLnRvVXBwZXJDYXNlKCkgKyBcIiBcIiArIHJlcS51cmw7XG4gICAgICB0aHJvdyBuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJ1bmZpbmlzaGVkIGJlaGF2aW9yIGRlZmluaXRpb246IGNhbm5vdCBjb25maWd1cmUgXCJcbiAgICAgICAgKyByZXFEZXNjciArIFwiIGJlZm9yZSBzZXR0aW5nIHRoZSByZXNwb25zZSBmb3IgXCIgKyBwZW5kaW5nUmVxRGVzY3IpO1xuICAgIH1cbiAgICB0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24gPSB7XG4gICAgICByZXF1ZXN0OiByZXEsXG4gICAgICBwcmVtYXRjaGVkQmVoYXZpb3I6IGJlaGF2aW9yXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgcmVsYXRpdmVQYXRoKGFic29sdXRlVXJpOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHVybCA9IG5ldyBVUkwoYWJzb2x1dGVVcmkpO1xuICAgIHJldHVybiB1cmwucGF0aG5hbWUgKyB1cmwucXVlcnkgKyB1cmwuaGFzaDtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuUmVxdWVzdElzKHJlcXVlc3Q6IFJlcXVlc3QpOiBSZXNwb25zZVNldHRlciB7XG4gICAgY29uc3QgcGF0aCA9IHRoaXMucmVsYXRpdmVQYXRoKHJlcXVlc3QudXJsKSwgbWV0aG9kID0gUmVxdWVzdE1ldGhvZFtyZXF1ZXN0Lm1ldGhvZF07XG5cbiAgICBsZXQgdmFsaWRhdGlvbkVycm9yO1xuICAgIGZvciAoY29uc3QgaSBpbiB0aGlzLmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IGJlaGF2aW9yID0gdGhpcy5kZWZpbmVkW2ldO1xuICAgICAgaWYgKGJlaGF2aW9yLnJlcXVlc3RQYXR0ZXJuLm1hdGNoZXMocmVxdWVzdCkpIHtcbiAgICAgICAgdGhpcy5tYXJrUmVxdWVzdEFzUGVuZGluZyhyZXF1ZXN0LCBiZWhhdmlvcik7XG4gICAgICAgIGlmICgodmFsaWRhdGlvbkVycm9yID0gYmVoYXZpb3IucmVxdWVzdFZhbGlkYXRvci5tYXRjaGVzKHJlcXVlc3QpKSA9PT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiBuZXcgUmVzcG9uc2VTZXR0ZXIodGhpcywgcmVzcG9uc2UgPT4gdGhpcy5vblN0dWJSZXNwb25zZUF2YWlsYWJsZShuZXcgUmVxdWVzdFBhdHRlcm4ocGF0aCwgbWV0aG9kLCBudWxsKSwgcmVzcG9uc2UpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IodmFsaWRhdGlvbkVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJmb3VuZCBubyBkZWNsYXJhdGlvbiBvZiByZXF1ZXN0IFtcIiArIG1ldGhvZC50b1VwcGVyQ2FzZSgpXG4gICAgICArIFwiIFwiICsgcGF0aCArIFwiXSBpbiBSQU1MIC0gcmVmdXNpbmcgdG8gc3R1YlwiKTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVCYWNrZW5kKCk6IFJBTUxCYWNrZW5kIHtcbiAgICByZXR1cm4gbmV3IFJBTUxCYWNrZW5kKHRoaXMuc3R1YmJlZCwgdGhpcy5leHBlY3RlZCk7XG4gIH1cblxufVxuIl19
