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
var raml10parser_1 = require("raml-1-parser/dist/raml1/artifacts/raml10parser");
var raml_1_parser_1 = require("raml-1-parser");
var http_1 = require("@angular/http");
var query_string_1 = require("query-string");
var RequestValidator = (function () {
    function RequestValidator(method) {
        var _this = this;
        this.expectedQueryParams = [];
        method.queryParameters().forEach(function (param) { return _this.expectedQueryParams.push(param.name()); });
    }
    RequestValidator.prototype.parseQueryString = function (url) {
        return query_string_1.parse(query_string_1.extract(url));
    };
    RequestValidator.prototype.matches = function (request) {
        if (this.expectedQueryParams.length > 0) {
            var actualQueryParams = this.parseQueryString(request.url);
            for (var paramName in actualQueryParams) {
                if (this.expectedQueryParams.indexOf(paramName) == -1) {
                    return "undeclared query parameter [invalid] found in request";
                }
            }
        }
        return null;
    };
    return RequestValidator;
}());
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
        var paramMap = {};
        if (arr === null) {
            return paramMap;
        }
        for (var i = 0; i < this.paramNames.length; ++i) {
            paramMap[this.paramNames[i]] = arr[i + 1];
        }
        return matches ? paramMap : null;
    };
    return URIPattern;
}());
exports.URIPattern = URIPattern;
var RequestPattern = (function () {
    function RequestPattern(expectedUri, expectedMethod) {
        this.expectedMethod = expectedMethod;
        this.expectedUri = new URIPattern(expectedUri);
    }
    RequestPattern.prototype.matches = function (request) {
        var actualMethod = http_1.RequestMethod[request.method].toLowerCase();
        var uriParams = this.expectedUri.matches(request.url);
        if (!(actualMethod === this.expectedMethod
            && uriParams !== null)) {
            return null;
        }
        return uriParams;
    };
    return RequestPattern;
}());
exports.RequestPattern = RequestPattern;
function lookupExampleResponseBody(respBodyDef) {
    if (respBodyDef === undefined) {
        return null;
    }
    if (respBodyDef.example() === null) {
        return respBodyDef.examples()[0].value();
    }
    else {
        return respBodyDef.example().value();
    }
}
function buildRequestPatterns(api) {
    var entries = [];
    for (var i in api.allResources()) {
        var resource = api.allResources()[i];
        for (var j in resource.methods()) {
            var method = resource.methods()[j];
            var pattern = new RequestPattern(resource.absoluteUri(), method.method());
            var response = new http_1.Response(new http_1.ResponseOptions({
                status: new Number(method.responses()[0].code().value()).valueOf(),
                body: lookupExampleResponseBody(method.responses()[0].body()[0])
            }));
            entries.push({
                requestPattern: pattern,
                response: response,
                requestValidator: new RequestValidator(method)
            });
        }
    }
    return entries;
}
var RamlBackend = (function (_super) {
    __extends(RamlBackend, _super);
    function RamlBackend() {
        var _this = _super.call(this) || this;
        _this.matchEntries = [];
        _this.connections.subscribe(_this.handleConnection.bind(_this));
        return _this;
    }
    RamlBackend.prototype.findMatchingResponse = function (request) {
        for (var i in this.matchEntries) {
            var entry = this.matchEntries[i];
            var uriParams = entry.requestPattern.matches(request);
            if (uriParams !== null) {
                return new MatchResult(uriParams, entry.response, entry.requestValidator);
            }
        }
        throw new Error("no matching request pattern found");
    };
    RamlBackend.prototype.handleConnection = function (conn) {
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
    Object.defineProperty(RamlBackend.prototype, "endpoints", {
        get: function () {
            var endpoints = [];
            this.api.allResources().forEach(function (i) { return endpoints.push(i.absoluteUri()); });
            return endpoints;
        },
        enumerable: true,
        configurable: true
    });
    RamlBackend.prototype.loadRAMLFromPath = function (path) {
        this.api = raml10parser_1.loadApiSync(path);
        this.matchEntries = buildRequestPatterns(this.api);
        return this;
    };
    RamlBackend.prototype.loadRAML = function (content) {
        this.api = raml_1_parser_1.parseRAMLSync(content);
        this.matchEntries = buildRequestPatterns(this.api);
        return this;
    };
    return RamlBackend;
}(testing_1.MockBackend));
exports.RamlBackend = RamlBackend;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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SUFFRCxzQkFBVyxrQ0FBUzthQUFwQjtZQUNFLElBQU0sU0FBUyxHQUFHLEVBQUUsQ0FBQztZQUNyQixJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxDQUFDLE9BQU8sQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDLEVBQS9CLENBQStCLENBQUMsQ0FBQztZQUN0RSxNQUFNLENBQUMsU0FBUyxDQUFDO1FBQ25CLENBQUM7OztPQUFBO0lBRU0sc0NBQWdCLEdBQXZCLFVBQXdCLElBQVk7UUFDbEMsSUFBSSxDQUFDLEdBQUcsR0FBRywwQkFBVyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzdCLElBQUksQ0FBQyxZQUFZLEdBQUcsb0JBQW9CLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ25ELE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRU0sOEJBQVEsR0FBZixVQUFnQixPQUFlO1FBQzdCLElBQUksQ0FBQyxHQUFHLEdBQUcsNkJBQWEsQ0FBQyxPQUFPLENBQVEsQ0FBQztRQUN6QyxJQUFJLENBQUMsWUFBWSxHQUFHLG9CQUFvQixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNuRCxNQUFNLENBQUMsSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVILGtCQUFDO0FBQUQsQ0F6REEsQUF5REMsQ0F6RGdDLHFCQUFXLEdBeUQzQztBQXpEWSxrQ0FBVyIsImZpbGUiOiJSYW1sQmFja2VuZC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7TW9ja0JhY2tlbmQsIE1vY2tDb25uZWN0aW9ufSBmcm9tIFwiQGFuZ3VsYXIvaHR0cC90ZXN0aW5nXCI7XG5pbXBvcnQge2xvYWRBcGlTeW5jfSBmcm9tIFwicmFtbC0xLXBhcnNlci9kaXN0L3JhbWwxL2FydGlmYWN0cy9yYW1sMTBwYXJzZXJcIjtcbmltcG9ydCB7QXBpLCBNZXRob2QsIFR5cGVEZWNsYXJhdGlvbn0gZnJvbSBcInJhbWwtMS1wYXJzZXIvZGlzdC9yYW1sMS9hcnRpZmFjdHMvcmFtbDEwcGFyc2VyYXBpXCI7XG5pbXBvcnQge3BhcnNlUkFNTFN5bmN9IGZyb20gXCJyYW1sLTEtcGFyc2VyXCI7XG5pbXBvcnQge1JlcXVlc3QsIFJlcXVlc3RNZXRob2QsIFJlc3BvbnNlLCBSZXNwb25zZU9wdGlvbnN9IGZyb20gXCJAYW5ndWxhci9odHRwXCI7XG5pbXBvcnQge2V4dHJhY3QsIHBhcnNlfSBmcm9tIFwicXVlcnktc3RyaW5nXCI7XG5cblxuaW50ZXJmYWNlIFVSSVBhcmFtcyB7XG5cbiAgW3BhcmFtTmFtZTogc3RyaW5nXTogYW55XG5cbn1cblxuY2xhc3MgUmVxdWVzdFZhbGlkYXRvciB7XG5cbiAgcHJpdmF0ZSBleHBlY3RlZFF1ZXJ5UGFyYW1zOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKG1ldGhvZDogTWV0aG9kKSB7XG4gICAgbWV0aG9kLnF1ZXJ5UGFyYW1ldGVycygpLmZvckVhY2gocGFyYW0gPT4gdGhpcy5leHBlY3RlZFF1ZXJ5UGFyYW1zLnB1c2gocGFyYW0ubmFtZSgpKSk7XG4gIH1cblxuICBwcml2YXRlIHBhcnNlUXVlcnlTdHJpbmcodXJsOiBzdHJpbmcpOiBvYmplY3Qge1xuICAgIHJldHVybiBwYXJzZShleHRyYWN0KHVybCkpO1xuICB9XG5cbiAgcHVibGljIG1hdGNoZXMocmVxdWVzdDogUmVxdWVzdCk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMuZXhwZWN0ZWRRdWVyeVBhcmFtcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBhY3R1YWxRdWVyeVBhcmFtcyA9IHRoaXMucGFyc2VRdWVyeVN0cmluZyhyZXF1ZXN0LnVybCk7XG4gICAgICBmb3IgKGNvbnN0IHBhcmFtTmFtZSBpbiBhY3R1YWxRdWVyeVBhcmFtcykge1xuICAgICAgICBpZiAodGhpcy5leHBlY3RlZFF1ZXJ5UGFyYW1zLmluZGV4T2YocGFyYW1OYW1lKSA9PSAtMSkge1xuICAgICAgICAgIHJldHVybiBcInVuZGVjbGFyZWQgcXVlcnkgcGFyYW1ldGVyIFtpbnZhbGlkXSBmb3VuZCBpbiByZXF1ZXN0XCI7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxufVxuXG5jbGFzcyBNYXRjaFJlc3VsdCB7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcmVhZG9ubHkgdXJpUGFyYW1zOiBVUklQYXJhbXMsXG4gICAgcmVhZG9ubHkgcmVzcG9uc2U6IFJlc3BvbnNlLFxuICAgIHJlYWRvbmx5IHJlcXVlc3RWYWxpZGF0b3JcbiAgKSB7fVxuXG59XG5cbmZ1bmN0aW9uIHVyaVBhdHRlcm5Ub1JlZ2V4cCh1cmlQYXR0ZXJuOiBzdHJpbmcpOiBbc3RyaW5nW10sIFJlZ0V4cF0ge1xuICBsZXQgcmVtYWluaW5nVXJpUGF0dGVybiA9IHVyaVBhdHRlcm4sIG9wZW5pbmdCcmFja2V0SWR4LCBjbG9zaW5nQnJhY2tldElkeCwgcGFyYW1OYW1lO1xuICBjb25zdCB1cmlQYXJhbU5hbWVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIHdoaWxlKChvcGVuaW5nQnJhY2tldElkeCA9IHJlbWFpbmluZ1VyaVBhdHRlcm4uaW5kZXhPZihcIntcIikpICE9PSAtMSkge1xuICAgIHJlbWFpbmluZ1VyaVBhdHRlcm4gPSByZW1haW5pbmdVcmlQYXR0ZXJuLnN1YnN0cmluZyhvcGVuaW5nQnJhY2tldElkeCArIDEpO1xuICAgIGNsb3NpbmdCcmFja2V0SWR4ID0gcmVtYWluaW5nVXJpUGF0dGVybi5pbmRleE9mKFwifVwiKTtcbiAgICBwYXJhbU5hbWUgPSByZW1haW5pbmdVcmlQYXR0ZXJuLnN1YnN0cmluZygwLCBjbG9zaW5nQnJhY2tldElkeCk7XG4gICAgdXJpUGFyYW1OYW1lcy5wdXNoKHBhcmFtTmFtZSk7XG4gICAgcmVtYWluaW5nVXJpUGF0dGVybiA9IHJlbWFpbmluZ1VyaVBhdHRlcm4uc3Vic3RyaW5nKGNsb3NpbmdCcmFja2V0SWR4ICsgMSk7XG4gIH1cblxuICBjb25zdCB0bXAgPSB1cmlQYXR0ZXJuLnJlcGxhY2UoL1xce1xcdytcXH0vZywgXCIoLiopXCIpO1xuICByZXR1cm4gW3VyaVBhcmFtTmFtZXMsIG5ldyBSZWdFeHAodG1wKV07XG59XG5cbmV4cG9ydCBjbGFzcyBVUklQYXR0ZXJuIHtcblxuICBwcml2YXRlIHBhdHRlcm46IFJlZ0V4cDtcblxuICBwcml2YXRlIHBhcmFtTmFtZXM6IHN0cmluZ1tdO1xuXG4gIGNvbnN0cnVjdG9yKHVyaVBhdHRlcm46IHN0cmluZykge1xuICAgIGxldCBwYXR0ZXJuTWF0Y2ggPSB1cmlQYXR0ZXJuVG9SZWdleHAodXJpUGF0dGVybik7XG4gICAgdGhpcy5wYXJhbU5hbWVzID0gcGF0dGVybk1hdGNoWzBdO1xuICAgIHRoaXMucGF0dGVybiA9IHBhdHRlcm5NYXRjaFsxXTtcbiAgfVxuXG4gIHB1YmxpYyBtYXRjaGVzKHVyaTogc3RyaW5nKTogVVJJUGFyYW1zIHtcbiAgICBjb25zdCBtYXRjaGVzID0gdGhpcy5wYXR0ZXJuLnRlc3QodXJpKTtcbiAgICBjb25zdCBhcnIgPSB0aGlzLnBhdHRlcm4uZXhlYyh1cmkpO1xuICAgIGNvbnN0IHBhcmFtTWFwOiBVUklQYXJhbXMgPSB7fTtcbiAgICBpZiAoYXJyID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gcGFyYW1NYXA7XG4gICAgfVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5wYXJhbU5hbWVzLmxlbmd0aDsgKytpKSB7XG4gICAgICBwYXJhbU1hcFt0aGlzLnBhcmFtTmFtZXNbaV1dID0gYXJyW2kgKyAxXTtcbiAgICB9XG4gICAgcmV0dXJuIG1hdGNoZXMgPyBwYXJhbU1hcCA6IG51bGw7XG4gIH1cblxufVxuXG5leHBvcnQgY2xhc3MgUmVxdWVzdFBhdHRlcm4ge1xuXG4gIHByaXZhdGUgZXhwZWN0ZWRVcmk6IFVSSVBhdHRlcm47XG5cbiAgY29uc3RydWN0b3IoXG4gICAgZXhwZWN0ZWRVcmk6IHN0cmluZyxcbiAgICByZWFkb25seSBleHBlY3RlZE1ldGhvZDogc3RyaW5nXG4gICkge1xuICAgIHRoaXMuZXhwZWN0ZWRVcmkgPSBuZXcgVVJJUGF0dGVybihleHBlY3RlZFVyaSk7XG4gIH1cblxuICBwdWJsaWMgbWF0Y2hlcyhyZXF1ZXN0OiBSZXF1ZXN0KTogVVJJUGFyYW1zIHtcbiAgICBjb25zdCBhY3R1YWxNZXRob2QgPSBSZXF1ZXN0TWV0aG9kW3JlcXVlc3QubWV0aG9kXS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IHVyaVBhcmFtcyA9IHRoaXMuZXhwZWN0ZWRVcmkubWF0Y2hlcyhyZXF1ZXN0LnVybCk7XG4gICAgaWYgKCEgKGFjdHVhbE1ldGhvZCA9PT0gdGhpcy5leHBlY3RlZE1ldGhvZFxuICAgICAgJiYgdXJpUGFyYW1zICE9PSBudWxsKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiB1cmlQYXJhbXM7XG4gIH1cbn1cblxuaW50ZXJmYWNlIFJlcXVlc3RNYXRjaEVudHJ5IHtcblxuICByZXF1ZXN0UGF0dGVybjogUmVxdWVzdFBhdHRlcm47XG5cbiAgcmVzcG9uc2U6IFJlc3BvbnNlO1xuXG4gIHJlcXVlc3RWYWxpZGF0b3I6IFJlcXVlc3RWYWxpZGF0b3I7XG5cbn1cblxuZnVuY3Rpb24gbG9va3VwRXhhbXBsZVJlc3BvbnNlQm9keShyZXNwQm9keURlZjogVHlwZURlY2xhcmF0aW9uKTogc3RyaW5nIHtcbiAgaWYgKHJlc3BCb2R5RGVmID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBpZiAocmVzcEJvZHlEZWYuZXhhbXBsZSgpID09PSBudWxsKSB7XG4gICAgcmV0dXJuIHJlc3BCb2R5RGVmLmV4YW1wbGVzKClbMF0udmFsdWUoKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcmVzcEJvZHlEZWYuZXhhbXBsZSgpLnZhbHVlKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gYnVpbGRSZXF1ZXN0UGF0dGVybnMoYXBpOiBBcGkpOiBSZXF1ZXN0TWF0Y2hFbnRyeVtdIHtcbiAgY29uc3QgZW50cmllcyA6IFJlcXVlc3RNYXRjaEVudHJ5W10gPSBbXTtcbiAgZm9yIChjb25zdCBpIGluIGFwaS5hbGxSZXNvdXJjZXMoKSkge1xuICAgIGNvbnN0IHJlc291cmNlID0gIGFwaS5hbGxSZXNvdXJjZXMoKVtpXTtcbiAgICBmb3IgKGNvbnN0IGogaW4gcmVzb3VyY2UubWV0aG9kcygpKSB7XG4gICAgICBjb25zdCBtZXRob2QgPSByZXNvdXJjZS5tZXRob2RzKClbal07XG4gICAgICBjb25zdCBwYXR0ZXJuID0gbmV3IFJlcXVlc3RQYXR0ZXJuKHJlc291cmNlLmFic29sdXRlVXJpKCksIG1ldGhvZC5tZXRob2QoKSk7XG4gICAgICBjb25zdCByZXNwb25zZSA9IG5ldyBSZXNwb25zZShuZXcgUmVzcG9uc2VPcHRpb25zKHtcbiAgICAgICAgc3RhdHVzOiBuZXcgTnVtYmVyKG1ldGhvZC5yZXNwb25zZXMoKVswXS5jb2RlKCkudmFsdWUoKSkudmFsdWVPZigpLFxuICAgICAgICBib2R5OiBsb29rdXBFeGFtcGxlUmVzcG9uc2VCb2R5KG1ldGhvZC5yZXNwb25zZXMoKVswXS5ib2R5KClbMF0pXG4gICAgICB9KSk7XG4gICAgICBlbnRyaWVzLnB1c2goe1xuICAgICAgICByZXF1ZXN0UGF0dGVybjogcGF0dGVybixcbiAgICAgICAgcmVzcG9uc2U6IHJlc3BvbnNlLFxuICAgICAgICByZXF1ZXN0VmFsaWRhdG9yOiBuZXcgUmVxdWVzdFZhbGlkYXRvcihtZXRob2QpXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGVudHJpZXM7XG59XG5cbmV4cG9ydCBjbGFzcyBSYW1sQmFja2VuZCBleHRlbmRzIE1vY2tCYWNrZW5kIHtcblxuICBwcml2YXRlIGFwaTogQXBpO1xuXG4gIHByaXZhdGUgbWF0Y2hFbnRyaWVzOiBSZXF1ZXN0TWF0Y2hFbnRyeVtdID0gW107XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmNvbm5lY3Rpb25zLnN1YnNjcmliZSh0aGlzLmhhbmRsZUNvbm5lY3Rpb24uYmluZCh0aGlzKSk7XG4gIH1cblxuXG4gIHByaXZhdGUgZmluZE1hdGNoaW5nUmVzcG9uc2UocmVxdWVzdDogUmVxdWVzdCk6IE1hdGNoUmVzdWx0IHtcbiAgICBmb3IgKGNvbnN0IGkgaW4gdGhpcy5tYXRjaEVudHJpZXMpIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy5tYXRjaEVudHJpZXNbaV07XG4gICAgICBsZXQgdXJpUGFyYW1zID0gZW50cnkucmVxdWVzdFBhdHRlcm4ubWF0Y2hlcyhyZXF1ZXN0KTtcbiAgICAgIGlmICh1cmlQYXJhbXMgIT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBNYXRjaFJlc3VsdCh1cmlQYXJhbXMsIGVudHJ5LnJlc3BvbnNlLCBlbnRyeS5yZXF1ZXN0VmFsaWRhdG9yKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKFwibm8gbWF0Y2hpbmcgcmVxdWVzdCBwYXR0ZXJuIGZvdW5kXCIpO1xuICB9XG4gIHByaXZhdGUgaGFuZGxlQ29ubmVjdGlvbihjb25uOiBNb2NrQ29ubmVjdGlvbikge1xuICAgIGNvbnN0IHJlcXVlc3QgPSBjb25uLnJlcXVlc3Q7XG4gICAgbGV0IHJlc3BvbnNlO1xuXG4gICAgY29uc3QgbWF0Y2hSZXN1bHQgPSB0aGlzLmZpbmRNYXRjaGluZ1Jlc3BvbnNlKHJlcXVlc3QpO1xuICAgIGxldCBlcnJvck1lc3NhZ2UgPSBtYXRjaFJlc3VsdC5yZXF1ZXN0VmFsaWRhdG9yLm1hdGNoZXMocmVxdWVzdCk7XG4gICAgaWYgKGVycm9yTWVzc2FnZSAhPT0gbnVsbCkge1xuICAgICAgcmVzcG9uc2UgPSBuZXcgUmVzcG9uc2UobmV3IFJlc3BvbnNlT3B0aW9ucyh7XG4gICAgICAgIHN0YXR1czogNDAxLFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7bWVzc2FnZTogZXJyb3JNZXNzYWdlfSlcbiAgICAgIH0pKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzcG9uc2UgPSBtYXRjaFJlc3VsdC5yZXNwb25zZTtcbiAgICB9XG4gICAgY29ubi5tb2NrUmVzcG9uZChyZXNwb25zZSk7XG4gIH1cblxuICBwdWJsaWMgZ2V0IGVuZHBvaW50cygpOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgZW5kcG9pbnRzID0gW107XG4gICAgdGhpcy5hcGkuYWxsUmVzb3VyY2VzKCkuZm9yRWFjaChpID0+IGVuZHBvaW50cy5wdXNoKGkuYWJzb2x1dGVVcmkoKSkpO1xuICAgIHJldHVybiBlbmRwb2ludHM7XG4gIH1cblxuICBwdWJsaWMgbG9hZFJBTUxGcm9tUGF0aChwYXRoOiBzdHJpbmcpOiBSYW1sQmFja2VuZCB7XG4gICAgdGhpcy5hcGkgPSBsb2FkQXBpU3luYyhwYXRoKTtcbiAgICB0aGlzLm1hdGNoRW50cmllcyA9IGJ1aWxkUmVxdWVzdFBhdHRlcm5zKHRoaXMuYXBpKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHB1YmxpYyBsb2FkUkFNTChjb250ZW50OiBzdHJpbmcpOiBSYW1sQmFja2VuZCB7XG4gICAgdGhpcy5hcGkgPSBwYXJzZVJBTUxTeW5jKGNvbnRlbnQpIGFzIEFwaTtcbiAgICB0aGlzLm1hdGNoRW50cmllcyA9IGJ1aWxkUmVxdWVzdFBhdHRlcm5zKHRoaXMuYXBpKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG59XG4iXX0=
