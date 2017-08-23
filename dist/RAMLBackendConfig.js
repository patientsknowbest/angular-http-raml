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
            var api = js_yaml_1.safeLoad(request.responseText);
            console.log(pathToRAMLFile, api);
            return new RAMLBackendConfig(api);
        }
        throw new Error("failed to GET " + pathToRAMLFile + ": " + request.status);
    };
    RAMLBackendConfig.findBestDummyResponse = function (responses) {
        var bestFittingResp = null;
        console.log("looking for responses: ", Object.keys(responses));
        for (var i in responses) {
            var candidate = responses[i];
            var statusCode = Number.parseInt(candidate.code().value());
            if (200 <= statusCode && statusCode < 300) {
                if (bestFittingResp === null) {
                    bestFittingResp = candidate;
                }
                else if (Number.parseInt(bestFittingResp.code().value()) > statusCode) {
                    bestFittingResp = candidate;
                }
            }
        }
        return bestFittingResp;
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
            body: this.lookupExampleResponseBody(responseDefinition.body()[0], exampleIdentifier)
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
        if (respBodyDef === undefined) {
            if (exampleIdentifier != null) {
                throwError();
            }
            return null;
        }
        var exampleDefs = respBodyDef.examples();
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
        if (respBodyDef.example() === null) {
            return exampleDefs[0].value();
        }
        else {
            return respBodyDef.example().value();
        }
    };
    RAMLBackendConfig.prototype.lookupResponse = function (statusCode, exampleIdentifier) {
        var possibleResponseDefs = this.lookupResponseDefsByRequest(this.pendingBehaviorSpecification.request);
        for (var i in possibleResponseDefs) {
            if (Number.parseInt(possibleResponseDefs[i].code().value()) === statusCode) {
                return this.buildResponseFromDefinition(possibleResponseDefs[i], exampleIdentifier);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUUsUUFBUSxDQUFDLEVBQTlFLENBQThFLENBQUMsQ0FBQztnQkFDOUgsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDTixNQUFNLElBQUksb0JBQW9CLENBQUMsZUFBZSxDQUFDLENBQUM7Z0JBQ2xELENBQUM7WUFDSCxDQUFDO1FBQ0gsQ0FBQztRQUNELE1BQU0sSUFBSSxvQkFBb0IsQ0FBQyxtQ0FBbUMsR0FBRyxNQUFNLENBQUMsV0FBVyxFQUFFO2NBQ3JGLEdBQUcsR0FBRyxJQUFJLEdBQUcsOEJBQThCLENBQUMsQ0FBQztJQUNuRCxDQUFDO0lBRU0seUNBQWEsR0FBcEI7UUFDRSxNQUFNLENBQUMsSUFBSSx5QkFBVyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUF6Uk0sa0NBQWdCLEdBQWEsQ0FBQyxPQUFPLEVBQUUsU0FBUyxFQUFFLFNBQVM7UUFDbEUsV0FBVyxFQUFFLE9BQU8sRUFBRSxXQUFXLENBQUMsQ0FBQztJQTBSckMsd0JBQUM7Q0E3UkQsQUE2UkMsSUFBQTtBQTdSWSw4Q0FBaUIiLCJmaWxlIjoiUkFNTEJhY2tlbmRDb25maWcuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge0JlaGF2aW9yLCBEZWZhdWx0UmVxdWVzdFZhbGlkYXRvciwgTm9vcFJlcXVlc3RWYWxpZGF0b3IsIFJBTUxCYWNrZW5kLCBSZXF1ZXN0UGF0dGVybn0gZnJvbSBcIi4vUkFNTEJhY2tlbmRcIjtcbmltcG9ydCB7c2FmZUxvYWR9IGZyb20gXCJqcy15YW1sXCI7XG5pbXBvcnQge1JlcXVlc3QsIFJlcXVlc3RNZXRob2QsIFJlc3BvbnNlLCBSZXNwb25zZU9wdGlvbnN9IGZyb20gXCJAYW5ndWxhci9odHRwXCI7XG5pbXBvcnQgVVJMID0gcmVxdWlyZShcInVybC1wYXJzZVwiKTtcblxuZXhwb3J0IGNsYXNzIEludmFsaWRTdHViYmluZ0Vycm9yIGV4dGVuZHMgRXJyb3Ige1xuXG59XG5cbmV4cG9ydCBjbGFzcyBSZXNwb25zZVNldHRlciB7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBvd25lcjogUkFNTEJhY2tlbmRDb25maWcsXG4gICAgICAgICAgICAgIHByaXZhdGUgb25SZWFkeTogKHJlc3BvbnNlOiBSZXNwb25zZSkgPT4gdm9pZCkge1xuICB9XG5cbiAgcHVibGljIHRoZW5SZXNwb25kKHJlc3BvbnNlOiBSZXNwb25zZSk6IFJBTUxCYWNrZW5kQ29uZmlnIHtcbiAgICB0aGlzLm9uUmVhZHkocmVzcG9uc2UpO1xuICAgIHJldHVybiB0aGlzLm93bmVyO1xuICB9XG5cbiAgcHVibGljIHRoZW5SZXNwb25kV2l0aChzdGF0dXNDb2RlOiBudW1iZXIsIGV4YW1wbGVJZGVudGlmaWVyPzogc3RyaW5nKTogUkFNTEJhY2tlbmRDb25maWcge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gdGhpcy5vd25lci5sb29rdXBSZXNwb25zZShzdGF0dXNDb2RlLCBleGFtcGxlSWRlbnRpZmllcik7XG4gICAgdGhpcy5vblJlYWR5KHJlc3BvbnNlKTtcbiAgICByZXR1cm4gdGhpcy5vd25lcjtcbiAgfVxuXG59XG5cbmludGVyZmFjZSBQZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uIHtcblxuICBwcmVtYXRjaGVkQmVoYXZpb3I6IEJlaGF2aW9yO1xuXG4gIHJlcXVlc3Q6IFJlcXVlc3Q7XG5cbiAgLy8gcmVzcG9uc2VQYXR0ZXJuQ2FuZGlkYXRlczogTWV0aG9kW107XG5cbn1cblxuZXhwb3J0IGNsYXNzIFJBTUxCYWNrZW5kQ29uZmlnIHtcblxuICBzdGF0aWMgdG9wTGV2ZWxLZXl3b3Jkczogc3RyaW5nW10gPSBbXCJ0aXRsZVwiLCBcInZlcnNpb25cIiwgXCJiYXNlVXJpXCIsXG4gIFwibWVkaWFUeXBlXCIsIFwidHlwZXNcIiwgXCJzZWN1cmVkQnlcIl07XG5cblxuICBzdGF0aWMgaW5pdFdpdGhGaWxlKHBhdGhUb1JBTUxGaWxlOiBzdHJpbmcpOiBSQU1MQmFja2VuZENvbmZpZyB7XG4gICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICByZXF1ZXN0Lm9wZW4oJ0dFVCcsIHBhdGhUb1JBTUxGaWxlLCBmYWxzZSk7ICAvLyBgZmFsc2VgIG1ha2VzIHRoZSByZXF1ZXN0IHN5bmNocm9ub3VzXG4gICAgcmVxdWVzdC5zZW5kKG51bGwpO1xuXG4gICAgaWYgKHJlcXVlc3Quc3RhdHVzID09PSAyMDApIHtcbiAgICAgIGNvbnN0IGFwaSA9IHNhZmVMb2FkKHJlcXVlc3QucmVzcG9uc2VUZXh0KTtcbiAgICAgIGNvbnNvbGUubG9nKHBhdGhUb1JBTUxGaWxlLCBhcGkpXG4gICAgICByZXR1cm4gbmV3IFJBTUxCYWNrZW5kQ29uZmlnKGFwaSk7XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcihcImZhaWxlZCB0byBHRVQgXCIgKyBwYXRoVG9SQU1MRmlsZSArIFwiOiBcIiArIHJlcXVlc3Quc3RhdHVzKTtcbiAgfVxuXG4gIHByaXZhdGUgc3RhdGljIGZpbmRCZXN0RHVtbXlSZXNwb25zZShyZXNwb25zZXMpIHtcbiAgICBsZXQgYmVzdEZpdHRpbmdSZXNwID0gbnVsbDtcbiAgICBjb25zb2xlLmxvZyhcImxvb2tpbmcgZm9yIHJlc3BvbnNlczogXCIsIE9iamVjdC5rZXlzKHJlc3BvbnNlcykpXG4gICAgZm9yIChjb25zdCBpIGluIHJlc3BvbnNlcykge1xuICAgICAgY29uc3QgY2FuZGlkYXRlID0gcmVzcG9uc2VzW2ldO1xuICAgICAgY29uc3Qgc3RhdHVzQ29kZSA9IE51bWJlci5wYXJzZUludChjYW5kaWRhdGUuY29kZSgpLnZhbHVlKCkpO1xuICAgICAgaWYgKDIwMCA8PSBzdGF0dXNDb2RlICYmIHN0YXR1c0NvZGUgPCAzMDApIHtcbiAgICAgICAgaWYgKGJlc3RGaXR0aW5nUmVzcCA9PT0gbnVsbCkge1xuICAgICAgICAgIGJlc3RGaXR0aW5nUmVzcCA9IGNhbmRpZGF0ZTtcbiAgICAgICAgfSBlbHNlIGlmIChOdW1iZXIucGFyc2VJbnQoYmVzdEZpdHRpbmdSZXNwLmNvZGUoKS52YWx1ZSgpKSA+IHN0YXR1c0NvZGUpIHtcbiAgICAgICAgICBiZXN0Rml0dGluZ1Jlc3AgPSBjYW5kaWRhdGU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGJlc3RGaXR0aW5nUmVzcDtcbiAgfVxuXG4gIHByaXZhdGUgZGVmaW5lZDogQmVoYXZpb3JbXSA9IFtdO1xuXG4gIHByaXZhdGUgc3R1YmJlZDogQmVoYXZpb3JbXSA9IFtdO1xuXG4gIHByaXZhdGUgZXhwZWN0ZWQ6IEJlaGF2aW9yW10gPSBbXTtcblxuICBwcml2YXRlIHBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb246IFBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24gPSBudWxsO1xuXG4gIHByaXZhdGUgZmluZFJlcXVlc3RCb2R5U2NoZW1hKG1ldGhvZCk6IGFueSB7XG4gICAgaWYgKG1ldGhvZFtcImJvZHlcIl0gJiYgbWV0aG9kW1wiYm9keVwiXVtcInR5cGVcIl0pIHtcbiAgICAgIGNvbnN0IHJhd1NjaGVtYSA9IG1ldGhvZFtcImJvZHlcIl1bXCJ0eXBlXCJdO1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UocmF3U2NoZW1hKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc3QgdHlwZU5hbWUgPSByYXdTY2hlbWEudHJpbSgpO1xuICAgICAgICBmb3IgKGNvbnN0IHQgaW4gdGhpcy5hcGlbXCJ0eXBlc1wiXSkge1xuICAgICAgICAgIGlmICh0ID09PSB0eXBlTmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UodGhpcy5hcGlbXCJ0eXBlc1wiXVt0XS50b1N0cmluZygpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhYnNvbHV0ZVVyaShyZWxhdGl2ZVVyaTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5hcGlbXCJiYXNlVXJpXCJdICsgcmVsYXRpdmVVcmk7XG4gIH1cblxuICBwcml2YXRlIGlzS2V5d29yZChjYW5kaWRhdGU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGZvciAobGV0IGkgaW4gUkFNTEJhY2tlbmRDb25maWcudG9wTGV2ZWxLZXl3b3Jkcykge1xuICAgICAgaWYgKFJBTUxCYWNrZW5kQ29uZmlnLnRvcExldmVsS2V5d29yZHNbaV0gPT09IGNhbmRpZGF0ZSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBhbGxSZXNvdXJjZXMoYXBpOiBhbnkpOiBhbnkge1xuICAgIGNvbnN0IHJ2YWwgPSB7fTtcbiAgICBmb3IgKHZhciBpIGluIGFwaSkge1xuICAgICAgaWYgKCF0aGlzLmlzS2V5d29yZChpKSkge1xuICAgICAgICBydmFsW2ldID0gYXBpW2ldO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcnZhbDtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgYXBpKSB7XG4gICAgY29uc29sZS5sb2codHlwZW9mIGFwaSwgYXBpKVxuICAgIGNvbnN0IGVudHJpZXM6IEJlaGF2aW9yW10gPSBbXTtcbiAgICBjb25zdCBhbGxSZXNvdXJjZXMgPSB0aGlzLmFsbFJlc291cmNlcyh0aGlzLmFwaSk7XG4gICAgZm9yIChjb25zdCBpIGluIGFsbFJlc291cmNlcykge1xuICAgICAgY29uc3QgcmVzb3VyY2UgPSBhbGxSZXNvdXJjZXNbaV07XG4gICAgICBjb25zdCByZXNvdXJjZVVyaSA9IHRoaXMuYWJzb2x1dGVVcmkoaSk7XG4gICAgICBjb25zb2xlLmxvZyhcInJlc291cmNlOlwiLCByZXNvdXJjZSwgaSwgYWxsUmVzb3VyY2VzKVxuICAgICAgZm9yIChjb25zdCBtZXRob2ROYW1lIGluIHJlc291cmNlKSB7XG4gICAgICAgIGNvbnN0IG1ldGhvZCA9IHJlc291cmNlW21ldGhvZE5hbWVdO1xuICAgICAgICBjb25zdCBzY2hlbWEgPSB0aGlzLmZpbmRSZXF1ZXN0Qm9keVNjaGVtYShtZXRob2QpO1xuXG4gICAgICAgIGNvbnNvbGUubG9nKFwibWV0aG9kOiBcIiwgbWV0aG9kKVxuXG4gICAgICAgIGNvbnN0IHBhdHRlcm4gPSBuZXcgUmVxdWVzdFBhdHRlcm4ocmVzb3VyY2VVcmksIG1ldGhvZE5hbWUsIHNjaGVtYSk7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlRGVmaW5pdGlvbiA9IFJBTUxCYWNrZW5kQ29uZmlnLmZpbmRCZXN0RHVtbXlSZXNwb25zZShtZXRob2RbXCJyZXNwb25zZXNcIl0pO1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IHRoaXMuYnVpbGRSZXNwb25zZUZyb21EZWZpbml0aW9uKHJlc3BvbnNlRGVmaW5pdGlvbik7XG4gICAgICAgIGVudHJpZXMucHVzaCh7XG4gICAgICAgICAgcmVxdWVzdFBhdHRlcm46IHBhdHRlcm4sXG4gICAgICAgICAgcmVzcG9uc2U6IHJlc3BvbnNlLFxuICAgICAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IG5ldyBEZWZhdWx0UmVxdWVzdFZhbGlkYXRvcihtZXRob2QpXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmRlZmluZWQgPSBlbnRyaWVzO1xuICB9XG5cbiAgcHJpdmF0ZSBidWlsZFJlc3BvbnNlRnJvbURlZmluaXRpb24ocmVzcG9uc2VEZWZpbml0aW9uLCBleGFtcGxlSWRlbnRpZmllcj86IHN0cmluZykge1xuICAgIHJldHVybiBuZXcgUmVzcG9uc2UobmV3IFJlc3BvbnNlT3B0aW9ucyh7XG4gICAgICBzdGF0dXM6IDIwMCwgLy8gVE9ET1xuICAgICAgYm9keTogdGhpcy5sb29rdXBFeGFtcGxlUmVzcG9uc2VCb2R5KHJlc3BvbnNlRGVmaW5pdGlvbi5ib2R5KClbMF0sIGV4YW1wbGVJZGVudGlmaWVyKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyBzdHViQWxsKCk6IFJBTUxCYWNrZW5kQ29uZmlnIHtcbiAgICB0aGlzLmRlZmluZWQuZm9yRWFjaChiZWhhdmlvciA9PiB0aGlzLnN0dWJiZWQucHVzaChiZWhhdmlvcikpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcHJpdmF0ZSBsb29rdXBFeGFtcGxlUmVzcG9uc2VCb2R5KHJlc3BCb2R5RGVmOiBUeXBlRGVjbGFyYXRpb24sIGV4YW1wbGVJZGVudGlmaWVyPzogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBmdW5jdGlvbiB0aHJvd0Vycm9yKCkge1xuICAgICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwiY291bGQgbm90IGZpbmQgZXhhbXBsZSBbXCIgKyBleGFtcGxlSWRlbnRpZmllciArIFwiXVwiKTtcbiAgICB9XG5cbiAgICBpZiAocmVzcEJvZHlEZWYgPT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKGV4YW1wbGVJZGVudGlmaWVyICE9IG51bGwpIHtcbiAgICAgICAgdGhyb3dFcnJvcigpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGV4YW1wbGVEZWZzID0gcmVzcEJvZHlEZWYuZXhhbXBsZXMoKTtcbiAgICBpZiAoZXhhbXBsZUlkZW50aWZpZXIgIT0gbnVsbCkge1xuICAgICAgaWYgKGV4YW1wbGVEZWZzID09IG51bGwgfHwgZXhhbXBsZURlZnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93RXJyb3IoKTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgaSBpbiBleGFtcGxlRGVmcykge1xuICAgICAgICBjb25zdCBleGFtcGxlID0gZXhhbXBsZURlZnNbaV07XG4gICAgICAgIGlmIChleGFtcGxlLm5hbWUoKSA9PT0gZXhhbXBsZUlkZW50aWZpZXIpIHtcbiAgICAgICAgICByZXR1cm4gZXhhbXBsZS52YWx1ZSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aHJvd0Vycm9yKCk7XG4gICAgfVxuICAgIGlmIChyZXNwQm9keURlZi5leGFtcGxlKCkgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBleGFtcGxlRGVmc1swXS52YWx1ZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcmVzcEJvZHlEZWYuZXhhbXBsZSgpLnZhbHVlKCk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGxvb2t1cFJlc3BvbnNlKHN0YXR1c0NvZGU6IG51bWJlciwgZXhhbXBsZUlkZW50aWZpZXI6IHN0cmluZyk6IFJlc3BvbnNlIHtcbiAgICBjb25zdCBwb3NzaWJsZVJlc3BvbnNlRGVmcyA9IHRoaXMubG9va3VwUmVzcG9uc2VEZWZzQnlSZXF1ZXN0KHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbi5yZXF1ZXN0KTtcbiAgICBmb3IgKGNvbnN0IGkgaW4gcG9zc2libGVSZXNwb25zZURlZnMpIHtcbiAgICAgIGlmIChOdW1iZXIucGFyc2VJbnQocG9zc2libGVSZXNwb25zZURlZnNbaV0uY29kZSgpLnZhbHVlKCkpID09PSBzdGF0dXNDb2RlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJ1aWxkUmVzcG9uc2VGcm9tRGVmaW5pdGlvbihwb3NzaWJsZVJlc3BvbnNlRGVmc1tpXSwgZXhhbXBsZUlkZW50aWZpZXIpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJ0aGVyZSBpcyBubyByZXNwb25zZSBkZWZpbmVkIHdpdGggc3RhdHVzIGNvZGUgXCIgKyBzdGF0dXNDb2RlICsgXCIgaW4gdGhlIFJBTUwgZmlsZVwiKTtcbiAgfVxuXG4gIHByaXZhdGUgbG9va3VwUmVzcG9uc2VEZWZzQnlSZXF1ZXN0KHJlcXVlc3Q6IFJlcXVlc3QpOiBSZXNwb25zZURlZltdIHtcbiAgICBmb3IgKGNvbnN0IGkgaW4gdGhpcy5hcGkucmVzb3VyY2VzKCkpIHtcbiAgICAgIGNvbnN0IHJlcyA9IHRoaXMuYXBpLnJlc291cmNlcygpW2ldO1xuICAgICAgZm9yIChjb25zdCBqIGluIHJlcy5tZXRob2RzKCkpIHtcbiAgICAgICAgY29uc3QgbWV0aG9kID0gcmVzLm1ldGhvZHMoKVtqXTtcbiAgICAgICAgY29uc3QgcGF0dGVybiA9IG5ldyBSZXF1ZXN0UGF0dGVybihyZXMuYWJzb2x1dGVVcmkoKSwgbWV0aG9kLm1ldGhvZCgpLCB0aGlzLmZpbmRSZXF1ZXN0Qm9keVNjaGVtYShtZXRob2QpKTtcbiAgICAgICAgaWYgKHBhdHRlcm4ubWF0Y2hlcyhyZXF1ZXN0KSkge1xuICAgICAgICAgIHJldHVybiBtZXRob2QucmVzcG9uc2VzKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgXCJub3QgZm91bmRcIjtcbiAgfVxuXG4gIHByaXZhdGUgb25TdHViUmVzcG9uc2VBdmFpbGFibGUocmVxdWVzdFBhdHRlcm46IFJlcXVlc3RQYXR0ZXJuLCByZXNwb25zZTogUmVzcG9uc2UpIHtcbiAgICAvLyB0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ucHJlbWF0Y2hlZEJlaGF2aW9yLjtcbiAgICB0aGlzLnN0dWJiZWQudW5zaGlmdCh7XG4gICAgICByZXNwb25zZTogcmVzcG9uc2UsXG4gICAgICByZXF1ZXN0UGF0dGVybjogcmVxdWVzdFBhdHRlcm4sXG4gICAgICByZXF1ZXN0VmFsaWRhdG9yOiBuZXcgTm9vcFJlcXVlc3RWYWxpZGF0b3IoKVxuICAgIH0pO1xuICAgIHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiA9IG51bGw7XG4gIH1cblxuICBwcml2YXRlIG9uTW9ja1Jlc3BvbnNlQXZhaWxhYmxlKGJlaGF2aW9yOiBCZWhhdmlvcikge1xuICAgIHRoaXMuZXhwZWN0ZWQucHVzaChiZWhhdmlvcik7XG4gICAgdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uID0gbnVsbDtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuR0VUKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcImdldFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlbkhFQUQodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwiaGVhZFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlblBPU1QodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwicG9zdFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlblBVVCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJwdXRcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5ERUxFVEUodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwiZGVsZXRlXCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuUEFUQ0godXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwicGF0Y2hcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5PUFRJT05TKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcIm9wdGlvbnNcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBtYXJrUmVxdWVzdEFzUGVuZGluZyhyZXE6IFJlcXVlc3QsIGJlaGF2aW9yOiBCZWhhdmlvcikge1xuICAgIGlmICh0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24gIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IHBlbmRpbmdSZXFEZXNjciA9IFJlcXVlc3RNZXRob2RbdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uLnJlcXVlc3QubWV0aG9kXS50b1VwcGVyQ2FzZSgpXG4gICAgICAgICsgXCIgXCIgKyB0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ucmVxdWVzdC51cmw7XG4gICAgICBjb25zdCByZXFEZXNjciA9IFJlcXVlc3RNZXRob2RbcmVxLm1ldGhvZF0udG9VcHBlckNhc2UoKSArIFwiIFwiICsgcmVxLnVybDtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcInVuZmluaXNoZWQgYmVoYXZpb3IgZGVmaW5pdGlvbjogY2Fubm90IGNvbmZpZ3VyZSBcIlxuICAgICAgICArIHJlcURlc2NyICsgXCIgYmVmb3JlIHNldHRpbmcgdGhlIHJlc3BvbnNlIGZvciBcIiArIHBlbmRpbmdSZXFEZXNjcik7XG4gICAgfVxuICAgIHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiA9IHtcbiAgICAgIHJlcXVlc3Q6IHJlcSxcbiAgICAgIHByZW1hdGNoZWRCZWhhdmlvcjogYmVoYXZpb3JcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSByZWxhdGl2ZVBhdGgoYWJzb2x1dGVVcmk6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgdXJsID0gbmV3IFVSTChhYnNvbHV0ZVVyaSk7XG4gICAgcmV0dXJuIHVybC5wYXRobmFtZSArIHVybC5xdWVyeSArIHVybC5oYXNoO1xuICB9XG5cbiAgcHVibGljIHdoZW5SZXF1ZXN0SXMocmVxdWVzdDogUmVxdWVzdCk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICBjb25zdCBwYXRoID0gdGhpcy5yZWxhdGl2ZVBhdGgocmVxdWVzdC51cmwpLCBtZXRob2QgPSBSZXF1ZXN0TWV0aG9kW3JlcXVlc3QubWV0aG9kXTtcblxuICAgIGxldCB2YWxpZGF0aW9uRXJyb3I7XG4gICAgZm9yIChjb25zdCBpIGluIHRoaXMuZGVmaW5lZCkge1xuICAgICAgY29uc3QgYmVoYXZpb3IgPSB0aGlzLmRlZmluZWRbaV07XG4gICAgICBpZiAoYmVoYXZpb3IucmVxdWVzdFBhdHRlcm4ubWF0Y2hlcyhyZXF1ZXN0KSkge1xuICAgICAgICB0aGlzLm1hcmtSZXF1ZXN0QXNQZW5kaW5nKHJlcXVlc3QsIGJlaGF2aW9yKTtcbiAgICAgICAgaWYgKCh2YWxpZGF0aW9uRXJyb3IgPSBiZWhhdmlvci5yZXF1ZXN0VmFsaWRhdG9yLm1hdGNoZXMocmVxdWVzdCkpID09PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZVNldHRlcih0aGlzLCByZXNwb25zZSA9PiB0aGlzLm9uU3R1YlJlc3BvbnNlQXZhaWxhYmxlKG5ldyBSZXF1ZXN0UGF0dGVybihwYXRoLCBtZXRob2QsIG51bGwpLCByZXNwb25zZSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcih2YWxpZGF0aW9uRXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRocm93IG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcImZvdW5kIG5vIGRlY2xhcmF0aW9uIG9mIHJlcXVlc3QgW1wiICsgbWV0aG9kLnRvVXBwZXJDYXNlKClcbiAgICAgICsgXCIgXCIgKyBwYXRoICsgXCJdIGluIFJBTUwgLSByZWZ1c2luZyB0byBzdHViXCIpO1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZUJhY2tlbmQoKTogUkFNTEJhY2tlbmQge1xuICAgIHJldHVybiBuZXcgUkFNTEJhY2tlbmQodGhpcy5zdHViYmVkLCB0aGlzLmV4cGVjdGVkKTtcbiAgfVxuXG59XG4iXX0=
