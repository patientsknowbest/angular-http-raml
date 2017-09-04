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
        throw new Error("no matching request pattern found for " + http_1.RequestMethod[request.method].toUpperCase() + " " + request.url);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QyxDQUFDO1lBQzVFLENBQUM7UUFDSCxDQUFDO1FBQ0QsTUFBTSxJQUFJLEtBQUssQ0FBQyx3Q0FBd0MsR0FBRyxvQkFBYSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxXQUFXLEVBQUUsR0FBRyxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzlILENBQUM7SUFFTyxzQ0FBZ0IsR0FBeEIsVUFBeUIsSUFBb0I7UUFDM0MsSUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUM3QixJQUFJLFFBQVEsQ0FBQztRQUViLElBQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN2RCxJQUFJLFlBQVksR0FBRyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2pFLEVBQUUsQ0FBQyxDQUFDLFlBQVksS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQzFCLFFBQVEsR0FBRyxJQUFJLGVBQVEsQ0FBQyxJQUFJLHNCQUFlLENBQUM7Z0JBQzFDLE1BQU0sRUFBRSxHQUFHO2dCQUNYLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUMsT0FBTyxFQUFFLFlBQVksRUFBQyxDQUFDO2FBQzlDLENBQUMsQ0FBQyxDQUFDO1FBQ04sQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ04sUUFBUSxHQUFHLFdBQVcsQ0FBQyxRQUFRLENBQUM7UUFDbEMsQ0FBQztRQUNELElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDN0IsQ0FBQztJQUVILGtCQUFDO0FBQUQsQ0FwQ0EsQUFvQ0MsQ0FwQ2dDLHFCQUFXLEdBb0MzQztBQXBDWSxrQ0FBVyIsImZpbGUiOiJSQU1MQmFja2VuZC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7TW9ja0JhY2tlbmQsIE1vY2tDb25uZWN0aW9ufSBmcm9tIFwiQGFuZ3VsYXIvaHR0cC90ZXN0aW5nXCI7XG5pbXBvcnQge1JlcXVlc3QsIFJlcXVlc3RNZXRob2QsIFJlc3BvbnNlLCBSZXNwb25zZU9wdGlvbnN9IGZyb20gXCJAYW5ndWxhci9odHRwXCI7XG5pbXBvcnQge2V4dHJhY3QsIHBhcnNlfSBmcm9tIFwicXVlcnktc3RyaW5nXCI7XG5pbXBvcnQgQWp2ID0gcmVxdWlyZShcImFqdlwiKTtcblxuY29uc3QgYWp2ID0gbmV3IEFqdigpO1xuXG5leHBvcnQgY2xhc3MgTWFsZm9ybWVkUmVxdWVzdEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuXG4gIGNvbnN0cnVjdG9yKGZhaWx1cmVSZWFzb246IGFueVtdKSB7XG4gICAgc3VwZXIoSlNPTi5zdHJpbmdpZnkoZmFpbHVyZVJlYXNvbikpO1xuICB9XG5cbn1cblxuZXhwb3J0IGludGVyZmFjZSBVUklQYXJhbXMge1xuXG4gIFtwYXJhbU5hbWU6IHN0cmluZ106IGFueVxuXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVxdWVzdFZhbGlkYXRvciB7XG5cbiAgbWF0Y2hlcyhyZXF1ZXN0OiBSZXF1ZXN0KTogc3RyaW5nO1xuXG59XG5cbmV4cG9ydCBjbGFzcyBEZWZhdWx0UmVxdWVzdFZhbGlkYXRvciBpbXBsZW1lbnRzIFJlcXVlc3RWYWxpZGF0b3Ige1xuXG4gIHByaXZhdGUgZXhwZWN0ZWRRdWVyeVBhcmFtczogc3RyaW5nW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihtZXRob2QpIHtcbiAgICBmb3IgKHZhciBwYXJhbU5hbWUgaW4gKG1ldGhvZFtcInF1ZXJ5UGFyYW1ldGVyc1wiXSB8fCB7fSkpIHtcbiAgICAgIHRoaXMuZXhwZWN0ZWRRdWVyeVBhcmFtcy5wdXNoKHBhcmFtTmFtZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZVF1ZXJ5U3RyaW5nKHVybDogc3RyaW5nKTogb2JqZWN0IHtcbiAgICByZXR1cm4gcGFyc2UoZXh0cmFjdCh1cmwpKTtcbiAgfVxuXG4gIHB1YmxpYyBtYXRjaGVzKHJlcXVlc3Q6IFJlcXVlc3QpOiBzdHJpbmcge1xuICAgIGlmICh0aGlzLmV4cGVjdGVkUXVlcnlQYXJhbXMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgYWN0dWFsUXVlcnlQYXJhbXMgPSB0aGlzLnBhcnNlUXVlcnlTdHJpbmcocmVxdWVzdC51cmwpO1xuICAgICAgZm9yIChjb25zdCBwYXJhbU5hbWUgaW4gYWN0dWFsUXVlcnlQYXJhbXMpIHtcbiAgICAgICAgaWYgKHRoaXMuZXhwZWN0ZWRRdWVyeVBhcmFtcy5pbmRleE9mKHBhcmFtTmFtZSkgPT0gLTEpIHtcbiAgICAgICAgICByZXR1cm4gXCJ1bmRlY2xhcmVkIHF1ZXJ5IHBhcmFtZXRlciBbXCIgKyBwYXJhbU5hbWUgKyBcIl0gZm91bmQgaW4gcmVxdWVzdFwiO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbn1cblxuZXhwb3J0IGNsYXNzIE5vb3BSZXF1ZXN0VmFsaWRhdG9yIHtcblxuICBwdWJsaWMgbWF0Y2hlcyhyZXF1ZXN0OiBSZXF1ZXN0KTogc3RyaW5nIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG59XG5cbmNsYXNzIE1hdGNoUmVzdWx0IHtcblxuICBjb25zdHJ1Y3RvcihcbiAgICByZWFkb25seSB1cmlQYXJhbXM6IFVSSVBhcmFtcyxcbiAgICByZWFkb25seSByZXNwb25zZTogUmVzcG9uc2UsXG4gICAgcmVhZG9ubHkgcmVxdWVzdFZhbGlkYXRvclxuICApIHt9XG5cbn1cblxuZnVuY3Rpb24gdXJpUGF0dGVyblRvUmVnZXhwKHVyaVBhdHRlcm46IHN0cmluZyk6IFtzdHJpbmdbXSwgUmVnRXhwXSB7XG4gIGxldCByZW1haW5pbmdVcmlQYXR0ZXJuID0gdXJpUGF0dGVybiwgb3BlbmluZ0JyYWNrZXRJZHgsIGNsb3NpbmdCcmFja2V0SWR4LCBwYXJhbU5hbWU7XG4gIGNvbnN0IHVyaVBhcmFtTmFtZXM6IHN0cmluZ1tdID0gW107XG5cbiAgd2hpbGUoKG9wZW5pbmdCcmFja2V0SWR4ID0gcmVtYWluaW5nVXJpUGF0dGVybi5pbmRleE9mKFwie1wiKSkgIT09IC0xKSB7XG4gICAgcmVtYWluaW5nVXJpUGF0dGVybiA9IHJlbWFpbmluZ1VyaVBhdHRlcm4uc3Vic3RyaW5nKG9wZW5pbmdCcmFja2V0SWR4ICsgMSk7XG4gICAgY2xvc2luZ0JyYWNrZXRJZHggPSByZW1haW5pbmdVcmlQYXR0ZXJuLmluZGV4T2YoXCJ9XCIpO1xuICAgIHBhcmFtTmFtZSA9IHJlbWFpbmluZ1VyaVBhdHRlcm4uc3Vic3RyaW5nKDAsIGNsb3NpbmdCcmFja2V0SWR4KTtcbiAgICB1cmlQYXJhbU5hbWVzLnB1c2gocGFyYW1OYW1lKTtcbiAgICByZW1haW5pbmdVcmlQYXR0ZXJuID0gcmVtYWluaW5nVXJpUGF0dGVybi5zdWJzdHJpbmcoY2xvc2luZ0JyYWNrZXRJZHggKyAxKTtcbiAgfVxuXG4gIGNvbnN0IHRtcCA9IHVyaVBhdHRlcm4ucmVwbGFjZSgvXFx7XFx3K1xcfS9nLCBcIiguKilcIik7XG4gIHJldHVybiBbdXJpUGFyYW1OYW1lcywgbmV3IFJlZ0V4cCh0bXApXTtcbn1cblxuZXhwb3J0IGNsYXNzIFVSSVBhdHRlcm4ge1xuXG4gIHByaXZhdGUgcGF0dGVybjogUmVnRXhwO1xuXG4gIHByaXZhdGUgcGFyYW1OYW1lczogc3RyaW5nW107XG5cbiAgY29uc3RydWN0b3IodXJpUGF0dGVybjogc3RyaW5nKSB7XG4gICAgbGV0IHBhdHRlcm5NYXRjaCA9IHVyaVBhdHRlcm5Ub1JlZ2V4cCh1cmlQYXR0ZXJuKTtcbiAgICB0aGlzLnBhcmFtTmFtZXMgPSBwYXR0ZXJuTWF0Y2hbMF07XG4gICAgdGhpcy5wYXR0ZXJuID0gcGF0dGVybk1hdGNoWzFdO1xuICB9XG5cbiAgcHVibGljIG1hdGNoZXModXJpOiBzdHJpbmcpOiBVUklQYXJhbXMge1xuICAgIGNvbnN0IG1hdGNoZXMgPSB0aGlzLnBhdHRlcm4udGVzdCh1cmkpO1xuICAgIGNvbnN0IGFyciA9IHRoaXMucGF0dGVybi5leGVjKHVyaSk7XG4gICAgaWYgKGFyciA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IHBhcmFtTWFwOiBVUklQYXJhbXMgPSB7fTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucGFyYW1OYW1lcy5sZW5ndGg7ICsraSkge1xuICAgICAgcGFyYW1NYXBbdGhpcy5wYXJhbU5hbWVzW2ldXSA9IGFycltpICsgMV07XG4gICAgfVxuICAgIHJldHVybiBtYXRjaGVzID8gcGFyYW1NYXAgOiBudWxsO1xuICB9XG5cbn1cblxuZXhwb3J0IGNsYXNzIFJlcXVlc3RQYXR0ZXJuIHtcblxuICBwcml2YXRlIGV4cGVjdGVkVXJpOiBVUklQYXR0ZXJuO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGV4cGVjdGVkVXJpOiBzdHJpbmcsXG4gICAgcmVhZG9ubHkgZXhwZWN0ZWRNZXRob2Q6IHN0cmluZyxcbiAgICBwcml2YXRlIHJlYWRvbmx5IHNjaGVtYSxcbiAgICByZWFkb25seSByZXNwb25zZVBhdHRlcm5zOiBSZXNwb25zZVBhdHRlcm5bXVxuICApIHtcbiAgICB0aGlzLmV4cGVjdGVkVXJpID0gbmV3IFVSSVBhdHRlcm4oZXhwZWN0ZWRVcmkpO1xuICB9XG5cbiAgcHVibGljIG1hdGNoZXMocmVxdWVzdDogUmVxdWVzdCk6IFVSSVBhcmFtcyB7XG4gICAgY29uc3QgYWN0dWFsTWV0aG9kID0gUmVxdWVzdE1ldGhvZFtyZXF1ZXN0Lm1ldGhvZF0udG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCB1cmlQYXJhbXMgPSB0aGlzLmV4cGVjdGVkVXJpLm1hdGNoZXMocmVxdWVzdC51cmwpO1xuICAgIGlmICghIChhY3R1YWxNZXRob2QudG9Mb3dlckNhc2UoKSA9PT0gdGhpcy5leHBlY3RlZE1ldGhvZC50b0xvd2VyQ2FzZSgpXG4gICAgICAmJiB1cmlQYXJhbXMgIT09IG51bGwpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QganNvbkJvZHkgPSBKU09OLnBhcnNlKHJlcXVlc3QuZ2V0Qm9keSgpKTtcbiAgICBpZiAodGhpcy5zY2hlbWEgIT0gbnVsbCAmJiAhYWp2LnZhbGlkYXRlKHRoaXMuc2NoZW1hLCBqc29uQm9keSkpIHtcbiAgICAgIHRocm93IG5ldyBNYWxmb3JtZWRSZXF1ZXN0RXJyb3IoYWp2LmVycm9ycyk7XG4gICAgfVxuICAgIHJldHVybiB1cmlQYXJhbXM7XG4gIH1cblxuICBwdWJsaWMgZmluZFJlc3BvbnNlUGF0dGVybkJ5U3RhdHVzQ29kZShzdGF0dXNDb2RlOiBudW1iZXIpOiBSZXNwb25zZVBhdHRlcm4ge1xuICAgIGZvciAoY29uc3QgaSBpbiB0aGlzLnJlc3BvbnNlUGF0dGVybnMpIHtcbiAgICAgIGxldCBjYW5kaWRhdGUgPSB0aGlzLnJlc3BvbnNlUGF0dGVybnNbaV07XG4gICAgICBpZiAoY2FuZGlkYXRlLmV4cGVjdGVkU3RhdHVzQ29kZSA9PT0gc3RhdHVzQ29kZSkge1xuICAgICAgICByZXR1cm4gY2FuZGlkYXRlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG59XG5cbmV4cG9ydCBjbGFzcyBSZXNwb25zZVBhdHRlcm4ge1xuXG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IGV4cGVjdGVkU3RhdHVzQ29kZTogbnVtYmVyLFxuICAgICAgICAgICAgICBwcml2YXRlIHJlc3BvbnNlQm9keVNjaGVtYSkge31cblxuICBwdWJsaWMgbWF0Y2hlcyhyZXNwb25zZTogUmVzcG9uc2UpOiBib29sZWFuIHtcbiAgICBpZiAocmVzcG9uc2Uuc3RhdHVzICE9PSB0aGlzLmV4cGVjdGVkU3RhdHVzQ29kZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcEpzb24gPSByZXNwb25zZS5qc29uKCk7XG4gICAgICBpZiAoIWFqdi52YWxpZGF0ZSh0aGlzLnJlc3BvbnNlQm9keVNjaGVtYSwgcmVzcEpzb24pKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zdCByYXdSZXNwID0gcmVzcG9uc2UudGV4dCgpO1xuICAgICAgaWYgKCFhanYudmFsaWRhdGUodGhpcy5yZXNwb25zZUJvZHlTY2hlbWEsIHJhd1Jlc3ApKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBCZWhhdmlvciB7XG5cbiAgcmVxdWVzdFBhdHRlcm46IFJlcXVlc3RQYXR0ZXJuO1xuXG4gIHJlc3BvbnNlOiBSZXNwb25zZTtcblxuICByZXF1ZXN0VmFsaWRhdG9yPyA6IFJlcXVlc3RWYWxpZGF0b3I7XG5cbn1cblxuZXhwb3J0IGNsYXNzIFJBTUxCYWNrZW5kIGV4dGVuZHMgTW9ja0JhY2tlbmQge1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgc3R1YmJlZDogQmVoYXZpb3JbXSA9IFtdLCBwcml2YXRlIGV4cGVjdGVkOiBCZWhhdmlvcltdID0gW10pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuY29ubmVjdGlvbnMuc3Vic2NyaWJlKHRoaXMuaGFuZGxlQ29ubmVjdGlvbi5iaW5kKHRoaXMpKTtcbiAgfVxuXG5cbiAgcHJpdmF0ZSBmaW5kTWF0Y2hpbmdSZXNwb25zZShyZXF1ZXN0OiBSZXF1ZXN0KTogTWF0Y2hSZXN1bHQge1xuICAgIGZvciAoY29uc3QgaSBpbiB0aGlzLnN0dWJiZWQpIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy5zdHViYmVkW2ldO1xuICAgICAgY29uc3QgdXJpUGFyYW1zID0gZW50cnkucmVxdWVzdFBhdHRlcm4ubWF0Y2hlcyhyZXF1ZXN0KTtcbiAgICAgIGlmICh1cmlQYXJhbXMgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBNYXRjaFJlc3VsdCh1cmlQYXJhbXMsIGVudHJ5LnJlc3BvbnNlLCBlbnRyeS5yZXF1ZXN0VmFsaWRhdG9yKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKFwibm8gbWF0Y2hpbmcgcmVxdWVzdCBwYXR0ZXJuIGZvdW5kIGZvciBcIiArIFJlcXVlc3RNZXRob2RbcmVxdWVzdC5tZXRob2RdLnRvVXBwZXJDYXNlKCkgKyBcIiBcIiArIHJlcXVlc3QudXJsKTtcbiAgfVxuXG4gIHByaXZhdGUgaGFuZGxlQ29ubmVjdGlvbihjb25uOiBNb2NrQ29ubmVjdGlvbikge1xuICAgIGNvbnN0IHJlcXVlc3QgPSBjb25uLnJlcXVlc3Q7XG4gICAgbGV0IHJlc3BvbnNlO1xuXG4gICAgY29uc3QgbWF0Y2hSZXN1bHQgPSB0aGlzLmZpbmRNYXRjaGluZ1Jlc3BvbnNlKHJlcXVlc3QpO1xuICAgIGxldCBlcnJvck1lc3NhZ2UgPSBtYXRjaFJlc3VsdC5yZXF1ZXN0VmFsaWRhdG9yLm1hdGNoZXMocmVxdWVzdCk7XG4gICAgaWYgKGVycm9yTWVzc2FnZSAhPT0gbnVsbCkge1xuICAgICAgcmVzcG9uc2UgPSBuZXcgUmVzcG9uc2UobmV3IFJlc3BvbnNlT3B0aW9ucyh7XG4gICAgICAgIHN0YXR1czogNDAxLFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7bWVzc2FnZTogZXJyb3JNZXNzYWdlfSlcbiAgICAgIH0pKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzcG9uc2UgPSBtYXRjaFJlc3VsdC5yZXNwb25zZTtcbiAgICB9XG4gICAgY29ubi5tb2NrUmVzcG9uZChyZXNwb25zZSk7XG4gIH1cblxufVxuIl19
