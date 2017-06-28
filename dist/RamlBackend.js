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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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UmFtbEJhY2tlbmQuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge01vY2tCYWNrZW5kLCBNb2NrQ29ubmVjdGlvbn0gZnJvbSBcIkBhbmd1bGFyL2h0dHAvdGVzdGluZ1wiO1xuaW1wb3J0IHtsb2FkQXBpU3luY30gZnJvbSBcInJhbWwtMS1wYXJzZXIvZGlzdC9yYW1sMS9hcnRpZmFjdHMvcmFtbDEwcGFyc2VyXCI7XG5pbXBvcnQge0FwaSwgTWV0aG9kLCBUeXBlRGVjbGFyYXRpb259IGZyb20gXCJyYW1sLTEtcGFyc2VyL2Rpc3QvcmFtbDEvYXJ0aWZhY3RzL3JhbWwxMHBhcnNlcmFwaVwiO1xuaW1wb3J0IHtwYXJzZVJBTUxTeW5jfSBmcm9tIFwicmFtbC0xLXBhcnNlclwiO1xuaW1wb3J0IHtSZXF1ZXN0LCBSZXF1ZXN0TWV0aG9kLCBSZXNwb25zZSwgUmVzcG9uc2VPcHRpb25zfSBmcm9tIFwiQGFuZ3VsYXIvaHR0cFwiO1xuXG5cbmludGVyZmFjZSBVUklQYXJhbXMge1xuXG4gIFtwYXJhbU5hbWU6IHN0cmluZ106IGFueVxuXG59XG5cbmNsYXNzIE1hdGNoUmVzdWx0IHtcblxuICBjb25zdHJ1Y3RvcihyZWFkb25seSB1cmlQYXJhbXM6IFVSSVBhcmFtcyl7fVxuXG59XG5cbmZ1bmN0aW9uIHVyaVBhdHRlcm5Ub1JlZ2V4cCh1cmlQYXR0ZXJuOiBzdHJpbmcpOiBbc3RyaW5nW10sIFJlZ0V4cF0ge1xuICBsZXQgcmVtYWluaW5nVXJpUGF0dGVybiA9IHVyaVBhdHRlcm4sIG9wZW5pbmdCcmFja2V0SWR4LCBjbG9zaW5nQnJhY2tldElkeCwgcGFyYW1OYW1lO1xuICBjb25zdCB1cmlQYXJhbU5hbWVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIHdoaWxlKChvcGVuaW5nQnJhY2tldElkeCA9IHJlbWFpbmluZ1VyaVBhdHRlcm4uaW5kZXhPZihcIntcIikpICE9PSAtMSkge1xuICAgIHJlbWFpbmluZ1VyaVBhdHRlcm4gPSByZW1haW5pbmdVcmlQYXR0ZXJuLnN1YnN0cmluZyhvcGVuaW5nQnJhY2tldElkeCArIDEpO1xuICAgIGNsb3NpbmdCcmFja2V0SWR4ID0gcmVtYWluaW5nVXJpUGF0dGVybi5pbmRleE9mKFwifVwiKTtcbiAgICBwYXJhbU5hbWUgPSByZW1haW5pbmdVcmlQYXR0ZXJuLnN1YnN0cmluZygwLCBjbG9zaW5nQnJhY2tldElkeCk7XG4gICAgdXJpUGFyYW1OYW1lcy5wdXNoKHBhcmFtTmFtZSk7XG4gICAgcmVtYWluaW5nVXJpUGF0dGVybiA9IHJlbWFpbmluZ1VyaVBhdHRlcm4uc3Vic3RyaW5nKGNsb3NpbmdCcmFja2V0SWR4ICsgMSk7XG4gIH1cblxuICBjb25zdCB0bXAgPSB1cmlQYXR0ZXJuLnJlcGxhY2UoL1xce1xcdytcXH0vZywgXCIoLiopXCIpO1xuICByZXR1cm4gW3VyaVBhcmFtTmFtZXMsIG5ldyBSZWdFeHAodG1wKV07XG59XG5cbmV4cG9ydCBjbGFzcyBVUklQYXR0ZXJuIHtcblxuICBwcml2YXRlIHBhdHRlcm46IFJlZ0V4cDtcblxuICBwcml2YXRlIHBhcmFtTmFtZXM6IHN0cmluZ1tdO1xuXG4gIGNvbnN0cnVjdG9yKHVyaVBhdHRlcm46IHN0cmluZykge1xuICAgIGxldCBwYXR0ZXJuTWF0Y2ggPSB1cmlQYXR0ZXJuVG9SZWdleHAodXJpUGF0dGVybik7XG4gICAgdGhpcy5wYXJhbU5hbWVzID0gcGF0dGVybk1hdGNoWzBdO1xuICAgIHRoaXMucGF0dGVybiA9IHBhdHRlcm5NYXRjaFsxXTtcbiAgfVxuXG4gIHB1YmxpYyBtYXRjaGVzKHVyaTogc3RyaW5nKTogVVJJUGFyYW1zIHtcbiAgICBjb25zdCBtYXRjaGVzID0gdGhpcy5wYXR0ZXJuLnRlc3QodXJpKTtcbiAgICBjb25zdCBhcnIgPSB0aGlzLnBhdHRlcm4uZXhlYyh1cmkpO1xuICAgIGNvbnN0IHBhcmFtTWFwOiBVUklQYXJhbXMgPSB7fTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucGFyYW1OYW1lcy5sZW5ndGg7ICsraSkge1xuICAgICAgcGFyYW1NYXBbdGhpcy5wYXJhbU5hbWVzW2ldXSA9IGFycltpICsgMV07XG4gICAgfVxuICAgIGNvbnNvbGUubG9nKHBhcmFtTWFwKTtcbiAgICByZXR1cm4gbWF0Y2hlcyA/IHBhcmFtTWFwIDogbnVsbDtcbiAgfVxuXG59XG5cbmV4cG9ydCBjbGFzcyBSZXF1ZXN0UGF0dGVybiB7XG5cbiAgcHJpdmF0ZSBleHBlY3RlZFVyaTogVVJJUGF0dGVybjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBleHBlY3RlZFVyaTogc3RyaW5nLFxuICAgIHJlYWRvbmx5IGV4cGVjdGVkTWV0aG9kOiBzdHJpbmdcbiAgKSB7XG4gICAgdGhpcy5leHBlY3RlZFVyaSA9IG5ldyBVUklQYXR0ZXJuKGV4cGVjdGVkVXJpKTtcbiAgfVxuXG4gIHB1YmxpYyBtYXRjaGVzKHJlcXVlc3Q6IFJlcXVlc3QpOiBib29sZWFuIHtcbiAgICBjb25zdCBhY3R1YWxNZXRob2QgPSBSZXF1ZXN0TWV0aG9kW3JlcXVlc3QubWV0aG9kXS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiBhY3R1YWxNZXRob2QgPT09IHRoaXMuZXhwZWN0ZWRNZXRob2RcbiAgICAgICYmIHRoaXMuZXhwZWN0ZWRVcmkubWF0Y2hlcyhyZXF1ZXN0LnVybCkgIT09IG51bGxcbiAgICA7XG4gIH1cbn1cblxuaW50ZXJmYWNlIFJlcXVlc3RNYXRjaEVudHJ5IHtcblxuICByZXF1ZXN0UGF0dGVybjogUmVxdWVzdFBhdHRlcm47XG5cbiAgcmVzcG9uc2U6IFJlc3BvbnNlO1xuXG59XG5cbmZ1bmN0aW9uIGxvb2t1cEV4YW1wbGVSZXNwb25zZUJvZHkocmVzcEJvZHlEZWY6IFR5cGVEZWNsYXJhdGlvbik6IHN0cmluZyB7XG4gIGlmIChyZXNwQm9keURlZiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgaWYgKHJlc3BCb2R5RGVmLmV4YW1wbGUoKSA9PT0gbnVsbCkge1xuICAgIHJldHVybiByZXNwQm9keURlZi5leGFtcGxlcygpWzBdLnZhbHVlKCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHJlc3BCb2R5RGVmLmV4YW1wbGUoKS52YWx1ZSgpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGJ1aWxkUmVxdWVzdFBhdHRlcm5zKGFwaTogQXBpKTogUmVxdWVzdE1hdGNoRW50cnlbXSB7XG4gIGNvbnN0IGVudHJpZXMgOiBSZXF1ZXN0TWF0Y2hFbnRyeVtdID0gW107XG4gIGZvciAoY29uc3QgaSBpbiBhcGkuYWxsUmVzb3VyY2VzKCkpIHtcbiAgICBjb25zdCByZXNvdXJjZSA9ICBhcGkuYWxsUmVzb3VyY2VzKClbaV07XG4gICAgZm9yIChjb25zdCBqIGluIHJlc291cmNlLm1ldGhvZHMoKSkge1xuICAgICAgY29uc3QgbWV0aG9kID0gcmVzb3VyY2UubWV0aG9kcygpW2pdO1xuICAgICAgY29uc3QgcGF0dGVybiA9IG5ldyBSZXF1ZXN0UGF0dGVybihyZXNvdXJjZS5hYnNvbHV0ZVVyaSgpLCBtZXRob2QubWV0aG9kKCkpO1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBuZXcgUmVzcG9uc2UobmV3IFJlc3BvbnNlT3B0aW9ucyh7XG4gICAgICAgIHN0YXR1czogbmV3IE51bWJlcihtZXRob2QucmVzcG9uc2VzKClbMF0uY29kZSgpLnZhbHVlKCkpLnZhbHVlT2YoKSxcbiAgICAgICAgYm9keTogbG9va3VwRXhhbXBsZVJlc3BvbnNlQm9keShtZXRob2QucmVzcG9uc2VzKClbMF0uYm9keSgpWzBdKVxuICAgICAgfSkpO1xuICAgICAgZW50cmllcy5wdXNoKHtcbiAgICAgICAgcmVxdWVzdFBhdHRlcm46IHBhdHRlcm4sXG4gICAgICAgIHJlc3BvbnNlOiByZXNwb25zZVxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBlbnRyaWVzO1xufVxuXG5leHBvcnQgY2xhc3MgUmFtbEJhY2tlbmQgZXh0ZW5kcyBNb2NrQmFja2VuZCB7XG5cbiAgcHJpdmF0ZSBhcGk6IEFwaTtcblxuICBwcml2YXRlIG1hdGNoRW50cmllczogUmVxdWVzdE1hdGNoRW50cnlbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5jb25uZWN0aW9ucy5zdWJzY3JpYmUodGhpcy5oYW5kbGVDb25uZWN0aW9uLmJpbmQodGhpcykpO1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVDb25uZWN0aW9uKGNvbm46IE1vY2tDb25uZWN0aW9uKSB7XG4gICAgY29uc3QgcmVxdWVzdCA9IGNvbm4ucmVxdWVzdDtcbiAgICBjb25uLm1vY2tSZXNwb25kKHRoaXMuZmluZE1hdGNoaW5nUmVzcG9uc2UocmVxdWVzdCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBmaW5kTWF0Y2hpbmdSZXNwb25zZShyZXF1ZXN0OiBSZXF1ZXN0KTogUmVzcG9uc2Uge1xuICAgIGZvciAoY29uc3QgaSBpbiB0aGlzLm1hdGNoRW50cmllcykge1xuICAgICAgY29uc3QgZW50cnkgPSB0aGlzLm1hdGNoRW50cmllc1tpXTtcbiAgICAgIGlmIChlbnRyeS5yZXF1ZXN0UGF0dGVybi5tYXRjaGVzKHJlcXVlc3QpKSB7XG4gICAgICAgIHJldHVybiBlbnRyeS5yZXNwb25zZTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKFwibm8gbWF0Y2hpbmcgcmVxdWVzdCBwYXR0ZXJuIGZvdW5kXCIpO1xuICB9XG5cbiAgcHVibGljIGdldCBlbmRwb2ludHMoKTogc3RyaW5nW10ge1xuICAgIGNvbnN0IGVuZHBvaW50cyA9IFtdO1xuICAgIHRoaXMuYXBpLmFsbFJlc291cmNlcygpLmZvckVhY2goaSA9PiBlbmRwb2ludHMucHVzaChpLmFic29sdXRlVXJpKCkpKTtcbiAgICByZXR1cm4gZW5kcG9pbnRzO1xuICB9XG5cbiAgcHVibGljIGxvYWRSQU1MRnJvbVBhdGgocGF0aDogc3RyaW5nKTogUmFtbEJhY2tlbmQge1xuICAgIHRoaXMuYXBpID0gbG9hZEFwaVN5bmMocGF0aCk7XG4gICAgdGhpcy5tYXRjaEVudHJpZXMgPSBidWlsZFJlcXVlc3RQYXR0ZXJucyh0aGlzLmFwaSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBwdWJsaWMgbG9hZFJBTUwoY29udGVudDogc3RyaW5nKTogUmFtbEJhY2tlbmQge1xuICAgIHRoaXMuYXBpID0gcGFyc2VSQU1MU3luYyhjb250ZW50KSBhcyBBcGk7XG4gICAgdGhpcy5tYXRjaEVudHJpZXMgPSBidWlsZFJlcXVlc3RQYXR0ZXJucyh0aGlzLmFwaSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxufVxuIl19
