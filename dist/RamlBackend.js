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
var MatchResult = (function () {
    function MatchResult(uriParams) {
        this.uriParams = uriParams;
    }
    return MatchResult;
}());
function uriPatternToRegexp(uriPattern) {
    var patternMatcher = /\{(\w+)\}/g;
    var matchingPatterns = patternMatcher.exec(uriPattern);
    var uriParamNames = [];
    var i = 1;
    while (matchingPatterns[i] !== undefined) {
        uriParamNames.push(matchingPatterns[i]);
        i++;
    }
    console.log(uriParamNames, matchingPatterns);
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
        for (var i = 0; i < this.paramNames.length; ++i) {
            paramMap[this.paramNames[i]] = arr[i + 1];
        }
        console.log(paramMap);
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
        return actualMethod === this.expectedMethod
            && this.expectedUri.matches(request.url) !== null;
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
                response: response
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
    RamlBackend.prototype.handleConnection = function (conn) {
        var request = conn.request;
        conn.mockRespond(this.findMatchingResponse(request));
    };
    RamlBackend.prototype.findMatchingResponse = function (request) {
        for (var i in this.matchEntries) {
            var entry = this.matchEntries[i];
            if (entry.requestPattern.matches(request)) {
                return entry.response;
            }
        }
        throw new Error("no matching request pattern found");
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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Q0FBQyxRQUFRLENBQUM7WUFDeEIsQ0FBQztRQUNILENBQUM7UUFDRCxNQUFNLElBQUksS0FBSyxDQUFDLG1DQUFtQyxDQUFDLENBQUM7SUFDdkQsQ0FBQztJQUVELHNCQUFXLGtDQUFTO2FBQXBCO1lBQ0UsSUFBTSxTQUFTLEdBQUcsRUFBRSxDQUFDO1lBQ3JCLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLENBQUMsT0FBTyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsRUFBL0IsQ0FBK0IsQ0FBQyxDQUFDO1lBQ3RFLE1BQU0sQ0FBQyxTQUFTLENBQUM7UUFDbkIsQ0FBQzs7O09BQUE7SUFFTSxzQ0FBZ0IsR0FBdkIsVUFBd0IsSUFBWTtRQUNsQyxJQUFJLENBQUMsR0FBRyxHQUFHLDBCQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDN0IsSUFBSSxDQUFDLFlBQVksR0FBRyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDbkQsTUFBTSxDQUFDLElBQUksQ0FBQztJQUNkLENBQUM7SUFFTSw4QkFBUSxHQUFmLFVBQWdCLE9BQWU7UUFDN0IsSUFBSSxDQUFDLEdBQUcsR0FBRyw2QkFBYSxDQUFDLE9BQU8sQ0FBUSxDQUFDO1FBQ3pDLElBQUksQ0FBQyxZQUFZLEdBQUcsb0JBQW9CLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ25ELE1BQU0sQ0FBQyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUgsa0JBQUM7QUFBRCxDQTVDQSxBQTRDQyxDQTVDZ0MscUJBQVcsR0E0QzNDO0FBNUNZLGtDQUFXIiwiZmlsZSI6IlJhbWxCYWNrZW5kLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtNb2NrQmFja2VuZCwgTW9ja0Nvbm5lY3Rpb259IGZyb20gXCJAYW5ndWxhci9odHRwL3Rlc3RpbmdcIjtcbmltcG9ydCB7bG9hZEFwaVN5bmN9IGZyb20gXCJyYW1sLTEtcGFyc2VyL2Rpc3QvcmFtbDEvYXJ0aWZhY3RzL3JhbWwxMHBhcnNlclwiO1xuaW1wb3J0IHtBcGksIE1ldGhvZCwgVHlwZURlY2xhcmF0aW9ufSBmcm9tIFwicmFtbC0xLXBhcnNlci9kaXN0L3JhbWwxL2FydGlmYWN0cy9yYW1sMTBwYXJzZXJhcGlcIjtcbmltcG9ydCB7cGFyc2VSQU1MU3luY30gZnJvbSBcInJhbWwtMS1wYXJzZXJcIjtcbmltcG9ydCB7UmVxdWVzdCwgUmVxdWVzdE1ldGhvZCwgUmVzcG9uc2UsIFJlc3BvbnNlT3B0aW9uc30gZnJvbSBcIkBhbmd1bGFyL2h0dHBcIjtcblxuXG5pbnRlcmZhY2UgVVJJUGFyYW1zIHtcblxuICBbcGFyYW1OYW1lOiBzdHJpbmddOiBhbnlcblxufVxuXG5jbGFzcyBNYXRjaFJlc3VsdCB7XG5cbiAgY29uc3RydWN0b3IocmVhZG9ubHkgdXJpUGFyYW1zOiBVUklQYXJhbXMpe31cblxufVxuXG5mdW5jdGlvbiB1cmlQYXR0ZXJuVG9SZWdleHAodXJpUGF0dGVybjogc3RyaW5nKTogW3N0cmluZ1tdLCBSZWdFeHBdIHtcbiAgY29uc3QgcGF0dGVybk1hdGNoZXI6IFJlZ0V4cCA9IC9cXHsoXFx3KylcXH0vZztcbiAgY29uc3QgbWF0Y2hpbmdQYXR0ZXJucyA9IHBhdHRlcm5NYXRjaGVyLmV4ZWModXJpUGF0dGVybik7XG4gIGNvbnN0IHVyaVBhcmFtTmFtZXM6IHN0cmluZ1tdID0gW107XG5cbiAgbGV0IGkgPSAxO1xuICB3aGlsZSAobWF0Y2hpbmdQYXR0ZXJuc1tpXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgdXJpUGFyYW1OYW1lcy5wdXNoKG1hdGNoaW5nUGF0dGVybnNbaV0pO1xuICAgIGkrKztcbiAgfVxuY29uc29sZS5sb2codXJpUGFyYW1OYW1lcywgbWF0Y2hpbmdQYXR0ZXJucylcbiAgY29uc3QgdG1wID0gdXJpUGF0dGVybi5yZXBsYWNlKC9cXHtcXHcrXFx9L2csIFwiKC4qKVwiKTtcbiAgcmV0dXJuIFt1cmlQYXJhbU5hbWVzLCBuZXcgUmVnRXhwKHRtcCldO1xufVxuXG5leHBvcnQgY2xhc3MgVVJJUGF0dGVybiB7XG5cbiAgcHJpdmF0ZSBwYXR0ZXJuOiBSZWdFeHA7XG5cbiAgcHJpdmF0ZSBwYXJhbU5hbWVzOiBzdHJpbmdbXTtcblxuICBjb25zdHJ1Y3Rvcih1cmlQYXR0ZXJuOiBzdHJpbmcpIHtcbiAgICBsZXQgcGF0dGVybk1hdGNoID0gdXJpUGF0dGVyblRvUmVnZXhwKHVyaVBhdHRlcm4pO1xuICAgIHRoaXMucGFyYW1OYW1lcyA9IHBhdHRlcm5NYXRjaFswXTtcbiAgICB0aGlzLnBhdHRlcm4gPSBwYXR0ZXJuTWF0Y2hbMV07XG4gIH1cblxuICBwdWJsaWMgbWF0Y2hlcyh1cmk6IHN0cmluZyk6IFVSSVBhcmFtcyB7XG4gICAgY29uc3QgbWF0Y2hlcyA9IHRoaXMucGF0dGVybi50ZXN0KHVyaSk7XG4gICAgY29uc3QgYXJyID0gdGhpcy5wYXR0ZXJuLmV4ZWModXJpKTtcbiAgICBjb25zdCBwYXJhbU1hcDogVVJJUGFyYW1zID0ge307XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnBhcmFtTmFtZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgIHBhcmFtTWFwW3RoaXMucGFyYW1OYW1lc1tpXV0gPSBhcnJbaSArIDFdO1xuICAgIH1cbiAgICBjb25zb2xlLmxvZyhwYXJhbU1hcCk7XG4gICAgcmV0dXJuIG1hdGNoZXMgPyBwYXJhbU1hcCA6IG51bGw7XG4gIH1cblxufVxuXG5leHBvcnQgY2xhc3MgUmVxdWVzdFBhdHRlcm4ge1xuXG4gIHByaXZhdGUgZXhwZWN0ZWRVcmk6IFVSSVBhdHRlcm47XG5cbiAgY29uc3RydWN0b3IoXG4gICAgZXhwZWN0ZWRVcmk6IHN0cmluZyxcbiAgICByZWFkb25seSBleHBlY3RlZE1ldGhvZDogc3RyaW5nXG4gICkge1xuICAgIHRoaXMuZXhwZWN0ZWRVcmkgPSBuZXcgVVJJUGF0dGVybihleHBlY3RlZFVyaSk7XG4gIH1cblxuICBwdWJsaWMgbWF0Y2hlcyhyZXF1ZXN0OiBSZXF1ZXN0KTogYm9vbGVhbiB7XG4gICAgY29uc3QgYWN0dWFsTWV0aG9kID0gUmVxdWVzdE1ldGhvZFtyZXF1ZXN0Lm1ldGhvZF0udG9Mb3dlckNhc2UoKTtcbiAgICByZXR1cm4gYWN0dWFsTWV0aG9kID09PSB0aGlzLmV4cGVjdGVkTWV0aG9kXG4gICAgICAmJiB0aGlzLmV4cGVjdGVkVXJpLm1hdGNoZXMocmVxdWVzdC51cmwpICE9PSBudWxsXG4gICAgO1xuICB9XG59XG5cbmludGVyZmFjZSBSZXF1ZXN0TWF0Y2hFbnRyeSB7XG5cbiAgcmVxdWVzdFBhdHRlcm46IFJlcXVlc3RQYXR0ZXJuO1xuXG4gIHJlc3BvbnNlOiBSZXNwb25zZTtcblxufVxuXG5mdW5jdGlvbiBsb29rdXBFeGFtcGxlUmVzcG9uc2VCb2R5KHJlc3BCb2R5RGVmOiBUeXBlRGVjbGFyYXRpb24pOiBzdHJpbmcge1xuICBpZiAocmVzcEJvZHlEZWYgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGlmIChyZXNwQm9keURlZi5leGFtcGxlKCkgPT09IG51bGwpIHtcbiAgICByZXR1cm4gcmVzcEJvZHlEZWYuZXhhbXBsZXMoKVswXS52YWx1ZSgpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiByZXNwQm9keURlZi5leGFtcGxlKCkudmFsdWUoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBidWlsZFJlcXVlc3RQYXR0ZXJucyhhcGk6IEFwaSk6IFJlcXVlc3RNYXRjaEVudHJ5W10ge1xuICBjb25zdCBlbnRyaWVzIDogUmVxdWVzdE1hdGNoRW50cnlbXSA9IFtdO1xuICBmb3IgKGNvbnN0IGkgaW4gYXBpLmFsbFJlc291cmNlcygpKSB7XG4gICAgY29uc3QgcmVzb3VyY2UgPSAgYXBpLmFsbFJlc291cmNlcygpW2ldO1xuICAgIGZvciAoY29uc3QgaiBpbiByZXNvdXJjZS5tZXRob2RzKCkpIHtcbiAgICAgIGNvbnN0IG1ldGhvZCA9IHJlc291cmNlLm1ldGhvZHMoKVtqXTtcbiAgICAgIGNvbnN0IHBhdHRlcm4gPSBuZXcgUmVxdWVzdFBhdHRlcm4ocmVzb3VyY2UuYWJzb2x1dGVVcmkoKSwgbWV0aG9kLm1ldGhvZCgpKTtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gbmV3IFJlc3BvbnNlKG5ldyBSZXNwb25zZU9wdGlvbnMoe1xuICAgICAgICBzdGF0dXM6IG5ldyBOdW1iZXIobWV0aG9kLnJlc3BvbnNlcygpWzBdLmNvZGUoKS52YWx1ZSgpKS52YWx1ZU9mKCksXG4gICAgICAgIGJvZHk6IGxvb2t1cEV4YW1wbGVSZXNwb25zZUJvZHkobWV0aG9kLnJlc3BvbnNlcygpWzBdLmJvZHkoKVswXSlcbiAgICAgIH0pKTtcbiAgICAgIGVudHJpZXMucHVzaCh7XG4gICAgICAgIHJlcXVlc3RQYXR0ZXJuOiBwYXR0ZXJuLFxuICAgICAgICByZXNwb25zZTogcmVzcG9uc2VcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZW50cmllcztcbn1cblxuZXhwb3J0IGNsYXNzIFJhbWxCYWNrZW5kIGV4dGVuZHMgTW9ja0JhY2tlbmQge1xuXG4gIHByaXZhdGUgYXBpOiBBcGk7XG5cbiAgcHJpdmF0ZSBtYXRjaEVudHJpZXM6IFJlcXVlc3RNYXRjaEVudHJ5W10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuY29ubmVjdGlvbnMuc3Vic2NyaWJlKHRoaXMuaGFuZGxlQ29ubmVjdGlvbi5iaW5kKHRoaXMpKTtcbiAgfVxuXG4gIHByaXZhdGUgaGFuZGxlQ29ubmVjdGlvbihjb25uOiBNb2NrQ29ubmVjdGlvbikge1xuICAgIGNvbnN0IHJlcXVlc3QgPSBjb25uLnJlcXVlc3Q7XG4gICAgY29ubi5tb2NrUmVzcG9uZCh0aGlzLmZpbmRNYXRjaGluZ1Jlc3BvbnNlKHJlcXVlc3QpKTtcbiAgfVxuXG4gIHByaXZhdGUgZmluZE1hdGNoaW5nUmVzcG9uc2UocmVxdWVzdDogUmVxdWVzdCk6IFJlc3BvbnNlIHtcbiAgICBmb3IgKGNvbnN0IGkgaW4gdGhpcy5tYXRjaEVudHJpZXMpIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gdGhpcy5tYXRjaEVudHJpZXNbaV07XG4gICAgICBpZiAoZW50cnkucmVxdWVzdFBhdHRlcm4ubWF0Y2hlcyhyZXF1ZXN0KSkge1xuICAgICAgICByZXR1cm4gZW50cnkucmVzcG9uc2U7XG4gICAgICB9XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcihcIm5vIG1hdGNoaW5nIHJlcXVlc3QgcGF0dGVybiBmb3VuZFwiKTtcbiAgfVxuXG4gIHB1YmxpYyBnZXQgZW5kcG9pbnRzKCk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCBlbmRwb2ludHMgPSBbXTtcbiAgICB0aGlzLmFwaS5hbGxSZXNvdXJjZXMoKS5mb3JFYWNoKGkgPT4gZW5kcG9pbnRzLnB1c2goaS5hYnNvbHV0ZVVyaSgpKSk7XG4gICAgcmV0dXJuIGVuZHBvaW50cztcbiAgfVxuXG4gIHB1YmxpYyBsb2FkUkFNTEZyb21QYXRoKHBhdGg6IHN0cmluZyk6IFJhbWxCYWNrZW5kIHtcbiAgICB0aGlzLmFwaSA9IGxvYWRBcGlTeW5jKHBhdGgpO1xuICAgIHRoaXMubWF0Y2hFbnRyaWVzID0gYnVpbGRSZXF1ZXN0UGF0dGVybnModGhpcy5hcGkpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcHVibGljIGxvYWRSQU1MKGNvbnRlbnQ6IHN0cmluZyk6IFJhbWxCYWNrZW5kIHtcbiAgICB0aGlzLmFwaSA9IHBhcnNlUkFNTFN5bmMoY29udGVudCkgYXMgQXBpO1xuICAgIHRoaXMubWF0Y2hFbnRyaWVzID0gYnVpbGRSZXF1ZXN0UGF0dGVybnModGhpcy5hcGkpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbn1cbiJdfQ==
