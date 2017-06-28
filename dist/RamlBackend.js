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
    var remainingUriPattern = uriPattern;
    var startIdx, closingBracketIdx;
    var uriParamNames = [];
    while ((startIdx = remainingUriPattern.indexOf("{")) !== -1) {
        remainingUriPattern = remainingUriPattern.substring(startIdx + 1);
        closingBracketIdx = remainingUriPattern.indexOf("}");
        var name_1 = remainingUriPattern.substring(0, closingBracketIdx);
        uriParamNames.push(name_1);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QVcsR0E0QzNDO0FBNUNZLGtDQUFXIiwiZmlsZSI6IlJhbWxCYWNrZW5kLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtNb2NrQmFja2VuZCwgTW9ja0Nvbm5lY3Rpb259IGZyb20gXCJAYW5ndWxhci9odHRwL3Rlc3RpbmdcIjtcbmltcG9ydCB7bG9hZEFwaVN5bmN9IGZyb20gXCJyYW1sLTEtcGFyc2VyL2Rpc3QvcmFtbDEvYXJ0aWZhY3RzL3JhbWwxMHBhcnNlclwiO1xuaW1wb3J0IHtBcGksIE1ldGhvZCwgVHlwZURlY2xhcmF0aW9ufSBmcm9tIFwicmFtbC0xLXBhcnNlci9kaXN0L3JhbWwxL2FydGlmYWN0cy9yYW1sMTBwYXJzZXJhcGlcIjtcbmltcG9ydCB7cGFyc2VSQU1MU3luY30gZnJvbSBcInJhbWwtMS1wYXJzZXJcIjtcbmltcG9ydCB7UmVxdWVzdCwgUmVxdWVzdE1ldGhvZCwgUmVzcG9uc2UsIFJlc3BvbnNlT3B0aW9uc30gZnJvbSBcIkBhbmd1bGFyL2h0dHBcIjtcblxuXG5pbnRlcmZhY2UgVVJJUGFyYW1zIHtcblxuICBbcGFyYW1OYW1lOiBzdHJpbmddOiBhbnlcblxufVxuXG5jbGFzcyBNYXRjaFJlc3VsdCB7XG5cbiAgY29uc3RydWN0b3IocmVhZG9ubHkgdXJpUGFyYW1zOiBVUklQYXJhbXMpe31cblxufVxuXG5mdW5jdGlvbiB1cmlQYXR0ZXJuVG9SZWdleHAodXJpUGF0dGVybjogc3RyaW5nKTogW3N0cmluZ1tdLCBSZWdFeHBdIHtcbiAgY29uc3QgcGF0dGVybk1hdGNoZXI6IFJlZ0V4cCA9IC9cXHsoXFx3KylcXH0vZztcbiAgbGV0IHJlbWFpbmluZ1VyaVBhdHRlcm4gPSB1cmlQYXR0ZXJuO1xuICBsZXQgc3RhcnRJZHgsIGNsb3NpbmdCcmFja2V0SWR4O1xuICBjb25zdCB1cmlQYXJhbU5hbWVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIHdoaWxlKChzdGFydElkeCA9IHJlbWFpbmluZ1VyaVBhdHRlcm4uaW5kZXhPZihcIntcIikpICE9PSAtMSkge1xuICAgIHJlbWFpbmluZ1VyaVBhdHRlcm4gPSByZW1haW5pbmdVcmlQYXR0ZXJuLnN1YnN0cmluZyhzdGFydElkeCArIDEpO1xuICAgIGNsb3NpbmdCcmFja2V0SWR4ID0gcmVtYWluaW5nVXJpUGF0dGVybi5pbmRleE9mKFwifVwiKTtcbiAgICBsZXQgbmFtZSA9IHJlbWFpbmluZ1VyaVBhdHRlcm4uc3Vic3RyaW5nKDAsIGNsb3NpbmdCcmFja2V0SWR4KTtcbiAgICB1cmlQYXJhbU5hbWVzLnB1c2gobmFtZSk7XG4gICAgcmVtYWluaW5nVXJpUGF0dGVybiA9IHJlbWFpbmluZ1VyaVBhdHRlcm4uc3Vic3RyaW5nKGNsb3NpbmdCcmFja2V0SWR4ICsgMSk7XG4gIH1cblxuICBjb25zdCB0bXAgPSB1cmlQYXR0ZXJuLnJlcGxhY2UoL1xce1xcdytcXH0vZywgXCIoLiopXCIpO1xuICByZXR1cm4gW3VyaVBhcmFtTmFtZXMsIG5ldyBSZWdFeHAodG1wKV07XG59XG5cbmV4cG9ydCBjbGFzcyBVUklQYXR0ZXJuIHtcblxuICBwcml2YXRlIHBhdHRlcm46IFJlZ0V4cDtcblxuICBwcml2YXRlIHBhcmFtTmFtZXM6IHN0cmluZ1tdO1xuXG4gIGNvbnN0cnVjdG9yKHVyaVBhdHRlcm46IHN0cmluZykge1xuICAgIGxldCBwYXR0ZXJuTWF0Y2ggPSB1cmlQYXR0ZXJuVG9SZWdleHAodXJpUGF0dGVybik7XG4gICAgdGhpcy5wYXJhbU5hbWVzID0gcGF0dGVybk1hdGNoWzBdO1xuICAgIHRoaXMucGF0dGVybiA9IHBhdHRlcm5NYXRjaFsxXTtcbiAgfVxuXG4gIHB1YmxpYyBtYXRjaGVzKHVyaTogc3RyaW5nKTogVVJJUGFyYW1zIHtcbiAgICBjb25zdCBtYXRjaGVzID0gdGhpcy5wYXR0ZXJuLnRlc3QodXJpKTtcbiAgICBjb25zdCBhcnIgPSB0aGlzLnBhdHRlcm4uZXhlYyh1cmkpO1xuICAgIGNvbnN0IHBhcmFtTWFwOiBVUklQYXJhbXMgPSB7fTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucGFyYW1OYW1lcy5sZW5ndGg7ICsraSkge1xuICAgICAgcGFyYW1NYXBbdGhpcy5wYXJhbU5hbWVzW2ldXSA9IGFycltpICsgMV07XG4gICAgfVxuICAgIGNvbnNvbGUubG9nKHBhcmFtTWFwKTtcbiAgICByZXR1cm4gbWF0Y2hlcyA/IHBhcmFtTWFwIDogbnVsbDtcbiAgfVxuXG59XG5cbmV4cG9ydCBjbGFzcyBSZXF1ZXN0UGF0dGVybiB7XG5cbiAgcHJpdmF0ZSBleHBlY3RlZFVyaTogVVJJUGF0dGVybjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBleHBlY3RlZFVyaTogc3RyaW5nLFxuICAgIHJlYWRvbmx5IGV4cGVjdGVkTWV0aG9kOiBzdHJpbmdcbiAgKSB7XG4gICAgdGhpcy5leHBlY3RlZFVyaSA9IG5ldyBVUklQYXR0ZXJuKGV4cGVjdGVkVXJpKTtcbiAgfVxuXG4gIHB1YmxpYyBtYXRjaGVzKHJlcXVlc3Q6IFJlcXVlc3QpOiBib29sZWFuIHtcbiAgICBjb25zdCBhY3R1YWxNZXRob2QgPSBSZXF1ZXN0TWV0aG9kW3JlcXVlc3QubWV0aG9kXS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiBhY3R1YWxNZXRob2QgPT09IHRoaXMuZXhwZWN0ZWRNZXRob2RcbiAgICAgICYmIHRoaXMuZXhwZWN0ZWRVcmkubWF0Y2hlcyhyZXF1ZXN0LnVybCkgIT09IG51bGxcbiAgICA7XG4gIH1cbn1cblxuaW50ZXJmYWNlIFJlcXVlc3RNYXRjaEVudHJ5IHtcblxuICByZXF1ZXN0UGF0dGVybjogUmVxdWVzdFBhdHRlcm47XG5cbiAgcmVzcG9uc2U6IFJlc3BvbnNlO1xuXG59XG5cbmZ1bmN0aW9uIGxvb2t1cEV4YW1wbGVSZXNwb25zZUJvZHkocmVzcEJvZHlEZWY6IFR5cGVEZWNsYXJhdGlvbik6IHN0cmluZyB7XG4gIGlmIChyZXNwQm9keURlZiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgaWYgKHJlc3BCb2R5RGVmLmV4YW1wbGUoKSA9PT0gbnVsbCkge1xuICAgIHJldHVybiByZXNwQm9keURlZi5leGFtcGxlcygpWzBdLnZhbHVlKCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHJlc3BCb2R5RGVmLmV4YW1wbGUoKS52YWx1ZSgpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGJ1aWxkUmVxdWVzdFBhdHRlcm5zKGFwaTogQXBpKTogUmVxdWVzdE1hdGNoRW50cnlbXSB7XG4gIGNvbnN0IGVudHJpZXMgOiBSZXF1ZXN0TWF0Y2hFbnRyeVtdID0gW107XG4gIGZvciAoY29uc3QgaSBpbiBhcGkuYWxsUmVzb3VyY2VzKCkpIHtcbiAgICBjb25zdCByZXNvdXJjZSA9ICBhcGkuYWxsUmVzb3VyY2VzKClbaV07XG4gICAgZm9yIChjb25zdCBqIGluIHJlc291cmNlLm1ldGhvZHMoKSkge1xuICAgICAgY29uc3QgbWV0aG9kID0gcmVzb3VyY2UubWV0aG9kcygpW2pdO1xuICAgICAgY29uc3QgcGF0dGVybiA9IG5ldyBSZXF1ZXN0UGF0dGVybihyZXNvdXJjZS5hYnNvbHV0ZVVyaSgpLCBtZXRob2QubWV0aG9kKCkpO1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBuZXcgUmVzcG9uc2UobmV3IFJlc3BvbnNlT3B0aW9ucyh7XG4gICAgICAgIHN0YXR1czogbmV3IE51bWJlcihtZXRob2QucmVzcG9uc2VzKClbMF0uY29kZSgpLnZhbHVlKCkpLnZhbHVlT2YoKSxcbiAgICAgICAgYm9keTogbG9va3VwRXhhbXBsZVJlc3BvbnNlQm9keShtZXRob2QucmVzcG9uc2VzKClbMF0uYm9keSgpWzBdKVxuICAgICAgfSkpO1xuICAgICAgZW50cmllcy5wdXNoKHtcbiAgICAgICAgcmVxdWVzdFBhdHRlcm46IHBhdHRlcm4sXG4gICAgICAgIHJlc3BvbnNlOiByZXNwb25zZVxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBlbnRyaWVzO1xufVxuXG5leHBvcnQgY2xhc3MgUmFtbEJhY2tlbmQgZXh0ZW5kcyBNb2NrQmFja2VuZCB7XG5cbiAgcHJpdmF0ZSBhcGk6IEFwaTtcblxuICBwcml2YXRlIG1hdGNoRW50cmllczogUmVxdWVzdE1hdGNoRW50cnlbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5jb25uZWN0aW9ucy5zdWJzY3JpYmUodGhpcy5oYW5kbGVDb25uZWN0aW9uLmJpbmQodGhpcykpO1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVDb25uZWN0aW9uKGNvbm46IE1vY2tDb25uZWN0aW9uKSB7XG4gICAgY29uc3QgcmVxdWVzdCA9IGNvbm4ucmVxdWVzdDtcbiAgICBjb25uLm1vY2tSZXNwb25kKHRoaXMuZmluZE1hdGNoaW5nUmVzcG9uc2UocmVxdWVzdCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBmaW5kTWF0Y2hpbmdSZXNwb25zZShyZXF1ZXN0OiBSZXF1ZXN0KTogUmVzcG9uc2Uge1xuICAgIGZvciAoY29uc3QgaSBpbiB0aGlzLm1hdGNoRW50cmllcykge1xuICAgICAgY29uc3QgZW50cnkgPSB0aGlzLm1hdGNoRW50cmllc1tpXTtcbiAgICAgIGlmIChlbnRyeS5yZXF1ZXN0UGF0dGVybi5tYXRjaGVzKHJlcXVlc3QpKSB7XG4gICAgICAgIHJldHVybiBlbnRyeS5yZXNwb25zZTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKFwibm8gbWF0Y2hpbmcgcmVxdWVzdCBwYXR0ZXJuIGZvdW5kXCIpO1xuICB9XG5cbiAgcHVibGljIGdldCBlbmRwb2ludHMoKTogc3RyaW5nW10ge1xuICAgIGNvbnN0IGVuZHBvaW50cyA9IFtdO1xuICAgIHRoaXMuYXBpLmFsbFJlc291cmNlcygpLmZvckVhY2goaSA9PiBlbmRwb2ludHMucHVzaChpLmFic29sdXRlVXJpKCkpKTtcbiAgICByZXR1cm4gZW5kcG9pbnRzO1xuICB9XG5cbiAgcHVibGljIGxvYWRSQU1MRnJvbVBhdGgocGF0aDogc3RyaW5nKTogUmFtbEJhY2tlbmQge1xuICAgIHRoaXMuYXBpID0gbG9hZEFwaVN5bmMocGF0aCk7XG4gICAgdGhpcy5tYXRjaEVudHJpZXMgPSBidWlsZFJlcXVlc3RQYXR0ZXJucyh0aGlzLmFwaSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBwdWJsaWMgbG9hZFJBTUwoY29udGVudDogc3RyaW5nKTogUmFtbEJhY2tlbmQge1xuICAgIHRoaXMuYXBpID0gcGFyc2VSQU1MU3luYyhjb250ZW50KSBhcyBBcGk7XG4gICAgdGhpcy5tYXRjaEVudHJpZXMgPSBidWlsZFJlcXVlc3RQYXR0ZXJucyh0aGlzLmFwaSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxufVxuIl19
