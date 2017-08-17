"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var testing_1 = require("@angular/http/testing");
var http_1 = require("@angular/http");
var query_string_1 = require("query-string");
var Ajv = require("ajv");
var ajv = new Ajv();
var MalformedRequestError = (function (_super) {
    __extends(MalformedRequestError, _super);
    function MalformedRequestError(failureReason) {
        return _super.call(this, JSON.stringify(failureReason)) || this;
    }
    return MalformedRequestError;
}(Error));
exports.MalformedRequestError = MalformedRequestError;
var DefaultRequestValidator = (function () {
    function DefaultRequestValidator(method) {
        var _this = this;
        this.expectedQueryParams = [];
        method.queryParameters().forEach(function (param) { return _this.expectedQueryParams.push(param.name()); });
    }
    DefaultRequestValidator.prototype.parseQueryString = function (url) {
        return query_string_1.parse(query_string_1.extract(url));
    };
    DefaultRequestValidator.prototype.matches = function (request) {
        if (this.expectedQueryParams.length > 0) {
            var actualQueryParams = this.parseQueryString(request.url);
            for (var paramName in actualQueryParams) {
                if (this.expectedQueryParams.indexOf(paramName) == -1) {
                    return "undeclared query parameter [" + paramName + "] found in request";
                }
            }
        }
        return null;
    };
    return DefaultRequestValidator;
}());
exports.DefaultRequestValidator = DefaultRequestValidator;
var NoopRequestValidator = (function () {
    function NoopRequestValidator() {
    }
    NoopRequestValidator.prototype.matches = function (request) {
        return null;
    };
    return NoopRequestValidator;
}());
exports.NoopRequestValidator = NoopRequestValidator;
var MatchResult = (function () {
    function MatchResult(uriParams, response, requestValidator) {
        this.uriParams = uriParams;
        this.response = response;
        this.requestValidator = requestValidator;
    }
    return MatchResult;
}());
function uriPatternToRegexp(uriPattern) {
    var remainingUriPattern = uriPattern, openingBracketIdx, closingBracketIdx, paramName;
    var uriParamNames = [];
    while ((openingBracketIdx = remainingUriPattern.indexOf("{")) !== -1) {
        remainingUriPattern = remainingUriPattern.substring(openingBracketIdx + 1);
        closingBracketIdx = remainingUriPattern.indexOf("}");
        paramName = remainingUriPattern.substring(0, closingBracketIdx);
        uriParamNames.push(paramName);
        remainingUriPattern = remainingUriPattern.substring(closingBracketIdx + 1);
    }
    var tmp = uriPattern.replace(/\{\w+\}/g, "(.*)");
    return [uriParamNames, new RegExp(tmp)];
}
var URIPattern = (function () {
    function URIPattern(uriPattern) {
        var patternMatch = uriPatternToRegexp(uriPattern);
        this.paramNames = patternMatch[0];
        this.pattern = patternMatch[1];
    }
    URIPattern.prototype.matches = function (uri) {
        var matches = this.pattern.test(uri);
        var arr = this.pattern.exec(uri);
        if (arr === null) {
            return null;
        }
        var paramMap = {};
        for (var i = 0; i < this.paramNames.length; ++i) {
            paramMap[this.paramNames[i]] = arr[i + 1];
        }
        return matches ? paramMap : null;
    };
    return URIPattern;
}());
exports.URIPattern = URIPattern;
var RequestPattern = (function () {
    function RequestPattern(expectedUri, expectedMethod, schema) {
        this.expectedMethod = expectedMethod;
        this.schema = schema;
        this.expectedUri = new URIPattern(expectedUri);
    }
    RequestPattern.prototype.matches = function (request) {
        var actualMethod = http_1.RequestMethod[request.method].toLowerCase();
        var uriParams = this.expectedUri.matches(request.url);
        if (!(actualMethod.toLowerCase() === this.expectedMethod.toLowerCase()
            && uriParams !== null)) {
            return null;
        }
        var jsonBody = JSON.parse(request.getBody());
        if (this.schema != null && !ajv.validate(this.schema, jsonBody)) {
            throw new MalformedRequestError(ajv.errors);
        }
        return uriParams;
    };
    return RequestPattern;
}());
exports.RequestPattern = RequestPattern;
var RAMLBackend = (function (_super) {
    __extends(RAMLBackend, _super);
    function RAMLBackend(stubbed, expected) {
        if (stubbed === void 0) { stubbed = []; }
        if (expected === void 0) { expected = []; }
        var _this = _super.call(this) || this;
        _this.stubbed = stubbed;
        _this.expected = expected;
        _this.connections.subscribe(_this.handleConnection.bind(_this));
        return _this;
    }
    RAMLBackend.prototype.findMatchingResponse = function (request) {
        for (var i in this.stubbed) {
            var entry = this.stubbed[i];
            var uriParams = entry.requestPattern.matches(request);
            if (uriParams !== null) {
                return new MatchResult(uriParams, entry.response, entry.requestValidator);
            }
        }
        throw new Error("no matching request pattern found");
    };
    RAMLBackend.prototype.handleConnection = function (conn) {
        var request = conn.request;
        var response;
        var matchResult = this.findMatchingResponse(request);
        var errorMessage = matchResult.requestValidator.matches(request);
        if (errorMessage !== null) {
            response = new http_1.Response(new http_1.ResponseOptions({
                status: 401,
                body: JSON.stringify({ message: errorMessage })
            }));
        }
        else {
            response = matchResult.response;
        }
        conn.mockRespond(response);
    };
    return RAMLBackend;
}(testing_1.MockBackend));
exports.RAMLBackend = RAMLBackend;
//# sourceMappingURL=RAMLBackend.js.map