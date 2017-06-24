"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var testing_1 = require("@angular/http/testing");
var RamlBackend = (function (_super) {
    __extends(RamlBackend, _super);
    function RamlBackend() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return RamlBackend;
}(testing_1.MockBackend));
exports.RamlBackend = RamlBackend;
//# sourceMappingURL=RamlBackend.js.map