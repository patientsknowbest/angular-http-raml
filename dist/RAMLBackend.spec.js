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
    it("can use altered base uri", function () {
        var subject = RAMLBackendConfig_1.RAMLBackendConfig.initWithFile("/base/testdata/test-endpoints.raml")
            .baseUri("http://somewhere-else")
            .stubAll()
            .createBackend();
        var http = new http_1.Http(subject, new http_1.RequestOptions());
        http.get("http://somewhere-else/queryparams").subscribe(function (resp) {
            expect(resp.json()).toEqual({ name: "John Smith" });
        });
        subject.verifyNoPendingRequests();
    });
    it("refuses to change base uri after any stubbing happened", function () {
        try {
            RAMLBackendConfig_1.RAMLBackendConfig.initWithFile("/base/testdata/test-endpoints.raml").stubAll().baseUri("asd");
            fail("did not throw exception");
        }
        catch (e) {
            expect(e).toEqual(new RAMLBackendConfig_1.InvalidStubbingError("cannot change baseUri after stubs are defined"));
        }
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
    it("loads simple authentication raml", function () {
        var subject = RAMLBackendConfig_1.RAMLBackendConfig.initWithFile("/base/testdata/authentication.raml")
            .stubAll()
            .createBackend();
        var http = new http_1.Http(subject, new http_1.RequestOptions());
        http.get("http://dummy-cc-backend/auth/token?code=123").subscribe(function (e) { });
    });
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,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R0FBRyxDQUFDLDZDQUE2QyxDQUFDLENBQUMsU0FBUyxDQUFDLFVBQUEsQ0FBQyxJQUFLLENBQUMsQ0FBQyxDQUFDO0lBRTdFLENBQUMsQ0FBQyxDQUFDO0FBRUwsQ0FBQyxDQUFDLENBQUEiLCJmaWxlIjoiUkFNTEJhY2tlbmQuc3BlYy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7UkFNTEJhY2tlbmQsIFVSSVBhdHRlcm59IGZyb20gXCIuL1JBTUxCYWNrZW5kXCI7XG5pbXBvcnQge0h0dHAsIFJlcXVlc3QsIFJlcXVlc3RPcHRpb25zLCBSZXNwb25zZSwgUmVzcG9uc2VPcHRpb25zfSBmcm9tIFwiQGFuZ3VsYXIvaHR0cFwiO1xuaW1wb3J0IHtJbnZhbGlkU3R1YmJpbmdFcnJvciwgUkFNTEJhY2tlbmRDb25maWd9IGZyb20gXCIuL1JBTUxCYWNrZW5kQ29uZmlnXCI7XG5cblxuXG5mdW5jdGlvbiBhYnNVcmkocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIFwiaHR0cDovL2R1bW15LWVuZHBvaW50XCIgKyBwYXRoO1xufVxuXG5mdW5jdGlvbiBvaygpIHtcbiAgcmV0dXJuIG5ldyBSZXNwb25zZShuZXcgUmVzcG9uc2VPcHRpb25zKHtcbiAgICBzdGF0dXM6IDIwMCxcbiAgICBib2R5OiBcIlwiXG4gIH0pKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlU3ViamVjdChwYXRoOiBzdHJpbmcgPSBcIi4vYmFzZS90ZXN0ZGF0YS90ZXN0LWVuZHBvaW50cy5yYW1sXCIpOiBSQU1MQmFja2VuZCB7XG4gIHJldHVybiBSQU1MQmFja2VuZENvbmZpZy5pbml0V2l0aEZpbGUocGF0aClcbiAgICAuc3R1YkFsbCgpXG4gICAgLmNyZWF0ZUJhY2tlbmQoKTtcbn1cblxuZGVzY3JpYmUoXCJSQU1MQmFja2VuZFwiLCAoKSA9PiB7XG5cbiAgaXQoXCJyZXR1cm5zIDIwMCB3aXRoIGV4YW1wbGUgZm9yIGZvdW5kIGVuZHBvaW50c1wiLCAoKSA9PiB7XG4gICAgY29uc3Qgc3ViamVjdCA9IGNyZWF0ZVN1YmplY3QoKSwgaHR0cCA9IG5ldyBIdHRwKHN1YmplY3QsIG5ldyBSZXF1ZXN0T3B0aW9ucygpKTtcblxuICAgIGh0dHAuZ2V0KGFic1VyaShcIi9hdXRoL3Rva2VuXCIpKVxuICAgICAgLnN1YnNjcmliZShyZXNwID0+IHtcbiAgICAgICAgZXhwZWN0KHJlc3AuanNvbigpKS50b0VxdWFsKHtuYW1lOiBcIkpvaG4gU25vd1wifSk7XG4gICAgICB9KTtcblxuICAgIHN1YmplY3QudmVyaWZ5Tm9QZW5kaW5nUmVxdWVzdHMoKTtcbiAgfSk7XG5cbiAgaXQoXCJ0YWtlcyBtZXRob2QgaW50byBhY2NvdW50IHdoZW4gbG9va2luZyBmb3IgcmVzcG9uc2VcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHN1YmplY3QgPSBjcmVhdGVTdWJqZWN0KCksIGh0dHAgPSBuZXcgSHR0cChzdWJqZWN0LCBuZXcgUmVxdWVzdE9wdGlvbnMoKSk7XG5cbiAgICBodHRwLnBvc3QoYWJzVXJpKFwiL2F1dGgvdG9rZW5cIiksIHt9KS5zdWJzY3JpYmUocmVzcCA9PiB7XG4gICAgICBleHBlY3QocmVzcC5zdGF0dXMpLnRvRXF1YWwoMjAxKTtcbiAgICAgIGV4cGVjdChyZXNwLmpzb24oKSkudG9FcXVhbCh7bWVzc2FnZTogXCJjcmVhdGVkXCJ9KTtcbiAgICB9KTtcblxuICAgIHN1YmplY3QudmVyaWZ5Tm9QZW5kaW5nUmVxdWVzdHMoKTtcbiAgfSk7XG5cbiAgaXQoXCJtYXRjaGVzIHBhdGggcGFyYW1ldGVyc1wiLCAoKSA9PiB7XG4gICAgY29uc3Qgc3ViamVjdCA9IGNyZWF0ZVN1YmplY3QoKSwgaHR0cCA9IG5ldyBIdHRwKHN1YmplY3QsIG5ldyBSZXF1ZXN0T3B0aW9ucygpKTtcblxuICAgIGh0dHAuZ2V0KGFic1VyaShcIi9wZXJzb24vMTIzLzQ1NlwiKSkuc3Vic2NyaWJlKHJlc3AgPT4ge1xuICAgICAgZXhwZWN0KHJlc3Auc3RhdHVzKS50b0VxdWFsKDIwMCk7XG4gICAgfSk7XG5cbiAgICBzdWJqZWN0LnZlcmlmeU5vUGVuZGluZ1JlcXVlc3RzKCk7XG4gIH0pO1xuXG4gIGl0KFwiY2hlY2tzIGludmFsaWQgcXVlcnkgcGFyYW1ldGVyc1wiLCAoKSA9PiB7XG4gICAgY29uc3Qgc3ViamVjdCA9IGNyZWF0ZVN1YmplY3QoKSwgaHR0cCA9IG5ldyBIdHRwKHN1YmplY3QsIG5ldyBSZXF1ZXN0T3B0aW9ucygpKTtcblxuICAgIGh0dHAuZ2V0KGFic1VyaShcIi9xdWVyeXBhcmFtcz9mb289YmFyJmhlbGxvPXdvcmxkJmludmFsaWQ9YXNkXCIpKVxuICAgICAgLnN1YnNjcmliZShyZXNwID0+IHtcbiAgICAgICAgZXhwZWN0KHJlc3Auc3RhdHVzKS50b0VxdWFsKDQwMSk7XG4gICAgICAgIGV4cGVjdChyZXNwLmpzb24oKS5tZXNzYWdlKS50b0VxdWFsKFwidW5kZWNsYXJlZCBxdWVyeSBwYXJhbWV0ZXIgW2ludmFsaWRdIGZvdW5kIGluIHJlcXVlc3RcIik7XG4gICAgICB9KTtcblxuICAgIHN1YmplY3QudmVyaWZ5Tm9QZW5kaW5nUmVxdWVzdHMoKTtcbiAgfSk7XG5cbiAgaXQoXCJjYW4gdXNlIGFsdGVyZWQgYmFzZSB1cmlcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHN1YmplY3QgPSBSQU1MQmFja2VuZENvbmZpZy5pbml0V2l0aEZpbGUoXCIvYmFzZS90ZXN0ZGF0YS90ZXN0LWVuZHBvaW50cy5yYW1sXCIpXG4gICAgICAuYmFzZVVyaShcImh0dHA6Ly9zb21ld2hlcmUtZWxzZVwiKVxuICAgICAgLnN0dWJBbGwoKVxuICAgICAgLmNyZWF0ZUJhY2tlbmQoKTtcbiAgICBjb25zdCBodHRwID0gbmV3IEh0dHAoc3ViamVjdCwgbmV3IFJlcXVlc3RPcHRpb25zKCkpO1xuXG4gICAgaHR0cC5nZXQoXCJodHRwOi8vc29tZXdoZXJlLWVsc2UvcXVlcnlwYXJhbXNcIikuc3Vic2NyaWJlKHJlc3AgPT4ge1xuICAgICAgZXhwZWN0KHJlc3AuanNvbigpKS50b0VxdWFsKHtuYW1lOiBcIkpvaG4gU21pdGhcIn0pO1xuICAgIH0pO1xuXG4gICAgc3ViamVjdC52ZXJpZnlOb1BlbmRpbmdSZXF1ZXN0cygpO1xuICB9KTtcblxuICBpdChcInJlZnVzZXMgdG8gY2hhbmdlIGJhc2UgdXJpIGFmdGVyIGFueSBzdHViYmluZyBoYXBwZW5lZFwiLCAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIFJBTUxCYWNrZW5kQ29uZmlnLmluaXRXaXRoRmlsZShcIi9iYXNlL3Rlc3RkYXRhL3Rlc3QtZW5kcG9pbnRzLnJhbWxcIikuc3R1YkFsbCgpLmJhc2VVcmkoXCJhc2RcIik7XG4gICAgICBmYWlsKFwiZGlkIG5vdCB0aHJvdyBleGNlcHRpb25cIik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZXhwZWN0KGUpLnRvRXF1YWwobmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwiY2Fubm90IGNoYW5nZSBiYXNlVXJpIGFmdGVyIHN0dWJzIGFyZSBkZWZpbmVkXCIpKVxuICAgIH1cbiAgfSk7XG5cbiAgeGl0KFwiY2hlY2tzIGhlYWRlcnNcIiAsICgpID0+IHtcbiAgICBjb25zdCBzdWJqZWN0ID0gY3JlYXRlU3ViamVjdCgpLCBodHRwID0gbmV3IEh0dHAoc3ViamVjdCwgbmV3IFJlcXVlc3RPcHRpb25zKCkpO1xuXG4gICAgaHR0cC5nZXQoXCJcIikuc3Vic2NyaWJlKHJlc3AgPT4ge1xuXG4gICAgfSk7XG5cbiAgICBzdWJqZWN0LnZlcmlmeU5vUGVuZGluZ1JlcXVlc3RzKCk7XG4gIH0pO1xuICB4aXQoXCJubyBleGFtcGxlLCBubyBleGFtcGxlc1wiLCAoKSA9PiB7XG5cbiAgfSk7XG4gIHhpdChcImNoZWNrcyB0aGUgdHlwZSBvZiBwYXRoIHBhcmFtc1wiLCAoKSA9PiB7XG5cbiAgfSk7XG5cbn0pO1xuXG5kZXNjcmliZShcIlVSSVBhdHRlcm5cIiwgKCkgPT4ge1xuXG5cbiAgZnVuY3Rpb24gY3JlYXRlU3ViamVjdChwYXRoOiBzdHJpbmcpOiBVUklQYXR0ZXJuIHtcbiAgICByZXR1cm4gbmV3IFVSSVBhdHRlcm4oYWJzVXJpKHBhdGgpKTtcbiAgfVxuXG4gIGl0KFwicmV0dXJucyBlbXB0eSByZXN1bHQgb24gbWF0Y2hpbmcgcGFyYW1ldGVybGVzcyBVUklcIiwgKCkgPT4ge1xuICAgIGV4cGVjdChjcmVhdGVTdWJqZWN0KFwiL3BlcnNvblwiKS5tYXRjaGVzKGFic1VyaShcIi9wZXJzb25cIikpKS50b0VxdWFsKHt9KTtcbiAgfSk7XG5cbiAgaXQoXCJyZXR1cm5zIHBhcmFtIG1hcCBmb3IgbWF0Y2hcIiwgKCkgPT4ge1xuICAgIGNvbnN0IGFjdHVhbCA9IGNyZWF0ZVN1YmplY3QoXCIvcGVyc29uL3twZXJzb25JZH0ve290aGVyUGFyYW19L2R1bW15L3t0aGlyZFBhcmFtfVwiKS5tYXRjaGVzKGFic1VyaShcIi9wZXJzb24vMTIzL2Zvby9kdW1teS9iYXJcIikpO1xuICAgIGV4cGVjdChhY3R1YWwpLnRvRXF1YWwoe3BlcnNvbklkOiBcIjEyM1wiLCBvdGhlclBhcmFtOiBcImZvb1wiLCB0aGlyZFBhcmFtOiBcImJhclwifSk7XG4gIH0pO1xuXG59KTtcblxuZGVzY3JpYmUoXCJleHBsaWNpdCBzdHVic1wiLCAoKSA9PiB7XG5cbiAgZnVuY3Rpb24gaW5pdFN0dWJDb25maWcoKSB7XG4gICAgcmV0dXJuIFJBTUxCYWNrZW5kQ29uZmlnLmluaXRXaXRoRmlsZShcIi4vYmFzZS90ZXN0ZGF0YS9zdHViLWJhc2UucmFtbFwiKS5zdHViQWxsKCk7XG4gIH1cblxuICBpdChcIm92ZXJyaWRlcyAnZXhhbXBsZScgcmVzcG9uc2VzXCIsICgpICA9PiB7XG4gICAgY29uc3QgZXhwbGljaXRBY2Nlc3NUb2tlbiA9IFwiQUNDVDQ1NlwiO1xuICAgIGNvbnN0IHN1YmplY3QgPSBpbml0U3R1YkNvbmZpZygpXG4gICAgICAud2hlbkdFVChcIi9lbmRwb2ludFwiKS50aGVuUmVzcG9uZChuZXcgUmVzcG9uc2UobmV3IFJlc3BvbnNlT3B0aW9ucyh7XG4gICAgICAgIHN0YXR1czogMjAwLFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7YWNjZXNzX3Rva2VuOiBcIkFDQ1Q0NTZcIn0pXG4gICAgICB9KSkpXG4gICAgICAuY3JlYXRlQmFja2VuZCgpO1xuXG4gICAgIGNvbnN0IGh0dHAgPSBuZXcgSHR0cChzdWJqZWN0LCBuZXcgUmVxdWVzdE9wdGlvbnMoKSk7XG4gICAgaHR0cC5nZXQoYWJzVXJpKFwiL2VuZHBvaW50XCIpKS5zdWJzY3JpYmUocmVzcCA9PiB7XG4gICAgICAgZXhwZWN0KHJlc3AuanNvbigpKS50b0VxdWFsKHthY2Nlc3NfdG9rZW46IGV4cGxpY2l0QWNjZXNzVG9rZW59KTtcbiAgIH0pXG5cbiAgfSk7XG5cbiAgaXQoXCJyZWZ1c2VzIGludmFsaWQgcGF0aHNcIiwgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBpbml0U3R1YkNvbmZpZygpLndoZW5HRVQoXCIvbm9uZXhpc3RlbnRcIik7XG4gICAgICBmYWlsKFwiZGlkIG5vdCByZWZ1c2Ugbm9uZXhpc3RlbnQgZW5kcG9pbnRcIik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZXhwZWN0KGUpLnRvRXF1YWwobmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwiZm91bmQgbm8gZGVjbGFyYXRpb24gb2YgcmVxdWVzdCBbR0VUIC9ub25leGlzdGVudF0gaW4gUkFNTCAtIHJlZnVzaW5nIHRvIHN0dWJcIikpXG4gICAgfVxuICB9KTtcblxuICBpdChcInJlZnVzZXMgaW52YWxpZCBtZXRob2RzXCIsICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgaW5pdFN0dWJDb25maWcoKS53aGVuSEVBRChcIi9lbmRwb2ludFwiKTtcbiAgICAgIGZhaWwoXCJkaWQgbm90IHJlZnVzZSB1bmRlZmluZWQgSEVBRCBtZXRob2RcIilcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBleHBlY3QoZSkudG9FcXVhbChuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJmb3VuZCBubyBkZWNsYXJhdGlvbiBvZiByZXF1ZXN0IFtIRUFEIC9lbmRwb2ludF0gaW4gUkFNTCAtIHJlZnVzaW5nIHRvIHN0dWJcIikpXG4gICAgfVxuICB9KTtcblxuICBpdChcInJlZnVzZXMgaW52YWxpZCBxdWVyeSBwYXJhbXNcIiwgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBzdWJqZWN0ID0gaW5pdFN0dWJDb25maWcoKVxuICAgICAgICAud2hlbkdFVChcIi9lbmRwb2ludD9xcDA9dmFsJmZvbz1iYXJcIikudGhlblJlc3BvbmQobmV3IFJlc3BvbnNlKG5ldyBSZXNwb25zZU9wdGlvbnMoe1xuICAgICAgICAgIHN0YXR1czogMjAwLFxuICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHthY2Nlc3NfdG9rZW46IDQ1Nn0pXG4gICAgICAgIH0pKSlcbiAgICAgICAgLmNyZWF0ZUJhY2tlbmQoKTtcbiAgICAgIGZhaWwoXCJkaWQgbm90IGZhaWwgZm9yIGludmFsaWQgcXVlcnkgcGFyYW1ldGVyXCIpXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZXhwZWN0KGUpLnRvRXF1YWwobmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwidW5kZWNsYXJlZCBxdWVyeSBwYXJhbWV0ZXIgW2Zvb10gZm91bmQgaW4gcmVxdWVzdFwiKSk7XG4gICAgfVxuICB9KTtcblxuICBpdChcInJlZnVzZXMgaW52YWxpZCByZXNwb25zZSBib2RpZXNcIiwgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBzdWJqZWN0ID0gaW5pdFN0dWJDb25maWcoKS53aGVuR0VUKFwiL2VuZHBvaW50XCIpXG4gICAgICAgIC50aGVuUmVzcG9uZChuZXcgUmVzcG9uc2UobmV3IFJlc3BvbnNlT3B0aW9ucyh7XG4gICAgICAgICAgc3RhdHVzOiAyMDAsXG4gICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe2ludmFsaWRLZXk6IDEyM30pXG4gICAgICAgIH0pKSk7XG4gICAgICBmYWlsKFwiZGlkIG5vdCB0aHJvdyBleGNlcHRpb24gZm9yIGludmFsaWQgcmVzcG9uc2UgYm9keVwiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBleHBlY3QoZSkudG9FcXVhbChuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJpbnZhbGlkIHN0dWIgcmVzcG9uc2UgYm9keVwiKSk7XG4gICAgfVxuICB9KTtcblxuICBpdChcImFsc28gdmFsaWRhdGVzIG5vbi1vYmplY3QgcmVzcG9uc2UgYm9kaWVzXCIsICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgaW5pdFN0dWJDb25maWcoKS53aGVuUE9TVChcIi9lbmRwb2ludFwiKS50aGVuUmVzcG9uZChuZXcgUmVzcG9uc2UobmV3IFJlc3BvbnNlT3B0aW9ucyh7XG4gICAgICAgIHN0YXR1czogMjAxLFxuICAgICAgICBib2R5OiBcImdnIHdwXCJcbiAgICAgIH0pKSk7XG4gICAgICBmYWlsKFwiZGlkIG5vdCB0aHJvdyBleGNlcHRpb24gZm9yIGludmFsaWQgcmVzcG9uc2UgYm9keVwiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBleHBlY3QoZSkudG9FcXVhbChuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJpbnZhbGlkIHN0dWIgcmVzcG9uc2UgYm9keVwiKSk7XG4gICAgfVxuICB9KTtcblxuICBpdChcImZhaWxzIGlmIHRoZXJlIGlzIHBlbmRpbmcgYmVoYXZpb3IgKHVuc2V0IHJlc3BvbnNlKVwiLCAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHN1YmplY3QgPSBpbml0U3R1YkNvbmZpZygpO1xuICAgICAgc3ViamVjdC53aGVuR0VUKFwiL2VuZHBvaW50XCIpO1xuICAgICAgc3ViamVjdC53aGVuUE9TVChcIi9lbmRwb2ludFwiKTtcbiAgICAgIGZhaWwoXCJkaWQgbm90IHRocm93IGV4Y2VwdGlvbiBmb3IgdW5maW5pc2hlZCBiZWhhdmlvclwiKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBleHBlY3QoZSkudG9FcXVhbChuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJ1bmZpbmlzaGVkIGJlaGF2aW9yIGRlZmluaXRpb246IGNhbm5vdCBjb25maWd1cmUgUE9TVCBodHRwOi8vZHVtbXktZW5kcG9pbnQvZW5kcG9pbnQgXCIgK1xuICAgICAgICBcImJlZm9yZSBzZXR0aW5nIHRoZSByZXNwb25zZSBmb3IgR0VUIGh0dHA6Ly9kdW1teS1lbmRwb2ludC9lbmRwb2ludFwiKSk7XG4gICAgfVxuICB9KTtcblxuICBpdChcImNhbiBjaGFpbiBtdWx0aXBsZSBzdHViYmluZ1wiLCAoKSA9PiB7XG4gICAgaW5pdFN0dWJDb25maWcoKS53aGVuR0VUKFwiL2VuZHBvaW50XCIpLnRoZW5SZXNwb25kKG5ldyBSZXNwb25zZShuZXcgUmVzcG9uc2VPcHRpb25zKHtcbiAgICAgIHN0YXR1czogMjAwLCBib2R5OiBcIntcXFwiYWNjZXNzX3Rva2VuXFxcIjpcXFwieHh4XFxcIn1cIlxuICAgICAgfSlcbiAgICApKS53aGVuUE9TVChcIi9lbmRwb2ludFwiKS50aGVuUmVzcG9uZChuZXcgUmVzcG9uc2UobmV3IFJlc3BvbnNlT3B0aW9ucyh7c3RhdHVzOiAyMDEsIGJvZHk6IFwiQ3JlYXRlZFwifSkpKTtcbiAgfSk7XG5cbiAgaXQoXCJjYW4gc3R1YiBQT1NUIHJlcXVlc3RzXCIsICgpID0+IHtcbiAgICBjb25zdCBzdWJqZWN0ID0gaW5pdFN0dWJDb25maWcoKS53aGVuUE9TVChcIi9lbmRwb2ludFwiKS50aGVuUmVzcG9uZChvaygpKS5jcmVhdGVCYWNrZW5kKCk7XG4gICAgY29uc3QgaHR0cCA9IG5ldyBIdHRwKHN1YmplY3QsIG5ldyBSZXF1ZXN0T3B0aW9ucygpKTtcblxuICAgIGh0dHAucG9zdChcIi9lbmRwb2ludFwiLCB7fSkuc3Vic2NyaWJlKHJlc3AgPT4ge1xuICAgICAgZXhwZWN0KHJlc3Aub2spLnRvQmUodHJ1ZSk7XG4gICAgfSk7XG5cbiAgICBzdWJqZWN0LnZlcmlmeU5vUGVuZGluZ1JlcXVlc3RzKCk7XG4gIH0pO1xuXG4gIGl0KFwiY2FuIHN0dWIgUFVUIHJlcXVlc3RzXCIsICgpID0+IHtcbiAgICBjb25zdCBzdWJqZWN0ID0gaW5pdFN0dWJDb25maWcoKS53aGVuUFVUKFwiL2VuZHBvaW50XCIpLnRoZW5SZXNwb25kKG9rKCkpLmNyZWF0ZUJhY2tlbmQoKTtcbiAgICBjb25zdCBodHRwID0gbmV3IEh0dHAoc3ViamVjdCwgbmV3IFJlcXVlc3RPcHRpb25zKCkpO1xuXG4gICAgaHR0cC5wdXQoXCIvZW5kcG9pbnRcIiwge30pLnN1YnNjcmliZShyZXNwID0+IHtcbiAgICAgIGV4cGVjdChyZXNwLm9rKS50b0JlKHRydWUpO1xuICAgIH0pO1xuXG4gICAgc3ViamVjdC52ZXJpZnlOb1BlbmRpbmdSZXF1ZXN0cygpO1xuICB9KTtcblxuICBpdChcImNhbiBzdHViIERFTEVURSByZXF1ZXN0c1wiLCAoKSA9PiB7XG4gICAgY29uc3Qgc3ViamVjdCA9IGluaXRTdHViQ29uZmlnKCkud2hlbkRFTEVURShcIi9lbmRwb2ludFwiKS50aGVuUmVzcG9uZChvaygpKS5jcmVhdGVCYWNrZW5kKCk7XG4gICAgY29uc3QgaHR0cCA9IG5ldyBIdHRwKHN1YmplY3QsIG5ldyBSZXF1ZXN0T3B0aW9ucygpKTtcblxuICAgIGh0dHAuZGVsZXRlKFwiL2VuZHBvaW50XCIpLnN1YnNjcmliZShyZXNwID0+IHtcbiAgICAgIGV4cGVjdChyZXNwLm9rKS50b0JlKHRydWUpO1xuICAgIH0pO1xuXG4gICAgc3ViamVjdC52ZXJpZnlOb1BlbmRpbmdSZXF1ZXN0cygpO1xuICB9KTtcblxuICBpdChcImNhbiBzdHViIFBBVENIIHJlcXVlc3RzXCIsICgpID0+IHtcbiAgICBjb25zdCBzdWJqZWN0ID0gaW5pdFN0dWJDb25maWcoKS53aGVuUEFUQ0goXCIvZW5kcG9pbnRcIikudGhlblJlc3BvbmQob2soKSkuY3JlYXRlQmFja2VuZCgpO1xuICAgIGNvbnN0IGh0dHAgPSBuZXcgSHR0cChzdWJqZWN0LCBuZXcgUmVxdWVzdE9wdGlvbnMoKSk7XG5cbiAgICBodHRwLnBhdGNoKFwiL2VuZHBvaW50XCIsIHt9KS5zdWJzY3JpYmUocmVzcCA9PiB7XG4gICAgICBleHBlY3QocmVzcC5vaykudG9CZSh0cnVlKTtcbiAgICB9KTtcblxuICAgIHN1YmplY3QudmVyaWZ5Tm9QZW5kaW5nUmVxdWVzdHMoKTtcbiAgfSk7XG5cbiAgaXQoXCJjYW4gc3R1YiBPUFRJT05TIHJlcXVlc3RzXCIsICgpID0+IHtcbiAgICBjb25zdCBzdWJqZWN0ID0gaW5pdFN0dWJDb25maWcoKS53aGVuT1BUSU9OUyhcIi9lbmRwb2ludFwiKS50aGVuUmVzcG9uZChvaygpKS5jcmVhdGVCYWNrZW5kKCk7XG4gICAgY29uc3QgaHR0cCA9IG5ldyBIdHRwKHN1YmplY3QsIG5ldyBSZXF1ZXN0T3B0aW9ucygpKTtcblxuICAgIGh0dHAub3B0aW9ucyhcIi9lbmRwb2ludFwiLCB7fSkuc3Vic2NyaWJlKHJlc3AgPT4ge1xuICAgICAgZXhwZWN0KHJlc3Aub2spLnRvQmUodHJ1ZSk7XG4gICAgfSk7XG5cbiAgICBzdWJqZWN0LnZlcmlmeU5vUGVuZGluZ1JlcXVlc3RzKCk7XG4gIH0pO1xuXG4gIGl0KFwiY2FuIHN0dWIgZW50aXJlIHJlcXVlc3RzXCIsICgpID0+IHtcbiAgICBjb25zdCByZXF1ZXN0ID0gbmV3IFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiBcInBvc3RcIixcbiAgICAgIHVybDogYWJzVXJpKFwiL2VuZHBvaW50XCIpLFxuICAgICAgYm9keToge2ZvbzogXCJiYXJcIn1cbiAgICB9KTtcbiAgICBjb25zdCByZXNwb25zZSA9IG5ldyBSZXNwb25zZShuZXcgUmVzcG9uc2VPcHRpb25zKHtcbiAgICAgIHN0YXR1czogMjAxLFxuICAgICAgYm9keTogXCJjcmVhdGVkXCJcbiAgICB9KSk7XG4gICAgY29uc3Qgc3ViamVjdCA9IGluaXRTdHViQ29uZmlnKCkud2hlblJlcXVlc3RJcyhyZXF1ZXN0KS50aGVuUmVzcG9uZChyZXNwb25zZSkuY3JlYXRlQmFja2VuZCgpO1xuICAgIGNvbnN0IGh0dHAgPSBuZXcgSHR0cChzdWJqZWN0LCBuZXcgUmVxdWVzdE9wdGlvbnMoKSk7XG5cbiAgICBodHRwLnBvc3QoYWJzVXJpKFwiL2VuZHBvaW50XCIpLCB7Zm9vIDpcImJhclwifSkuc3Vic2NyaWJlKHJlc3AgPT4ge1xuICAgICAgZXhwZWN0KHJlc3ApLnRvRXF1YWwocmVzcG9uc2UpO1xuICAgIH0pO1xuXG4gICAgc3ViamVjdC52ZXJpZnlOb1BlbmRpbmdSZXF1ZXN0cygpO1xuICB9KTtcblxufSk7XG5cbmRlc2NyaWJlKFwicmVzcG9uc2Ugc2VsZWN0aW9uXCIsICgpID0+IHtcblxuICBpdChcInJldHVybnMgdGhlIGxvd2VzdCAyeHggcmVzcG9uc2UgYnkgZGVmYXVsdFwiLCAoKSA9PiB7XG4gICAgY29uc3Qgc3ViamVjdCA9IFJBTUxCYWNrZW5kQ29uZmlnLmluaXRXaXRoRmlsZShcIi4vYmFzZS90ZXN0ZGF0YS9zdGF0dXMtY29kZXMucmFtbFwiKVxuICAgICAgLnN0dWJBbGwoKVxuICAgICAgLmNyZWF0ZUJhY2tlbmQoKTtcbiAgICBjb25zdCBodHRwID0gbmV3IEh0dHAoc3ViamVjdCwgbmV3IFJlcXVlc3RPcHRpb25zKCkpO1xuXG4gICAgaHR0cC5nZXQoYWJzVXJpKFwiL2VuZHBvaW50XCIpKS5zdWJzY3JpYmUocmVzcCA9PiB7XG4gICAgICBleHBlY3QocmVzcC5zdGF0dXMpLnRvQmUoMjAwKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgaXQoXCJjYW4gc3R1YiByZXNwb25zZSBieSBvbmx5IHN0YXR1cyBjb2RlXCIsICgpID0+IHtcbiAgICBjb25zdCBzdWJqZWN0ID0gUkFNTEJhY2tlbmRDb25maWcuaW5pdFdpdGhGaWxlKFwiLi9iYXNlL3Rlc3RkYXRhL3N0YXR1cy1jb2Rlcy5yYW1sXCIpXG4gICAgICAud2hlbkdFVChcIi9lbmRwb2ludFwiKS50aGVuUmVzcG9uZFdpdGgoNTAwKVxuICAgICAgLmNyZWF0ZUJhY2tlbmQoKTtcbiAgICBjb25zdCBodHRwID0gbmV3IEh0dHAoc3ViamVjdCwgbmV3IFJlcXVlc3RPcHRpb25zKCkpO1xuXG4gICAgaHR0cC5nZXQoXCIvZW5kcG9pbnRcIikuc3Vic2NyaWJlKHJlc3AgPT4ge1xuICAgICAgZXhwZWN0KHJlc3Auc3RhdHVzKS50b0JlKDUwMCk7XG4gICAgICBleHBlY3QocmVzcC5qc29uKCkpLnRvRXF1YWwoe21lc3NhZ2U6XCJpbnRlcm5hbCBzZXJ2ZXIgZXJyb3JcIn0pO1xuICAgIH0pO1xuXG4gICAgc3ViamVjdC52ZXJpZnlOb1BlbmRpbmdSZXF1ZXN0cygpO1xuICB9KTtcblxuICBpdChcImNhbiBzdHViIGJ5IG9ubHkgc3RhdHVzIGNvZGUgYW5kIGV4YW1wbGUgaWRcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHN1YmplY3QgPSBSQU1MQmFja2VuZENvbmZpZy5pbml0V2l0aEZpbGUoXCIuL2Jhc2UvdGVzdGRhdGEvc3RhdHVzLWNvZGVzLnJhbWxcIilcbiAgICAgIC53aGVuR0VUKFwiL2VuZHBvaW50XCIpLnRoZW5SZXNwb25kV2l0aCgyMDEsIFwid2l0aEVudGl0eUlkXCIpXG4gICAgICAuY3JlYXRlQmFja2VuZCgpO1xuICAgIGNvbnN0IGh0dHAgPSBuZXcgSHR0cChzdWJqZWN0LCBuZXcgUmVxdWVzdE9wdGlvbnMoKSk7XG5cbiAgICBodHRwLmdldChcIi9lbmRwb2ludFwiKS5zdWJzY3JpYmUocmVzcCA9PiB7XG4gICAgICBleHBlY3QocmVzcC5qc29uKCkpLnRvRXF1YWwoe21lc3NhZ2U6IFwiY3JlYXRlZFwiLCBlbnRpdHlJZDogNDJ9KTtcbiAgICB9KTtcblxuICAgIHN1YmplY3QudmVyaWZ5Tm9QZW5kaW5nUmVxdWVzdHMoKTtcbiAgfSk7XG5cbiAgaXQoXCJ0aHJvd3MgZXhjZXB0aW9uIGlmIG5vIGV4YW1wbGVzIGFyZSBkZWZpbmVkXCIsICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc3ViamVjdCA9IFJBTUxCYWNrZW5kQ29uZmlnLmluaXRXaXRoRmlsZShcIi4vYmFzZS90ZXN0ZGF0YS9zdGF0dXMtY29kZXMucmFtbFwiKVxuICAgICAgICAud2hlbkdFVChcIi9lbmRwb2ludFwiKS50aGVuUmVzcG9uZFdpdGgoMjAwLCBcIm5vdEZvdW5kXCIpXG4gICAgICBmYWlsKFwiZGlkIG5vdCB0aHJvdyBleGNlcHRpb25cIik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZXhwZWN0KGUpLnRvRXF1YWwobmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwiY291bGQgbm90IGZpbmQgZXhhbXBsZSBbbm90Rm91bmRdXCIpKTtcbiAgICB9XG4gIH0pO1xuXG4gIGl0KFwidGhyb3dzIGV4Y2VwdGlvbiBpZiBubyBleGFtcGxlcyBhcmUgZGVmaW5lZFwiLCAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHN1YmplY3QgPSBSQU1MQmFja2VuZENvbmZpZy5pbml0V2l0aEZpbGUoXCIuL2Jhc2UvdGVzdGRhdGEvc3RhdHVzLWNvZGVzLnJhbWxcIilcbiAgICAgICAgLndoZW5HRVQoXCIvZW5kcG9pbnRcIikudGhlblJlc3BvbmRXaXRoKDIwMSwgXCJub3RGb3VuZFwiKVxuICAgICAgZmFpbCgpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGV4cGVjdChlKS50b0VxdWFsKG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcImNvdWxkIG5vdCBmaW5kIGV4YW1wbGUgW25vdEZvdW5kXVwiKSk7XG4gICAgfVxuICB9KTtcblxuICBpdChcInRocm93cyBleGNlcHRpb24gaWYgbm8gcmVzcCBmb3VuZCB3aXRoIHN0YXR1cyBjb2RlXCIsICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgUkFNTEJhY2tlbmRDb25maWcuaW5pdFdpdGhGaWxlKFwiLi9iYXNlL3Rlc3RkYXRhL3N0YXR1cy1jb2Rlcy5yYW1sXCIpLndoZW5HRVQoXCIvZW5kcG9pbnRcIikudGhlblJlc3BvbmRXaXRoKDU1NSk7XG4gICAgICBmYWlsKFwiZGlkIG5vdCB0aHJvdyBleGNlcHRpb24gZm9yIHVuZGVmaW5lZCByZXNwb25zZVwiKVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGV4cGVjdChlKS50b0VxdWFsKG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcInRoZXJlIGlzIG5vIHJlc3BvbnNlIGRlZmluZWQgd2l0aCBzdGF0dXMgY29kZSA1NTUgaW4gdGhlIFJBTUwgZmlsZVwiKSk7XG4gICAgfVxuICB9KTtcblxufSk7XG5cbmRlc2NyaWJlKFwiQm9keSB2YWxpZGF0aW9uXCIsICgpID0+IHtcblxuICBpdChcInZhbGlkYXRlcyByZXF1ZXN0IGJvZGllcyBhcyBwZXIganNvbiBzY2hlbWFcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHN1YmplY3QgPSBjcmVhdGVTdWJqZWN0KFwiLi9iYXNlL3Rlc3RkYXRhL2VuZHBvaW50cy13aXRoLXNjaGVtYXMucmFtbFwiKSwgaHR0cCA9IG5ldyBIdHRwKHN1YmplY3QsIG5ldyBSZXF1ZXN0T3B0aW9ucygpKTtcbiAgICBjb25zdCBvblN1Y2Nlc3MgPSBqYXNtaW5lLmNyZWF0ZVNweShcIm9uU3VjY2Vzc1wiKTtcblxuICAgIHRyeSB7XG4gICAgICBodHRwLnBvc3QoYWJzVXJpKFwiL3RoaW5nXCIpLCB7cHJvcDpcImFiXCJ9KS5zdWJzY3JpYmUob25TdWNjZXNzKTtcbiAgICAgIGZhaWwoXCJkaWQgbm90IHRocm93IGV4Y2VwdGlvbiBmb3IgaW52YWxpZCByZXF1ZXN0IGJvZHlcIik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZXhwZWN0KG9uU3VjY2Vzcykubm90LnRvSGF2ZUJlZW5DYWxsZWQoKTtcbiAgICB9XG4gIH0pO1xuXG4gIGl0KFwiY2FuIHJlZmVyIHRvIHNjaGVtYXMgaW4gZnJhZ21lbnRcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHN1YmplY3QgPSBjcmVhdGVTdWJqZWN0KFwiLi9iYXNlL3Rlc3RkYXRhL2VuZHBvaW50cy13aXRoLXNjaGVtYXMucmFtbFwiKSwgaHR0cCA9IG5ldyBIdHRwKHN1YmplY3QsIG5ldyBSZXF1ZXN0T3B0aW9ucygpKTtcbiAgICBjb25zdCBvblN1Y2Nlc3MgPSBqYXNtaW5lLmNyZWF0ZVNweShcIm9uU3VjY2Vzc1wiKTtcblxuICAgIHRyeSB7XG4gICAgICBodHRwLnBvc3QoYWJzVXJpKFwiL3Byb3B0eXBlXCIpLCB7cHJvcDpcImFiXCJ9KS5zdWJzY3JpYmUob25TdWNjZXNzKTtcbiAgICAgIGZhaWwoXCJkaWQgbm90IHRocm93IGV4Y2VwdGlvbiBmb3IgaW52YWxpZCByZXF1ZXN0IGJvZHlcIik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZXhwZWN0KG9uU3VjY2Vzcykubm90LnRvSGF2ZUJlZW5DYWxsZWQoKTtcbiAgICB9XG4gIH0pO1xuXG59KTtcblxuZGVzY3JpYmUoXCJyZWdyZXNzaW9uc1wiLCAoKSA9PiB7XG5cbiAgaXQoXCJsb2FkcyBzaW1wbGUgYXV0aGVudGljYXRpb24gcmFtbFwiLCAoKSA9PiB7XG4gICAgY29uc3Qgc3ViamVjdCA9IFJBTUxCYWNrZW5kQ29uZmlnLmluaXRXaXRoRmlsZShcIi9iYXNlL3Rlc3RkYXRhL2F1dGhlbnRpY2F0aW9uLnJhbWxcIilcbiAgICAgIC5zdHViQWxsKClcbiAgICAgIC5jcmVhdGVCYWNrZW5kKCk7XG4gICAgY29uc3QgaHR0cCA9IG5ldyBIdHRwKHN1YmplY3QsIG5ldyBSZXF1ZXN0T3B0aW9ucygpKTtcblxuICAgIGh0dHAuZ2V0KFwiaHR0cDovL2R1bW15LWNjLWJhY2tlbmQvYXV0aC90b2tlbj9jb2RlPTEyM1wiKS5zdWJzY3JpYmUoZSA9PiB7fSk7XG5cbiAgfSk7XG5cbn0pXG4iXX0=
