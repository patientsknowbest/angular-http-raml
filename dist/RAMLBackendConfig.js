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
var raml_1_parser_1 = require("./raml-1-parser");
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
        var entries = [];
        for (var i in this.api.allResources()) {
            var resource = this.api.allResources()[i];
            var resourceUri = resource.absoluteUri();
            for (var j in resource.methods()) {
                var method = resource.methods()[j];
                var schema = this.findRequestBodySchema(method);
                // console.log("validation result", ajv.validate(JSON.parse(method.body()[0].type()[0].toString()), {prop:true}));
                // console.log("validation errors", ajv.errors)
                var pattern = new RAMLBackend_1.RequestPattern(resourceUri, method.method(), schema);
                var responseDefinition = RAMLBackendConfig.findBestDummyResponse(method.responses());
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
        var api = raml_1_parser_1.loadApiSync(pathToRAMLFile, {
            fsResolver: {
                content: function (path) {
                    path = "./base" + path;
                    console.log("GET", path);
                    var xhttp = new XMLHttpRequest(), request = xhttp;
                    xhttp.open("GET", path, false);
                    xhttp.send();
                    if (request.status === 200) {
                        return request.responseText;
                    }
                },
                list: function (path) { throw "list dir: " + path; }
            }
        });
        return new RAMLBackendConfig(api);
    };
    RAMLBackendConfig.findBestDummyResponse = function (responses) {
        var bestFittingResp = null;
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
        if (method.body().length > 0 && method.body()[0].type().length > 0) {
            var rawSchema = method.body()[0].type()[0].toString();
            try {
                return JSON.parse(rawSchema);
            }
            catch (e) {
                var typeName = rawSchema.trim();
                for (var t in this.api.types()) {
                    var typeDecl = this.api.types()[t];
                    if (typeDecl.name() === typeName) {
                        return JSON.parse(typeDecl.type()[0].toString());
                    }
                }
            }
        }
        else {
            return null;
        }
    };
    RAMLBackendConfig.prototype.buildResponseFromDefinition = function (responseDefinition, exampleIdentifier) {
        return new http_1.Response(new http_1.ResponseOptions({
            status: new Number(responseDefinition.code().value()).valueOf(),
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
    RAMLBackendConfig.prototype.absoluteUri = function (path) {
        return this.api.baseUri().value() + path;
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
exports.RAMLBackendConfig = RAMLBackendConfig;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFBO0FBelFZLDhDQUFpQiIsImZpbGUiOiJSQU1MQmFja2VuZENvbmZpZy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7QmVoYXZpb3IsIERlZmF1bHRSZXF1ZXN0VmFsaWRhdG9yLCBOb29wUmVxdWVzdFZhbGlkYXRvciwgUkFNTEJhY2tlbmQsIFJlcXVlc3RQYXR0ZXJufSBmcm9tIFwiLi9SQU1MQmFja2VuZFwiO1xuXG5pbXBvcnQge0FwaSwgTWV0aG9kLCBSZXNwb25zZSBhcyBSZXNwb25zZURlZiwgVHlwZURlY2xhcmF0aW9ufSBmcm9tIFwiLi9yYW1sLTEtcGFyc2VyXCI7XG5pbXBvcnQge3BhcnNlUkFNTFN5bmMsIGxvYWRBcGlTeW5jfSBmcm9tIFwiLi9yYW1sLTEtcGFyc2VyXCI7XG5pbXBvcnQge1JlcXVlc3QsIFJlcXVlc3RNZXRob2QsIFJlc3BvbnNlLCBSZXNwb25zZU9wdGlvbnN9IGZyb20gXCJAYW5ndWxhci9odHRwXCI7XG5pbXBvcnQgVVJMID0gcmVxdWlyZShcInVybC1wYXJzZVwiKTtcblxuZXhwb3J0IGNsYXNzIEludmFsaWRTdHViYmluZ0Vycm9yIGV4dGVuZHMgRXJyb3Ige1xuXG59XG5cbmV4cG9ydCBjbGFzcyBSZXNwb25zZVNldHRlciB7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBvd25lcjogUkFNTEJhY2tlbmRDb25maWcsXG4gICAgcHJpdmF0ZSBvblJlYWR5OiAocmVzcG9uc2U6IFJlc3BvbnNlKSA9PiB2b2lkXG4gICkge31cblxuICBwdWJsaWMgdGhlblJlc3BvbmQocmVzcG9uc2U6IFJlc3BvbnNlKTogUkFNTEJhY2tlbmRDb25maWcge1xuICAgIHRoaXMub25SZWFkeShyZXNwb25zZSk7XG4gICAgcmV0dXJuIHRoaXMub3duZXI7XG4gIH1cblxuICBwdWJsaWMgdGhlblJlc3BvbmRXaXRoKHN0YXR1c0NvZGU6IG51bWJlciwgZXhhbXBsZUlkZW50aWZpZXI/OiBzdHJpbmcpOiBSQU1MQmFja2VuZENvbmZpZyB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSB0aGlzLm93bmVyLmxvb2t1cFJlc3BvbnNlKHN0YXR1c0NvZGUsIGV4YW1wbGVJZGVudGlmaWVyKTtcbiAgICB0aGlzLm9uUmVhZHkocmVzcG9uc2UpO1xuICAgIHJldHVybiB0aGlzLm93bmVyO1xuICB9XG5cbn1cblxuaW50ZXJmYWNlIFBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ge1xuXG4gIHByZW1hdGNoZWRCZWhhdmlvcjogQmVoYXZpb3I7XG5cbiAgcmVxdWVzdDogUmVxdWVzdDtcblxuICAvLyByZXNwb25zZVBhdHRlcm5DYW5kaWRhdGVzOiBNZXRob2RbXTtcblxufVxuXG5leHBvcnQgY2xhc3MgUkFNTEJhY2tlbmRDb25maWcge1xuXG4gIHN0YXRpYyBpbml0V2l0aEZpbGUocGF0aFRvUkFNTEZpbGU6IHN0cmluZyk6IFJBTUxCYWNrZW5kQ29uZmlnIHtcbiAgICBjb25zdCBhcGkgPSBsb2FkQXBpU3luYyhwYXRoVG9SQU1MRmlsZSwge1xuICAgIGZzUmVzb2x2ZXI6IHtcbiAgICBcdGNvbnRlbnQ6IGZ1bmN0aW9uKHBhdGgpeyBcbiAgICAgICAgICAgIHBhdGggPSBcIi4vYmFzZVwiICsgcGF0aDtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiR0VUXCIsIHBhdGgpXG4gICAgICAgICAgICB2YXIgeGh0dHAgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKSwgcmVxdWVzdCA9IHhodHRwO1xuICAgICAgICAgICAgeGh0dHAub3BlbihcIkdFVFwiLCBwYXRoLCBmYWxzZSk7XG4gICAgICAgICAgICB4aHR0cC5zZW5kKCk7XG4gICAgICAgICAgICBpZiAocmVxdWVzdC5zdGF0dXMgPT09IDIwMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiByZXF1ZXN0LnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICBcdGxpc3Q6IGZ1bmN0aW9uKHBhdGgpeyB0aHJvdyBcImxpc3QgZGlyOiBcIiArIHBhdGg7IH1cbiAgICB9XG59KTtcbiAgICByZXR1cm4gbmV3IFJBTUxCYWNrZW5kQ29uZmlnKGFwaSk7XG4gIH1cblxuICBwcml2YXRlIHN0YXRpYyBmaW5kQmVzdER1bW15UmVzcG9uc2UocmVzcG9uc2VzOiBSZXNwb25zZURlZltdKTogUmVzcG9uc2VEZWYge1xuICAgIGxldCBiZXN0Rml0dGluZ1Jlc3A6IFJlc3BvbnNlRGVmID0gbnVsbDtcbiAgICBmb3IgKGNvbnN0IGkgaW4gcmVzcG9uc2VzKSB7XG4gICAgICBjb25zdCBjYW5kaWRhdGUgPSByZXNwb25zZXNbaV07XG4gICAgICBjb25zdCBzdGF0dXNDb2RlID0gTnVtYmVyLnBhcnNlSW50KGNhbmRpZGF0ZS5jb2RlKCkudmFsdWUoKSk7XG4gICAgICBpZiAoMjAwIDw9IHN0YXR1c0NvZGUgJiYgc3RhdHVzQ29kZSA8IDMwMCkge1xuICAgICAgICBpZiAoYmVzdEZpdHRpbmdSZXNwID09PSBudWxsKSB7XG4gICAgICAgICAgYmVzdEZpdHRpbmdSZXNwID0gY2FuZGlkYXRlO1xuICAgICAgICB9IGVsc2UgaWYgKE51bWJlci5wYXJzZUludChiZXN0Rml0dGluZ1Jlc3AuY29kZSgpLnZhbHVlKCkpID4gc3RhdHVzQ29kZSkge1xuICAgICAgICAgIGJlc3RGaXR0aW5nUmVzcCA9IGNhbmRpZGF0ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYmVzdEZpdHRpbmdSZXNwO1xuICB9XG5cbiAgcHJpdmF0ZSBkZWZpbmVkOiBCZWhhdmlvcltdID0gW107XG5cbiAgcHJpdmF0ZSBzdHViYmVkOiBCZWhhdmlvcltdID0gW107XG5cbiAgcHJpdmF0ZSBleHBlY3RlZDogQmVoYXZpb3JbXSA9IFtdO1xuXG4gIHByaXZhdGUgcGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbjogUGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiA9IG51bGw7XG5cbiAgcHJpdmF0ZSBmaW5kUmVxdWVzdEJvZHlTY2hlbWEobWV0aG9kOiBNZXRob2QpOiBhbnkge1xuICAgIGlmIChtZXRob2QuYm9keSgpLmxlbmd0aCA+IDAgJiYgbWV0aG9kLmJvZHkoKVswXS50eXBlKCkubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgcmF3U2NoZW1hID0gbWV0aG9kLmJvZHkoKVswXS50eXBlKClbMF0udG9TdHJpbmcoKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBKU09OLnBhcnNlKHJhd1NjaGVtYSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnN0IHR5cGVOYW1lID0gcmF3U2NoZW1hLnRyaW0oKTtcbiAgICAgICAgZm9yIChjb25zdCB0IGluIHRoaXMuYXBpLnR5cGVzKCkpIHtcbiAgICAgICAgICBjb25zdCB0eXBlRGVjbCA9IHRoaXMuYXBpLnR5cGVzKClbdF07XG4gICAgICAgICAgaWYgKHR5cGVEZWNsLm5hbWUoKSA9PT0gdHlwZU5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKHR5cGVEZWNsLnR5cGUoKVswXS50b1N0cmluZygpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2V7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGFwaTogQXBpKSB7XG4gICAgY29uc3QgZW50cmllcyA6IEJlaGF2aW9yW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IGkgaW4gdGhpcy5hcGkuYWxsUmVzb3VyY2VzKCkpIHtcbiAgICAgIGNvbnN0IHJlc291cmNlID0gIHRoaXMuYXBpLmFsbFJlc291cmNlcygpW2ldO1xuICAgICAgY29uc3QgcmVzb3VyY2VVcmkgPSByZXNvdXJjZS5hYnNvbHV0ZVVyaSgpO1xuICAgICAgZm9yIChjb25zdCBqIGluIHJlc291cmNlLm1ldGhvZHMoKSkge1xuICAgICAgICBjb25zdCBtZXRob2QgPSByZXNvdXJjZS5tZXRob2RzKClbal07XG4gICAgICAgIGNvbnN0IHNjaGVtYSA9IHRoaXMuZmluZFJlcXVlc3RCb2R5U2NoZW1hKG1ldGhvZCk7XG5cbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJ2YWxpZGF0aW9uIHJlc3VsdFwiLCBhanYudmFsaWRhdGUoSlNPTi5wYXJzZShtZXRob2QuYm9keSgpWzBdLnR5cGUoKVswXS50b1N0cmluZygpKSwge3Byb3A6dHJ1ZX0pKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJ2YWxpZGF0aW9uIGVycm9yc1wiLCBhanYuZXJyb3JzKVxuXG4gICAgICAgIGNvbnN0IHBhdHRlcm4gPSBuZXcgUmVxdWVzdFBhdHRlcm4ocmVzb3VyY2VVcmksIG1ldGhvZC5tZXRob2QoKSwgc2NoZW1hKTtcbiAgICAgICAgY29uc3QgcmVzcG9uc2VEZWZpbml0aW9uOiBSZXNwb25zZURlZiA9IFJBTUxCYWNrZW5kQ29uZmlnLmZpbmRCZXN0RHVtbXlSZXNwb25zZShtZXRob2QucmVzcG9uc2VzKCkpO1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IHRoaXMuYnVpbGRSZXNwb25zZUZyb21EZWZpbml0aW9uKHJlc3BvbnNlRGVmaW5pdGlvbik7XG4gICAgICAgIGVudHJpZXMucHVzaCh7XG4gICAgICAgICAgcmVxdWVzdFBhdHRlcm46IHBhdHRlcm4sXG4gICAgICAgICAgcmVzcG9uc2U6IHJlc3BvbnNlLFxuICAgICAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IG5ldyBEZWZhdWx0UmVxdWVzdFZhbGlkYXRvcihtZXRob2QpXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmRlZmluZWQgPSBlbnRyaWVzO1xuICB9XG5cbiAgcHJpdmF0ZSBidWlsZFJlc3BvbnNlRnJvbURlZmluaXRpb24ocmVzcG9uc2VEZWZpbml0aW9uOiBSZXNwb25zZURlZiwgZXhhbXBsZUlkZW50aWZpZXI/OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKG5ldyBSZXNwb25zZU9wdGlvbnMoe1xuICAgICAgc3RhdHVzOiBuZXcgTnVtYmVyKHJlc3BvbnNlRGVmaW5pdGlvbi5jb2RlKCkudmFsdWUoKSkudmFsdWVPZigpLFxuICAgICAgYm9keTogdGhpcy5sb29rdXBFeGFtcGxlUmVzcG9uc2VCb2R5KHJlc3BvbnNlRGVmaW5pdGlvbi5ib2R5KClbMF0sIGV4YW1wbGVJZGVudGlmaWVyKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyBzdHViQWxsKCk6IFJBTUxCYWNrZW5kQ29uZmlnIHtcbiAgICB0aGlzLmRlZmluZWQuZm9yRWFjaChiZWhhdmlvciA9PiB0aGlzLnN0dWJiZWQucHVzaChiZWhhdmlvcikpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcHJpdmF0ZSBsb29rdXBFeGFtcGxlUmVzcG9uc2VCb2R5KHJlc3BCb2R5RGVmOiBUeXBlRGVjbGFyYXRpb24sIGV4YW1wbGVJZGVudGlmaWVyPzogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBmdW5jdGlvbiB0aHJvd0Vycm9yKCkge1xuICAgICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwiY291bGQgbm90IGZpbmQgZXhhbXBsZSBbXCIgKyBleGFtcGxlSWRlbnRpZmllciArIFwiXVwiKTtcbiAgICB9XG4gICAgaWYgKHJlc3BCb2R5RGVmID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmIChleGFtcGxlSWRlbnRpZmllciAhPSBudWxsKSB7XG4gICAgICAgIHRocm93RXJyb3IoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBleGFtcGxlRGVmcyA9IHJlc3BCb2R5RGVmLmV4YW1wbGVzKCk7XG4gICAgaWYgKGV4YW1wbGVJZGVudGlmaWVyICE9IG51bGwpIHtcbiAgICAgIGlmIChleGFtcGxlRGVmcyA9PSBudWxsIHx8IGV4YW1wbGVEZWZzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvd0Vycm9yKCk7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGkgaW4gZXhhbXBsZURlZnMpIHtcbiAgICAgICAgY29uc3QgZXhhbXBsZSA9IGV4YW1wbGVEZWZzW2ldO1xuICAgICAgICBpZiAoZXhhbXBsZS5uYW1lKCkgPT09IGV4YW1wbGVJZGVudGlmaWVyKSB7XG4gICAgICAgICAgcmV0dXJuIGV4YW1wbGUudmFsdWUoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhyb3dFcnJvcigpO1xuICAgIH1cbiAgICBpZiAocmVzcEJvZHlEZWYuZXhhbXBsZSgpID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gZXhhbXBsZURlZnNbMF0udmFsdWUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHJlc3BCb2R5RGVmLmV4YW1wbGUoKS52YWx1ZSgpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBsb29rdXBSZXNwb25zZShzdGF0dXNDb2RlOiBudW1iZXIsIGV4YW1wbGVJZGVudGlmaWVyOiBzdHJpbmcpOiBSZXNwb25zZSB7XG4gICAgY29uc3QgcG9zc2libGVSZXNwb25zZURlZnMgPSB0aGlzLmxvb2t1cFJlc3BvbnNlRGVmc0J5UmVxdWVzdCh0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ucmVxdWVzdCk7XG4gICAgZm9yIChjb25zdCBpIGluIHBvc3NpYmxlUmVzcG9uc2VEZWZzKSB7XG4gICAgICBpZiAoTnVtYmVyLnBhcnNlSW50KHBvc3NpYmxlUmVzcG9uc2VEZWZzW2ldLmNvZGUoKS52YWx1ZSgpKSA9PT0gc3RhdHVzQ29kZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5idWlsZFJlc3BvbnNlRnJvbURlZmluaXRpb24ocG9zc2libGVSZXNwb25zZURlZnNbaV0sIGV4YW1wbGVJZGVudGlmaWVyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwidGhlcmUgaXMgbm8gcmVzcG9uc2UgZGVmaW5lZCB3aXRoIHN0YXR1cyBjb2RlIFwiICsgc3RhdHVzQ29kZSArIFwiIGluIHRoZSBSQU1MIGZpbGVcIik7XG4gIH1cblxuICBwcml2YXRlIGxvb2t1cFJlc3BvbnNlRGVmc0J5UmVxdWVzdChyZXF1ZXN0OiBSZXF1ZXN0KTogUmVzcG9uc2VEZWZbXSB7XG4gICAgZm9yIChjb25zdCBpIGluIHRoaXMuYXBpLnJlc291cmNlcygpKSB7XG4gICAgICBjb25zdCByZXMgPSB0aGlzLmFwaS5yZXNvdXJjZXMoKVtpXTtcbiAgICAgIGZvciAoY29uc3QgaiBpbiByZXMubWV0aG9kcygpKSB7XG4gICAgICAgIGNvbnN0IG1ldGhvZCA9IHJlcy5tZXRob2RzKClbal07XG4gICAgICAgIGNvbnN0IHBhdHRlcm4gPSBuZXcgUmVxdWVzdFBhdHRlcm4ocmVzLmFic29sdXRlVXJpKCksIG1ldGhvZC5tZXRob2QoKSwgdGhpcy5maW5kUmVxdWVzdEJvZHlTY2hlbWEobWV0aG9kKSk7XG4gICAgICAgIGlmIChwYXR0ZXJuLm1hdGNoZXMocmVxdWVzdCkpIHtcbiAgICAgICAgICByZXR1cm4gbWV0aG9kLnJlc3BvbnNlcygpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRocm93IFwibm90IGZvdW5kXCI7XG4gIH1cblxuICBwcml2YXRlIG9uU3R1YlJlc3BvbnNlQXZhaWxhYmxlKHJlcXVlc3RQYXR0ZXJuOiBSZXF1ZXN0UGF0dGVybiwgcmVzcG9uc2U6IFJlc3BvbnNlKSB7XG4gICAgLy8gdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uLnByZW1hdGNoZWRCZWhhdmlvci47XG4gICAgdGhpcy5zdHViYmVkLnVuc2hpZnQoe1xuICAgICAgcmVzcG9uc2U6IHJlc3BvbnNlLFxuICAgICAgcmVxdWVzdFBhdHRlcm46IHJlcXVlc3RQYXR0ZXJuLFxuICAgICAgcmVxdWVzdFZhbGlkYXRvcjogbmV3IE5vb3BSZXF1ZXN0VmFsaWRhdG9yKClcbiAgICB9KTtcbiAgICB0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24gPSBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBvbk1vY2tSZXNwb25zZUF2YWlsYWJsZShiZWhhdmlvcjogQmVoYXZpb3IpIHtcbiAgICB0aGlzLmV4cGVjdGVkLnB1c2goYmVoYXZpb3IpO1xuICAgIHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiA9IG51bGw7XG4gIH1cblxuICBwcml2YXRlIGFic29sdXRlVXJpKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuYXBpLmJhc2VVcmkoKS52YWx1ZSgpICsgcGF0aDtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuR0VUKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcImdldFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlbkhFQUQodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwiaGVhZFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlblBPU1QodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwicG9zdFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlblBVVCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJwdXRcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5ERUxFVEUodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwiZGVsZXRlXCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuUEFUQ0godXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwicGF0Y2hcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5PUFRJT05TKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcIm9wdGlvbnNcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBtYXJrUmVxdWVzdEFzUGVuZGluZyhyZXE6IFJlcXVlc3QsIGJlaGF2aW9yOiBCZWhhdmlvcikge1xuICAgIGlmICh0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24gIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IHBlbmRpbmdSZXFEZXNjciA9IFJlcXVlc3RNZXRob2RbdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uLnJlcXVlc3QubWV0aG9kXS50b1VwcGVyQ2FzZSgpXG4gICAgICAgICsgXCIgXCIgKyB0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ucmVxdWVzdC51cmw7XG4gICAgICBjb25zdCByZXFEZXNjciA9IFJlcXVlc3RNZXRob2RbcmVxLm1ldGhvZF0udG9VcHBlckNhc2UoKSArIFwiIFwiICsgcmVxLnVybDtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcInVuZmluaXNoZWQgYmVoYXZpb3IgZGVmaW5pdGlvbjogY2Fubm90IGNvbmZpZ3VyZSBcIlxuICAgICAgICArIHJlcURlc2NyICsgXCIgYmVmb3JlIHNldHRpbmcgdGhlIHJlc3BvbnNlIGZvciBcIiArIHBlbmRpbmdSZXFEZXNjcik7XG4gICAgfVxuICAgIHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiA9IHtcbiAgICAgIHJlcXVlc3Q6IHJlcSxcbiAgICAgIHByZW1hdGNoZWRCZWhhdmlvcjogYmVoYXZpb3JcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSByZWxhdGl2ZVBhdGgoYWJzb2x1dGVVcmk6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgdXJsID0gbmV3IFVSTChhYnNvbHV0ZVVyaSk7XG4gICAgcmV0dXJuIHVybC5wYXRobmFtZSArIHVybC5xdWVyeSArIHVybC5oYXNoO1xuICB9XG5cbiAgcHVibGljIHdoZW5SZXF1ZXN0SXMocmVxdWVzdDogUmVxdWVzdCk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICBjb25zdCBwYXRoID0gdGhpcy5yZWxhdGl2ZVBhdGgocmVxdWVzdC51cmwpLCBtZXRob2QgPSAgUmVxdWVzdE1ldGhvZFtyZXF1ZXN0Lm1ldGhvZF07XG5cbiAgICBsZXQgdmFsaWRhdGlvbkVycm9yO1xuICAgIGZvciAoY29uc3QgaSBpbiB0aGlzLmRlZmluZWQpICB7XG4gICAgICBjb25zdCBiZWhhdmlvciA9IHRoaXMuZGVmaW5lZFtpXTtcbiAgICAgIGlmIChiZWhhdmlvci5yZXF1ZXN0UGF0dGVybi5tYXRjaGVzKHJlcXVlc3QpKSB7XG4gICAgICAgIHRoaXMubWFya1JlcXVlc3RBc1BlbmRpbmcocmVxdWVzdCwgYmVoYXZpb3IpO1xuICAgICAgICBpZiAoKHZhbGlkYXRpb25FcnJvciA9IGJlaGF2aW9yLnJlcXVlc3RWYWxpZGF0b3IubWF0Y2hlcyhyZXF1ZXN0KSkgPT09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gbmV3IFJlc3BvbnNlU2V0dGVyKHRoaXMsIHJlc3BvbnNlID0+IHRoaXMub25TdHViUmVzcG9uc2VBdmFpbGFibGUobmV3IFJlcXVlc3RQYXR0ZXJuKHBhdGgsIG1ldGhvZCwgbnVsbCksIHJlc3BvbnNlKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKHZhbGlkYXRpb25FcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwiZm91bmQgbm8gZGVjbGFyYXRpb24gb2YgcmVxdWVzdCBbXCIrIG1ldGhvZC50b1VwcGVyQ2FzZSgpXG4gICAgICArIFwiIFwiICsgcGF0aCArIFwiXSBpbiBSQU1MIC0gcmVmdXNpbmcgdG8gc3R1YlwiKTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVCYWNrZW5kKCk6IFJBTUxCYWNrZW5kIHtcbiAgICByZXR1cm4gbmV3IFJBTUxCYWNrZW5kKHRoaXMuc3R1YmJlZCwgdGhpcy5leHBlY3RlZCk7XG4gIH1cblxufVxuIl19
