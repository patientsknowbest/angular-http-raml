"use strict";
var RAMLBackend_1 = require("./RAMLBackend");
var http_1 = require("@angular/http");
var RAMLBackendConfig_1 = require("./RAMLBackendConfig");
function absUri(path) {
    return "http://dummy-endpoint" + path;
}
function ok() {
    return new http_1.Response(new http_1.ResponseOptions({
        status: 200,
        body: ""
    }));
}
function createSubject(path) {
    if (path === void 0) { path = "./base/testdata/test-endpoints.raml"; }
    return RAMLBackendConfig_1.RAMLBackendConfig.initWithFile(path)
        .stubAll()
        .createBackend();
}
describe("RAMLBackend", function () {
    it("returns 200 with example for found endpoints", function () {
        var subject = createSubject(), http = new http_1.Http(subject, new http_1.RequestOptions());
        http.get(absUri("/auth/token"))
            .subscribe(function (resp) {
            expect(resp.json()).toEqual({ name: "John Snow" });
        });
        subject.verifyNoPendingRequests();
    });
    it("takes method into account when looking for response", function () {
        var subject = createSubject(), http = new http_1.Http(subject, new http_1.RequestOptions());
        http.post(absUri("/auth/token"), {}).subscribe(function (resp) {
            expect(resp.status).toEqual(201);
            expect(resp.json()).toEqual({ message: "created" });
        });
        subject.verifyNoPendingRequests();
    });
    it("uses the 0th example if there are more than one", function () {
        var subject = createSubject(), http = new http_1.Http(subject, new http_1.RequestOptions());
        http.get(absUri("/create/whatever")).subscribe(function (resp) {
            expect(resp.status).toEqual(200);
            expect(resp.json()).toEqual({ name: "Alice" });
        });
        subject.verifyNoPendingRequests();
    });
    it("matches path parameters", function () {
        var subject = createSubject(), http = new http_1.Http(subject, new http_1.RequestOptions());
        http.get(absUri("/person/123/456")).subscribe(function (resp) {
            expect(resp.status).toEqual(200);
        });
        subject.verifyNoPendingRequests();
    });
    it("checks invalid query parameters", function () {
        var subject = createSubject(), http = new http_1.Http(subject, new http_1.RequestOptions());
        http.get(absUri("/queryparams?foo=bar&hello=world&invalid=asd"))
            .subscribe(function (resp) {
            expect(resp.status).toEqual(401);
            expect(resp.json().message).toEqual("undeclared query parameter [invalid] found in request");
        });
        subject.verifyNoPendingRequests();
    });
    xit("checks headers", function () {
        var subject = createSubject(), http = new http_1.Http(subject, new http_1.RequestOptions());
        http.get("").subscribe(function (resp) {
        });
        subject.verifyNoPendingRequests();
    });
    xit("checks the type of path params", function () {
    });
    xit("no example, no examples", function () {
    });
});
describe("URIPattern", function () {
    function createSubject(path) {
        return new RAMLBackend_1.URIPattern(absUri(path));
    }
    it("returns empty result on matching parameterless URI", function () {
        expect(createSubject("/person").matches(absUri("/person"))).toEqual({});
    });
    it("returns param map for match", function () {
        var actual = createSubject("/person/{personId}/{otherParam}/dummy/{thirdParam}").matches(absUri("/person/123/foo/dummy/bar"));
        expect(actual).toEqual({ personId: "123", otherParam: "foo", thirdParam: "bar" });
    });
});
describe("explicit stubs", function () {
    function initStubConfig() {
        return RAMLBackendConfig_1.RAMLBackendConfig.initWithFile("./base/testdata/stub-base.raml").stubAll();
    }
    it("overrides 'example' responses", function () {
        var subject = initStubConfig()
            .whenGET("/endpoint").thenRespond(new http_1.Response(new http_1.ResponseOptions({
            status: 200,
            body: JSON.stringify({ access_token: 456 })
        })))
            .createBackend();
        var http = new http_1.Http(subject, new http_1.RequestOptions());
        http.get(absUri("/endpoint")).subscribe(function (resp) {
            expect(resp.json()).toEqual({ access_token: 456 });
        });
    });
    it("refuses invalid paths", function () {
        try {
            initStubConfig().whenGET("/nonexistent");
            fail("did not refuse nonexistent endpoint");
        }
        catch (e) {
            expect(e).toEqual(new RAMLBackendConfig_1.InvalidStubbingError("found no declaration of request [GET /nonexistent] in RAML - refusing to stub"));
        }
    });
    it("refuses invalid methods", function () {
        try {
            initStubConfig().whenHEAD("/endpoint");
            fail("did not refuse undefined HEAD method");
        }
        catch (e) {
            expect(e).toEqual(new RAMLBackendConfig_1.InvalidStubbingError("found no declaration of request [HEAD /endpoint] in RAML - refusing to stub"));
        }
    });
    it("refuses invalid query params", function () {
        try {
            var subject = initStubConfig()
                .whenGET("/endpoint?qp0=val&foo=bar").thenRespond(new http_1.Response(new http_1.ResponseOptions({
                status: 200,
                body: JSON.stringify({ access_token: 456 })
            })))
                .createBackend();
            fail("did not fail for invalid query parameter");
        }
        catch (e) {
            expect(e).toEqual(new RAMLBackendConfig_1.InvalidStubbingError("undeclared query parameter [foo] found in request"));
        }
    });
    xit("refuses invalid response bodies", function () {
        try {
            var subject = initStubConfig().whenGET("/endpoint")
                .thenRespond(new http_1.Response(new http_1.ResponseOptions({
                status: 200,
                body: JSON.stringify({ invalidKey: 123 })
            })));
            fail("did not throw exception for invalid response body");
        }
        catch (e) {
            expect(e).toEqual(new RAMLBackendConfig_1.InvalidStubbingError("invalid stub response body"));
        }
    });
    it("fails if there is pending behavior (unset response)", function () {
        try {
            var subject = initStubConfig();
            subject.whenGET("/endpoint");
            subject.whenPOST("/endpoint");
            fail("did not throw exception for unfinished behavior");
        }
        catch (e) {
            expect(e).toEqual(new RAMLBackendConfig_1.InvalidStubbingError("unfinished behavior definition: cannot configure POST http://dummy-endpoint/endpoint " +
                "before setting the response for GET http://dummy-endpoint/endpoint"));
        }
    });
    it("can chain multiple stubbing", function () {
        initStubConfig().whenGET("/endpoint").thenRespond(new http_1.Response(new http_1.ResponseOptions({
            status: 200, body: ""
        }))).whenPOST("/endpoint").thenRespond(new http_1.Response(new http_1.ResponseOptions({ status: 201, body: "Created" })));
    });
    it("can stub POST requests", function () {
        var subject = initStubConfig().whenPOST("/endpoint").thenRespond(ok()).createBackend();
        var http = new http_1.Http(subject, new http_1.RequestOptions());
        http.post("/endpoint", {}).subscribe(function (resp) {
            expect(resp.ok).toBe(true);
        });
        subject.verifyNoPendingRequests();
    });
    it("can stub PUT requests", function () {
        var subject = initStubConfig().whenPUT("/endpoint").thenRespond(ok()).createBackend();
        var http = new http_1.Http(subject, new http_1.RequestOptions());
        http.put("/endpoint", {}).subscribe(function (resp) {
            expect(resp.ok).toBe(true);
        });
        subject.verifyNoPendingRequests();
    });
    it("can stub DELETE requests", function () {
        var subject = initStubConfig().whenDELETE("/endpoint").thenRespond(ok()).createBackend();
        var http = new http_1.Http(subject, new http_1.RequestOptions());
        http.delete("/endpoint").subscribe(function (resp) {
            expect(resp.ok).toBe(true);
        });
        subject.verifyNoPendingRequests();
    });
    it("can stub PATCH requests", function () {
        var subject = initStubConfig().whenPATCH("/endpoint").thenRespond(ok()).createBackend();
        var http = new http_1.Http(subject, new http_1.RequestOptions());
        http.patch("/endpoint", {}).subscribe(function (resp) {
            expect(resp.ok).toBe(true);
        });
        subject.verifyNoPendingRequests();
    });
    it("can stub OPTIONS requests", function () {
        var subject = initStubConfig().whenOPTIONS("/endpoint").thenRespond(ok()).createBackend();
        var http = new http_1.Http(subject, new http_1.RequestOptions());
        http.options("/endpoint", {}).subscribe(function (resp) {
            expect(resp.ok).toBe(true);
        });
        subject.verifyNoPendingRequests();
    });
    it("can stub entire requests", function () {
        var request = new http_1.Request({
            method: "post",
            url: absUri("/endpoint"),
            body: { foo: "bar" }
        });
        var response = new http_1.Response(new http_1.ResponseOptions({
            status: 201,
            body: JSON.stringify({ message: "created" })
        }));
        var subject = initStubConfig().whenRequestIs(request).thenRespond(response).createBackend();
        var http = new http_1.Http(subject, new http_1.RequestOptions());
        http.post(absUri("/endpoint"), { foo: "bar" }).subscribe(function (resp) {
            expect(resp).toEqual(response);
        });
        subject.verifyNoPendingRequests();
    });
});
describe("response selection", function () {
    it("returns the lowest 2xx response by default", function () {
        var subject = RAMLBackendConfig_1.RAMLBackendConfig.initWithFile("./base/testdata/status-codes.raml")
            .stubAll()
            .createBackend();
        var http = new http_1.Http(subject, new http_1.RequestOptions());
        http.get(absUri("/endpoint")).subscribe(function (resp) {
            expect(resp.status).toBe(200);
        });
    });
    it("can stub response by only status code", function () {
        var subject = RAMLBackendConfig_1.RAMLBackendConfig.initWithFile("./base/testdata/status-codes.raml")
            .whenGET("/endpoint").thenRespondWith(500)
            .createBackend();
        var http = new http_1.Http(subject, new http_1.RequestOptions());
        http.get("/endpoint").subscribe(function (resp) {
            expect(resp.status).toBe(500);
            expect(resp.json()).toEqual({ message: "internal server error" });
        });
        subject.verifyNoPendingRequests();
    });
    it("can stub by only status code and example id", function () {
        var subject = RAMLBackendConfig_1.RAMLBackendConfig.initWithFile("./base/testdata/status-codes.raml")
            .whenGET("/endpoint").thenRespondWith(201, "withEntityId")
            .createBackend();
        var http = new http_1.Http(subject, new http_1.RequestOptions());
        http.get("/endpoint").subscribe(function (resp) {
            expect(resp.json()).toEqual({ message: "created", entityId: 42 });
        });
        subject.verifyNoPendingRequests();
    });
    it("throws exception if no examples are defined", function () {
        try {
            var subject = RAMLBackendConfig_1.RAMLBackendConfig.initWithFile("./base/testdata/status-codes.raml")
                .whenGET("/endpoint").thenRespondWith(200, "notFound");
            fail("did not throw exception");
        }
        catch (e) {
            expect(e).toEqual(new RAMLBackendConfig_1.InvalidStubbingError("could not find example [notFound]"));
        }
    });
    it("throws exception if no examples are defined", function () {
        try {
            var subject = RAMLBackendConfig_1.RAMLBackendConfig.initWithFile("./base/testdata/status-codes.raml")
                .whenGET("/endpoint").thenRespondWith(201, "notFound");
            fail();
        }
        catch (e) {
            expect(e).toEqual(new RAMLBackendConfig_1.InvalidStubbingError("could not find example [notFound]"));
        }
    });
    it("throws exception if no resp found with status code", function () {
        try {
            RAMLBackendConfig_1.RAMLBackendConfig.initWithFile("./base/testdata/status-codes.raml").whenGET("/endpoint").thenRespondWith(555);
            fail("did not throw exception for undefined response");
        }
        catch (e) {
            expect(e).toEqual(new RAMLBackendConfig_1.InvalidStubbingError("there is no response defined with status code 555 in the RAML file"));
        }
    });
});
describe("Body validation", function () {
    it("validates request bodies as per json schema", function () {
        var subject = createSubject("./base/testdata/endpoints-with-schemas.raml"), http = new http_1.Http(subject, new http_1.RequestOptions());
        var onSuccess = jasmine.createSpy("onSuccess");
        try {
            http.post(absUri("/thing"), { prop: "ab" }).subscribe(onSuccess);
            fail("did not throw exception for invalid request body");
        }
        catch (e) {
            expect(onSuccess).not.toHaveBeenCalled();
        }
    });
    it("can refer to schemas in fragment", function () {
        var subject = createSubject("./base/testdata/endpoints-with-schemas.raml"), http = new http_1.Http(subject, new http_1.RequestOptions());
        var onSuccess = jasmine.createSpy("onSuccess");
        try {
            http.post(absUri("/proptype"), { prop: "ab" }).subscribe(onSuccess);
            fail("did not throw exception for invalid request body");
        }
        catch (e) {
            expect(onSuccess).not.toHaveBeenCalled();
        }
    });
});
//# sourceMappingURL=RAMLBackend.spec.js.map