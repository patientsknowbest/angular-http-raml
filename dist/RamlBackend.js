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
var RamlBackend = (function (_super) {
    __extends(RamlBackend, _super);
    function RamlBackend() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    RamlBackend.prototype.doStuff = function () {
        var raml = raml10parser_1.loadRAMLSync("./github.raml", []);
        var api = raml10parser_1.loadApiSync("./github.raml");
        console.log(api.allResources()[0].absoluteUri());
    };
    return RamlBackend;
}(testing_1.MockBackend));
exports.RamlBackend = RamlBackend;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL1JhbWxCYWNrZW5kLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFrRDtBQUNsRCxnRkFBMEY7QUFFMUY7SUFBaUMsK0JBQVc7SUFBNUM7O0lBUUEsQ0FBQztJQU5RLDZCQUFPLEdBQWQ7UUFDRSxJQUFNLElBQUksR0FBRywyQkFBWSxDQUFDLGVBQWUsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMvQyxJQUFNLEdBQUcsR0FBRywwQkFBVyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3pDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7SUFDbkQsQ0FBQztJQUVILGtCQUFDO0FBQUQsQ0FSQSxBQVFDLENBUmdDLHFCQUFXLEdBUTNDO0FBUlksa0NBQVciLCJmaWxlIjoiUmFtbEJhY2tlbmQuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge01vY2tCYWNrZW5kfSBmcm9tIFwiQGFuZ3VsYXIvaHR0cC90ZXN0aW5nXCI7XG5pbXBvcnQge2xvYWRBcGlTeW5jLCBsb2FkUkFNTFN5bmN9IGZyb20gXCJyYW1sLTEtcGFyc2VyL2Rpc3QvcmFtbDEvYXJ0aWZhY3RzL3JhbWwxMHBhcnNlclwiO1xuXG5leHBvcnQgY2xhc3MgUmFtbEJhY2tlbmQgZXh0ZW5kcyBNb2NrQmFja2VuZCB7XG5cbiAgcHVibGljIGRvU3R1ZmYoKSB7XG4gICAgY29uc3QgcmFtbCA9IGxvYWRSQU1MU3luYyhcIi4vZ2l0aHViLnJhbWxcIiwgW10pO1xuICAgIGNvbnN0IGFwaSA9IGxvYWRBcGlTeW5jKFwiLi9naXRodWIucmFtbFwiKTtcbiAgICBjb25zb2xlLmxvZyhhcGkuYWxsUmVzb3VyY2VzKClbMF0uYWJzb2x1dGVVcmkoKSk7XG4gIH1cblxufVxuIl19
