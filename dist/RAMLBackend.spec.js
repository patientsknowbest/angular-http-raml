"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
    xit("no example, no examples", function () {
    });
    xit("checks the type of path params", function () {
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
        var explicitAccessToken = "ACCT456";
        var subject = initStubConfig()
            .whenGET("/endpoint").thenRespond(new http_1.Response(new http_1.ResponseOptions({
            status: 200,
            body: JSON.stringify({ access_token: "ACCT456" })
        })))
            .createBackend();
        var http = new http_1.Http(subject, new http_1.RequestOptions());
        http.get(absUri("/endpoint")).subscribe(function (resp) {
            expect(resp.json()).toEqual({ access_token: explicitAccessToken });
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
    it("refuses invalid response bodies", function () {
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
    it("also validates non-object response bodies", function () {
        try {
            initStubConfig().whenPOST("/endpoint").thenRespond(new http_1.Response(new http_1.ResponseOptions({
                status: 201,
                body: "gg wp"
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
            status: 200, body: "{\"access_token\":\"xxx\"}"
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
            body: "created"
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
describe("regressions", function () {
    fit("loads simple authentication raml", function () {
        var subject = RAMLBackendConfig_1.RAMLBackendConfig.initWithFile("/base/testdata/authentication.raml")
            .stubAll()
            .createBackend();
        var http = new http_1.Http(subject, new http_1.RequestOptions());
        http.get("http://dummy-cc-backend/auth/token?code=123").subscribe(function (e) { });
    });
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QW9DLENBQUM7YUFDakYsT0FBTyxFQUFFO2FBQ1QsYUFBYSxFQUFFLENBQUM7UUFDbkIsSUFBTSxJQUFJLEdBQUcsSUFBSSxXQUFJLENBQUMsT0FBTyxFQUFFLElBQUkscUJBQWMsRUFBRSxDQUFDLENBQUM7UUFFckQsSUFBSSxDQUFDLEdBQUcsQ0FBQyw2Q0FBNkMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxVQUFBLENBQUMsSUFBSyxDQUFDLENBQUMsQ0FBQztJQUU3RSxDQUFDLENBQUMsQ0FBQztBQUVMLENBQUMsQ0FBQyxDQUFBIiwiZmlsZSI6IlJBTUxCYWNrZW5kLnNwZWMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1JBTUxCYWNrZW5kLCBVUklQYXR0ZXJufSBmcm9tIFwiLi9SQU1MQmFja2VuZFwiO1xuaW1wb3J0IHtIdHRwLCBSZXF1ZXN0LCBSZXF1ZXN0T3B0aW9ucywgUmVzcG9uc2UsIFJlc3BvbnNlT3B0aW9uc30gZnJvbSBcIkBhbmd1bGFyL2h0dHBcIjtcbmltcG9ydCB7SW52YWxpZFN0dWJiaW5nRXJyb3IsIFJBTUxCYWNrZW5kQ29uZmlnfSBmcm9tIFwiLi9SQU1MQmFja2VuZENvbmZpZ1wiO1xuXG5cblxuZnVuY3Rpb24gYWJzVXJpKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBcImh0dHA6Ly9kdW1teS1lbmRwb2ludFwiICsgcGF0aDtcbn1cblxuZnVuY3Rpb24gb2soKSB7XG4gIHJldHVybiBuZXcgUmVzcG9uc2UobmV3IFJlc3BvbnNlT3B0aW9ucyh7XG4gICAgc3RhdHVzOiAyMDAsXG4gICAgYm9keTogXCJcIlxuICB9KSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVN1YmplY3QocGF0aDogc3RyaW5nID0gXCIuL2Jhc2UvdGVzdGRhdGEvdGVzdC1lbmRwb2ludHMucmFtbFwiKTogUkFNTEJhY2tlbmQge1xuICByZXR1cm4gUkFNTEJhY2tlbmRDb25maWcuaW5pdFdpdGhGaWxlKHBhdGgpXG4gICAgLnN0dWJBbGwoKVxuICAgIC5jcmVhdGVCYWNrZW5kKCk7XG59XG5cbmRlc2NyaWJlKFwiUkFNTEJhY2tlbmRcIiwgKCkgPT4ge1xuXG4gIGl0KFwicmV0dXJucyAyMDAgd2l0aCBleGFtcGxlIGZvciBmb3VuZCBlbmRwb2ludHNcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHN1YmplY3QgPSBjcmVhdGVTdWJqZWN0KCksIGh0dHAgPSBuZXcgSHR0cChzdWJqZWN0LCBuZXcgUmVxdWVzdE9wdGlvbnMoKSk7XG5cbiAgICBodHRwLmdldChhYnNVcmkoXCIvYXV0aC90b2tlblwiKSlcbiAgICAgIC5zdWJzY3JpYmUocmVzcCA9PiB7XG4gICAgICAgIGV4cGVjdChyZXNwLmpzb24oKSkudG9FcXVhbCh7bmFtZTogXCJKb2huIFNub3dcIn0pO1xuICAgICAgfSk7XG5cbiAgICBzdWJqZWN0LnZlcmlmeU5vUGVuZGluZ1JlcXVlc3RzKCk7XG4gIH0pO1xuXG4gIGl0KFwidGFrZXMgbWV0aG9kIGludG8gYWNjb3VudCB3aGVuIGxvb2tpbmcgZm9yIHJlc3BvbnNlXCIsICgpID0+IHtcbiAgICBjb25zdCBzdWJqZWN0ID0gY3JlYXRlU3ViamVjdCgpLCBodHRwID0gbmV3IEh0dHAoc3ViamVjdCwgbmV3IFJlcXVlc3RPcHRpb25zKCkpO1xuXG4gICAgaHR0cC5wb3N0KGFic1VyaShcIi9hdXRoL3Rva2VuXCIpLCB7fSkuc3Vic2NyaWJlKHJlc3AgPT4ge1xuICAgICAgZXhwZWN0KHJlc3Auc3RhdHVzKS50b0VxdWFsKDIwMSk7XG4gICAgICBleHBlY3QocmVzcC5qc29uKCkpLnRvRXF1YWwoe21lc3NhZ2U6IFwiY3JlYXRlZFwifSk7XG4gICAgfSk7XG5cbiAgICBzdWJqZWN0LnZlcmlmeU5vUGVuZGluZ1JlcXVlc3RzKCk7XG4gIH0pO1xuXG4gIGl0KFwibWF0Y2hlcyBwYXRoIHBhcmFtZXRlcnNcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHN1YmplY3QgPSBjcmVhdGVTdWJqZWN0KCksIGh0dHAgPSBuZXcgSHR0cChzdWJqZWN0LCBuZXcgUmVxdWVzdE9wdGlvbnMoKSk7XG5cbiAgICBodHRwLmdldChhYnNVcmkoXCIvcGVyc29uLzEyMy80NTZcIikpLnN1YnNjcmliZShyZXNwID0+IHtcbiAgICAgIGV4cGVjdChyZXNwLnN0YXR1cykudG9FcXVhbCgyMDApO1xuICAgIH0pO1xuXG4gICAgc3ViamVjdC52ZXJpZnlOb1BlbmRpbmdSZXF1ZXN0cygpO1xuICB9KTtcblxuICBpdChcImNoZWNrcyBpbnZhbGlkIHF1ZXJ5IHBhcmFtZXRlcnNcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHN1YmplY3QgPSBjcmVhdGVTdWJqZWN0KCksIGh0dHAgPSBuZXcgSHR0cChzdWJqZWN0LCBuZXcgUmVxdWVzdE9wdGlvbnMoKSk7XG5cbiAgICBodHRwLmdldChhYnNVcmkoXCIvcXVlcnlwYXJhbXM/Zm9vPWJhciZoZWxsbz13b3JsZCZpbnZhbGlkPWFzZFwiKSlcbiAgICAgIC5zdWJzY3JpYmUocmVzcCA9PiB7XG4gICAgICAgIGV4cGVjdChyZXNwLnN0YXR1cykudG9FcXVhbCg0MDEpO1xuICAgICAgICBleHBlY3QocmVzcC5qc29uKCkubWVzc2FnZSkudG9FcXVhbChcInVuZGVjbGFyZWQgcXVlcnkgcGFyYW1ldGVyIFtpbnZhbGlkXSBmb3VuZCBpbiByZXF1ZXN0XCIpO1xuICAgICAgfSk7XG5cbiAgICBzdWJqZWN0LnZlcmlmeU5vUGVuZGluZ1JlcXVlc3RzKCk7XG4gIH0pO1xuXG4gIHhpdChcImNoZWNrcyBoZWFkZXJzXCIgLCAoKSA9PiB7XG4gICAgY29uc3Qgc3ViamVjdCA9IGNyZWF0ZVN1YmplY3QoKSwgaHR0cCA9IG5ldyBIdHRwKHN1YmplY3QsIG5ldyBSZXF1ZXN0T3B0aW9ucygpKTtcblxuICAgIGh0dHAuZ2V0KFwiXCIpLnN1YnNjcmliZShyZXNwID0+IHtcblxuICAgIH0pO1xuXG4gICAgc3ViamVjdC52ZXJpZnlOb1BlbmRpbmdSZXF1ZXN0cygpO1xuICB9KTtcblxuXG4gIHhpdChcIm5vIGV4YW1wbGUsIG5vIGV4YW1wbGVzXCIsICgpID0+IHtcblxuICB9KTtcbiAgeGl0KFwiY2hlY2tzIHRoZSB0eXBlIG9mIHBhdGggcGFyYW1zXCIsICgpID0+IHtcblxuICB9KTtcblxufSk7XG5cbmRlc2NyaWJlKFwiVVJJUGF0dGVyblwiLCAoKSA9PiB7XG5cblxuICBmdW5jdGlvbiBjcmVhdGVTdWJqZWN0KHBhdGg6IHN0cmluZyk6IFVSSVBhdHRlcm4ge1xuICAgIHJldHVybiBuZXcgVVJJUGF0dGVybihhYnNVcmkocGF0aCkpO1xuICB9XG5cbiAgaXQoXCJyZXR1cm5zIGVtcHR5IHJlc3VsdCBvbiBtYXRjaGluZyBwYXJhbWV0ZXJsZXNzIFVSSVwiLCAoKSA9PiB7XG4gICAgZXhwZWN0KGNyZWF0ZVN1YmplY3QoXCIvcGVyc29uXCIpLm1hdGNoZXMoYWJzVXJpKFwiL3BlcnNvblwiKSkpLnRvRXF1YWwoe30pO1xuICB9KTtcblxuICBpdChcInJldHVybnMgcGFyYW0gbWFwIGZvciBtYXRjaFwiLCAoKSA9PiB7XG4gICAgY29uc3QgYWN0dWFsID0gY3JlYXRlU3ViamVjdChcIi9wZXJzb24ve3BlcnNvbklkfS97b3RoZXJQYXJhbX0vZHVtbXkve3RoaXJkUGFyYW19XCIpLm1hdGNoZXMoYWJzVXJpKFwiL3BlcnNvbi8xMjMvZm9vL2R1bW15L2JhclwiKSk7XG4gICAgZXhwZWN0KGFjdHVhbCkudG9FcXVhbCh7cGVyc29uSWQ6IFwiMTIzXCIsIG90aGVyUGFyYW06IFwiZm9vXCIsIHRoaXJkUGFyYW06IFwiYmFyXCJ9KTtcbiAgfSk7XG5cbn0pO1xuXG5kZXNjcmliZShcImV4cGxpY2l0IHN0dWJzXCIsICgpID0+IHtcblxuICBmdW5jdGlvbiBpbml0U3R1YkNvbmZpZygpIHtcbiAgICByZXR1cm4gUkFNTEJhY2tlbmRDb25maWcuaW5pdFdpdGhGaWxlKFwiLi9iYXNlL3Rlc3RkYXRhL3N0dWItYmFzZS5yYW1sXCIpLnN0dWJBbGwoKTtcbiAgfVxuXG4gIGl0KFwib3ZlcnJpZGVzICdleGFtcGxlJyByZXNwb25zZXNcIiwgKCkgID0+IHtcbiAgICBjb25zdCBleHBsaWNpdEFjY2Vzc1Rva2VuID0gXCJBQ0NUNDU2XCI7XG4gICAgY29uc3Qgc3ViamVjdCA9IGluaXRTdHViQ29uZmlnKClcbiAgICAgIC53aGVuR0VUKFwiL2VuZHBvaW50XCIpLnRoZW5SZXNwb25kKG5ldyBSZXNwb25zZShuZXcgUmVzcG9uc2VPcHRpb25zKHtcbiAgICAgICAgc3RhdHVzOiAyMDAsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHthY2Nlc3NfdG9rZW46IFwiQUNDVDQ1NlwifSlcbiAgICAgIH0pKSlcbiAgICAgIC5jcmVhdGVCYWNrZW5kKCk7XG5cbiAgICAgY29uc3QgaHR0cCA9IG5ldyBIdHRwKHN1YmplY3QsIG5ldyBSZXF1ZXN0T3B0aW9ucygpKTtcbiAgICBodHRwLmdldChhYnNVcmkoXCIvZW5kcG9pbnRcIikpLnN1YnNjcmliZShyZXNwID0+IHtcbiAgICAgICBleHBlY3QocmVzcC5qc29uKCkpLnRvRXF1YWwoe2FjY2Vzc190b2tlbjogZXhwbGljaXRBY2Nlc3NUb2tlbn0pO1xuICAgfSlcblxuICB9KTtcblxuICBpdChcInJlZnVzZXMgaW52YWxpZCBwYXRoc1wiLCAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGluaXRTdHViQ29uZmlnKCkud2hlbkdFVChcIi9ub25leGlzdGVudFwiKTtcbiAgICAgIGZhaWwoXCJkaWQgbm90IHJlZnVzZSBub25leGlzdGVudCBlbmRwb2ludFwiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBleHBlY3QoZSkudG9FcXVhbChuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJmb3VuZCBubyBkZWNsYXJhdGlvbiBvZiByZXF1ZXN0IFtHRVQgL25vbmV4aXN0ZW50XSBpbiBSQU1MIC0gcmVmdXNpbmcgdG8gc3R1YlwiKSlcbiAgICB9XG4gIH0pO1xuXG4gIGl0KFwicmVmdXNlcyBpbnZhbGlkIG1ldGhvZHNcIiwgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBpbml0U3R1YkNvbmZpZygpLndoZW5IRUFEKFwiL2VuZHBvaW50XCIpO1xuICAgICAgZmFpbChcImRpZCBub3QgcmVmdXNlIHVuZGVmaW5lZCBIRUFEIG1ldGhvZFwiKVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGV4cGVjdChlKS50b0VxdWFsKG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcImZvdW5kIG5vIGRlY2xhcmF0aW9uIG9mIHJlcXVlc3QgW0hFQUQgL2VuZHBvaW50XSBpbiBSQU1MIC0gcmVmdXNpbmcgdG8gc3R1YlwiKSlcbiAgICB9XG4gIH0pO1xuXG4gIGl0KFwicmVmdXNlcyBpbnZhbGlkIHF1ZXJ5IHBhcmFtc1wiLCAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHN1YmplY3QgPSBpbml0U3R1YkNvbmZpZygpXG4gICAgICAgIC53aGVuR0VUKFwiL2VuZHBvaW50P3FwMD12YWwmZm9vPWJhclwiKS50aGVuUmVzcG9uZChuZXcgUmVzcG9uc2UobmV3IFJlc3BvbnNlT3B0aW9ucyh7XG4gICAgICAgICAgc3RhdHVzOiAyMDAsXG4gICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe2FjY2Vzc190b2tlbjogNDU2fSlcbiAgICAgICAgfSkpKVxuICAgICAgICAuY3JlYXRlQmFja2VuZCgpO1xuICAgICAgZmFpbChcImRpZCBub3QgZmFpbCBmb3IgaW52YWxpZCBxdWVyeSBwYXJhbWV0ZXJcIilcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBleHBlY3QoZSkudG9FcXVhbChuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJ1bmRlY2xhcmVkIHF1ZXJ5IHBhcmFtZXRlciBbZm9vXSBmb3VuZCBpbiByZXF1ZXN0XCIpKTtcbiAgICB9XG4gIH0pO1xuXG4gIGl0KFwicmVmdXNlcyBpbnZhbGlkIHJlc3BvbnNlIGJvZGllc1wiLCAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHN1YmplY3QgPSBpbml0U3R1YkNvbmZpZygpLndoZW5HRVQoXCIvZW5kcG9pbnRcIilcbiAgICAgICAgLnRoZW5SZXNwb25kKG5ldyBSZXNwb25zZShuZXcgUmVzcG9uc2VPcHRpb25zKHtcbiAgICAgICAgICBzdGF0dXM6IDIwMCxcbiAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7aW52YWxpZEtleTogMTIzfSlcbiAgICAgICAgfSkpKTtcbiAgICAgIGZhaWwoXCJkaWQgbm90IHRocm93IGV4Y2VwdGlvbiBmb3IgaW52YWxpZCByZXNwb25zZSBib2R5XCIpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGV4cGVjdChlKS50b0VxdWFsKG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcImludmFsaWQgc3R1YiByZXNwb25zZSBib2R5XCIpKTtcbiAgICB9XG4gIH0pO1xuXG4gIGl0KFwiYWxzbyB2YWxpZGF0ZXMgbm9uLW9iamVjdCByZXNwb25zZSBib2RpZXNcIiwgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBpbml0U3R1YkNvbmZpZygpLndoZW5QT1NUKFwiL2VuZHBvaW50XCIpLnRoZW5SZXNwb25kKG5ldyBSZXNwb25zZShuZXcgUmVzcG9uc2VPcHRpb25zKHtcbiAgICAgICAgc3RhdHVzOiAyMDEsXG4gICAgICAgIGJvZHk6IFwiZ2cgd3BcIlxuICAgICAgfSkpKTtcbiAgICAgIGZhaWwoXCJkaWQgbm90IHRocm93IGV4Y2VwdGlvbiBmb3IgaW52YWxpZCByZXNwb25zZSBib2R5XCIpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGV4cGVjdChlKS50b0VxdWFsKG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcImludmFsaWQgc3R1YiByZXNwb25zZSBib2R5XCIpKTtcbiAgICB9XG4gIH0pO1xuXG4gIGl0KFwiZmFpbHMgaWYgdGhlcmUgaXMgcGVuZGluZyBiZWhhdmlvciAodW5zZXQgcmVzcG9uc2UpXCIsICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc3ViamVjdCA9IGluaXRTdHViQ29uZmlnKCk7XG4gICAgICBzdWJqZWN0LndoZW5HRVQoXCIvZW5kcG9pbnRcIik7XG4gICAgICBzdWJqZWN0LndoZW5QT1NUKFwiL2VuZHBvaW50XCIpO1xuICAgICAgZmFpbChcImRpZCBub3QgdGhyb3cgZXhjZXB0aW9uIGZvciB1bmZpbmlzaGVkIGJlaGF2aW9yXCIpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGV4cGVjdChlKS50b0VxdWFsKG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcInVuZmluaXNoZWQgYmVoYXZpb3IgZGVmaW5pdGlvbjogY2Fubm90IGNvbmZpZ3VyZSBQT1NUIGh0dHA6Ly9kdW1teS1lbmRwb2ludC9lbmRwb2ludCBcIiArXG4gICAgICAgIFwiYmVmb3JlIHNldHRpbmcgdGhlIHJlc3BvbnNlIGZvciBHRVQgaHR0cDovL2R1bW15LWVuZHBvaW50L2VuZHBvaW50XCIpKTtcbiAgICB9XG4gIH0pO1xuXG4gIGl0KFwiY2FuIGNoYWluIG11bHRpcGxlIHN0dWJiaW5nXCIsICgpID0+IHtcbiAgICBpbml0U3R1YkNvbmZpZygpLndoZW5HRVQoXCIvZW5kcG9pbnRcIikudGhlblJlc3BvbmQobmV3IFJlc3BvbnNlKG5ldyBSZXNwb25zZU9wdGlvbnMoe1xuICAgICAgc3RhdHVzOiAyMDAsIGJvZHk6IFwie1xcXCJhY2Nlc3NfdG9rZW5cXFwiOlxcXCJ4eHhcXFwifVwiXG4gICAgICB9KVxuICAgICkpLndoZW5QT1NUKFwiL2VuZHBvaW50XCIpLnRoZW5SZXNwb25kKG5ldyBSZXNwb25zZShuZXcgUmVzcG9uc2VPcHRpb25zKHtzdGF0dXM6IDIwMSwgYm9keTogXCJDcmVhdGVkXCJ9KSkpO1xuICB9KTtcblxuICBpdChcImNhbiBzdHViIFBPU1QgcmVxdWVzdHNcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHN1YmplY3QgPSBpbml0U3R1YkNvbmZpZygpLndoZW5QT1NUKFwiL2VuZHBvaW50XCIpLnRoZW5SZXNwb25kKG9rKCkpLmNyZWF0ZUJhY2tlbmQoKTtcbiAgICBjb25zdCBodHRwID0gbmV3IEh0dHAoc3ViamVjdCwgbmV3IFJlcXVlc3RPcHRpb25zKCkpO1xuXG4gICAgaHR0cC5wb3N0KFwiL2VuZHBvaW50XCIsIHt9KS5zdWJzY3JpYmUocmVzcCA9PiB7XG4gICAgICBleHBlY3QocmVzcC5vaykudG9CZSh0cnVlKTtcbiAgICB9KTtcblxuICAgIHN1YmplY3QudmVyaWZ5Tm9QZW5kaW5nUmVxdWVzdHMoKTtcbiAgfSk7XG5cbiAgaXQoXCJjYW4gc3R1YiBQVVQgcmVxdWVzdHNcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHN1YmplY3QgPSBpbml0U3R1YkNvbmZpZygpLndoZW5QVVQoXCIvZW5kcG9pbnRcIikudGhlblJlc3BvbmQob2soKSkuY3JlYXRlQmFja2VuZCgpO1xuICAgIGNvbnN0IGh0dHAgPSBuZXcgSHR0cChzdWJqZWN0LCBuZXcgUmVxdWVzdE9wdGlvbnMoKSk7XG5cbiAgICBodHRwLnB1dChcIi9lbmRwb2ludFwiLCB7fSkuc3Vic2NyaWJlKHJlc3AgPT4ge1xuICAgICAgZXhwZWN0KHJlc3Aub2spLnRvQmUodHJ1ZSk7XG4gICAgfSk7XG5cbiAgICBzdWJqZWN0LnZlcmlmeU5vUGVuZGluZ1JlcXVlc3RzKCk7XG4gIH0pO1xuXG4gIGl0KFwiY2FuIHN0dWIgREVMRVRFIHJlcXVlc3RzXCIsICgpID0+IHtcbiAgICBjb25zdCBzdWJqZWN0ID0gaW5pdFN0dWJDb25maWcoKS53aGVuREVMRVRFKFwiL2VuZHBvaW50XCIpLnRoZW5SZXNwb25kKG9rKCkpLmNyZWF0ZUJhY2tlbmQoKTtcbiAgICBjb25zdCBodHRwID0gbmV3IEh0dHAoc3ViamVjdCwgbmV3IFJlcXVlc3RPcHRpb25zKCkpO1xuXG4gICAgaHR0cC5kZWxldGUoXCIvZW5kcG9pbnRcIikuc3Vic2NyaWJlKHJlc3AgPT4ge1xuICAgICAgZXhwZWN0KHJlc3Aub2spLnRvQmUodHJ1ZSk7XG4gICAgfSk7XG5cbiAgICBzdWJqZWN0LnZlcmlmeU5vUGVuZGluZ1JlcXVlc3RzKCk7XG4gIH0pO1xuXG4gIGl0KFwiY2FuIHN0dWIgUEFUQ0ggcmVxdWVzdHNcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHN1YmplY3QgPSBpbml0U3R1YkNvbmZpZygpLndoZW5QQVRDSChcIi9lbmRwb2ludFwiKS50aGVuUmVzcG9uZChvaygpKS5jcmVhdGVCYWNrZW5kKCk7XG4gICAgY29uc3QgaHR0cCA9IG5ldyBIdHRwKHN1YmplY3QsIG5ldyBSZXF1ZXN0T3B0aW9ucygpKTtcblxuICAgIGh0dHAucGF0Y2goXCIvZW5kcG9pbnRcIiwge30pLnN1YnNjcmliZShyZXNwID0+IHtcbiAgICAgIGV4cGVjdChyZXNwLm9rKS50b0JlKHRydWUpO1xuICAgIH0pO1xuXG4gICAgc3ViamVjdC52ZXJpZnlOb1BlbmRpbmdSZXF1ZXN0cygpO1xuICB9KTtcblxuICBpdChcImNhbiBzdHViIE9QVElPTlMgcmVxdWVzdHNcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHN1YmplY3QgPSBpbml0U3R1YkNvbmZpZygpLndoZW5PUFRJT05TKFwiL2VuZHBvaW50XCIpLnRoZW5SZXNwb25kKG9rKCkpLmNyZWF0ZUJhY2tlbmQoKTtcbiAgICBjb25zdCBodHRwID0gbmV3IEh0dHAoc3ViamVjdCwgbmV3IFJlcXVlc3RPcHRpb25zKCkpO1xuXG4gICAgaHR0cC5vcHRpb25zKFwiL2VuZHBvaW50XCIsIHt9KS5zdWJzY3JpYmUocmVzcCA9PiB7XG4gICAgICBleHBlY3QocmVzcC5vaykudG9CZSh0cnVlKTtcbiAgICB9KTtcblxuICAgIHN1YmplY3QudmVyaWZ5Tm9QZW5kaW5nUmVxdWVzdHMoKTtcbiAgfSk7XG5cbiAgaXQoXCJjYW4gc3R1YiBlbnRpcmUgcmVxdWVzdHNcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHJlcXVlc3QgPSBuZXcgUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6IFwicG9zdFwiLFxuICAgICAgdXJsOiBhYnNVcmkoXCIvZW5kcG9pbnRcIiksXG4gICAgICBib2R5OiB7Zm9vOiBcImJhclwifVxuICAgIH0pO1xuICAgIGNvbnN0IHJlc3BvbnNlID0gbmV3IFJlc3BvbnNlKG5ldyBSZXNwb25zZU9wdGlvbnMoe1xuICAgICAgc3RhdHVzOiAyMDEsXG4gICAgICBib2R5OiBcImNyZWF0ZWRcIlxuICAgIH0pKTtcbiAgICBjb25zdCBzdWJqZWN0ID0gaW5pdFN0dWJDb25maWcoKS53aGVuUmVxdWVzdElzKHJlcXVlc3QpLnRoZW5SZXNwb25kKHJlc3BvbnNlKS5jcmVhdGVCYWNrZW5kKCk7XG4gICAgY29uc3QgaHR0cCA9IG5ldyBIdHRwKHN1YmplY3QsIG5ldyBSZXF1ZXN0T3B0aW9ucygpKTtcblxuICAgIGh0dHAucG9zdChhYnNVcmkoXCIvZW5kcG9pbnRcIiksIHtmb28gOlwiYmFyXCJ9KS5zdWJzY3JpYmUocmVzcCA9PiB7XG4gICAgICBleHBlY3QocmVzcCkudG9FcXVhbChyZXNwb25zZSk7XG4gICAgfSk7XG5cbiAgICBzdWJqZWN0LnZlcmlmeU5vUGVuZGluZ1JlcXVlc3RzKCk7XG4gIH0pO1xuXG59KTtcblxuZGVzY3JpYmUoXCJyZXNwb25zZSBzZWxlY3Rpb25cIiwgKCkgPT4ge1xuXG4gIGl0KFwicmV0dXJucyB0aGUgbG93ZXN0IDJ4eCByZXNwb25zZSBieSBkZWZhdWx0XCIsICgpID0+IHtcbiAgICBjb25zdCBzdWJqZWN0ID0gUkFNTEJhY2tlbmRDb25maWcuaW5pdFdpdGhGaWxlKFwiLi9iYXNlL3Rlc3RkYXRhL3N0YXR1cy1jb2Rlcy5yYW1sXCIpXG4gICAgICAuc3R1YkFsbCgpXG4gICAgICAuY3JlYXRlQmFja2VuZCgpO1xuICAgIGNvbnN0IGh0dHAgPSBuZXcgSHR0cChzdWJqZWN0LCBuZXcgUmVxdWVzdE9wdGlvbnMoKSk7XG5cbiAgICBodHRwLmdldChhYnNVcmkoXCIvZW5kcG9pbnRcIikpLnN1YnNjcmliZShyZXNwID0+IHtcbiAgICAgIGV4cGVjdChyZXNwLnN0YXR1cykudG9CZSgyMDApO1xuICAgIH0pO1xuICB9KTtcblxuICBpdChcImNhbiBzdHViIHJlc3BvbnNlIGJ5IG9ubHkgc3RhdHVzIGNvZGVcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHN1YmplY3QgPSBSQU1MQmFja2VuZENvbmZpZy5pbml0V2l0aEZpbGUoXCIuL2Jhc2UvdGVzdGRhdGEvc3RhdHVzLWNvZGVzLnJhbWxcIilcbiAgICAgIC53aGVuR0VUKFwiL2VuZHBvaW50XCIpLnRoZW5SZXNwb25kV2l0aCg1MDApXG4gICAgICAuY3JlYXRlQmFja2VuZCgpO1xuICAgIGNvbnN0IGh0dHAgPSBuZXcgSHR0cChzdWJqZWN0LCBuZXcgUmVxdWVzdE9wdGlvbnMoKSk7XG5cbiAgICBodHRwLmdldChcIi9lbmRwb2ludFwiKS5zdWJzY3JpYmUocmVzcCA9PiB7XG4gICAgICBleHBlY3QocmVzcC5zdGF0dXMpLnRvQmUoNTAwKTtcbiAgICAgIGV4cGVjdChyZXNwLmpzb24oKSkudG9FcXVhbCh7bWVzc2FnZTpcImludGVybmFsIHNlcnZlciBlcnJvclwifSk7XG4gICAgfSk7XG5cbiAgICBzdWJqZWN0LnZlcmlmeU5vUGVuZGluZ1JlcXVlc3RzKCk7XG4gIH0pO1xuXG4gIGl0KFwiY2FuIHN0dWIgYnkgb25seSBzdGF0dXMgY29kZSBhbmQgZXhhbXBsZSBpZFwiLCAoKSA9PiB7XG4gICAgY29uc3Qgc3ViamVjdCA9IFJBTUxCYWNrZW5kQ29uZmlnLmluaXRXaXRoRmlsZShcIi4vYmFzZS90ZXN0ZGF0YS9zdGF0dXMtY29kZXMucmFtbFwiKVxuICAgICAgLndoZW5HRVQoXCIvZW5kcG9pbnRcIikudGhlblJlc3BvbmRXaXRoKDIwMSwgXCJ3aXRoRW50aXR5SWRcIilcbiAgICAgIC5jcmVhdGVCYWNrZW5kKCk7XG4gICAgY29uc3QgaHR0cCA9IG5ldyBIdHRwKHN1YmplY3QsIG5ldyBSZXF1ZXN0T3B0aW9ucygpKTtcblxuICAgIGh0dHAuZ2V0KFwiL2VuZHBvaW50XCIpLnN1YnNjcmliZShyZXNwID0+IHtcbiAgICAgIGV4cGVjdChyZXNwLmpzb24oKSkudG9FcXVhbCh7bWVzc2FnZTogXCJjcmVhdGVkXCIsIGVudGl0eUlkOiA0Mn0pO1xuICAgIH0pO1xuXG4gICAgc3ViamVjdC52ZXJpZnlOb1BlbmRpbmdSZXF1ZXN0cygpO1xuICB9KTtcblxuICBpdChcInRocm93cyBleGNlcHRpb24gaWYgbm8gZXhhbXBsZXMgYXJlIGRlZmluZWRcIiwgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBzdWJqZWN0ID0gUkFNTEJhY2tlbmRDb25maWcuaW5pdFdpdGhGaWxlKFwiLi9iYXNlL3Rlc3RkYXRhL3N0YXR1cy1jb2Rlcy5yYW1sXCIpXG4gICAgICAgIC53aGVuR0VUKFwiL2VuZHBvaW50XCIpLnRoZW5SZXNwb25kV2l0aCgyMDAsIFwibm90Rm91bmRcIilcbiAgICAgIGZhaWwoXCJkaWQgbm90IHRocm93IGV4Y2VwdGlvblwiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBleHBlY3QoZSkudG9FcXVhbChuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJjb3VsZCBub3QgZmluZCBleGFtcGxlIFtub3RGb3VuZF1cIikpO1xuICAgIH1cbiAgfSk7XG5cbiAgaXQoXCJ0aHJvd3MgZXhjZXB0aW9uIGlmIG5vIGV4YW1wbGVzIGFyZSBkZWZpbmVkXCIsICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc3ViamVjdCA9IFJBTUxCYWNrZW5kQ29uZmlnLmluaXRXaXRoRmlsZShcIi4vYmFzZS90ZXN0ZGF0YS9zdGF0dXMtY29kZXMucmFtbFwiKVxuICAgICAgICAud2hlbkdFVChcIi9lbmRwb2ludFwiKS50aGVuUmVzcG9uZFdpdGgoMjAxLCBcIm5vdEZvdW5kXCIpXG4gICAgICBmYWlsKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZXhwZWN0KGUpLnRvRXF1YWwobmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwiY291bGQgbm90IGZpbmQgZXhhbXBsZSBbbm90Rm91bmRdXCIpKTtcbiAgICB9XG4gIH0pO1xuXG4gIGl0KFwidGhyb3dzIGV4Y2VwdGlvbiBpZiBubyByZXNwIGZvdW5kIHdpdGggc3RhdHVzIGNvZGVcIiwgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBSQU1MQmFja2VuZENvbmZpZy5pbml0V2l0aEZpbGUoXCIuL2Jhc2UvdGVzdGRhdGEvc3RhdHVzLWNvZGVzLnJhbWxcIikud2hlbkdFVChcIi9lbmRwb2ludFwiKS50aGVuUmVzcG9uZFdpdGgoNTU1KTtcbiAgICAgIGZhaWwoXCJkaWQgbm90IHRocm93IGV4Y2VwdGlvbiBmb3IgdW5kZWZpbmVkIHJlc3BvbnNlXCIpXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZXhwZWN0KGUpLnRvRXF1YWwobmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwidGhlcmUgaXMgbm8gcmVzcG9uc2UgZGVmaW5lZCB3aXRoIHN0YXR1cyBjb2RlIDU1NSBpbiB0aGUgUkFNTCBmaWxlXCIpKTtcbiAgICB9XG4gIH0pO1xuXG59KTtcblxuZGVzY3JpYmUoXCJCb2R5IHZhbGlkYXRpb25cIiwgKCkgPT4ge1xuXG4gIGl0KFwidmFsaWRhdGVzIHJlcXVlc3QgYm9kaWVzIGFzIHBlciBqc29uIHNjaGVtYVwiLCAoKSA9PiB7XG4gICAgY29uc3Qgc3ViamVjdCA9IGNyZWF0ZVN1YmplY3QoXCIuL2Jhc2UvdGVzdGRhdGEvZW5kcG9pbnRzLXdpdGgtc2NoZW1hcy5yYW1sXCIpLCBodHRwID0gbmV3IEh0dHAoc3ViamVjdCwgbmV3IFJlcXVlc3RPcHRpb25zKCkpO1xuICAgIGNvbnN0IG9uU3VjY2VzcyA9IGphc21pbmUuY3JlYXRlU3B5KFwib25TdWNjZXNzXCIpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGh0dHAucG9zdChhYnNVcmkoXCIvdGhpbmdcIiksIHtwcm9wOlwiYWJcIn0pLnN1YnNjcmliZShvblN1Y2Nlc3MpO1xuICAgICAgZmFpbChcImRpZCBub3QgdGhyb3cgZXhjZXB0aW9uIGZvciBpbnZhbGlkIHJlcXVlc3QgYm9keVwiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBleHBlY3Qob25TdWNjZXNzKS5ub3QudG9IYXZlQmVlbkNhbGxlZCgpO1xuICAgIH1cbiAgfSk7XG5cbiAgaXQoXCJjYW4gcmVmZXIgdG8gc2NoZW1hcyBpbiBmcmFnbWVudFwiLCAoKSA9PiB7XG4gICAgY29uc3Qgc3ViamVjdCA9IGNyZWF0ZVN1YmplY3QoXCIuL2Jhc2UvdGVzdGRhdGEvZW5kcG9pbnRzLXdpdGgtc2NoZW1hcy5yYW1sXCIpLCBodHRwID0gbmV3IEh0dHAoc3ViamVjdCwgbmV3IFJlcXVlc3RPcHRpb25zKCkpO1xuICAgIGNvbnN0IG9uU3VjY2VzcyA9IGphc21pbmUuY3JlYXRlU3B5KFwib25TdWNjZXNzXCIpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGh0dHAucG9zdChhYnNVcmkoXCIvcHJvcHR5cGVcIiksIHtwcm9wOlwiYWJcIn0pLnN1YnNjcmliZShvblN1Y2Nlc3MpO1xuICAgICAgZmFpbChcImRpZCBub3QgdGhyb3cgZXhjZXB0aW9uIGZvciBpbnZhbGlkIHJlcXVlc3QgYm9keVwiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBleHBlY3Qob25TdWNjZXNzKS5ub3QudG9IYXZlQmVlbkNhbGxlZCgpO1xuICAgIH1cbiAgfSk7XG5cbn0pO1xuXG5kZXNjcmliZShcInJlZ3Jlc3Npb25zXCIsICgpID0+IHtcblxuICBmaXQoXCJsb2FkcyBzaW1wbGUgYXV0aGVudGljYXRpb24gcmFtbFwiLCAoKSA9PiB7XG4gICAgY29uc3Qgc3ViamVjdCA9IFJBTUxCYWNrZW5kQ29uZmlnLmluaXRXaXRoRmlsZShcIi9iYXNlL3Rlc3RkYXRhL2F1dGhlbnRpY2F0aW9uLnJhbWxcIilcbiAgICAgIC5zdHViQWxsKClcbiAgICAgIC5jcmVhdGVCYWNrZW5kKCk7XG4gICAgY29uc3QgaHR0cCA9IG5ldyBIdHRwKHN1YmplY3QsIG5ldyBSZXF1ZXN0T3B0aW9ucygpKTtcblxuICAgIGh0dHAuZ2V0KFwiaHR0cDovL2R1bW15LWNjLWJhY2tlbmQvYXV0aC90b2tlbj9jb2RlPTEyM1wiKS5zdWJzY3JpYmUoZSA9PiB7fSk7XG5cbiAgfSk7XG5cbn0pXG4iXX0=
