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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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b0JBQW9CLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDdkQsSUFBSSxZQUFZLEdBQUcsV0FBVyxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNqRSxFQUFFLENBQUMsQ0FBQyxZQUFZLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztZQUMxQixRQUFRLEdBQUcsSUFBSSxlQUFRLENBQUMsSUFBSSxzQkFBZSxDQUFDO2dCQUMxQyxNQUFNLEVBQUUsR0FBRztnQkFDWCxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUMsQ0FBQzthQUM5QyxDQUFDLENBQUMsQ0FBQztRQUNOLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLFFBQVEsR0FBRyxXQUFXLENBQUMsUUFBUSxDQUFDO1FBQ2xDLENBQUM7UUFDRCxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzdCLENBQUM7SUFFSCxrQkFBQztBQUFELENBcENBLEFBb0NDLENBcENnQyxxQkFBVyxHQW9DM0M7QUFwQ1ksa0NBQVciLCJmaWxlIjoiUkFNTEJhY2tlbmQuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge01vY2tCYWNrZW5kLCBNb2NrQ29ubmVjdGlvbn0gZnJvbSBcIkBhbmd1bGFyL2h0dHAvdGVzdGluZ1wiO1xuaW1wb3J0IHtSZXF1ZXN0LCBSZXF1ZXN0TWV0aG9kLCBSZXNwb25zZSwgUmVzcG9uc2VPcHRpb25zfSBmcm9tIFwiQGFuZ3VsYXIvaHR0cFwiO1xuaW1wb3J0IHtleHRyYWN0LCBwYXJzZX0gZnJvbSBcInF1ZXJ5LXN0cmluZ1wiO1xuaW1wb3J0IEFqdiA9IHJlcXVpcmUoXCJhanZcIik7XG5cbmNvbnN0IGFqdiA9IG5ldyBBanYoKTtcblxuZXhwb3J0IGNsYXNzIE1hbGZvcm1lZFJlcXVlc3RFcnJvciBleHRlbmRzIEVycm9yIHtcblxuICBjb25zdHJ1Y3RvcihmYWlsdXJlUmVhc29uOiBhbnlbXSkge1xuICAgIHN1cGVyKEpTT04uc3RyaW5naWZ5KGZhaWx1cmVSZWFzb24pKTtcbiAgfVxuXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVVJJUGFyYW1zIHtcblxuICBbcGFyYW1OYW1lOiBzdHJpbmddOiBhbnlcblxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJlcXVlc3RWYWxpZGF0b3Ige1xuXG4gIG1hdGNoZXMocmVxdWVzdDogUmVxdWVzdCk6IHN0cmluZztcblxufVxuXG5leHBvcnQgY2xhc3MgRGVmYXVsdFJlcXVlc3RWYWxpZGF0b3IgaW1wbGVtZW50cyBSZXF1ZXN0VmFsaWRhdG9yIHtcblxuICBwcml2YXRlIGV4cGVjdGVkUXVlcnlQYXJhbXM6IHN0cmluZ1tdID0gW107XG5cbiAgY29uc3RydWN0b3IobWV0aG9kKSB7XG4gICAgbWV0aG9kLnF1ZXJ5UGFyYW1ldGVycygpLmZvckVhY2gocGFyYW0gPT4gdGhpcy5leHBlY3RlZFF1ZXJ5UGFyYW1zLnB1c2gocGFyYW0ubmFtZSgpKSk7XG4gIH1cblxuICBwcml2YXRlIHBhcnNlUXVlcnlTdHJpbmcodXJsOiBzdHJpbmcpOiBvYmplY3Qge1xuICAgIHJldHVybiBwYXJzZShleHRyYWN0KHVybCkpO1xuICB9XG5cbiAgcHVibGljIG1hdGNoZXMocmVxdWVzdDogUmVxdWVzdCk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMuZXhwZWN0ZWRRdWVyeVBhcmFtcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBhY3R1YWxRdWVyeVBhcmFtcyA9IHRoaXMucGFyc2VRdWVyeVN0cmluZyhyZXF1ZXN0LnVybCk7XG4gICAgICBmb3IgKGNvbnN0IHBhcmFtTmFtZSBpbiBhY3R1YWxRdWVyeVBhcmFtcykge1xuICAgICAgICBpZiAodGhpcy5leHBlY3RlZFF1ZXJ5UGFyYW1zLmluZGV4T2YocGFyYW1OYW1lKSA9PSAtMSkge1xuICAgICAgICAgIHJldHVybiBcInVuZGVjbGFyZWQgcXVlcnkgcGFyYW1ldGVyIFtcIiArIHBhcmFtTmFtZSArIFwiXSBmb3VuZCBpbiByZXF1ZXN0XCI7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxufVxuXG5leHBvcnQgY2xhc3MgTm9vcFJlcXVlc3RWYWxpZGF0b3Ige1xuXG4gIHB1YmxpYyBtYXRjaGVzKHJlcXVlc3Q6IFJlcXVlc3QpOiBzdHJpbmcge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbn1cblxuY2xhc3MgTWF0Y2hSZXN1bHQge1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHJlYWRvbmx5IHVyaVBhcmFtczogVVJJUGFyYW1zLFxuICAgIHJlYWRvbmx5IHJlc3BvbnNlOiBSZXNwb25zZSxcbiAgICByZWFkb25seSByZXF1ZXN0VmFsaWRhdG9yXG4gICkge31cblxufVxuXG5mdW5jdGlvbiB1cmlQYXR0ZXJuVG9SZWdleHAodXJpUGF0dGVybjogc3RyaW5nKTogW3N0cmluZ1tdLCBSZWdFeHBdIHtcbiAgbGV0IHJlbWFpbmluZ1VyaVBhdHRlcm4gPSB1cmlQYXR0ZXJuLCBvcGVuaW5nQnJhY2tldElkeCwgY2xvc2luZ0JyYWNrZXRJZHgsIHBhcmFtTmFtZTtcbiAgY29uc3QgdXJpUGFyYW1OYW1lczogc3RyaW5nW10gPSBbXTtcblxuICB3aGlsZSgob3BlbmluZ0JyYWNrZXRJZHggPSByZW1haW5pbmdVcmlQYXR0ZXJuLmluZGV4T2YoXCJ7XCIpKSAhPT0gLTEpIHtcbiAgICByZW1haW5pbmdVcmlQYXR0ZXJuID0gcmVtYWluaW5nVXJpUGF0dGVybi5zdWJzdHJpbmcob3BlbmluZ0JyYWNrZXRJZHggKyAxKTtcbiAgICBjbG9zaW5nQnJhY2tldElkeCA9IHJlbWFpbmluZ1VyaVBhdHRlcm4uaW5kZXhPZihcIn1cIik7XG4gICAgcGFyYW1OYW1lID0gcmVtYWluaW5nVXJpUGF0dGVybi5zdWJzdHJpbmcoMCwgY2xvc2luZ0JyYWNrZXRJZHgpO1xuICAgIHVyaVBhcmFtTmFtZXMucHVzaChwYXJhbU5hbWUpO1xuICAgIHJlbWFpbmluZ1VyaVBhdHRlcm4gPSByZW1haW5pbmdVcmlQYXR0ZXJuLnN1YnN0cmluZyhjbG9zaW5nQnJhY2tldElkeCArIDEpO1xuICB9XG5cbiAgY29uc3QgdG1wID0gdXJpUGF0dGVybi5yZXBsYWNlKC9cXHtcXHcrXFx9L2csIFwiKC4qKVwiKTtcbiAgcmV0dXJuIFt1cmlQYXJhbU5hbWVzLCBuZXcgUmVnRXhwKHRtcCldO1xufVxuXG5leHBvcnQgY2xhc3MgVVJJUGF0dGVybiB7XG5cbiAgcHJpdmF0ZSBwYXR0ZXJuOiBSZWdFeHA7XG5cbiAgcHJpdmF0ZSBwYXJhbU5hbWVzOiBzdHJpbmdbXTtcblxuICBjb25zdHJ1Y3Rvcih1cmlQYXR0ZXJuOiBzdHJpbmcpIHtcbiAgICBsZXQgcGF0dGVybk1hdGNoID0gdXJpUGF0dGVyblRvUmVnZXhwKHVyaVBhdHRlcm4pO1xuICAgIHRoaXMucGFyYW1OYW1lcyA9IHBhdHRlcm5NYXRjaFswXTtcbiAgICB0aGlzLnBhdHRlcm4gPSBwYXR0ZXJuTWF0Y2hbMV07XG4gIH1cblxuICBwdWJsaWMgbWF0Y2hlcyh1cmk6IHN0cmluZyk6IFVSSVBhcmFtcyB7XG4gICAgY29uc3QgbWF0Y2hlcyA9IHRoaXMucGF0dGVybi50ZXN0KHVyaSk7XG4gICAgY29uc3QgYXJyID0gdGhpcy5wYXR0ZXJuLmV4ZWModXJpKTtcbiAgICBpZiAoYXJyID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgcGFyYW1NYXA6IFVSSVBhcmFtcyA9IHt9O1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5wYXJhbU5hbWVzLmxlbmd0aDsgKytpKSB7XG4gICAgICBwYXJhbU1hcFt0aGlzLnBhcmFtTmFtZXNbaV1dID0gYXJyW2kgKyAxXTtcbiAgICB9XG4gICAgcmV0dXJuIG1hdGNoZXMgPyBwYXJhbU1hcCA6IG51bGw7XG4gIH1cblxufVxuXG5leHBvcnQgY2xhc3MgUmVxdWVzdFBhdHRlcm4ge1xuXG4gIHByaXZhdGUgZXhwZWN0ZWRVcmk6IFVSSVBhdHRlcm47XG5cbiAgY29uc3RydWN0b3IoXG4gICAgZXhwZWN0ZWRVcmk6IHN0cmluZyxcbiAgICByZWFkb25seSBleHBlY3RlZE1ldGhvZDogc3RyaW5nLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgc2NoZW1hXG4gICkge1xuICAgIHRoaXMuZXhwZWN0ZWRVcmkgPSBuZXcgVVJJUGF0dGVybihleHBlY3RlZFVyaSk7XG4gIH1cblxuICBwdWJsaWMgbWF0Y2hlcyhyZXF1ZXN0OiBSZXF1ZXN0KTogVVJJUGFyYW1zIHtcbiAgICBjb25zdCBhY3R1YWxNZXRob2QgPSBSZXF1ZXN0TWV0aG9kW3JlcXVlc3QubWV0aG9kXS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IHVyaVBhcmFtcyA9IHRoaXMuZXhwZWN0ZWRVcmkubWF0Y2hlcyhyZXF1ZXN0LnVybCk7XG4gICAgaWYgKCEgKGFjdHVhbE1ldGhvZC50b0xvd2VyQ2FzZSgpID09PSB0aGlzLmV4cGVjdGVkTWV0aG9kLnRvTG93ZXJDYXNlKClcbiAgICAgICYmIHVyaVBhcmFtcyAhPT0gbnVsbCkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBqc29uQm9keSA9IEpTT04ucGFyc2UocmVxdWVzdC5nZXRCb2R5KCkpO1xuICAgIGlmICh0aGlzLnNjaGVtYSAhPSBudWxsICYmICFhanYudmFsaWRhdGUodGhpcy5zY2hlbWEsIGpzb25Cb2R5KSkge1xuICAgICAgdGhyb3cgbmV3IE1hbGZvcm1lZFJlcXVlc3RFcnJvcihhanYuZXJyb3JzKTtcbiAgICB9XG4gICAgcmV0dXJuIHVyaVBhcmFtcztcbiAgfVxuXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQmVoYXZpb3Ige1xuXG4gIHJlcXVlc3RQYXR0ZXJuOiBSZXF1ZXN0UGF0dGVybjtcblxuICByZXNwb25zZTogUmVzcG9uc2U7XG5cbiAgcmVxdWVzdFZhbGlkYXRvcj8gOiBSZXF1ZXN0VmFsaWRhdG9yO1xuXG59XG5cbmV4cG9ydCBjbGFzcyBSQU1MQmFja2VuZCBleHRlbmRzIE1vY2tCYWNrZW5kIHtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHN0dWJiZWQ6IEJlaGF2aW9yW10gPSBbXSwgcHJpdmF0ZSBleHBlY3RlZDogQmVoYXZpb3JbXSA9IFtdKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmNvbm5lY3Rpb25zLnN1YnNjcmliZSh0aGlzLmhhbmRsZUNvbm5lY3Rpb24uYmluZCh0aGlzKSk7XG4gIH1cblxuXG4gIHByaXZhdGUgZmluZE1hdGNoaW5nUmVzcG9uc2UocmVxdWVzdDogUmVxdWVzdCk6IE1hdGNoUmVzdWx0IHtcbiAgICBmb3IgKGNvbnN0IGkgaW4gdGhpcy5zdHViYmVkKSB7XG4gICAgICBjb25zdCBlbnRyeSA9IHRoaXMuc3R1YmJlZFtpXTtcbiAgICAgIGNvbnN0IHVyaVBhcmFtcyA9IGVudHJ5LnJlcXVlc3RQYXR0ZXJuLm1hdGNoZXMocmVxdWVzdCk7XG4gICAgICBpZiAodXJpUGFyYW1zICE9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBuZXcgTWF0Y2hSZXN1bHQodXJpUGFyYW1zLCBlbnRyeS5yZXNwb25zZSwgZW50cnkucmVxdWVzdFZhbGlkYXRvcik7XG4gICAgICB9XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcihcIm5vIG1hdGNoaW5nIHJlcXVlc3QgcGF0dGVybiBmb3VuZFwiKTtcbiAgfVxuXG4gIHByaXZhdGUgaGFuZGxlQ29ubmVjdGlvbihjb25uOiBNb2NrQ29ubmVjdGlvbikge1xuICAgIGNvbnN0IHJlcXVlc3QgPSBjb25uLnJlcXVlc3Q7XG4gICAgbGV0IHJlc3BvbnNlO1xuXG4gICAgY29uc3QgbWF0Y2hSZXN1bHQgPSB0aGlzLmZpbmRNYXRjaGluZ1Jlc3BvbnNlKHJlcXVlc3QpO1xuICAgIGxldCBlcnJvck1lc3NhZ2UgPSBtYXRjaFJlc3VsdC5yZXF1ZXN0VmFsaWRhdG9yLm1hdGNoZXMocmVxdWVzdCk7XG4gICAgaWYgKGVycm9yTWVzc2FnZSAhPT0gbnVsbCkge1xuICAgICAgcmVzcG9uc2UgPSBuZXcgUmVzcG9uc2UobmV3IFJlc3BvbnNlT3B0aW9ucyh7XG4gICAgICAgIHN0YXR1czogNDAxLFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7bWVzc2FnZTogZXJyb3JNZXNzYWdlfSlcbiAgICAgIH0pKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzcG9uc2UgPSBtYXRjaFJlc3VsdC5yZXNwb25zZTtcbiAgICB9XG4gICAgY29ubi5tb2NrUmVzcG9uZChyZXNwb25zZSk7XG4gIH1cblxufVxuIl19
