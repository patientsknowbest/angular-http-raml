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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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LElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDakMsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUM3QyxJQUFJLENBQUMsb0JBQW9CLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO2dCQUM3QyxFQUFFLENBQUMsQ0FBQyxDQUFDLGVBQWUsR0FBRyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztvQkFDNUUsTUFBTSxDQUFDLElBQUksY0FBYyxDQUFDLElBQUksRUFBRSxVQUFBLFFBQVEsSUFBSSxPQUFBLEtBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLDRCQUFjLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsRUFBRSxRQUFRLENBQUMsRUFBOUUsQ0FBOEUsQ0FBQyxDQUFDO2dCQUM5SCxDQUFDO2dCQUFDLElBQUksQ0FBQyxDQUFDO29CQUNOLE1BQU0sSUFBSSxvQkFBb0IsQ0FBQyxlQUFlLENBQUMsQ0FBQztnQkFDbEQsQ0FBQztZQUNILENBQUM7UUFDSCxDQUFDO1FBQ0QsTUFBTSxJQUFJLG9CQUFvQixDQUFDLG1DQUFtQyxHQUFFLE1BQU0sQ0FBQyxXQUFXLEVBQUU7Y0FDcEYsR0FBRyxHQUFHLElBQUksR0FBRyw4QkFBOEIsQ0FBQyxDQUFDO0lBQ25ELENBQUM7SUFFTSx5Q0FBYSxHQUFwQjtRQUNFLE1BQU0sQ0FBQyxJQUFJLHlCQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDdEQsQ0FBQztJQUVILHdCQUFDO0FBQUQsQ0F2UUEsQUF1UUMsSUFBQTtBQXZRWSw4Q0FBaUIiLCJmaWxlIjoiUkFNTEJhY2tlbmRDb25maWcuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge0JlaGF2aW9yLCBEZWZhdWx0UmVxdWVzdFZhbGlkYXRvciwgTm9vcFJlcXVlc3RWYWxpZGF0b3IsIFJBTUxCYWNrZW5kLCBSZXF1ZXN0UGF0dGVybn0gZnJvbSBcIi4vUkFNTEJhY2tlbmRcIjtcblxuaW1wb3J0IHtBcGksIE1ldGhvZCwgUmVzcG9uc2UgYXMgUmVzcG9uc2VEZWYsIFR5cGVEZWNsYXJhdGlvbn0gZnJvbSBcInJhbWwtMTAtcGFyc2VyLWFwaVwiO1xuaW1wb3J0IHtwYXJzZVJBTUxTeW5jLCBsb2FkQXBpU3luY30gZnJvbSBcIi4vcmFtbC0xLXBhcnNlclwiO1xuaW1wb3J0IHtSZXF1ZXN0LCBSZXF1ZXN0TWV0aG9kLCBSZXNwb25zZSwgUmVzcG9uc2VPcHRpb25zfSBmcm9tIFwiQGFuZ3VsYXIvaHR0cFwiO1xuaW1wb3J0IFVSTCA9IHJlcXVpcmUoXCJ1cmwtcGFyc2VcIik7XG5cbmV4cG9ydCBjbGFzcyBJbnZhbGlkU3R1YmJpbmdFcnJvciBleHRlbmRzIEVycm9yIHtcblxufVxuXG5leHBvcnQgY2xhc3MgUmVzcG9uc2VTZXR0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgb3duZXI6IFJBTUxCYWNrZW5kQ29uZmlnLFxuICAgIHByaXZhdGUgb25SZWFkeTogKHJlc3BvbnNlOiBSZXNwb25zZSkgPT4gdm9pZFxuICApIHt9XG5cbiAgcHVibGljIHRoZW5SZXNwb25kKHJlc3BvbnNlOiBSZXNwb25zZSk6IFJBTUxCYWNrZW5kQ29uZmlnIHtcbiAgICB0aGlzLm9uUmVhZHkocmVzcG9uc2UpO1xuICAgIHJldHVybiB0aGlzLm93bmVyO1xuICB9XG5cbiAgcHVibGljIHRoZW5SZXNwb25kV2l0aChzdGF0dXNDb2RlOiBudW1iZXIsIGV4YW1wbGVJZGVudGlmaWVyPzogc3RyaW5nKTogUkFNTEJhY2tlbmRDb25maWcge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gdGhpcy5vd25lci5sb29rdXBSZXNwb25zZShzdGF0dXNDb2RlLCBleGFtcGxlSWRlbnRpZmllcik7XG4gICAgdGhpcy5vblJlYWR5KHJlc3BvbnNlKTtcbiAgICByZXR1cm4gdGhpcy5vd25lcjtcbiAgfVxuXG59XG5cbmludGVyZmFjZSBQZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uIHtcblxuICBwcmVtYXRjaGVkQmVoYXZpb3I6IEJlaGF2aW9yO1xuXG4gIHJlcXVlc3Q6IFJlcXVlc3Q7XG5cbiAgLy8gcmVzcG9uc2VQYXR0ZXJuQ2FuZGlkYXRlczogTWV0aG9kW107XG5cbn1cblxuZXhwb3J0IGNsYXNzIFJBTUxCYWNrZW5kQ29uZmlnIHtcblxuICBzdGF0aWMgaW5pdFdpdGhGaWxlKHBhdGhUb1JBTUxGaWxlOiBzdHJpbmcpOiBSQU1MQmFja2VuZENvbmZpZyB7XG4gICAgY29uc3QgYXBpID0gbG9hZEFwaVN5bmMocGF0aFRvUkFNTEZpbGUsIHtcbiAgICBmc1Jlc29sdmVyOiB7XG4gICAgXHRjb250ZW50OiBmdW5jdGlvbihwYXRoKXtcbiAgICAgICAgICAgIHZhciB4aHR0cCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpLCByZXF1ZXN0ID0geGh0dHA7XG4gICAgICAgICAgICB4aHR0cC5vcGVuKFwiR0VUXCIsIHBhdGgsIGZhbHNlKTtcbiAgICAgICAgICAgIHhodHRwLnNlbmQoKTtcbiAgICAgICAgICAgIGlmIChyZXF1ZXN0LnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlcXVlc3QucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgIFx0bGlzdDogZnVuY3Rpb24ocGF0aCl7IHRocm93IFwibGlzdCBkaXI6IFwiICsgcGF0aDsgfVxuICAgIH1cbn0pO1xuICAgIHJldHVybiBuZXcgUkFNTEJhY2tlbmRDb25maWcoYXBpKTtcbiAgfVxuXG4gIHByaXZhdGUgc3RhdGljIGZpbmRCZXN0RHVtbXlSZXNwb25zZShyZXNwb25zZXM6IFJlc3BvbnNlRGVmW10pOiBSZXNwb25zZURlZiB7XG4gICAgbGV0IGJlc3RGaXR0aW5nUmVzcDogUmVzcG9uc2VEZWYgPSBudWxsO1xuICAgIGZvciAoY29uc3QgaSBpbiByZXNwb25zZXMpIHtcbiAgICAgIGNvbnN0IGNhbmRpZGF0ZSA9IHJlc3BvbnNlc1tpXTtcbiAgICAgIGNvbnN0IHN0YXR1c0NvZGUgPSBOdW1iZXIucGFyc2VJbnQoY2FuZGlkYXRlLmNvZGUoKS52YWx1ZSgpKTtcbiAgICAgIGlmICgyMDAgPD0gc3RhdHVzQ29kZSAmJiBzdGF0dXNDb2RlIDwgMzAwKSB7XG4gICAgICAgIGlmIChiZXN0Rml0dGluZ1Jlc3AgPT09IG51bGwpIHtcbiAgICAgICAgICBiZXN0Rml0dGluZ1Jlc3AgPSBjYW5kaWRhdGU7XG4gICAgICAgIH0gZWxzZSBpZiAoTnVtYmVyLnBhcnNlSW50KGJlc3RGaXR0aW5nUmVzcC5jb2RlKCkudmFsdWUoKSkgPiBzdGF0dXNDb2RlKSB7XG4gICAgICAgICAgYmVzdEZpdHRpbmdSZXNwID0gY2FuZGlkYXRlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBiZXN0Rml0dGluZ1Jlc3A7XG4gIH1cblxuICBwcml2YXRlIGRlZmluZWQ6IEJlaGF2aW9yW10gPSBbXTtcblxuICBwcml2YXRlIHN0dWJiZWQ6IEJlaGF2aW9yW10gPSBbXTtcblxuICBwcml2YXRlIGV4cGVjdGVkOiBCZWhhdmlvcltdID0gW107XG5cbiAgcHJpdmF0ZSBwZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uOiBQZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uID0gbnVsbDtcblxuICBwcml2YXRlIGZpbmRSZXF1ZXN0Qm9keVNjaGVtYShtZXRob2Q6IE1ldGhvZCk6IGFueSB7XG4gICAgaWYgKG1ldGhvZC5ib2R5KCkubGVuZ3RoID4gMCAmJiBtZXRob2QuYm9keSgpWzBdLnR5cGUoKS5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCByYXdTY2hlbWEgPSBtZXRob2QuYm9keSgpWzBdLnR5cGUoKVswXS50b1N0cmluZygpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UocmF3U2NoZW1hKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc3QgdHlwZU5hbWUgPSByYXdTY2hlbWEudHJpbSgpO1xuICAgICAgICBmb3IgKGNvbnN0IHQgaW4gdGhpcy5hcGkudHlwZXMoKSkge1xuICAgICAgICAgIGNvbnN0IHR5cGVEZWNsID0gdGhpcy5hcGkudHlwZXMoKVt0XTtcbiAgICAgICAgICBpZiAodHlwZURlY2wubmFtZSgpID09PSB0eXBlTmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UodHlwZURlY2wudHlwZSgpWzBdLnRvU3RyaW5nKCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZXtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgYXBpOiBBcGkpIHtcbiAgICBjb25zdCBlbnRyaWVzIDogQmVoYXZpb3JbXSA9IFtdO1xuICAgIGZvciAoY29uc3QgaSBpbiB0aGlzLmFwaS5hbGxSZXNvdXJjZXMoKSkge1xuICAgICAgY29uc3QgcmVzb3VyY2UgPSAgdGhpcy5hcGkuYWxsUmVzb3VyY2VzKClbaV07XG4gICAgICBjb25zdCByZXNvdXJjZVVyaSA9IHJlc291cmNlLmFic29sdXRlVXJpKCk7XG4gICAgICBmb3IgKGNvbnN0IGogaW4gcmVzb3VyY2UubWV0aG9kcygpKSB7XG4gICAgICAgIGNvbnN0IG1ldGhvZCA9IHJlc291cmNlLm1ldGhvZHMoKVtqXTtcbiAgICAgICAgY29uc3Qgc2NoZW1hID0gdGhpcy5maW5kUmVxdWVzdEJvZHlTY2hlbWEobWV0aG9kKTtcblxuICAgICAgICAvLyBjb25zb2xlLmxvZyhcInZhbGlkYXRpb24gcmVzdWx0XCIsIGFqdi52YWxpZGF0ZShKU09OLnBhcnNlKG1ldGhvZC5ib2R5KClbMF0udHlwZSgpWzBdLnRvU3RyaW5nKCkpLCB7cHJvcDp0cnVlfSkpO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhcInZhbGlkYXRpb24gZXJyb3JzXCIsIGFqdi5lcnJvcnMpXG5cbiAgICAgICAgY29uc3QgcGF0dGVybiA9IG5ldyBSZXF1ZXN0UGF0dGVybihyZXNvdXJjZVVyaSwgbWV0aG9kLm1ldGhvZCgpLCBzY2hlbWEpO1xuICAgICAgICBjb25zdCByZXNwb25zZURlZmluaXRpb246IFJlc3BvbnNlRGVmID0gUkFNTEJhY2tlbmRDb25maWcuZmluZEJlc3REdW1teVJlc3BvbnNlKG1ldGhvZC5yZXNwb25zZXMoKSk7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gdGhpcy5idWlsZFJlc3BvbnNlRnJvbURlZmluaXRpb24ocmVzcG9uc2VEZWZpbml0aW9uKTtcbiAgICAgICAgZW50cmllcy5wdXNoKHtcbiAgICAgICAgICByZXF1ZXN0UGF0dGVybjogcGF0dGVybixcbiAgICAgICAgICByZXNwb25zZTogcmVzcG9uc2UsXG4gICAgICAgICAgcmVxdWVzdFZhbGlkYXRvcjogbmV3IERlZmF1bHRSZXF1ZXN0VmFsaWRhdG9yKG1ldGhvZClcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuZGVmaW5lZCA9IGVudHJpZXM7XG4gIH1cblxuICBwcml2YXRlIGJ1aWxkUmVzcG9uc2VGcm9tRGVmaW5pdGlvbihyZXNwb25zZURlZmluaXRpb246IFJlc3BvbnNlRGVmLCBleGFtcGxlSWRlbnRpZmllcj86IHN0cmluZykge1xuICAgIHJldHVybiBuZXcgUmVzcG9uc2UobmV3IFJlc3BvbnNlT3B0aW9ucyh7XG4gICAgICBzdGF0dXM6IG5ldyBOdW1iZXIocmVzcG9uc2VEZWZpbml0aW9uLmNvZGUoKS52YWx1ZSgpKS52YWx1ZU9mKCksXG4gICAgICBib2R5OiB0aGlzLmxvb2t1cEV4YW1wbGVSZXNwb25zZUJvZHkocmVzcG9uc2VEZWZpbml0aW9uLmJvZHkoKVswXSwgZXhhbXBsZUlkZW50aWZpZXIpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHN0dWJBbGwoKTogUkFNTEJhY2tlbmRDb25maWcge1xuICAgIHRoaXMuZGVmaW5lZC5mb3JFYWNoKGJlaGF2aW9yID0+IHRoaXMuc3R1YmJlZC5wdXNoKGJlaGF2aW9yKSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBwcml2YXRlIGxvb2t1cEV4YW1wbGVSZXNwb25zZUJvZHkocmVzcEJvZHlEZWY6IFR5cGVEZWNsYXJhdGlvbiwgZXhhbXBsZUlkZW50aWZpZXI/OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGZ1bmN0aW9uIHRocm93RXJyb3IoKSB7XG4gICAgICB0aHJvdyBuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJjb3VsZCBub3QgZmluZCBleGFtcGxlIFtcIiArIGV4YW1wbGVJZGVudGlmaWVyICsgXCJdXCIpO1xuICAgIH1cbiAgICBpZiAocmVzcEJvZHlEZWYgPT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKGV4YW1wbGVJZGVudGlmaWVyICE9IG51bGwpIHtcbiAgICAgICAgdGhyb3dFcnJvcigpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGV4YW1wbGVEZWZzID0gcmVzcEJvZHlEZWYuZXhhbXBsZXMoKTtcbiAgICBpZiAoZXhhbXBsZUlkZW50aWZpZXIgIT0gbnVsbCkge1xuICAgICAgaWYgKGV4YW1wbGVEZWZzID09IG51bGwgfHwgZXhhbXBsZURlZnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93RXJyb3IoKTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgaSBpbiBleGFtcGxlRGVmcykge1xuICAgICAgICBjb25zdCBleGFtcGxlID0gZXhhbXBsZURlZnNbaV07XG4gICAgICAgIGlmIChleGFtcGxlLm5hbWUoKSA9PT0gZXhhbXBsZUlkZW50aWZpZXIpIHtcbiAgICAgICAgICByZXR1cm4gZXhhbXBsZS52YWx1ZSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aHJvd0Vycm9yKCk7XG4gICAgfVxuICAgIGlmIChyZXNwQm9keURlZi5leGFtcGxlKCkgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBleGFtcGxlRGVmc1swXS52YWx1ZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcmVzcEJvZHlEZWYuZXhhbXBsZSgpLnZhbHVlKCk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGxvb2t1cFJlc3BvbnNlKHN0YXR1c0NvZGU6IG51bWJlciwgZXhhbXBsZUlkZW50aWZpZXI6IHN0cmluZyk6IFJlc3BvbnNlIHtcbiAgICBjb25zdCBwb3NzaWJsZVJlc3BvbnNlRGVmcyA9IHRoaXMubG9va3VwUmVzcG9uc2VEZWZzQnlSZXF1ZXN0KHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbi5yZXF1ZXN0KTtcbiAgICBmb3IgKGNvbnN0IGkgaW4gcG9zc2libGVSZXNwb25zZURlZnMpIHtcbiAgICAgIGlmIChOdW1iZXIucGFyc2VJbnQocG9zc2libGVSZXNwb25zZURlZnNbaV0uY29kZSgpLnZhbHVlKCkpID09PSBzdGF0dXNDb2RlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJ1aWxkUmVzcG9uc2VGcm9tRGVmaW5pdGlvbihwb3NzaWJsZVJlc3BvbnNlRGVmc1tpXSwgZXhhbXBsZUlkZW50aWZpZXIpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJ0aGVyZSBpcyBubyByZXNwb25zZSBkZWZpbmVkIHdpdGggc3RhdHVzIGNvZGUgXCIgKyBzdGF0dXNDb2RlICsgXCIgaW4gdGhlIFJBTUwgZmlsZVwiKTtcbiAgfVxuXG4gIHByaXZhdGUgbG9va3VwUmVzcG9uc2VEZWZzQnlSZXF1ZXN0KHJlcXVlc3Q6IFJlcXVlc3QpOiBSZXNwb25zZURlZltdIHtcbiAgICBmb3IgKGNvbnN0IGkgaW4gdGhpcy5hcGkucmVzb3VyY2VzKCkpIHtcbiAgICAgIGNvbnN0IHJlcyA9IHRoaXMuYXBpLnJlc291cmNlcygpW2ldO1xuICAgICAgZm9yIChjb25zdCBqIGluIHJlcy5tZXRob2RzKCkpIHtcbiAgICAgICAgY29uc3QgbWV0aG9kID0gcmVzLm1ldGhvZHMoKVtqXTtcbiAgICAgICAgY29uc3QgcGF0dGVybiA9IG5ldyBSZXF1ZXN0UGF0dGVybihyZXMuYWJzb2x1dGVVcmkoKSwgbWV0aG9kLm1ldGhvZCgpLCB0aGlzLmZpbmRSZXF1ZXN0Qm9keVNjaGVtYShtZXRob2QpKTtcbiAgICAgICAgaWYgKHBhdHRlcm4ubWF0Y2hlcyhyZXF1ZXN0KSkge1xuICAgICAgICAgIHJldHVybiBtZXRob2QucmVzcG9uc2VzKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgXCJub3QgZm91bmRcIjtcbiAgfVxuXG4gIHByaXZhdGUgb25TdHViUmVzcG9uc2VBdmFpbGFibGUocmVxdWVzdFBhdHRlcm46IFJlcXVlc3RQYXR0ZXJuLCByZXNwb25zZTogUmVzcG9uc2UpIHtcbiAgICAvLyB0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ucHJlbWF0Y2hlZEJlaGF2aW9yLjtcbiAgICB0aGlzLnN0dWJiZWQudW5zaGlmdCh7XG4gICAgICByZXNwb25zZTogcmVzcG9uc2UsXG4gICAgICByZXF1ZXN0UGF0dGVybjogcmVxdWVzdFBhdHRlcm4sXG4gICAgICByZXF1ZXN0VmFsaWRhdG9yOiBuZXcgTm9vcFJlcXVlc3RWYWxpZGF0b3IoKVxuICAgIH0pO1xuICAgIHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiA9IG51bGw7XG4gIH1cblxuICBwcml2YXRlIG9uTW9ja1Jlc3BvbnNlQXZhaWxhYmxlKGJlaGF2aW9yOiBCZWhhdmlvcikge1xuICAgIHRoaXMuZXhwZWN0ZWQucHVzaChiZWhhdmlvcik7XG4gICAgdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uID0gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgYWJzb2x1dGVVcmkocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5hcGkuYmFzZVVyaSgpLnZhbHVlKCkgKyBwYXRoO1xuICB9XG5cbiAgcHVibGljIHdoZW5HRVQodXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwiZ2V0XCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuSEVBRCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJoZWFkXCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuUE9TVCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJwb3N0XCIsXG4gICAgICB1cmw6IHRoaXMuYWJzb2x1dGVVcmkodXJpKVxuICAgIH0pKTtcbiAgfVxuXG4gIHB1YmxpYyB3aGVuUFVUKHVyaTogc3RyaW5nKTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIHJldHVybiB0aGlzLndoZW5SZXF1ZXN0SXMobmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcInB1dFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlbkRFTEVURSh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJkZWxldGVcIixcbiAgICAgIHVybDogdGhpcy5hYnNvbHV0ZVVyaSh1cmkpXG4gICAgfSkpO1xuICB9XG5cbiAgcHVibGljIHdoZW5QQVRDSCh1cmk6IHN0cmluZyk6IFJlc3BvbnNlU2V0dGVyIHtcbiAgICByZXR1cm4gdGhpcy53aGVuUmVxdWVzdElzKG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJwYXRjaFwiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwdWJsaWMgd2hlbk9QVElPTlModXJpOiBzdHJpbmcpOiBSZXNwb25zZVNldHRlciB7XG4gICAgcmV0dXJuIHRoaXMud2hlblJlcXVlc3RJcyhuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwib3B0aW9uc1wiLFxuICAgICAgdXJsOiB0aGlzLmFic29sdXRlVXJpKHVyaSlcbiAgICB9KSk7XG4gIH1cblxuICBwcml2YXRlIG1hcmtSZXF1ZXN0QXNQZW5kaW5nKHJlcTogUmVxdWVzdCwgYmVoYXZpb3I6IEJlaGF2aW9yKSB7XG4gICAgaWYgKHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbiAhPT0gbnVsbCkge1xuICAgICAgY29uc3QgcGVuZGluZ1JlcURlc2NyID0gUmVxdWVzdE1ldGhvZFt0aGlzLnBlbmRpbmdCZWhhdmlvclNwZWNpZmljYXRpb24ucmVxdWVzdC5tZXRob2RdLnRvVXBwZXJDYXNlKClcbiAgICAgICAgKyBcIiBcIiArIHRoaXMucGVuZGluZ0JlaGF2aW9yU3BlY2lmaWNhdGlvbi5yZXF1ZXN0LnVybDtcbiAgICAgIGNvbnN0IHJlcURlc2NyID0gUmVxdWVzdE1ldGhvZFtyZXEubWV0aG9kXS50b1VwcGVyQ2FzZSgpICsgXCIgXCIgKyByZXEudXJsO1xuICAgICAgdGhyb3cgbmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwidW5maW5pc2hlZCBiZWhhdmlvciBkZWZpbml0aW9uOiBjYW5ub3QgY29uZmlndXJlIFwiXG4gICAgICAgICsgcmVxRGVzY3IgKyBcIiBiZWZvcmUgc2V0dGluZyB0aGUgcmVzcG9uc2UgZm9yIFwiICsgcGVuZGluZ1JlcURlc2NyKTtcbiAgICB9XG4gICAgdGhpcy5wZW5kaW5nQmVoYXZpb3JTcGVjaWZpY2F0aW9uID0ge1xuICAgICAgcmVxdWVzdDogcmVxLFxuICAgICAgcHJlbWF0Y2hlZEJlaGF2aW9yOiBiZWhhdmlvclxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIHJlbGF0aXZlUGF0aChhYnNvbHV0ZVVyaTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCB1cmwgPSBuZXcgVVJMKGFic29sdXRlVXJpKTtcbiAgICByZXR1cm4gdXJsLnBhdGhuYW1lICsgdXJsLnF1ZXJ5ICsgdXJsLmhhc2g7XG4gIH1cblxuICBwdWJsaWMgd2hlblJlcXVlc3RJcyhyZXF1ZXN0OiBSZXF1ZXN0KTogUmVzcG9uc2VTZXR0ZXIge1xuICAgIGNvbnN0IHBhdGggPSB0aGlzLnJlbGF0aXZlUGF0aChyZXF1ZXN0LnVybCksIG1ldGhvZCA9ICBSZXF1ZXN0TWV0aG9kW3JlcXVlc3QubWV0aG9kXTtcblxuICAgIGxldCB2YWxpZGF0aW9uRXJyb3I7XG4gICAgZm9yIChjb25zdCBpIGluIHRoaXMuZGVmaW5lZCkgIHtcbiAgICAgIGNvbnN0IGJlaGF2aW9yID0gdGhpcy5kZWZpbmVkW2ldO1xuICAgICAgaWYgKGJlaGF2aW9yLnJlcXVlc3RQYXR0ZXJuLm1hdGNoZXMocmVxdWVzdCkpIHtcbiAgICAgICAgdGhpcy5tYXJrUmVxdWVzdEFzUGVuZGluZyhyZXF1ZXN0LCBiZWhhdmlvcik7XG4gICAgICAgIGlmICgodmFsaWRhdGlvbkVycm9yID0gYmVoYXZpb3IucmVxdWVzdFZhbGlkYXRvci5tYXRjaGVzKHJlcXVlc3QpKSA9PT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiBuZXcgUmVzcG9uc2VTZXR0ZXIodGhpcywgcmVzcG9uc2UgPT4gdGhpcy5vblN0dWJSZXNwb25zZUF2YWlsYWJsZShuZXcgUmVxdWVzdFBhdHRlcm4ocGF0aCwgbWV0aG9kLCBudWxsKSwgcmVzcG9uc2UpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IodmFsaWRhdGlvbkVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJmb3VuZCBubyBkZWNsYXJhdGlvbiBvZiByZXF1ZXN0IFtcIisgbWV0aG9kLnRvVXBwZXJDYXNlKClcbiAgICAgICsgXCIgXCIgKyBwYXRoICsgXCJdIGluIFJBTUwgLSByZWZ1c2luZyB0byBzdHViXCIpO1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZUJhY2tlbmQoKTogUkFNTEJhY2tlbmQge1xuICAgIHJldHVybiBuZXcgUkFNTEJhY2tlbmQodGhpcy5zdHViYmVkLCB0aGlzLmV4cGVjdGVkKTtcbiAgfVxuXG59XG4iXX0=
