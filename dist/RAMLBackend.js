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
    function RequestPattern(expectedUri, expectedMethod, schema, responsePatterns) {
        this.expectedMethod = expectedMethod;
        this.schema = schema;
        this.responsePatterns = responsePatterns;
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
    RequestPattern.prototype.findResponsePatternByStatusCode = function (statusCode) {
        for (var i in this.responsePatterns) {
            var candidate = this.responsePatterns[i];
            if (candidate.expectedStatusCode === statusCode) {
                return candidate;
            }
        }
        return null;
    };
    return RequestPattern;
}());
exports.RequestPattern = RequestPattern;
var ResponsePattern = (function () {
    function ResponsePattern(expectedStatusCode, responseBodySchema) {
        this.expectedStatusCode = expectedStatusCode;
        this.responseBodySchema = responseBodySchema;
    }
    ResponsePattern.prototype.matches = function (response) {
        if (response.status !== this.expectedStatusCode) {
            return false;
        }
        try {
            var respJson = response.json();
            if (!ajv.validate(this.responseBodySchema, respJson)) {
                console.log(ajv.errors);
                return false;
            }
        }
        catch (e) {
            var rawResp = response.text();
            if (!ajv.validate(this.responseBodySchema, rawResp)) {
                return false;
            }
        }
        return true;
    };
    return ResponsePattern;
}());
exports.ResponsePattern = ResponsePattern;
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QyxTQUFTLEVBQUUsS0FBSyxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztZQUM1RSxDQUFDO1FBQ0gsQ0FBQztRQUNELE1BQU0sSUFBSSxLQUFLLENBQUMsbUNBQW1DLENBQUMsQ0FBQztJQUN2RCxDQUFDO0lBRU8sc0NBQWdCLEdBQXhCLFVBQXlCLElBQW9CO1FBQzNDLElBQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7UUFDN0IsSUFBSSxRQUFRLENBQUM7UUFFYixJQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDdkQsSUFBSSxZQUFZLEdBQUcsV0FBVyxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNqRSxFQUFFLENBQUMsQ0FBQyxZQUFZLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztZQUMxQixRQUFRLEdBQUcsSUFBSSxlQUFRLENBQUMsSUFBSSxzQkFBZSxDQUFDO2dCQUMxQyxNQUFNLEVBQUUsR0FBRztnQkFDWCxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUMsQ0FBQzthQUM5QyxDQUFDLENBQUMsQ0FBQztRQUNOLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLFFBQVEsR0FBRyxXQUFXLENBQUMsUUFBUSxDQUFDO1FBQ2xDLENBQUM7UUFDRCxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzdCLENBQUM7SUFFSCxrQkFBQztBQUFELENBcENBLEFBb0NDLENBcENnQyxxQkFBVyxHQW9DM0M7QUFwQ1ksa0NBQVciLCJmaWxlIjoiUkFNTEJhY2tlbmQuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge01vY2tCYWNrZW5kLCBNb2NrQ29ubmVjdGlvbn0gZnJvbSBcIkBhbmd1bGFyL2h0dHAvdGVzdGluZ1wiO1xuaW1wb3J0IHtSZXF1ZXN0LCBSZXF1ZXN0TWV0aG9kLCBSZXNwb25zZSwgUmVzcG9uc2VPcHRpb25zfSBmcm9tIFwiQGFuZ3VsYXIvaHR0cFwiO1xuaW1wb3J0IHtleHRyYWN0LCBwYXJzZX0gZnJvbSBcInF1ZXJ5LXN0cmluZ1wiO1xuaW1wb3J0IEFqdiA9IHJlcXVpcmUoXCJhanZcIik7XG5cbmNvbnN0IGFqdiA9IG5ldyBBanYoKTtcblxuZXhwb3J0IGNsYXNzIE1hbGZvcm1lZFJlcXVlc3RFcnJvciBleHRlbmRzIEVycm9yIHtcblxuICBjb25zdHJ1Y3RvcihmYWlsdXJlUmVhc29uOiBhbnlbXSkge1xuICAgIHN1cGVyKEpTT04uc3RyaW5naWZ5KGZhaWx1cmVSZWFzb24pKTtcbiAgfVxuXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVVJJUGFyYW1zIHtcblxuICBbcGFyYW1OYW1lOiBzdHJpbmddOiBhbnlcblxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJlcXVlc3RWYWxpZGF0b3Ige1xuXG4gIG1hdGNoZXMocmVxdWVzdDogUmVxdWVzdCk6IHN0cmluZztcblxufVxuXG5leHBvcnQgY2xhc3MgRGVmYXVsdFJlcXVlc3RWYWxpZGF0b3IgaW1wbGVtZW50cyBSZXF1ZXN0VmFsaWRhdG9yIHtcblxuICBwcml2YXRlIGV4cGVjdGVkUXVlcnlQYXJhbXM6IHN0cmluZ1tdID0gW107XG5cbiAgY29uc3RydWN0b3IobWV0aG9kKSB7XG4gICAgZm9yICh2YXIgcGFyYW1OYW1lIGluIChtZXRob2RbXCJxdWVyeVBhcmFtZXRlcnNcIl0gfHwge30pKSB7XG4gICAgICB0aGlzLmV4cGVjdGVkUXVlcnlQYXJhbXMucHVzaChwYXJhbU5hbWUpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VRdWVyeVN0cmluZyh1cmw6IHN0cmluZyk6IG9iamVjdCB7XG4gICAgcmV0dXJuIHBhcnNlKGV4dHJhY3QodXJsKSk7XG4gIH1cblxuICBwdWJsaWMgbWF0Y2hlcyhyZXF1ZXN0OiBSZXF1ZXN0KTogc3RyaW5nIHtcbiAgICBpZiAodGhpcy5leHBlY3RlZFF1ZXJ5UGFyYW1zLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGFjdHVhbFF1ZXJ5UGFyYW1zID0gdGhpcy5wYXJzZVF1ZXJ5U3RyaW5nKHJlcXVlc3QudXJsKTtcbiAgICAgIGZvciAoY29uc3QgcGFyYW1OYW1lIGluIGFjdHVhbFF1ZXJ5UGFyYW1zKSB7XG4gICAgICAgIGlmICh0aGlzLmV4cGVjdGVkUXVlcnlQYXJhbXMuaW5kZXhPZihwYXJhbU5hbWUpID09IC0xKSB7XG4gICAgICAgICAgcmV0dXJuIFwidW5kZWNsYXJlZCBxdWVyeSBwYXJhbWV0ZXIgW1wiICsgcGFyYW1OYW1lICsgXCJdIGZvdW5kIGluIHJlcXVlc3RcIjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG59XG5cbmV4cG9ydCBjbGFzcyBOb29wUmVxdWVzdFZhbGlkYXRvciB7XG5cbiAgcHVibGljIG1hdGNoZXMocmVxdWVzdDogUmVxdWVzdCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxufVxuXG5jbGFzcyBNYXRjaFJlc3VsdCB7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcmVhZG9ubHkgdXJpUGFyYW1zOiBVUklQYXJhbXMsXG4gICAgcmVhZG9ubHkgcmVzcG9uc2U6IFJlc3BvbnNlLFxuICAgIHJlYWRvbmx5IHJlcXVlc3RWYWxpZGF0b3JcbiAgKSB7fVxuXG59XG5cbmZ1bmN0aW9uIHVyaVBhdHRlcm5Ub1JlZ2V4cCh1cmlQYXR0ZXJuOiBzdHJpbmcpOiBbc3RyaW5nW10sIFJlZ0V4cF0ge1xuICBsZXQgcmVtYWluaW5nVXJpUGF0dGVybiA9IHVyaVBhdHRlcm4sIG9wZW5pbmdCcmFja2V0SWR4LCBjbG9zaW5nQnJhY2tldElkeCwgcGFyYW1OYW1lO1xuICBjb25zdCB1cmlQYXJhbU5hbWVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIHdoaWxlKChvcGVuaW5nQnJhY2tldElkeCA9IHJlbWFpbmluZ1VyaVBhdHRlcm4uaW5kZXhPZihcIntcIikpICE9PSAtMSkge1xuICAgIHJlbWFpbmluZ1VyaVBhdHRlcm4gPSByZW1haW5pbmdVcmlQYXR0ZXJuLnN1YnN0cmluZyhvcGVuaW5nQnJhY2tldElkeCArIDEpO1xuICAgIGNsb3NpbmdCcmFja2V0SWR4ID0gcmVtYWluaW5nVXJpUGF0dGVybi5pbmRleE9mKFwifVwiKTtcbiAgICBwYXJhbU5hbWUgPSByZW1haW5pbmdVcmlQYXR0ZXJuLnN1YnN0cmluZygwLCBjbG9zaW5nQnJhY2tldElkeCk7XG4gICAgdXJpUGFyYW1OYW1lcy5wdXNoKHBhcmFtTmFtZSk7XG4gICAgcmVtYWluaW5nVXJpUGF0dGVybiA9IHJlbWFpbmluZ1VyaVBhdHRlcm4uc3Vic3RyaW5nKGNsb3NpbmdCcmFja2V0SWR4ICsgMSk7XG4gIH1cblxuICBjb25zdCB0bXAgPSB1cmlQYXR0ZXJuLnJlcGxhY2UoL1xce1xcdytcXH0vZywgXCIoLiopXCIpO1xuICByZXR1cm4gW3VyaVBhcmFtTmFtZXMsIG5ldyBSZWdFeHAodG1wKV07XG59XG5cbmV4cG9ydCBjbGFzcyBVUklQYXR0ZXJuIHtcblxuICBwcml2YXRlIHBhdHRlcm46IFJlZ0V4cDtcblxuICBwcml2YXRlIHBhcmFtTmFtZXM6IHN0cmluZ1tdO1xuXG4gIGNvbnN0cnVjdG9yKHVyaVBhdHRlcm46IHN0cmluZykge1xuICAgIGxldCBwYXR0ZXJuTWF0Y2ggPSB1cmlQYXR0ZXJuVG9SZWdleHAodXJpUGF0dGVybik7XG4gICAgdGhpcy5wYXJhbU5hbWVzID0gcGF0dGVybk1hdGNoWzBdO1xuICAgIHRoaXMucGF0dGVybiA9IHBhdHRlcm5NYXRjaFsxXTtcbiAgfVxuXG4gIHB1YmxpYyBtYXRjaGVzKHVyaTogc3RyaW5nKTogVVJJUGFyYW1zIHtcbiAgICBjb25zdCBtYXRjaGVzID0gdGhpcy5wYXR0ZXJuLnRlc3QodXJpKTtcbiAgICBjb25zdCBhcnIgPSB0aGlzLnBhdHRlcm4uZXhlYyh1cmkpO1xuICAgIGlmIChhcnIgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBwYXJhbU1hcDogVVJJUGFyYW1zID0ge307XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnBhcmFtTmFtZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgIHBhcmFtTWFwW3RoaXMucGFyYW1OYW1lc1tpXV0gPSBhcnJbaSArIDFdO1xuICAgIH1cbiAgICByZXR1cm4gbWF0Y2hlcyA/IHBhcmFtTWFwIDogbnVsbDtcbiAgfVxuXG59XG5cbmV4cG9ydCBjbGFzcyBSZXF1ZXN0UGF0dGVybiB7XG5cbiAgcHJpdmF0ZSBleHBlY3RlZFVyaTogVVJJUGF0dGVybjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBleHBlY3RlZFVyaTogc3RyaW5nLFxuICAgIHJlYWRvbmx5IGV4cGVjdGVkTWV0aG9kOiBzdHJpbmcsXG4gICAgcHJpdmF0ZSByZWFkb25seSBzY2hlbWEsXG4gICAgcmVhZG9ubHkgcmVzcG9uc2VQYXR0ZXJuczogUmVzcG9uc2VQYXR0ZXJuW11cbiAgKSB7XG4gICAgdGhpcy5leHBlY3RlZFVyaSA9IG5ldyBVUklQYXR0ZXJuKGV4cGVjdGVkVXJpKTtcbiAgfVxuXG4gIHB1YmxpYyBtYXRjaGVzKHJlcXVlc3Q6IFJlcXVlc3QpOiBVUklQYXJhbXMge1xuICAgIGNvbnN0IGFjdHVhbE1ldGhvZCA9IFJlcXVlc3RNZXRob2RbcmVxdWVzdC5tZXRob2RdLnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgdXJpUGFyYW1zID0gdGhpcy5leHBlY3RlZFVyaS5tYXRjaGVzKHJlcXVlc3QudXJsKTtcbiAgICBpZiAoISAoYWN0dWFsTWV0aG9kLnRvTG93ZXJDYXNlKCkgPT09IHRoaXMuZXhwZWN0ZWRNZXRob2QudG9Mb3dlckNhc2UoKVxuICAgICAgJiYgdXJpUGFyYW1zICE9PSBudWxsKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGpzb25Cb2R5ID0gSlNPTi5wYXJzZShyZXF1ZXN0LmdldEJvZHkoKSk7XG4gICAgaWYgKHRoaXMuc2NoZW1hICE9IG51bGwgJiYgIWFqdi52YWxpZGF0ZSh0aGlzLnNjaGVtYSwganNvbkJvZHkpKSB7XG4gICAgICB0aHJvdyBuZXcgTWFsZm9ybWVkUmVxdWVzdEVycm9yKGFqdi5lcnJvcnMpO1xuICAgIH1cbiAgICByZXR1cm4gdXJpUGFyYW1zO1xuICB9XG5cbiAgcHVibGljIGZpbmRSZXNwb25zZVBhdHRlcm5CeVN0YXR1c0NvZGUoc3RhdHVzQ29kZTogbnVtYmVyKTogUmVzcG9uc2VQYXR0ZXJuIHtcbiAgICBmb3IgKGNvbnN0IGkgaW4gdGhpcy5yZXNwb25zZVBhdHRlcm5zKSB7XG4gICAgICBsZXQgY2FuZGlkYXRlID0gdGhpcy5yZXNwb25zZVBhdHRlcm5zW2ldO1xuICAgICAgaWYgKGNhbmRpZGF0ZS5leHBlY3RlZFN0YXR1c0NvZGUgPT09IHN0YXR1c0NvZGUpIHtcbiAgICAgICAgcmV0dXJuIGNhbmRpZGF0ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxufVxuXG5leHBvcnQgY2xhc3MgUmVzcG9uc2VQYXR0ZXJuIHtcblxuICBjb25zdHJ1Y3RvcihyZWFkb25seSBleHBlY3RlZFN0YXR1c0NvZGU6IG51bWJlcixcbiAgICAgICAgICAgICAgcHJpdmF0ZSByZXNwb25zZUJvZHlTY2hlbWEpIHt9XG5cbiAgcHVibGljIG1hdGNoZXMocmVzcG9uc2U6IFJlc3BvbnNlKTogYm9vbGVhbiB7XG4gICAgaWYgKHJlc3BvbnNlLnN0YXR1cyAhPT0gdGhpcy5leHBlY3RlZFN0YXR1c0NvZGUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BKc29uID0gcmVzcG9uc2UuanNvbigpO1xuICAgICAgaWYgKCFhanYudmFsaWRhdGUodGhpcy5yZXNwb25zZUJvZHlTY2hlbWEsIHJlc3BKc29uKSkge1xuICAgICAgICBjb25zb2xlLmxvZyhhanYuZXJyb3JzKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnN0IHJhd1Jlc3AgPSByZXNwb25zZS50ZXh0KCk7XG4gICAgICBpZiAoIWFqdi52YWxpZGF0ZSh0aGlzLnJlc3BvbnNlQm9keVNjaGVtYSwgcmF3UmVzcCkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJlaGF2aW9yIHtcblxuICByZXF1ZXN0UGF0dGVybjogUmVxdWVzdFBhdHRlcm47XG5cbiAgcmVzcG9uc2U6IFJlc3BvbnNlO1xuXG4gIHJlcXVlc3RWYWxpZGF0b3I/IDogUmVxdWVzdFZhbGlkYXRvcjtcblxufVxuXG5leHBvcnQgY2xhc3MgUkFNTEJhY2tlbmQgZXh0ZW5kcyBNb2NrQmFja2VuZCB7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBzdHViYmVkOiBCZWhhdmlvcltdID0gW10sIHByaXZhdGUgZXhwZWN0ZWQ6IEJlaGF2aW9yW10gPSBbXSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5jb25uZWN0aW9ucy5zdWJzY3JpYmUodGhpcy5oYW5kbGVDb25uZWN0aW9uLmJpbmQodGhpcykpO1xuICB9XG5cblxuICBwcml2YXRlIGZpbmRNYXRjaGluZ1Jlc3BvbnNlKHJlcXVlc3Q6IFJlcXVlc3QpOiBNYXRjaFJlc3VsdCB7XG4gICAgZm9yIChjb25zdCBpIGluIHRoaXMuc3R1YmJlZCkge1xuICAgICAgY29uc3QgZW50cnkgPSB0aGlzLnN0dWJiZWRbaV07XG4gICAgICBjb25zdCB1cmlQYXJhbXMgPSBlbnRyeS5yZXF1ZXN0UGF0dGVybi5tYXRjaGVzKHJlcXVlc3QpO1xuICAgICAgaWYgKHVyaVBhcmFtcyAhPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gbmV3IE1hdGNoUmVzdWx0KHVyaVBhcmFtcywgZW50cnkucmVzcG9uc2UsIGVudHJ5LnJlcXVlc3RWYWxpZGF0b3IpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJubyBtYXRjaGluZyByZXF1ZXN0IHBhdHRlcm4gZm91bmRcIik7XG4gIH1cblxuICBwcml2YXRlIGhhbmRsZUNvbm5lY3Rpb24oY29ubjogTW9ja0Nvbm5lY3Rpb24pIHtcbiAgICBjb25zdCByZXF1ZXN0ID0gY29ubi5yZXF1ZXN0O1xuICAgIGxldCByZXNwb25zZTtcblxuICAgIGNvbnN0IG1hdGNoUmVzdWx0ID0gdGhpcy5maW5kTWF0Y2hpbmdSZXNwb25zZShyZXF1ZXN0KTtcbiAgICBsZXQgZXJyb3JNZXNzYWdlID0gbWF0Y2hSZXN1bHQucmVxdWVzdFZhbGlkYXRvci5tYXRjaGVzKHJlcXVlc3QpO1xuICAgIGlmIChlcnJvck1lc3NhZ2UgIT09IG51bGwpIHtcbiAgICAgIHJlc3BvbnNlID0gbmV3IFJlc3BvbnNlKG5ldyBSZXNwb25zZU9wdGlvbnMoe1xuICAgICAgICBzdGF0dXM6IDQwMSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe21lc3NhZ2U6IGVycm9yTWVzc2FnZX0pXG4gICAgICB9KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3BvbnNlID0gbWF0Y2hSZXN1bHQucmVzcG9uc2U7XG4gICAgfVxuICAgIGNvbm4ubW9ja1Jlc3BvbmQocmVzcG9uc2UpO1xuICB9XG5cbn1cbiJdfQ==
