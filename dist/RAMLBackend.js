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
        this.expectedQueryParams = [];
        for (var paramName in (method["queryParameters"] || {})) {
            this.expectedQueryParams.push(paramName);
        }
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFDLG9CQUFvQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3ZELElBQUksWUFBWSxHQUFHLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDakUsRUFBRSxDQUFDLENBQUMsWUFBWSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDMUIsUUFBUSxHQUFHLElBQUksZUFBUSxDQUFDLElBQUksc0JBQWUsQ0FBQztnQkFDMUMsTUFBTSxFQUFFLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBQyxPQUFPLEVBQUUsWUFBWSxFQUFDLENBQUM7YUFDOUMsQ0FBQyxDQUFDLENBQUM7UUFDTixDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixRQUFRLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQztRQUNsQyxDQUFDO1FBQ0QsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUM3QixDQUFDO0lBRUgsa0JBQUM7QUFBRCxDQXBDQSxBQW9DQyxDQXBDZ0MscUJBQVcsR0FvQzNDO0FBcENZLGtDQUFXIiwiZmlsZSI6IlJBTUxCYWNrZW5kLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtNb2NrQmFja2VuZCwgTW9ja0Nvbm5lY3Rpb259IGZyb20gXCJAYW5ndWxhci9odHRwL3Rlc3RpbmdcIjtcbmltcG9ydCB7UmVxdWVzdCwgUmVxdWVzdE1ldGhvZCwgUmVzcG9uc2UsIFJlc3BvbnNlT3B0aW9uc30gZnJvbSBcIkBhbmd1bGFyL2h0dHBcIjtcbmltcG9ydCB7ZXh0cmFjdCwgcGFyc2V9IGZyb20gXCJxdWVyeS1zdHJpbmdcIjtcbmltcG9ydCBBanYgPSByZXF1aXJlKFwiYWp2XCIpO1xuXG5jb25zdCBhanYgPSBuZXcgQWp2KCk7XG5cbmV4cG9ydCBjbGFzcyBNYWxmb3JtZWRSZXF1ZXN0RXJyb3IgZXh0ZW5kcyBFcnJvciB7XG5cbiAgY29uc3RydWN0b3IoZmFpbHVyZVJlYXNvbjogYW55W10pIHtcbiAgICBzdXBlcihKU09OLnN0cmluZ2lmeShmYWlsdXJlUmVhc29uKSk7XG4gIH1cblxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFVSSVBhcmFtcyB7XG5cbiAgW3BhcmFtTmFtZTogc3RyaW5nXTogYW55XG5cbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZXF1ZXN0VmFsaWRhdG9yIHtcblxuICBtYXRjaGVzKHJlcXVlc3Q6IFJlcXVlc3QpOiBzdHJpbmc7XG5cbn1cblxuZXhwb3J0IGNsYXNzIERlZmF1bHRSZXF1ZXN0VmFsaWRhdG9yIGltcGxlbWVudHMgUmVxdWVzdFZhbGlkYXRvciB7XG5cbiAgcHJpdmF0ZSBleHBlY3RlZFF1ZXJ5UGFyYW1zOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKG1ldGhvZCkge1xuICAgIGZvciAodmFyIHBhcmFtTmFtZSBpbiAobWV0aG9kW1wicXVlcnlQYXJhbWV0ZXJzXCJdIHx8IHt9KSkge1xuICAgICAgdGhpcy5leHBlY3RlZFF1ZXJ5UGFyYW1zLnB1c2gocGFyYW1OYW1lKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHBhcnNlUXVlcnlTdHJpbmcodXJsOiBzdHJpbmcpOiBvYmplY3Qge1xuICAgIHJldHVybiBwYXJzZShleHRyYWN0KHVybCkpO1xuICB9XG5cbiAgcHVibGljIG1hdGNoZXMocmVxdWVzdDogUmVxdWVzdCk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMuZXhwZWN0ZWRRdWVyeVBhcmFtcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBhY3R1YWxRdWVyeVBhcmFtcyA9IHRoaXMucGFyc2VRdWVyeVN0cmluZyhyZXF1ZXN0LnVybCk7XG4gICAgICBmb3IgKGNvbnN0IHBhcmFtTmFtZSBpbiBhY3R1YWxRdWVyeVBhcmFtcykge1xuICAgICAgICBpZiAodGhpcy5leHBlY3RlZFF1ZXJ5UGFyYW1zLmluZGV4T2YocGFyYW1OYW1lKSA9PSAtMSkge1xuICAgICAgICAgIHJldHVybiBcInVuZGVjbGFyZWQgcXVlcnkgcGFyYW1ldGVyIFtcIiArIHBhcmFtTmFtZSArIFwiXSBmb3VuZCBpbiByZXF1ZXN0XCI7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxufVxuXG5leHBvcnQgY2xhc3MgTm9vcFJlcXVlc3RWYWxpZGF0b3Ige1xuXG4gIHB1YmxpYyBtYXRjaGVzKHJlcXVlc3Q6IFJlcXVlc3QpOiBzdHJpbmcge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbn1cblxuY2xhc3MgTWF0Y2hSZXN1bHQge1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHJlYWRvbmx5IHVyaVBhcmFtczogVVJJUGFyYW1zLFxuICAgIHJlYWRvbmx5IHJlc3BvbnNlOiBSZXNwb25zZSxcbiAgICByZWFkb25seSByZXF1ZXN0VmFsaWRhdG9yXG4gICkge31cblxufVxuXG5mdW5jdGlvbiB1cmlQYXR0ZXJuVG9SZWdleHAodXJpUGF0dGVybjogc3RyaW5nKTogW3N0cmluZ1tdLCBSZWdFeHBdIHtcbiAgbGV0IHJlbWFpbmluZ1VyaVBhdHRlcm4gPSB1cmlQYXR0ZXJuLCBvcGVuaW5nQnJhY2tldElkeCwgY2xvc2luZ0JyYWNrZXRJZHgsIHBhcmFtTmFtZTtcbiAgY29uc3QgdXJpUGFyYW1OYW1lczogc3RyaW5nW10gPSBbXTtcblxuICB3aGlsZSgob3BlbmluZ0JyYWNrZXRJZHggPSByZW1haW5pbmdVcmlQYXR0ZXJuLmluZGV4T2YoXCJ7XCIpKSAhPT0gLTEpIHtcbiAgICByZW1haW5pbmdVcmlQYXR0ZXJuID0gcmVtYWluaW5nVXJpUGF0dGVybi5zdWJzdHJpbmcob3BlbmluZ0JyYWNrZXRJZHggKyAxKTtcbiAgICBjbG9zaW5nQnJhY2tldElkeCA9IHJlbWFpbmluZ1VyaVBhdHRlcm4uaW5kZXhPZihcIn1cIik7XG4gICAgcGFyYW1OYW1lID0gcmVtYWluaW5nVXJpUGF0dGVybi5zdWJzdHJpbmcoMCwgY2xvc2luZ0JyYWNrZXRJZHgpO1xuICAgIHVyaVBhcmFtTmFtZXMucHVzaChwYXJhbU5hbWUpO1xuICAgIHJlbWFpbmluZ1VyaVBhdHRlcm4gPSByZW1haW5pbmdVcmlQYXR0ZXJuLnN1YnN0cmluZyhjbG9zaW5nQnJhY2tldElkeCArIDEpO1xuICB9XG5cbiAgY29uc3QgdG1wID0gdXJpUGF0dGVybi5yZXBsYWNlKC9cXHtcXHcrXFx9L2csIFwiKC4qKVwiKTtcbiAgcmV0dXJuIFt1cmlQYXJhbU5hbWVzLCBuZXcgUmVnRXhwKHRtcCldO1xufVxuXG5leHBvcnQgY2xhc3MgVVJJUGF0dGVybiB7XG5cbiAgcHJpdmF0ZSBwYXR0ZXJuOiBSZWdFeHA7XG5cbiAgcHJpdmF0ZSBwYXJhbU5hbWVzOiBzdHJpbmdbXTtcblxuICBjb25zdHJ1Y3Rvcih1cmlQYXR0ZXJuOiBzdHJpbmcpIHtcbiAgICBsZXQgcGF0dGVybk1hdGNoID0gdXJpUGF0dGVyblRvUmVnZXhwKHVyaVBhdHRlcm4pO1xuICAgIHRoaXMucGFyYW1OYW1lcyA9IHBhdHRlcm5NYXRjaFswXTtcbiAgICB0aGlzLnBhdHRlcm4gPSBwYXR0ZXJuTWF0Y2hbMV07XG4gIH1cblxuICBwdWJsaWMgbWF0Y2hlcyh1cmk6IHN0cmluZyk6IFVSSVBhcmFtcyB7XG4gICAgY29uc3QgbWF0Y2hlcyA9IHRoaXMucGF0dGVybi50ZXN0KHVyaSk7XG4gICAgY29uc3QgYXJyID0gdGhpcy5wYXR0ZXJuLmV4ZWModXJpKTtcbiAgICBpZiAoYXJyID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgcGFyYW1NYXA6IFVSSVBhcmFtcyA9IHt9O1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5wYXJhbU5hbWVzLmxlbmd0aDsgKytpKSB7XG4gICAgICBwYXJhbU1hcFt0aGlzLnBhcmFtTmFtZXNbaV1dID0gYXJyW2kgKyAxXTtcbiAgICB9XG4gICAgcmV0dXJuIG1hdGNoZXMgPyBwYXJhbU1hcCA6IG51bGw7XG4gIH1cblxufVxuXG5leHBvcnQgY2xhc3MgUmVxdWVzdFBhdHRlcm4ge1xuXG4gIHByaXZhdGUgZXhwZWN0ZWRVcmk6IFVSSVBhdHRlcm47XG5cbiAgY29uc3RydWN0b3IoXG4gICAgZXhwZWN0ZWRVcmk6IHN0cmluZyxcbiAgICByZWFkb25seSBleHBlY3RlZE1ldGhvZDogc3RyaW5nLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgc2NoZW1hXG4gICkge1xuICAgIHRoaXMuZXhwZWN0ZWRVcmkgPSBuZXcgVVJJUGF0dGVybihleHBlY3RlZFVyaSk7XG4gIH1cblxuICBwdWJsaWMgbWF0Y2hlcyhyZXF1ZXN0OiBSZXF1ZXN0KTogVVJJUGFyYW1zIHtcbiAgICBjb25zdCBhY3R1YWxNZXRob2QgPSBSZXF1ZXN0TWV0aG9kW3JlcXVlc3QubWV0aG9kXS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IHVyaVBhcmFtcyA9IHRoaXMuZXhwZWN0ZWRVcmkubWF0Y2hlcyhyZXF1ZXN0LnVybCk7XG4gICAgaWYgKCEgKGFjdHVhbE1ldGhvZC50b0xvd2VyQ2FzZSgpID09PSB0aGlzLmV4cGVjdGVkTWV0aG9kLnRvTG93ZXJDYXNlKClcbiAgICAgICYmIHVyaVBhcmFtcyAhPT0gbnVsbCkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBqc29uQm9keSA9IEpTT04ucGFyc2UocmVxdWVzdC5nZXRCb2R5KCkpO1xuICAgIGlmICh0aGlzLnNjaGVtYSAhPSBudWxsICYmICFhanYudmFsaWRhdGUodGhpcy5zY2hlbWEsIGpzb25Cb2R5KSkge1xuICAgICAgdGhyb3cgbmV3IE1hbGZvcm1lZFJlcXVlc3RFcnJvcihhanYuZXJyb3JzKTtcbiAgICB9XG4gICAgcmV0dXJuIHVyaVBhcmFtcztcbiAgfVxuXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQmVoYXZpb3Ige1xuXG4gIHJlcXVlc3RQYXR0ZXJuOiBSZXF1ZXN0UGF0dGVybjtcblxuICByZXNwb25zZTogUmVzcG9uc2U7XG5cbiAgcmVxdWVzdFZhbGlkYXRvcj8gOiBSZXF1ZXN0VmFsaWRhdG9yO1xuXG59XG5cbmV4cG9ydCBjbGFzcyBSQU1MQmFja2VuZCBleHRlbmRzIE1vY2tCYWNrZW5kIHtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHN0dWJiZWQ6IEJlaGF2aW9yW10gPSBbXSwgcHJpdmF0ZSBleHBlY3RlZDogQmVoYXZpb3JbXSA9IFtdKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmNvbm5lY3Rpb25zLnN1YnNjcmliZSh0aGlzLmhhbmRsZUNvbm5lY3Rpb24uYmluZCh0aGlzKSk7XG4gIH1cblxuXG4gIHByaXZhdGUgZmluZE1hdGNoaW5nUmVzcG9uc2UocmVxdWVzdDogUmVxdWVzdCk6IE1hdGNoUmVzdWx0IHtcbiAgICBmb3IgKGNvbnN0IGkgaW4gdGhpcy5zdHViYmVkKSB7XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMuc3R1YmJlZFtpXTtcbiAgICAgIGNvbnN0IHVyaVBhcmFtcyA9IGVudHJ5LnJlcXVlc3RQYXR0ZXJuLm1hdGNoZXMocmVxdWVzdCk7XG4gICAgICBpZiAodXJpUGFyYW1zICE9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBuZXcgTWF0Y2hSZXN1bHQodXJpUGFyYW1zLCBlbnRyeS5yZXNwb25zZSwgZW50cnkucmVxdWVzdFZhbGlkYXRvcik7XG4gICAgICB9XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcihcIm5vIG1hdGNoaW5nIHJlcXVlc3QgcGF0dGVybiBmb3VuZFwiKTtcbiAgfVxuXG4gIHByaXZhdGUgaGFuZGxlQ29ubmVjdGlvbihjb25uOiBNb2NrQ29ubmVjdGlvbikge1xuICAgIGNvbnN0IHJlcXVlc3QgPSBjb25uLnJlcXVlc3Q7XG4gICAgbGV0IHJlc3BvbnNlO1xuXG4gICAgY29uc3QgbWF0Y2hSZXN1bHQgPSB0aGlzLmZpbmRNYXRjaGluZ1Jlc3BvbnNlKHJlcXVlc3QpO1xuICAgIGxldCBlcnJvck1lc3NhZ2UgPSBtYXRjaFJlc3VsdC5yZXF1ZXN0VmFsaWRhdG9yLm1hdGNoZXMocmVxdWVzdCk7XG4gICAgaWYgKGVycm9yTWVzc2FnZSAhPT0gbnVsbCkge1xuICAgICAgcmVzcG9uc2UgPSBuZXcgUmVzcG9uc2UobmV3IFJlc3BvbnNlT3B0aW9ucyh7XG4gICAgICAgIHN0YXR1czogNDAxLFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7bWVzc2FnZTogZXJyb3JNZXNzYWdlfSlcbiAgICAgIH0pKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzcG9uc2UgPSBtYXRjaFJlc3VsdC5yZXNwb25zZTtcbiAgICB9XG4gICAgY29ubi5tb2NrUmVzcG9uZChyZXNwb25zZSk7XG4gIH1cblxufVxuIl19
