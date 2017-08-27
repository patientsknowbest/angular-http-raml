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
var js_yaml_1 = require("js-yaml");
function syncGet(path) {
    var request = new XMLHttpRequest();
    request.open('GET', path, false);
    request.send(null);
    if (request.status === 200) {
        return request.responseText;
    }
    else {
        throw Error(request.status + ": GET " + this.currentDocumentPath);
    }
}
var YAMLFileLoader = (function () {
    function YAMLFileLoader(pathToYAMLFile) {
        this.currentDocumentPath = pathToYAMLFile;
    }
    YAMLFileLoader.prototype.loadFile = function () {
        var api = js_yaml_1.safeLoad(syncGet(this.currentDocumentPath), {
            schema: js_yaml_1.Schema.create([new IncludeType(this.currentDocumentPath)])
        });
        return api;
    };
    return YAMLFileLoader;
}());
exports.YAMLFileLoader = YAMLFileLoader;
var IncludeType = (function (_super) {
    __extends(IncludeType, _super);
    function IncludeType(parentDocumentPath) {
        var _this = _super.call(this, "!include", {
            kind: "scalar",
            construct: function (pathToRAMLFile) {
                return js_yaml_1.safeLoad(syncGet(this.relPathToAbs(pathToRAMLFile)), {
                    schema: js_yaml_1.Schema.create([new IncludeType(pathToRAMLFile)])
                });
            },
            resolve: function (path) {
                return true;
            }
        }) || this;
        _this.parentDocumentPath = parentDocumentPath;
        return _this;
    }
    IncludeType.prototype.relPathToAbs = function (sRelPath) {
        var nUpLn, sDir = "", sPath = this.parentDocumentPath.replace(/[^\/]*$/, sRelPath.replace(/(\/|^)(?:\.?\/+)+/g, "$1"));
        for (var nEnd, nStart = 0; nEnd = sPath.indexOf("/../", nStart), nEnd > -1; nStart = nEnd + nUpLn) {
            nUpLn = /^\/(?:\.\.\/)*/.exec(sPath.slice(nEnd))[0].length;
            sDir = (sDir + sPath.substring(nStart, nEnd)).replace(new RegExp("(?:\\\/+[^\\\/]*){0," + ((nUpLn - 1) / 3) + "}$"), "/");
        }
        return sDir + sPath.substr(nStart);
    };
    return IncludeType;
}(js_yaml_1.Type));
exports.IncludeType = IncludeType;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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LENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQzVILENBQUM7UUFDRCxNQUFNLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDckMsQ0FBQztJQWVILGtCQUFDO0FBQUQsQ0F4QkEsQUF3QkMsQ0F4QmdDLGNBQUksR0F3QnBDO0FBeEJZLGtDQUFXIiwiZmlsZSI6IlJBTUxMb2FkZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge3NhZmVMb2FkLCBTY2hlbWEsIFR5cGV9IGZyb20gXCJqcy15YW1sXCI7XG5cbmZ1bmN0aW9uIHN5bmNHZXQocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgcmVxdWVzdC5vcGVuKCdHRVQnLCBwYXRoLCBmYWxzZSk7XG4gIHJlcXVlc3Quc2VuZChudWxsKTtcbiAgaWYgKHJlcXVlc3Quc3RhdHVzID09PSAyMDApIHtcbiAgICByZXR1cm4gcmVxdWVzdC5yZXNwb25zZVRleHQ7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgRXJyb3IocmVxdWVzdC5zdGF0dXMgKyBcIjogR0VUIFwiICsgdGhpcy5jdXJyZW50RG9jdW1lbnRQYXRoKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgWUFNTEZpbGVMb2FkZXIge1xuXG4gIHByaXZhdGUgY3VycmVudERvY3VtZW50UGF0aDtcblxuICBjb25zdHJ1Y3RvcihwYXRoVG9ZQU1MRmlsZTogc3RyaW5nKSB7XG4gICAgdGhpcy5jdXJyZW50RG9jdW1lbnRQYXRoID0gcGF0aFRvWUFNTEZpbGU7XG4gIH1cblxuICBwdWJsaWMgbG9hZEZpbGUoKTogYW55IHtcbiAgICBjb25zdCBhcGkgPSBzYWZlTG9hZChzeW5jR2V0KHRoaXMuY3VycmVudERvY3VtZW50UGF0aCksIHtcbiAgICAgIHNjaGVtYTogU2NoZW1hLmNyZWF0ZShbbmV3IEluY2x1ZGVUeXBlKHRoaXMuY3VycmVudERvY3VtZW50UGF0aCldKVxuICAgIH0pO1xuICAgIHJldHVybiBhcGk7XG4gIH1cblxufVxuXG5leHBvcnQgY2xhc3MgSW5jbHVkZVR5cGUgZXh0ZW5kcyBUeXBlIHtcblxuICBwcml2YXRlIHJlbFBhdGhUb0FicyhzUmVsUGF0aCkge1xuICAgIHZhciBuVXBMbiwgc0RpciA9IFwiXCIsIHNQYXRoID0gdGhpcy5wYXJlbnREb2N1bWVudFBhdGgucmVwbGFjZSgvW15cXC9dKiQvLCBzUmVsUGF0aC5yZXBsYWNlKC8oXFwvfF4pKD86XFwuP1xcLyspKy9nLCBcIiQxXCIpKTtcbiAgICBmb3IgKHZhciBuRW5kLCBuU3RhcnQgPSAwOyBuRW5kID0gc1BhdGguaW5kZXhPZihcIi8uLi9cIiwgblN0YXJ0KSwgbkVuZCA+IC0xOyBuU3RhcnQgPSBuRW5kICsgblVwTG4pIHtcbiAgICAgIG5VcExuID0gL15cXC8oPzpcXC5cXC5cXC8pKi8uZXhlYyhzUGF0aC5zbGljZShuRW5kKSlbMF0ubGVuZ3RoO1xuICAgICAgc0RpciA9IChzRGlyICsgc1BhdGguc3Vic3RyaW5nKG5TdGFydCwgbkVuZCkpLnJlcGxhY2UobmV3IFJlZ0V4cChcIig/OlxcXFxcXC8rW15cXFxcXFwvXSopezAsXCIgKyAoKG5VcExuIC0gMSkgLyAzKSArIFwifSRcIiksIFwiL1wiKTtcbiAgICB9XG4gICAgcmV0dXJuIHNEaXIgKyBzUGF0aC5zdWJzdHIoblN0YXJ0KTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcGFyZW50RG9jdW1lbnRQYXRoKSB7XG4gICAgc3VwZXIoXCIhaW5jbHVkZVwiLCB7XG4gICAgICBraW5kOiBcInNjYWxhclwiLFxuICAgICAgY29uc3RydWN0OiBmdW5jdGlvbiAocGF0aFRvUkFNTEZpbGUpIHtcbiAgICAgICAgcmV0dXJuIHNhZmVMb2FkKHN5bmNHZXQodGhpcy5yZWxQYXRoVG9BYnMocGF0aFRvUkFNTEZpbGUpKSwge1xuICAgICAgICAgIHNjaGVtYTogU2NoZW1hLmNyZWF0ZShbbmV3IEluY2x1ZGVUeXBlKHBhdGhUb1JBTUxGaWxlKV0pXG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICAgIHJlc29sdmU6IGZ1bmN0aW9uIChwYXRoOiBzdHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==
