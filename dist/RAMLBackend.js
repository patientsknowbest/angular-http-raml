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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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b0JBQW9CLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDdkQsSUFBSSxZQUFZLEdBQUcsV0FBVyxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNqRSxFQUFFLENBQUMsQ0FBQyxZQUFZLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztZQUMxQixRQUFRLEdBQUcsSUFBSSxlQUFRLENBQUMsSUFBSSxzQkFBZSxDQUFDO2dCQUMxQyxNQUFNLEVBQUUsR0FBRztnQkFDWCxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUMsQ0FBQzthQUM5QyxDQUFDLENBQUMsQ0FBQztRQUNOLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLFFBQVEsR0FBRyxXQUFXLENBQUMsUUFBUSxDQUFDO1FBQ2xDLENBQUM7UUFDRCxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzdCLENBQUM7SUFFSCxrQkFBQztBQUFELENBcENBLEFBb0NDLENBcENnQyxxQkFBVyxHQW9DM0M7QUFwQ1ksa0NBQVciLCJmaWxlIjoiUkFNTEJhY2tlbmQuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge01vY2tCYWNrZW5kLCBNb2NrQ29ubmVjdGlvbn0gZnJvbSBcIkBhbmd1bGFyL2h0dHAvdGVzdGluZ1wiO1xuaW1wb3J0IHtNZXRob2R9IGZyb20gXCJyYW1sLTEtcGFyc2VyL2Rpc3QvcmFtbDEvYXJ0aWZhY3RzL3JhbWwxMHBhcnNlcmFwaVwiO1xuaW1wb3J0IHtSZXF1ZXN0LCBSZXF1ZXN0TWV0aG9kLCBSZXNwb25zZSwgUmVzcG9uc2VPcHRpb25zfSBmcm9tIFwiQGFuZ3VsYXIvaHR0cFwiO1xuaW1wb3J0IHtleHRyYWN0LCBwYXJzZX0gZnJvbSBcInF1ZXJ5LXN0cmluZ1wiO1xuaW1wb3J0IEFqdiA9IHJlcXVpcmUoXCJhanZcIik7XG5cbmNvbnN0IGFqdiA9IG5ldyBBanYoKTtcblxuZXhwb3J0IGNsYXNzIE1hbGZvcm1lZFJlcXVlc3RFcnJvciBleHRlbmRzIEVycm9yIHtcblxuICBjb25zdHJ1Y3RvcihmYWlsdXJlUmVhc29uOiBhbnlbXSkge1xuICAgIHN1cGVyKEpTT04uc3RyaW5naWZ5KGZhaWx1cmVSZWFzb24pKTtcbiAgfVxuXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVVJJUGFyYW1zIHtcblxuICBbcGFyYW1OYW1lOiBzdHJpbmddOiBhbnlcblxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJlcXVlc3RWYWxpZGF0b3Ige1xuXG4gIG1hdGNoZXMocmVxdWVzdDogUmVxdWVzdCk6IHN0cmluZztcblxufVxuXG5leHBvcnQgY2xhc3MgRGVmYXVsdFJlcXVlc3RWYWxpZGF0b3IgaW1wbGVtZW50cyBSZXF1ZXN0VmFsaWRhdG9yIHtcblxuICBwcml2YXRlIGV4cGVjdGVkUXVlcnlQYXJhbXM6IHN0cmluZ1tdID0gW107XG5cbiAgY29uc3RydWN0b3IobWV0aG9kOiBNZXRob2QpIHtcbiAgICBtZXRob2QucXVlcnlQYXJhbWV0ZXJzKCkuZm9yRWFjaChwYXJhbSA9PiB0aGlzLmV4cGVjdGVkUXVlcnlQYXJhbXMucHVzaChwYXJhbS5uYW1lKCkpKTtcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VRdWVyeVN0cmluZyh1cmw6IHN0cmluZyk6IG9iamVjdCB7XG4gICAgcmV0dXJuIHBhcnNlKGV4dHJhY3QodXJsKSk7XG4gIH1cblxuICBwdWJsaWMgbWF0Y2hlcyhyZXF1ZXN0OiBSZXF1ZXN0KTogc3RyaW5nIHtcbiAgICBpZiAodGhpcy5leHBlY3RlZFF1ZXJ5UGFyYW1zLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGFjdHVhbFF1ZXJ5UGFyYW1zID0gdGhpcy5wYXJzZVF1ZXJ5U3RyaW5nKHJlcXVlc3QudXJsKTtcbiAgICAgIGZvciAoY29uc3QgcGFyYW1OYW1lIGluIGFjdHVhbFF1ZXJ5UGFyYW1zKSB7XG4gICAgICAgIGlmICh0aGlzLmV4cGVjdGVkUXVlcnlQYXJhbXMuaW5kZXhPZihwYXJhbU5hbWUpID09IC0xKSB7XG4gICAgICAgICAgcmV0dXJuIFwidW5kZWNsYXJlZCBxdWVyeSBwYXJhbWV0ZXIgW1wiICsgcGFyYW1OYW1lICsgXCJdIGZvdW5kIGluIHJlcXVlc3RcIjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG59XG5cbmV4cG9ydCBjbGFzcyBOb29wUmVxdWVzdFZhbGlkYXRvciB7XG5cbiAgcHVibGljIG1hdGNoZXMocmVxdWVzdDogUmVxdWVzdCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxufVxuXG5jbGFzcyBNYXRjaFJlc3VsdCB7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcmVhZG9ubHkgdXJpUGFyYW1zOiBVUklQYXJhbXMsXG4gICAgcmVhZG9ubHkgcmVzcG9uc2U6IFJlc3BvbnNlLFxuICAgIHJlYWRvbmx5IHJlcXVlc3RWYWxpZGF0b3JcbiAgKSB7fVxuXG59XG5cbmZ1bmN0aW9uIHVyaVBhdHRlcm5Ub1JlZ2V4cCh1cmlQYXR0ZXJuOiBzdHJpbmcpOiBbc3RyaW5nW10sIFJlZ0V4cF0ge1xuICBsZXQgcmVtYWluaW5nVXJpUGF0dGVybiA9IHVyaVBhdHRlcm4sIG9wZW5pbmdCcmFja2V0SWR4LCBjbG9zaW5nQnJhY2tldElkeCwgcGFyYW1OYW1lO1xuICBjb25zdCB1cmlQYXJhbU5hbWVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIHdoaWxlKChvcGVuaW5nQnJhY2tldElkeCA9IHJlbWFpbmluZ1VyaVBhdHRlcm4uaW5kZXhPZihcIntcIikpICE9PSAtMSkge1xuICAgIHJlbWFpbmluZ1VyaVBhdHRlcm4gPSByZW1haW5pbmdVcmlQYXR0ZXJuLnN1YnN0cmluZyhvcGVuaW5nQnJhY2tldElkeCArIDEpO1xuICAgIGNsb3NpbmdCcmFja2V0SWR4ID0gcmVtYWluaW5nVXJpUGF0dGVybi5pbmRleE9mKFwifVwiKTtcbiAgICBwYXJhbU5hbWUgPSByZW1haW5pbmdVcmlQYXR0ZXJuLnN1YnN0cmluZygwLCBjbG9zaW5nQnJhY2tldElkeCk7XG4gICAgdXJpUGFyYW1OYW1lcy5wdXNoKHBhcmFtTmFtZSk7XG4gICAgcmVtYWluaW5nVXJpUGF0dGVybiA9IHJlbWFpbmluZ1VyaVBhdHRlcm4uc3Vic3RyaW5nKGNsb3NpbmdCcmFja2V0SWR4ICsgMSk7XG4gIH1cblxuICBjb25zdCB0bXAgPSB1cmlQYXR0ZXJuLnJlcGxhY2UoL1xce1xcdytcXH0vZywgXCIoLiopXCIpO1xuICByZXR1cm4gW3VyaVBhcmFtTmFtZXMsIG5ldyBSZWdFeHAodG1wKV07XG59XG5cbmV4cG9ydCBjbGFzcyBVUklQYXR0ZXJuIHtcblxuICBwcml2YXRlIHBhdHRlcm46IFJlZ0V4cDtcblxuICBwcml2YXRlIHBhcmFtTmFtZXM6IHN0cmluZ1tdO1xuXG4gIGNvbnN0cnVjdG9yKHVyaVBhdHRlcm46IHN0cmluZykge1xuICAgIGxldCBwYXR0ZXJuTWF0Y2ggPSB1cmlQYXR0ZXJuVG9SZWdleHAodXJpUGF0dGVybik7XG4gICAgdGhpcy5wYXJhbU5hbWVzID0gcGF0dGVybk1hdGNoWzBdO1xuICAgIHRoaXMucGF0dGVybiA9IHBhdHRlcm5NYXRjaFsxXTtcbiAgfVxuXG4gIHB1YmxpYyBtYXRjaGVzKHVyaTogc3RyaW5nKTogVVJJUGFyYW1zIHtcbiAgICBjb25zdCBtYXRjaGVzID0gdGhpcy5wYXR0ZXJuLnRlc3QodXJpKTtcbiAgICBjb25zdCBhcnIgPSB0aGlzLnBhdHRlcm4uZXhlYyh1cmkpO1xuICAgIGlmIChhcnIgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBwYXJhbU1hcDogVVJJUGFyYW1zID0ge307XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnBhcmFtTmFtZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgIHBhcmFtTWFwW3RoaXMucGFyYW1OYW1lc1tpXV0gPSBhcnJbaSArIDFdO1xuICAgIH1cbiAgICByZXR1cm4gbWF0Y2hlcyA/IHBhcmFtTWFwIDogbnVsbDtcbiAgfVxuXG59XG5cbmV4cG9ydCBjbGFzcyBSZXF1ZXN0UGF0dGVybiB7XG5cbiAgcHJpdmF0ZSBleHBlY3RlZFVyaTogVVJJUGF0dGVybjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBleHBlY3RlZFVyaTogc3RyaW5nLFxuICAgIHJlYWRvbmx5IGV4cGVjdGVkTWV0aG9kOiBzdHJpbmcsXG4gICAgcHJpdmF0ZSByZWFkb25seSBzY2hlbWFcbiAgKSB7XG4gICAgdGhpcy5leHBlY3RlZFVyaSA9IG5ldyBVUklQYXR0ZXJuKGV4cGVjdGVkVXJpKTtcbiAgfVxuXG4gIHB1YmxpYyBtYXRjaGVzKHJlcXVlc3Q6IFJlcXVlc3QpOiBVUklQYXJhbXMge1xuICAgIGNvbnN0IGFjdHVhbE1ldGhvZCA9IFJlcXVlc3RNZXRob2RbcmVxdWVzdC5tZXRob2RdLnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgdXJpUGFyYW1zID0gdGhpcy5leHBlY3RlZFVyaS5tYXRjaGVzKHJlcXVlc3QudXJsKTtcbiAgICBpZiAoISAoYWN0dWFsTWV0aG9kLnRvTG93ZXJDYXNlKCkgPT09IHRoaXMuZXhwZWN0ZWRNZXRob2QudG9Mb3dlckNhc2UoKVxuICAgICAgJiYgdXJpUGFyYW1zICE9PSBudWxsKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IGpzb25Cb2R5ID0gSlNPTi5wYXJzZShyZXF1ZXN0LmdldEJvZHkoKSk7XG4gICAgaWYgKHRoaXMuc2NoZW1hICE9IG51bGwgJiYgIWFqdi52YWxpZGF0ZSh0aGlzLnNjaGVtYSwganNvbkJvZHkpKSB7XG4gICAgICB0aHJvdyBuZXcgTWFsZm9ybWVkUmVxdWVzdEVycm9yKGFqdi5lcnJvcnMpO1xuICAgIH1cbiAgICByZXR1cm4gdXJpUGFyYW1zO1xuICB9XG5cbn1cblxuZXhwb3J0IGludGVyZmFjZSBCZWhhdmlvciB7XG5cbiAgcmVxdWVzdFBhdHRlcm46IFJlcXVlc3RQYXR0ZXJuO1xuXG4gIHJlc3BvbnNlOiBSZXNwb25zZTtcblxuICByZXF1ZXN0VmFsaWRhdG9yPyA6IFJlcXVlc3RWYWxpZGF0b3I7XG5cbn1cblxuZXhwb3J0IGNsYXNzIFJBTUxCYWNrZW5kIGV4dGVuZHMgTW9ja0JhY2tlbmQge1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgc3R1YmJlZDogQmVoYXZpb3JbXSA9IFtdLCBwcml2YXRlIGV4cGVjdGVkOiBCZWhhdmlvcltdID0gW10pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuY29ubmVjdGlvbnMuc3Vic2NyaWJlKHRoaXMuaGFuZGxlQ29ubmVjdGlvbi5iaW5kKHRoaXMpKTtcbiAgfVxuXG5cbiAgcHJpdmF0ZSBmaW5kTWF0Y2hpbmdSZXNwb25zZShyZXF1ZXN0OiBSZXF1ZXN0KTogTWF0Y2hSZXN1bHQge1xuICAgIGZvciAoY29uc3QgaSBpbiB0aGlzLnN0dWJiZWQpIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy5zdHViYmVkW2ldO1xuICAgICAgY29uc3QgdXJpUGFyYW1zID0gZW50cnkucmVxdWVzdFBhdHRlcm4ubWF0Y2hlcyhyZXF1ZXN0KTtcbiAgICAgIGlmICh1cmlQYXJhbXMgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBNYXRjaFJlc3VsdCh1cmlQYXJhbXMsIGVudHJ5LnJlc3BvbnNlLCBlbnRyeS5yZXF1ZXN0VmFsaWRhdG9yKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKFwibm8gbWF0Y2hpbmcgcmVxdWVzdCBwYXR0ZXJuIGZvdW5kXCIpO1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVDb25uZWN0aW9uKGNvbm46IE1vY2tDb25uZWN0aW9uKSB7XG4gICAgY29uc3QgcmVxdWVzdCA9IGNvbm4ucmVxdWVzdDtcbiAgICBsZXQgcmVzcG9uc2U7XG5cbiAgICBjb25zdCBtYXRjaFJlc3VsdCA9IHRoaXMuZmluZE1hdGNoaW5nUmVzcG9uc2UocmVxdWVzdCk7XG4gICAgbGV0IGVycm9yTWVzc2FnZSA9IG1hdGNoUmVzdWx0LnJlcXVlc3RWYWxpZGF0b3IubWF0Y2hlcyhyZXF1ZXN0KTtcbiAgICBpZiAoZXJyb3JNZXNzYWdlICE9PSBudWxsKSB7XG4gICAgICByZXNwb25zZSA9IG5ldyBSZXNwb25zZShuZXcgUmVzcG9uc2VPcHRpb25zKHtcbiAgICAgICAgc3RhdHVzOiA0MDEsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHttZXNzYWdlOiBlcnJvck1lc3NhZ2V9KVxuICAgICAgfSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXNwb25zZSA9IG1hdGNoUmVzdWx0LnJlc3BvbnNlO1xuICAgIH1cbiAgICBjb25uLm1vY2tSZXNwb25kKHJlc3BvbnNlKTtcbiAgfVxuXG59XG4iXX0=
