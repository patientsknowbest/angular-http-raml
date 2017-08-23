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
        var api = js_yaml_1.load(pathToRAMLFile);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL1JBTUxCYWNrZW5kQ29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBLDZDQUFtSDtBQUNuSCxtQ0FBK0I7QUFDL0Isc0NBQWdGO0FBQ2hGLCtCQUFrQztBQUVsQztJQUEwQyx3Q0FBSztJQUEvQzs7SUFFQSxDQUFDO0lBQUQsMkJBQUM7QUFBRCxDQUZBLEFBRUMsQ0FGeUMsS0FBSyxHQUU5QztBQUZZLG9EQUFvQjtBQUlqQztJQUVFLHdCQUNVLEtBQXdCLEVBQ3hCLE9BQXFDO1FBRHJDLFVBQUssR0FBTCxLQUFLLENBQW1CO1FBQ3hCLFlBQU8sR0FBUCxPQUFPLENBQThCO0lBQzVDLENBQUM7SUFFRyxvQ0FBVyxHQUFsQixVQUFtQixRQUFrQjtRQUNuQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3ZCLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO0lBQ3BCLENBQUM7SUFFTSx3Q0FBZSxHQUF0QixVQUF1QixVQUFrQixFQUFFLGlCQUEwQjtRQUNuRSxJQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxVQUFVLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztRQUMxRSxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3ZCLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO0lBQ3BCLENBQUM7SUFFSCxxQkFBQztBQUFELENBbEJBLEFBa0JDLElBQUE7QUFsQlksd0NBQWM7QUE4QjNCO0lBa0RFLDJCQUFvQixHQUFHO1FBQUgsUUFBRyxHQUFILEdBQUcsQ0FBQTtRQTNCZixZQUFPLEdBQWUsRUFBRSxDQUFDO1FBRXpCLFlBQU8sR0FBZSxFQUFFLENBQUM7UUFFekIsYUFBUSxHQUFlLEVBQUUsQ0FBQztRQUUxQixpQ0FBNEIsR0FBaUMsSUFBSSxDQUFDO1FBc0J4RSxJQUFNLE9BQU8sR0FBZ0IsRUFBRSxDQUFDO1FBQ2hDLEdBQUcsQ0FB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QUFNLEVBQUUsSUFBSSxDQUFDLEVBQUUsUUFBUSxDQUFDLEVBQTlFLENBQThFLENBQUMsQ0FBQztnQkFDOUgsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDTixNQUFNLElBQUksb0JBQW9CLENBQUMsZUFBZSxDQUFDLENBQUM7Z0JBQ2xELENBQUM7WUFDSCxDQUFDO1FBQ0gsQ0FBQztRQUNELE1BQU0sSUFBSSxvQkFBb0IsQ0FBQyxtQ0FBbUMsR0FBRSxNQUFNLENBQUMsV0FBVyxFQUFFO2NBQ3BGLEdBQUcsR0FBRyxJQUFJLEdBQUcsOEJBQThCLENBQUMsQ0FBQztJQUNuRCxDQUFDO0lBRU0seUNBQWEsR0FBcEI7UUFDRSxNQUFNLENBQUMsSUFBSSx5QkFBVyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUFFSCx3QkFBQztBQUFELENBM1BBLEFBMlBDLElBQUE7QUEzUFksOENBQWlCIiwiZmlsZSI6IlJBTUxCYWNrZW5kQ29uZmlnLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtCZWhhdmlvciwgRGVmYXVsdFJlcXVlc3RWYWxpZGF0b3IsIE5vb3BSZXF1ZXN0VmFsaWRhdG9yLCBSQU1MQmFja2VuZCwgUmVxdWVzdFBhdHRlcm59IGZyb20gXCIuL1JBTUxCYWNrZW5kXCI7XG5pbXBvcnQgeyBsb2FkIH0gZnJvbSBcImpzLXlhbWxcIjtcbmltcG9ydCB7UmVxdWVzdCwgUmVxdWVzdE1ldGhvZCwgUmVzcG9uc2UsIFJlc3BvbnNlT3B0aW9uc30gZnJvbSBcIkBhbmd1bGFyL2h0dHBcIjtcbmltcG9ydCBVUkwgPSByZXF1aXJlKFwidXJsLXBhcnNlXCIpO1xuXG5leHBvcnQgY2xhc3MgSW52YWxpZFN0dWJiaW5nRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG5cbn1cblxuZXhwb3J0IGNsYXNzIFJlc3BvbnNlU2V0dGVyIHtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIG93bmVyOiBSQU1MQmFja2VuZENvbmZpZyxcbiAgICBwcml2YXRlIG9uUmVhZHk6IChyZXNwb25zZTogUmVzcG9uc2UpID0+IHZvaWRcbiAgKSB7fVxuXG4gIHB1YmxpYyB0aGVuUmVzcG9uZChyZXNwb25zZTogUmVzcG9uc2UpOiBSQU1MQmFja2VuZENvbmZpZyB7XG4gICAgdGhpcy5vblJlYWR5KHJlc3BvbnNlKTtcbiAgICByZXR1cm4gdGhpcy5vd25lcjtcbiAgfVxuXG4gIHB1YmxpYyB0aGVuUmVzcG9uZFdpdGgoc3RhdHVzQ29kZTogbnVtYmVyLCBleGFtcGxlSWRlbnRpZmllcj86IHN0cmluZyk6IFJBTUxCYWNrZW5kQ29uZmlnIHtcbiAgICBjb25zdCByZXNwb25zZSA9IHRoaXMub3duZXIubG9va3VwUmVzcG9uc2Uoc3RhdHVzQ29kZSwgZXhhbXBsZUlkZW50aWZpZXIpO1xuICAgIHRoaXMub25SZWFkeShyZXNwb25zZSk7XG4gICAgcmV0dXJuIHRoaXMub3duZXI7XG4gIH1cblxufVxuXG5pbnRlcmZhY2UgUGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiB7XG5cbiAgcHJlbWF0Y2hlZEJlaGF2aW9yOiBCZWhhdmlvcjtcblxuICByZXF1ZXN0OiBSZXF1ZXN0O1xuXG4gIC8vIHJlc3BvbnNlUGF0dGVybkNhbmRpZGF0ZXM6IE1ldGhvZFtdO1xuXG59XG5cbmV4cG9ydCBjbGFzcyBSQU1MQmFja2VuZENvbmZpZyB7XG5cbiAgc3RhdGljIGluaXRXaXRoRmlsZShwYXRoVG9SQU1MRmlsZTogc3RyaW5nKTogUkFNTEJhY2tlbmRDb25maWcge1xuICAgIGNvbnN0IGFwaSA9IGxvYWQocGF0aFRvUkFNTEZpbGUpO1xuICAgIHJldHVybiBuZXcgUkFNTEJhY2tlbmRDb25maWcoYXBpKTtcbiAgfVxuXG4gIHByaXZhdGUgc3RhdGljIGZpbmRCZXN0RHVtbXlSZXNwb25zZShyZXNwb25zZXM6IFJlc3BvbnNlRGVmW10pOiBSZXNwb25zZURlZiB7XG4gICAgbGV0IGJlc3RGaXR0aW5nUmVzcDogUmVzcG9uc2VEZWYgPSBudWxsO1xuICAgIGZvciAoY29uc3QgaSBpbiByZXNwb25zZXMpIHtcbiAgICAgIGNvbnN0IGNhbmRpZGF0ZSA9IHJlc3BvbnNlc1tpXTtcbiAgICAgIGNvbnN0IHN0YXR1c0NvZGUgPSBOdW1iZXIucGFyc2VJbnQoY2FuZGlkYXRlLmNvZGUoKS52YWx1ZSgpKTtcbiAgICAgIGlmICgyMDAgPD0gc3RhdHVzQ29kZSAmJiBzdGF0dXNDb2RlIDwgMzAwKSB7XG4gICAgICAgIGlmIChiZXN0Rml0dGluZ1Jlc3AgPT09IG51bGwpIHtcbiAgICAgICAgICBiZXN0Rml0dGluZ1Jlc3AgPSBjYW5kaWRhdGU7XG4gICAgICAgIH0gZWxzZSBpZiAoTnVtYmVyLnBhcnNlSW50KGJlc3RGaXR0aW5nUmVzcC5jb2RlKCkudmFsdWUoKSkgPiBzdGF0dXNDb2RlKSB7XG4gICAgICAgICAgYmVzdEZpdHRpbmdSZXNwID0gY2FuZGlkYXRlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBiZXN0Rml0dGluZ1Jlc3A7XG4gIH1cblxuICBwcml2YXRlIGRlZmluZWQ6IEJlaGF2aW9yW10gPSBbXTtcblxuICBwcml2YXRlIHN0dWJiZWQ6IEJlaGF2aW9yW10gPSBbXTtcblxuICBwcml2YXRlIGV4cGVjdGVkOiBCZWhhdmlvcltdID0gW107XG5cbiAgcHJpdmF0ZSBwZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uOiBQZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uID0gbnVsbDtcblxuICBwcml2YXRlIGZpbmRSZXF1ZXN0Qm9keVNjaGVtYShtZXRob2Q6IE1ldGhvZCk6IGFueSB7XG4gICAgaWYgKG1ldGhvZC5ib2R5KCkubGVuZ3RoID4gMCAmJiBtZXRob2QuYm9keSgpWzBdLnR5cGUoKS5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCByYXdTY2hlbWEgPSBtZXRob2QuYm9keSgpWzBdLnR5cGUoKVswXS50b1N0cmluZygpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UocmF3U2NoZW1hKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc3QgdHlwZU5hbWUgPSByYXdTY2hlbWEudHJpbSgpO1xuICAgICAgICBmb3IgKGNvbnN0IHQgaW4gdGhpcy5hcGkudHlwZXMoKSkge1xuICAgICAgICAgIGNvbnN0IHR5cGVEZWNsID0gdGhpcy5hcGkudHlwZXMoKVt0XTtcbiAgICAgICAgICBpZiAodHlwZURlY2wubmFtZSgpID09PSB0eXBlTmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UodHlwZURlY2wudHlwZSgpWzBdLnRvU3RyaW5nKCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZXtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgYXBpKSB7XG4gICAgY29uc3QgZW50cmllcyA6IEJlaGF2aW9yW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IGkgaW4gdGhpcy5hcGkuYWxsUmVzb3VyY2VzKCkpIHtcbiAgICAgIGNvbnN0IHJlc291cmNlID0gIHRoaXMuYXBpLmFsbFJlc291cmNlcygpW2ldO1xuICAgICAgY29uc3QgcmVzb3VyY2VVcmkgPSByZXNvdXJjZS5hYnNvbHV0ZVVyaSgpO1xuICAgICAgZm9yIChjb25zdCBqIGluIHJlc291cmNlLm1ldGhvZHMoKSkge1xuICAgICAgICBjb25zdCBtZXRob2QgPSByZXNvdXJjZS5tZXRob2RzKClbal07XG4gICAgICAgIGNvbnN0IHNjaGVtYSA9IHRoaXMuZmluZFJlcXVlc3RCb2R5U2NoZW1hKG1ldGhvZCk7XG5cbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJ2YWxpZGF0aW9uIHJlc3VsdFwiLCBhanYudmFsaWRhdGUoSlNPTi5wYXJzZShtZXRob2QuYm9keSgpWzBdLnR5cGUoKVswXS50b1N0cmluZygpKSwge3Byb3A6dHJ1ZX0pKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJ2YWxpZGF0aW9uIGVycm9yc1wiLCBhanYuZXJyb3JzKVxuXG4gICAgICAgIGNvbnN0IHBhdHRlcm4gPSBuZXcgUmVxdWVzdFBhdHRlcm4ocmVzb3VyY2VVcmksIG1ldGhvZC5tZXRob2QoKSwgc2NoZW1hKTtcbiAgICAgICAgY29uc3QgcmVzcG9uc2VEZWZpbml0aW9uOiBSZXNwb25zZURlZiA9IFJBTUxCYWNrZW5kQ29uZmlnLmZpbmRCZXN0RHVtbXlSZXNwb25zZShtZXRob2QucmVzcG9uc2VzKCkpO1xuICAgICAgICBjb25zdCByZXNwb25zZSA9IHRoaXMuYnVpbGRSZXNwb25zZUZyb21EZWZpbml0aW9uKHJlc3BvbnNlRGVmaW5pdGlvbik7XG4gICAgICAgIGVudHJpZXMucHVzaCh7XG4gICAgICAgICAgcmVxdWVzdFBhdHRlcm46IHBhdHRlcm4sXG4gICAgICAgICAgcmVzcG9uc2U6IHJlc3BvbnNlLFxuICAgICAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IG5ldyBEZWZhdWx0UmVxdWVzdFZhbGlkYXRvcihtZXRob2QpXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmRlZmluZWQgPSBlbnRyaWVzO1xuICB9XG5cbiAgcHJpdmF0ZSBidWlsZFJlc3BvbnNlRnJvbURlZmluaXRpb24ocmVzcG9uc2VEZWZpbml0aW9uOiBSZXNwb25zZURlZiwgZXhhbXBsZUlkZW50aWZpZXI/OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKG5ldyBSZXNwb25zZU9wdGlvbnMoe1xuICAgICAgc3RhdHVzOiBuZXcgTnVtYmVyKHJlc3BvbnNlRGVmaW5pdGlvbi5jb2RlKCkudmFsdWUoKSkudmFsdWVPZigpLFxuICAgICAgYm9keTogdGhpcy5sb29rdXBFeGFtcGxlUmVzcG9uc2VCb2R5KHJlc3BvbnNlRGVmaW5pdGlvbi5ib2R5KClbMF0sIGV4YW1wbGVJZGVudGlmaWVyKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyBzdHViQWxsKCk6IFJBTUxCYWNrZW5kQ29uZmlnIHtcbiAgICB0aGlzLmRlZmluZWQuZm9yRWFjaChiZWhhdmlvciA9PiB0aGlzLnN0dWJiZWQucHVzaChiZWhhdmlvcikpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcHJpdmF0ZSBsb29rdXBFeGFtcGxlUmVzcG9uc2VCb2R5KHJlc3BCb2R5RGVmOiBUeXBlRGVjbGFyYXRpb24sIGV4YW1wbGVJZGVudGlmaWVyPzogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBmdW5jdGlvbiB0aHJvd0Vycm9yKCkge1xuICAgICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwiY291bGQgbm90IGZpbmQgZXhhbXBsZSBbXCIgKyBleGFtcGxlSWRlbnRpZmllciArIFwiXVwiKTtcbiAgICB9XG4gICAgaWYgKHJlc3BCb2R5RGVmID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmIChleGFtcGxlSWRlbnRpZmllciAhPSBudWxsKSB7XG4gICAgICAgIHRocm93RXJyb3IoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBleGFtcGxlRGVmcyA9IHJlc3BCb2R5RGVmLmV4YW1wbGVzKCk7XG4gICAgaWYgKGV4YW1wbGVJZGVudGlmaWVyICE9IG51bGwpIHtcbiAgICAgIGlmIChleGFtcGxlRGVmcyA9PSBudWxsIHx8IGV4YW1wbGVEZWZzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvd0Vycm9yKCk7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGkgaW4gZXhhbXBsZURlZnMpIHtcbiAgICAgICAgY29uc3QgZXhhbXBsZSA9IGV4YW1wbGVEZWZzW2ldO1xuICAgICAgICBpZiAoZXhhbXBsZS5uYW1lKCkgPT09IGV4YW1wbGVJZGVudGlmaWVyKSB7XG4gICAgICAgICAgcmV0dXJuIGV4YW1wbGUudmFsdWUoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhyb3dFcnJvcigpO1xuICAgIH1cbiAgICBpZiAocmVzcEJvZHlEZWYuZXhhbXBsZSgpID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gZXhhbXBsZURlZnNbMF0udmFsdWUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHJlc3BCb2R5RGVmLmV4YW1wbGUoKS52YWx1ZSgpO1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBsb29rdXBSZXNwb25zZShzdGF0dXNDb2RlOiBudW1iZXIsIGV4YW1wbGVJZGVudGlmaWVyOiBzdHJpbmcpOiBSZXNwb25zZSB7XG4gICAgY29uc3QgcG9zc2libGVSZXNwb25zZURlZnMgPSB0aGlzLmxvb2t1cFJlc3BvbnNlRGVmc0J5UmVxdWVzdCh0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ucmVxdWVzdCk7XG4gICAgZm9yIChjb25zdCBpIGluIHBvc3NpYmxlUmVzcG9uc2VEZWZzKSB7XG4gICAgICBpZiAoTnVtYmVyLnBhcnNlSW50KHBvc3NpYmxlUmVzcG9uc2VEZWZzW2ldLmNvZGUoKS52YWx1ZSgpKSA9PT0gc3RhdHVzQ29kZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5idWlsZFJlc3BvbnNlRnJvbURlZmluaXRpb24ocG9zc2libGVSZXNwb25zZURlZnNbaV0sIGV4YW1wbGVJZGVudGlmaWVyKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwidGhlcmUgaXMgbm8gcmVzcG9uc2UgZGVmaW5lZCB3aXRoIHN0YXR1cyBjb2RlIFwiICsgc3RhdHVzQ29kZSArIFwiIGluIHRoZSBSQU1MIGZpbGVcIik7XG4gIH1cblxuICBwcml2YXRlIGxvb2t1cFJlc3BvbnNlRGVmc0J5UmVxdWVzdChyZXF1ZXN0OiBSZXF1ZXN0KTogUmVzcG9uc2VEZWZbXSB7XG4gICAgZm9yIChjb25zdCBpIGluIHRoaXMuYXBpLnJlc291cmNlcygpKSB7XG4gICAgICBjb25zdCByZXMgPSB0aGlzLmFwaS5yZXNvdXJjZXMoKVtpXTtcbiAgICAgIGZvciAoY29uc3QgaiBpbiByZXMubWV0aG9kcygpKSB7XG4gICAgICAgIGNvbnN0IG1ldGhvZCA9IHJlcy5tZXRob2RzKClbal07XG4gICAgICAgIGNvbnN0IHBhdHRlcm4gPSBuZXcgUmVxdWVzdFBhdHRlcm4ocmVzLmFic29sdXRlVXJpKCksIG1ldGhvZC5tZXRob2QoKSwgdGhpcy5maW5kUmVxdWVzdEJvZHlTY2hlbWEobWV0aG9kKSk7XG4gICAgICAgIGlmIChwYXR0ZXJuLm1hdGNoZXMocmVxdWVzdCkpIHtcbiAgICAgICAgICByZXR1cm4gbWV0aG9kLnJlc3BvbnNlcygpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRocm93IFwibm90IGZvdW5kXCI7XG4gIH1cblxuICBwcml2YXRlIG9uU3R1YlJlc3BvbnNlQXZhaWxhYmxlKHJlcXVlc3RQYXR0ZXJuOiBSZXF1ZXN0UGF0dGVybiwgcmVzcG9uc2U6IFJlc3BvbnNlKSB7XG4gICAgLy8gdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uLnByZW1hdGNoZWRCZWhhdmlvci47XG4gICAgdGhpcy5zdHViYmVkLnVuc2hpZnQoe1xuICAgICAgcmVzcG9uc2U6IHJlc3BvbnNlLFxuICAgICAgcmVxdWVzdFBhdHRlcm46IHJlcXVlc3RQYXR0ZXJuLFxuICAgICAgcmVxdWVzdFZhbGlkYXRvcjogbmV3IE5vb3BSZXF1ZXN0VmFsaWRhdG9yKClcbiAgICB9KTtcbiAgICB0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24gPSBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBvbk1vY2tSZXNwb25zZUF2YWlsYWJsZShiZWhhdmlvcjogQmVoYXZpb3IpIHtcbiAgICB0aGlzLmV4cGVjdGVkLnB1c2goYmVoYXZpb3IpO1xuICAgIHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiA9IG51bGw7XG4gIH1cblxuICBwcml2YXRlIGFic29sdXRlVXJpKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuYXBpLmJhc2VVcmkoKS52YWx1ZSgpICsgcGF0aDtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuR0VUKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcImdldFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlbkhFQUQodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwiaGVhZFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlblBPU1QodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwicG9zdFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlblBVVCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJwdXRcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5ERUxFVEUodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwiZGVsZXRlXCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuUEFUQ0godXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwicGF0Y2hcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5PUFRJT05TKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcIm9wdGlvbnNcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBtYXJrUmVxdWVzdEFzUGVuZGluZyhyZXE6IFJlcXVlc3QsIGJlaGF2aW9yOiBCZWhhdmlvcikge1xuICAgIGlmICh0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24gIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IHBlbmRpbmdSZXFEZXNjciA9IFJlcXVlc3RNZXRob2RbdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uLnJlcXVlc3QubWV0aG9kXS50b1VwcGVyQ2FzZSgpXG4gICAgICAgICsgXCIgXCIgKyB0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ucmVxdWVzdC51cmw7XG4gICAgICBjb25zdCByZXFEZXNjciA9IFJlcXVlc3RNZXRob2RbcmVxLm1ldGhvZF0udG9VcHBlckNhc2UoKSArIFwiIFwiICsgcmVxLnVybDtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcInVuZmluaXNoZWQgYmVoYXZpb3IgZGVmaW5pdGlvbjogY2Fubm90IGNvbmZpZ3VyZSBcIlxuICAgICAgICArIHJlcURlc2NyICsgXCIgYmVmb3JlIHNldHRpbmcgdGhlIHJlc3BvbnNlIGZvciBcIiArIHBlbmRpbmdSZXFEZXNjcik7XG4gICAgfVxuICAgIHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiA9IHtcbiAgICAgIHJlcXVlc3Q6IHJlcSxcbiAgICAgIHByZW1hdGNoZWRCZWhhdmlvcjogYmVoYXZpb3JcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSByZWxhdGl2ZVBhdGgoYWJzb2x1dGVVcmk6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgdXJsID0gbmV3IFVSTChhYnNvbHV0ZVVyaSk7XG4gICAgcmV0dXJuIHVybC5wYXRobmFtZSArIHVybC5xdWVyeSArIHVybC5oYXNoO1xuICB9XG5cbiAgcHVibGljIHdoZW5SZXF1ZXN0SXMocmVxdWVzdDogUmVxdWVzdCk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICBjb25zdCBwYXRoID0gdGhpcy5yZWxhdGl2ZVBhdGgocmVxdWVzdC51cmwpLCBtZXRob2QgPSAgUmVxdWVzdE1ldGhvZFtyZXF1ZXN0Lm1ldGhvZF07XG5cbiAgICBsZXQgdmFsaWRhdGlvbkVycm9yO1xuICAgIGZvciAoY29uc3QgaSBpbiB0aGlzLmRlZmluZWQpICB7XG4gICAgICBjb25zdCBiZWhhdmlvciA9IHRoaXMuZGVmaW5lZFtpXTtcbiAgICAgIGlmIChiZWhhdmlvci5yZXF1ZXN0UGF0dGVybi5tYXRjaGVzKHJlcXVlc3QpKSB7XG4gICAgICAgIHRoaXMubWFya1JlcXVlc3RBc1BlbmRpbmcocmVxdWVzdCwgYmVoYXZpb3IpO1xuICAgICAgICBpZiAoKHZhbGlkYXRpb25FcnJvciA9IGJlaGF2aW9yLnJlcXVlc3RWYWxpZGF0b3IubWF0Y2hlcyhyZXF1ZXN0KSkgPT09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gbmV3IFJlc3BvbnNlU2V0dGVyKHRoaXMsIHJlc3BvbnNlID0+IHRoaXMub25TdHViUmVzcG9uc2VBdmFpbGFibGUobmV3IFJlcXVlc3RQYXR0ZXJuKHBhdGgsIG1ldGhvZCwgbnVsbCksIHJlc3BvbnNlKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKHZhbGlkYXRpb25FcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwiZm91bmQgbm8gZGVjbGFyYXRpb24gb2YgcmVxdWVzdCBbXCIrIG1ldGhvZC50b1VwcGVyQ2FzZSgpXG4gICAgICArIFwiIFwiICsgcGF0aCArIFwiXSBpbiBSQU1MIC0gcmVmdXNpbmcgdG8gc3R1YlwiKTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVCYWNrZW5kKCk6IFJBTUxCYWNrZW5kIHtcbiAgICByZXR1cm4gbmV3IFJBTUxCYWNrZW5kKHRoaXMuc3R1YmJlZCwgdGhpcy5leHBlY3RlZCk7XG4gIH1cblxufVxuIl19
