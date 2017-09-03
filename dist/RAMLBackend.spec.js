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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFJLENBQUM7WUFDSCxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFDLElBQUksRUFBQyxJQUFJLEVBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUM5RCxJQUFJLENBQUMsa0RBQWtELENBQUMsQ0FBQztRQUMzRCxDQUFDO1FBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNYLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUMzQyxDQUFDO0lBQ0gsQ0FBQyxDQUFDLENBQUM7SUFFSCxFQUFFLENBQUMsa0NBQWtDLEVBQUU7UUFDckMsSUFBTSxPQUFPLEdBQUcsYUFBYSxDQUFDLDZDQUE2QyxDQUFDLEVBQUUsSUFBSSxHQUFHLElBQUksV0FBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLHFCQUFjLEVBQUUsQ0FBQyxDQUFDO1FBQzdILElBQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFakQsSUFBSSxDQUFDO1lBQ0gsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBQyxJQUFJLEVBQUMsSUFBSSxFQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDakUsSUFBSSxDQUFDLGtEQUFrRCxDQUFDLENBQUM7UUFDM0QsQ0FBQztRQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDWCxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDM0MsQ0FBQztJQUNILENBQUMsQ0FBQyxDQUFDO0FBRUwsQ0FBQyxDQUFDLENBQUMiLCJmaWxlIjoiUkFNTEJhY2tlbmQuc3BlYy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7UkFNTEJhY2tlbmQsIFVSSVBhdHRlcm59IGZyb20gXCIuL1JBTUxCYWNrZW5kXCI7XG5pbXBvcnQge0h0dHAsIFJlcXVlc3QsIFJlcXVlc3RPcHRpb25zLCBSZXNwb25zZSwgUmVzcG9uc2VPcHRpb25zfSBmcm9tIFwiQGFuZ3VsYXIvaHR0cFwiO1xuaW1wb3J0IHtJbnZhbGlkU3R1YmJpbmdFcnJvciwgUkFNTEJhY2tlbmRDb25maWd9IGZyb20gXCIuL1JBTUxCYWNrZW5kQ29uZmlnXCI7XG5cblxuXG5mdW5jdGlvbiBhYnNVcmkocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIFwiaHR0cDovL2R1bW15LWVuZHBvaW50XCIgKyBwYXRoO1xufVxuXG5mdW5jdGlvbiBvaygpIHtcbiAgcmV0dXJuIG5ldyBSZXNwb25zZShuZXcgUmVzcG9uc2VPcHRpb25zKHtcbiAgICBzdGF0dXM6IDIwMCxcbiAgICBib2R5OiBcIlwiXG4gIH0pKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlU3ViamVjdChwYXRoOiBzdHJpbmcgPSBcIi4vYmFzZS90ZXN0ZGF0YS90ZXN0LWVuZHBvaW50cy5yYW1sXCIpOiBSQU1MQmFja2VuZCB7XG4gIHJldHVybiBSQU1MQmFja2VuZENvbmZpZy5pbml0V2l0aEZpbGUocGF0aClcbiAgICAuc3R1YkFsbCgpXG4gICAgLmNyZWF0ZUJhY2tlbmQoKTtcbn1cblxuZGVzY3JpYmUoXCJSQU1MQmFja2VuZFwiLCAoKSA9PiB7XG5cbiAgaXQoXCJyZXR1cm5zIDIwMCB3aXRoIGV4YW1wbGUgZm9yIGZvdW5kIGVuZHBvaW50c1wiLCAoKSA9PiB7XG4gICAgY29uc3Qgc3ViamVjdCA9IGNyZWF0ZVN1YmplY3QoKSwgaHR0cCA9IG5ldyBIdHRwKHN1YmplY3QsIG5ldyBSZXF1ZXN0T3B0aW9ucygpKTtcblxuICAgIGh0dHAuZ2V0KGFic1VyaShcIi9hdXRoL3Rva2VuXCIpKVxuICAgICAgLnN1YnNjcmliZShyZXNwID0+IHtcbiAgICAgICAgZXhwZWN0KHJlc3AuanNvbigpKS50b0VxdWFsKHtuYW1lOiBcIkpvaG4gU25vd1wifSk7XG4gICAgICB9KTtcblxuICAgIHN1YmplY3QudmVyaWZ5Tm9QZW5kaW5nUmVxdWVzdHMoKTtcbiAgfSk7XG5cbiAgaXQoXCJ0YWtlcyBtZXRob2QgaW50byBhY2NvdW50IHdoZW4gbG9va2luZyBmb3IgcmVzcG9uc2VcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHN1YmplY3QgPSBjcmVhdGVTdWJqZWN0KCksIGh0dHAgPSBuZXcgSHR0cChzdWJqZWN0LCBuZXcgUmVxdWVzdE9wdGlvbnMoKSk7XG5cbiAgICBodHRwLnBvc3QoYWJzVXJpKFwiL2F1dGgvdG9rZW5cIiksIHt9KS5zdWJzY3JpYmUocmVzcCA9PiB7XG4gICAgICBleHBlY3QocmVzcC5zdGF0dXMpLnRvRXF1YWwoMjAxKTtcbiAgICAgIGV4cGVjdChyZXNwLmpzb24oKSkudG9FcXVhbCh7bWVzc2FnZTogXCJjcmVhdGVkXCJ9KTtcbiAgICB9KTtcblxuICAgIHN1YmplY3QudmVyaWZ5Tm9QZW5kaW5nUmVxdWVzdHMoKTtcbiAgfSk7XG5cbiAgaXQoXCJtYXRjaGVzIHBhdGggcGFyYW1ldGVyc1wiLCAoKSA9PiB7XG4gICAgY29uc3Qgc3ViamVjdCA9IGNyZWF0ZVN1YmplY3QoKSwgaHR0cCA9IG5ldyBIdHRwKHN1YmplY3QsIG5ldyBSZXF1ZXN0T3B0aW9ucygpKTtcblxuICAgIGh0dHAuZ2V0KGFic1VyaShcIi9wZXJzb24vMTIzLzQ1NlwiKSkuc3Vic2NyaWJlKHJlc3AgPT4ge1xuICAgICAgZXhwZWN0KHJlc3Auc3RhdHVzKS50b0VxdWFsKDIwMCk7XG4gICAgfSk7XG5cbiAgICBzdWJqZWN0LnZlcmlmeU5vUGVuZGluZ1JlcXVlc3RzKCk7XG4gIH0pO1xuXG4gIGl0KFwiY2hlY2tzIGludmFsaWQgcXVlcnkgcGFyYW1ldGVyc1wiLCAoKSA9PiB7XG4gICAgY29uc3Qgc3ViamVjdCA9IGNyZWF0ZVN1YmplY3QoKSwgaHR0cCA9IG5ldyBIdHRwKHN1YmplY3QsIG5ldyBSZXF1ZXN0T3B0aW9ucygpKTtcblxuICAgIGh0dHAuZ2V0KGFic1VyaShcIi9xdWVyeXBhcmFtcz9mb289YmFyJmhlbGxvPXdvcmxkJmludmFsaWQ9YXNkXCIpKVxuICAgICAgLnN1YnNjcmliZShyZXNwID0+IHtcbiAgICAgICAgZXhwZWN0KHJlc3Auc3RhdHVzKS50b0VxdWFsKDQwMSk7XG4gICAgICAgIGV4cGVjdChyZXNwLmpzb24oKS5tZXNzYWdlKS50b0VxdWFsKFwidW5kZWNsYXJlZCBxdWVyeSBwYXJhbWV0ZXIgW2ludmFsaWRdIGZvdW5kIGluIHJlcXVlc3RcIik7XG4gICAgICB9KTtcblxuICAgIHN1YmplY3QudmVyaWZ5Tm9QZW5kaW5nUmVxdWVzdHMoKTtcbiAgfSk7XG5cbiAgeGl0KFwiY2hlY2tzIGhlYWRlcnNcIiAsICgpID0+IHtcbiAgICBjb25zdCBzdWJqZWN0ID0gY3JlYXRlU3ViamVjdCgpLCBodHRwID0gbmV3IEh0dHAoc3ViamVjdCwgbmV3IFJlcXVlc3RPcHRpb25zKCkpO1xuXG4gICAgaHR0cC5nZXQoXCJcIikuc3Vic2NyaWJlKHJlc3AgPT4ge1xuXG4gICAgfSk7XG5cbiAgICBzdWJqZWN0LnZlcmlmeU5vUGVuZGluZ1JlcXVlc3RzKCk7XG4gIH0pO1xuXG5cbiAgeGl0KFwibm8gZXhhbXBsZSwgbm8gZXhhbXBsZXNcIiwgKCkgPT4ge1xuXG4gIH0pO1xuICB4aXQoXCJjaGVja3MgdGhlIHR5cGUgb2YgcGF0aCBwYXJhbXNcIiwgKCkgPT4ge1xuXG4gIH0pO1xuXG59KTtcblxuZGVzY3JpYmUoXCJVUklQYXR0ZXJuXCIsICgpID0+IHtcblxuXG4gIGZ1bmN0aW9uIGNyZWF0ZVN1YmplY3QocGF0aDogc3RyaW5nKTogVVJJUGF0dGVybiB7XG4gICAgcmV0dXJuIG5ldyBVUklQYXR0ZXJuKGFic1VyaShwYXRoKSk7XG4gIH1cblxuICBpdChcInJldHVybnMgZW1wdHkgcmVzdWx0IG9uIG1hdGNoaW5nIHBhcmFtZXRlcmxlc3MgVVJJXCIsICgpID0+IHtcbiAgICBleHBlY3QoY3JlYXRlU3ViamVjdChcIi9wZXJzb25cIikubWF0Y2hlcyhhYnNVcmkoXCIvcGVyc29uXCIpKSkudG9FcXVhbCh7fSk7XG4gIH0pO1xuXG4gIGl0KFwicmV0dXJucyBwYXJhbSBtYXAgZm9yIG1hdGNoXCIsICgpID0+IHtcbiAgICBjb25zdCBhY3R1YWwgPSBjcmVhdGVTdWJqZWN0KFwiL3BlcnNvbi97cGVyc29uSWR9L3tvdGhlclBhcmFtfS9kdW1teS97dGhpcmRQYXJhbX1cIikubWF0Y2hlcyhhYnNVcmkoXCIvcGVyc29uLzEyMy9mb28vZHVtbXkvYmFyXCIpKTtcbiAgICBleHBlY3QoYWN0dWFsKS50b0VxdWFsKHtwZXJzb25JZDogXCIxMjNcIiwgb3RoZXJQYXJhbTogXCJmb29cIiwgdGhpcmRQYXJhbTogXCJiYXJcIn0pO1xuICB9KTtcblxufSk7XG5cbmRlc2NyaWJlKFwiZXhwbGljaXQgc3R1YnNcIiwgKCkgPT4ge1xuXG4gIGZ1bmN0aW9uIGluaXRTdHViQ29uZmlnKCkge1xuICAgIHJldHVybiBSQU1MQmFja2VuZENvbmZpZy5pbml0V2l0aEZpbGUoXCIuL2Jhc2UvdGVzdGRhdGEvc3R1Yi1iYXNlLnJhbWxcIikuc3R1YkFsbCgpO1xuICB9XG5cbiAgaXQoXCJvdmVycmlkZXMgJ2V4YW1wbGUnIHJlc3BvbnNlc1wiLCAoKSAgPT4ge1xuICAgIGNvbnN0IGV4cGxpY2l0QWNjZXNzVG9rZW4gPSBcIkFDQ1Q0NTZcIjtcbiAgICBjb25zdCBzdWJqZWN0ID0gaW5pdFN0dWJDb25maWcoKVxuICAgICAgLndoZW5HRVQoXCIvZW5kcG9pbnRcIikudGhlblJlc3BvbmQobmV3IFJlc3BvbnNlKG5ldyBSZXNwb25zZU9wdGlvbnMoe1xuICAgICAgICBzdGF0dXM6IDIwMCxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe2FjY2Vzc190b2tlbjogXCJBQ0NUNDU2XCJ9KVxuICAgICAgfSkpKVxuICAgICAgLmNyZWF0ZUJhY2tlbmQoKTtcblxuICAgICBjb25zdCBodHRwID0gbmV3IEh0dHAoc3ViamVjdCwgbmV3IFJlcXVlc3RPcHRpb25zKCkpO1xuICAgIGh0dHAuZ2V0KGFic1VyaShcIi9lbmRwb2ludFwiKSkuc3Vic2NyaWJlKHJlc3AgPT4ge1xuICAgICAgIGV4cGVjdChyZXNwLmpzb24oKSkudG9FcXVhbCh7YWNjZXNzX3Rva2VuOiBleHBsaWNpdEFjY2Vzc1Rva2VufSk7XG4gICB9KVxuXG4gIH0pO1xuXG4gIGl0KFwicmVmdXNlcyBpbnZhbGlkIHBhdGhzXCIsICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgaW5pdFN0dWJDb25maWcoKS53aGVuR0VUKFwiL25vbmV4aXN0ZW50XCIpO1xuICAgICAgZmFpbChcImRpZCBub3QgcmVmdXNlIG5vbmV4aXN0ZW50IGVuZHBvaW50XCIpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGV4cGVjdChlKS50b0VxdWFsKG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcImZvdW5kIG5vIGRlY2xhcmF0aW9uIG9mIHJlcXVlc3QgW0dFVCAvbm9uZXhpc3RlbnRdIGluIFJBTUwgLSByZWZ1c2luZyB0byBzdHViXCIpKVxuICAgIH1cbiAgfSk7XG5cbiAgaXQoXCJyZWZ1c2VzIGludmFsaWQgbWV0aG9kc1wiLCAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGluaXRTdHViQ29uZmlnKCkud2hlbkhFQUQoXCIvZW5kcG9pbnRcIik7XG4gICAgICBmYWlsKFwiZGlkIG5vdCByZWZ1c2UgdW5kZWZpbmVkIEhFQUQgbWV0aG9kXCIpXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZXhwZWN0KGUpLnRvRXF1YWwobmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwiZm91bmQgbm8gZGVjbGFyYXRpb24gb2YgcmVxdWVzdCBbSEVBRCAvZW5kcG9pbnRdIGluIFJBTUwgLSByZWZ1c2luZyB0byBzdHViXCIpKVxuICAgIH1cbiAgfSk7XG5cbiAgaXQoXCJyZWZ1c2VzIGludmFsaWQgcXVlcnkgcGFyYW1zXCIsICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc3ViamVjdCA9IGluaXRTdHViQ29uZmlnKClcbiAgICAgICAgLndoZW5HRVQoXCIvZW5kcG9pbnQ/cXAwPXZhbCZmb289YmFyXCIpLnRoZW5SZXNwb25kKG5ldyBSZXNwb25zZShuZXcgUmVzcG9uc2VPcHRpb25zKHtcbiAgICAgICAgICBzdGF0dXM6IDIwMCxcbiAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7YWNjZXNzX3Rva2VuOiA0NTZ9KVxuICAgICAgICB9KSkpXG4gICAgICAgIC5jcmVhdGVCYWNrZW5kKCk7XG4gICAgICBmYWlsKFwiZGlkIG5vdCBmYWlsIGZvciBpbnZhbGlkIHF1ZXJ5IHBhcmFtZXRlclwiKVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGV4cGVjdChlKS50b0VxdWFsKG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcInVuZGVjbGFyZWQgcXVlcnkgcGFyYW1ldGVyIFtmb29dIGZvdW5kIGluIHJlcXVlc3RcIikpO1xuICAgIH1cbiAgfSk7XG5cbiAgaXQoXCJyZWZ1c2VzIGludmFsaWQgcmVzcG9uc2UgYm9kaWVzXCIsICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc3ViamVjdCA9IGluaXRTdHViQ29uZmlnKCkud2hlbkdFVChcIi9lbmRwb2ludFwiKVxuICAgICAgICAudGhlblJlc3BvbmQobmV3IFJlc3BvbnNlKG5ldyBSZXNwb25zZU9wdGlvbnMoe1xuICAgICAgICAgIHN0YXR1czogMjAwLFxuICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtpbnZhbGlkS2V5OiAxMjN9KVxuICAgICAgICB9KSkpO1xuICAgICAgZmFpbChcImRpZCBub3QgdGhyb3cgZXhjZXB0aW9uIGZvciBpbnZhbGlkIHJlc3BvbnNlIGJvZHlcIik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZXhwZWN0KGUpLnRvRXF1YWwobmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwiaW52YWxpZCBzdHViIHJlc3BvbnNlIGJvZHlcIikpO1xuICAgIH1cbiAgfSk7XG5cbiAgaXQoXCJhbHNvIHZhbGlkYXRlcyBub24tb2JqZWN0IHJlc3BvbnNlIGJvZGllc1wiLCAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGluaXRTdHViQ29uZmlnKCkud2hlblBPU1QoXCIvZW5kcG9pbnRcIikudGhlblJlc3BvbmQobmV3IFJlc3BvbnNlKG5ldyBSZXNwb25zZU9wdGlvbnMoe1xuICAgICAgICBzdGF0dXM6IDIwMSxcbiAgICAgICAgYm9keTogXCJnZyB3cFwiXG4gICAgICB9KSkpO1xuICAgICAgZmFpbChcImRpZCBub3QgdGhyb3cgZXhjZXB0aW9uIGZvciBpbnZhbGlkIHJlc3BvbnNlIGJvZHlcIik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZXhwZWN0KGUpLnRvRXF1YWwobmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwiaW52YWxpZCBzdHViIHJlc3BvbnNlIGJvZHlcIikpO1xuICAgIH1cbiAgfSk7XG5cbiAgaXQoXCJmYWlscyBpZiB0aGVyZSBpcyBwZW5kaW5nIGJlaGF2aW9yICh1bnNldCByZXNwb25zZSlcIiwgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBzdWJqZWN0ID0gaW5pdFN0dWJDb25maWcoKTtcbiAgICAgIHN1YmplY3Qud2hlbkdFVChcIi9lbmRwb2ludFwiKTtcbiAgICAgIHN1YmplY3Qud2hlblBPU1QoXCIvZW5kcG9pbnRcIik7XG4gICAgICBmYWlsKFwiZGlkIG5vdCB0aHJvdyBleGNlcHRpb24gZm9yIHVuZmluaXNoZWQgYmVoYXZpb3JcIik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZXhwZWN0KGUpLnRvRXF1YWwobmV3IEludmFsaWRTdHViYmluZ0Vycm9yKFwidW5maW5pc2hlZCBiZWhhdmlvciBkZWZpbml0aW9uOiBjYW5ub3QgY29uZmlndXJlIFBPU1QgaHR0cDovL2R1bW15LWVuZHBvaW50L2VuZHBvaW50IFwiICtcbiAgICAgICAgXCJiZWZvcmUgc2V0dGluZyB0aGUgcmVzcG9uc2UgZm9yIEdFVCBodHRwOi8vZHVtbXktZW5kcG9pbnQvZW5kcG9pbnRcIikpO1xuICAgIH1cbiAgfSk7XG5cbiAgaXQoXCJjYW4gY2hhaW4gbXVsdGlwbGUgc3R1YmJpbmdcIiwgKCkgPT4ge1xuICAgIGluaXRTdHViQ29uZmlnKCkud2hlbkdFVChcIi9lbmRwb2ludFwiKS50aGVuUmVzcG9uZChuZXcgUmVzcG9uc2UobmV3IFJlc3BvbnNlT3B0aW9ucyh7XG4gICAgICBzdGF0dXM6IDIwMCwgYm9keTogXCJ7XFxcImFjY2Vzc190b2tlblxcXCI6XFxcInh4eFxcXCJ9XCJcbiAgICAgIH0pXG4gICAgKSkud2hlblBPU1QoXCIvZW5kcG9pbnRcIikudGhlblJlc3BvbmQobmV3IFJlc3BvbnNlKG5ldyBSZXNwb25zZU9wdGlvbnMoe3N0YXR1czogMjAxLCBib2R5OiBcIkNyZWF0ZWRcIn0pKSk7XG4gIH0pO1xuXG4gIGl0KFwiY2FuIHN0dWIgUE9TVCByZXF1ZXN0c1wiLCAoKSA9PiB7XG4gICAgY29uc3Qgc3ViamVjdCA9IGluaXRTdHViQ29uZmlnKCkud2hlblBPU1QoXCIvZW5kcG9pbnRcIikudGhlblJlc3BvbmQob2soKSkuY3JlYXRlQmFja2VuZCgpO1xuICAgIGNvbnN0IGh0dHAgPSBuZXcgSHR0cChzdWJqZWN0LCBuZXcgUmVxdWVzdE9wdGlvbnMoKSk7XG5cbiAgICBodHRwLnBvc3QoXCIvZW5kcG9pbnRcIiwge30pLnN1YnNjcmliZShyZXNwID0+IHtcbiAgICAgIGV4cGVjdChyZXNwLm9rKS50b0JlKHRydWUpO1xuICAgIH0pO1xuXG4gICAgc3ViamVjdC52ZXJpZnlOb1BlbmRpbmdSZXF1ZXN0cygpO1xuICB9KTtcblxuICBpdChcImNhbiBzdHViIFBVVCByZXF1ZXN0c1wiLCAoKSA9PiB7XG4gICAgY29uc3Qgc3ViamVjdCA9IGluaXRTdHViQ29uZmlnKCkud2hlblBVVChcIi9lbmRwb2ludFwiKS50aGVuUmVzcG9uZChvaygpKS5jcmVhdGVCYWNrZW5kKCk7XG4gICAgY29uc3QgaHR0cCA9IG5ldyBIdHRwKHN1YmplY3QsIG5ldyBSZXF1ZXN0T3B0aW9ucygpKTtcblxuICAgIGh0dHAucHV0KFwiL2VuZHBvaW50XCIsIHt9KS5zdWJzY3JpYmUocmVzcCA9PiB7XG4gICAgICBleHBlY3QocmVzcC5vaykudG9CZSh0cnVlKTtcbiAgICB9KTtcblxuICAgIHN1YmplY3QudmVyaWZ5Tm9QZW5kaW5nUmVxdWVzdHMoKTtcbiAgfSk7XG5cbiAgaXQoXCJjYW4gc3R1YiBERUxFVEUgcmVxdWVzdHNcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHN1YmplY3QgPSBpbml0U3R1YkNvbmZpZygpLndoZW5ERUxFVEUoXCIvZW5kcG9pbnRcIikudGhlblJlc3BvbmQob2soKSkuY3JlYXRlQmFja2VuZCgpO1xuICAgIGNvbnN0IGh0dHAgPSBuZXcgSHR0cChzdWJqZWN0LCBuZXcgUmVxdWVzdE9wdGlvbnMoKSk7XG5cbiAgICBodHRwLmRlbGV0ZShcIi9lbmRwb2ludFwiKS5zdWJzY3JpYmUocmVzcCA9PiB7XG4gICAgICBleHBlY3QocmVzcC5vaykudG9CZSh0cnVlKTtcbiAgICB9KTtcblxuICAgIHN1YmplY3QudmVyaWZ5Tm9QZW5kaW5nUmVxdWVzdHMoKTtcbiAgfSk7XG5cbiAgaXQoXCJjYW4gc3R1YiBQQVRDSCByZXF1ZXN0c1wiLCAoKSA9PiB7XG4gICAgY29uc3Qgc3ViamVjdCA9IGluaXRTdHViQ29uZmlnKCkud2hlblBBVENIKFwiL2VuZHBvaW50XCIpLnRoZW5SZXNwb25kKG9rKCkpLmNyZWF0ZUJhY2tlbmQoKTtcbiAgICBjb25zdCBodHRwID0gbmV3IEh0dHAoc3ViamVjdCwgbmV3IFJlcXVlc3RPcHRpb25zKCkpO1xuXG4gICAgaHR0cC5wYXRjaChcIi9lbmRwb2ludFwiLCB7fSkuc3Vic2NyaWJlKHJlc3AgPT4ge1xuICAgICAgZXhwZWN0KHJlc3Aub2spLnRvQmUodHJ1ZSk7XG4gICAgfSk7XG5cbiAgICBzdWJqZWN0LnZlcmlmeU5vUGVuZGluZ1JlcXVlc3RzKCk7XG4gIH0pO1xuXG4gIGl0KFwiY2FuIHN0dWIgT1BUSU9OUyByZXF1ZXN0c1wiLCAoKSA9PiB7XG4gICAgY29uc3Qgc3ViamVjdCA9IGluaXRTdHViQ29uZmlnKCkud2hlbk9QVElPTlMoXCIvZW5kcG9pbnRcIikudGhlblJlc3BvbmQob2soKSkuY3JlYXRlQmFja2VuZCgpO1xuICAgIGNvbnN0IGh0dHAgPSBuZXcgSHR0cChzdWJqZWN0LCBuZXcgUmVxdWVzdE9wdGlvbnMoKSk7XG5cbiAgICBodHRwLm9wdGlvbnMoXCIvZW5kcG9pbnRcIiwge30pLnN1YnNjcmliZShyZXNwID0+IHtcbiAgICAgIGV4cGVjdChyZXNwLm9rKS50b0JlKHRydWUpO1xuICAgIH0pO1xuXG4gICAgc3ViamVjdC52ZXJpZnlOb1BlbmRpbmdSZXF1ZXN0cygpO1xuICB9KTtcblxuICBpdChcImNhbiBzdHViIGVudGlyZSByZXF1ZXN0c1wiLCAoKSA9PiB7XG4gICAgY29uc3QgcmVxdWVzdCA9IG5ldyBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogXCJwb3N0XCIsXG4gICAgICB1cmw6IGFic1VyaShcIi9lbmRwb2ludFwiKSxcbiAgICAgIGJvZHk6IHtmb286IFwiYmFyXCJ9XG4gICAgfSk7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBuZXcgUmVzcG9uc2UobmV3IFJlc3BvbnNlT3B0aW9ucyh7XG4gICAgICBzdGF0dXM6IDIwMSxcbiAgICAgIGJvZHk6IFwiY3JlYXRlZFwiXG4gICAgfSkpO1xuICAgIGNvbnN0IHN1YmplY3QgPSBpbml0U3R1YkNvbmZpZygpLndoZW5SZXF1ZXN0SXMocmVxdWVzdCkudGhlblJlc3BvbmQocmVzcG9uc2UpLmNyZWF0ZUJhY2tlbmQoKTtcbiAgICBjb25zdCBodHRwID0gbmV3IEh0dHAoc3ViamVjdCwgbmV3IFJlcXVlc3RPcHRpb25zKCkpO1xuXG4gICAgaHR0cC5wb3N0KGFic1VyaShcIi9lbmRwb2ludFwiKSwge2ZvbyA6XCJiYXJcIn0pLnN1YnNjcmliZShyZXNwID0+IHtcbiAgICAgIGV4cGVjdChyZXNwKS50b0VxdWFsKHJlc3BvbnNlKTtcbiAgICB9KTtcblxuICAgIHN1YmplY3QudmVyaWZ5Tm9QZW5kaW5nUmVxdWVzdHMoKTtcbiAgfSk7XG5cbn0pO1xuXG5kZXNjcmliZShcInJlc3BvbnNlIHNlbGVjdGlvblwiLCAoKSA9PiB7XG5cbiAgaXQoXCJyZXR1cm5zIHRoZSBsb3dlc3QgMnh4IHJlc3BvbnNlIGJ5IGRlZmF1bHRcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHN1YmplY3QgPSBSQU1MQmFja2VuZENvbmZpZy5pbml0V2l0aEZpbGUoXCIuL2Jhc2UvdGVzdGRhdGEvc3RhdHVzLWNvZGVzLnJhbWxcIilcbiAgICAgIC5zdHViQWxsKClcbiAgICAgIC5jcmVhdGVCYWNrZW5kKCk7XG4gICAgY29uc3QgaHR0cCA9IG5ldyBIdHRwKHN1YmplY3QsIG5ldyBSZXF1ZXN0T3B0aW9ucygpKTtcblxuICAgIGh0dHAuZ2V0KGFic1VyaShcIi9lbmRwb2ludFwiKSkuc3Vic2NyaWJlKHJlc3AgPT4ge1xuICAgICAgZXhwZWN0KHJlc3Auc3RhdHVzKS50b0JlKDIwMCk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGl0KFwiY2FuIHN0dWIgcmVzcG9uc2UgYnkgb25seSBzdGF0dXMgY29kZVwiLCAoKSA9PiB7XG4gICAgY29uc3Qgc3ViamVjdCA9IFJBTUxCYWNrZW5kQ29uZmlnLmluaXRXaXRoRmlsZShcIi4vYmFzZS90ZXN0ZGF0YS9zdGF0dXMtY29kZXMucmFtbFwiKVxuICAgICAgLndoZW5HRVQoXCIvZW5kcG9pbnRcIikudGhlblJlc3BvbmRXaXRoKDUwMClcbiAgICAgIC5jcmVhdGVCYWNrZW5kKCk7XG4gICAgY29uc3QgaHR0cCA9IG5ldyBIdHRwKHN1YmplY3QsIG5ldyBSZXF1ZXN0T3B0aW9ucygpKTtcblxuICAgIGh0dHAuZ2V0KFwiL2VuZHBvaW50XCIpLnN1YnNjcmliZShyZXNwID0+IHtcbiAgICAgIGV4cGVjdChyZXNwLnN0YXR1cykudG9CZSg1MDApO1xuICAgICAgZXhwZWN0KHJlc3AuanNvbigpKS50b0VxdWFsKHttZXNzYWdlOlwiaW50ZXJuYWwgc2VydmVyIGVycm9yXCJ9KTtcbiAgICB9KTtcblxuICAgIHN1YmplY3QudmVyaWZ5Tm9QZW5kaW5nUmVxdWVzdHMoKTtcbiAgfSk7XG5cbiAgaXQoXCJjYW4gc3R1YiBieSBvbmx5IHN0YXR1cyBjb2RlIGFuZCBleGFtcGxlIGlkXCIsICgpID0+IHtcbiAgICBjb25zdCBzdWJqZWN0ID0gUkFNTEJhY2tlbmRDb25maWcuaW5pdFdpdGhGaWxlKFwiLi9iYXNlL3Rlc3RkYXRhL3N0YXR1cy1jb2Rlcy5yYW1sXCIpXG4gICAgICAud2hlbkdFVChcIi9lbmRwb2ludFwiKS50aGVuUmVzcG9uZFdpdGgoMjAxLCBcIndpdGhFbnRpdHlJZFwiKVxuICAgICAgLmNyZWF0ZUJhY2tlbmQoKTtcbiAgICBjb25zdCBodHRwID0gbmV3IEh0dHAoc3ViamVjdCwgbmV3IFJlcXVlc3RPcHRpb25zKCkpO1xuXG4gICAgaHR0cC5nZXQoXCIvZW5kcG9pbnRcIikuc3Vic2NyaWJlKHJlc3AgPT4ge1xuICAgICAgZXhwZWN0KHJlc3AuanNvbigpKS50b0VxdWFsKHttZXNzYWdlOiBcImNyZWF0ZWRcIiwgZW50aXR5SWQ6IDQyfSk7XG4gICAgfSk7XG5cbiAgICBzdWJqZWN0LnZlcmlmeU5vUGVuZGluZ1JlcXVlc3RzKCk7XG4gIH0pO1xuXG4gIGl0KFwidGhyb3dzIGV4Y2VwdGlvbiBpZiBubyBleGFtcGxlcyBhcmUgZGVmaW5lZFwiLCAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHN1YmplY3QgPSBSQU1MQmFja2VuZENvbmZpZy5pbml0V2l0aEZpbGUoXCIuL2Jhc2UvdGVzdGRhdGEvc3RhdHVzLWNvZGVzLnJhbWxcIilcbiAgICAgICAgLndoZW5HRVQoXCIvZW5kcG9pbnRcIikudGhlblJlc3BvbmRXaXRoKDIwMCwgXCJub3RGb3VuZFwiKVxuICAgICAgZmFpbChcImRpZCBub3QgdGhyb3cgZXhjZXB0aW9uXCIpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGV4cGVjdChlKS50b0VxdWFsKG5ldyBJbnZhbGlkU3R1YmJpbmdFcnJvcihcImNvdWxkIG5vdCBmaW5kIGV4YW1wbGUgW25vdEZvdW5kXVwiKSk7XG4gICAgfVxuICB9KTtcblxuICBpdChcInRocm93cyBleGNlcHRpb24gaWYgbm8gZXhhbXBsZXMgYXJlIGRlZmluZWRcIiwgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBzdWJqZWN0ID0gUkFNTEJhY2tlbmRDb25maWcuaW5pdFdpdGhGaWxlKFwiLi9iYXNlL3Rlc3RkYXRhL3N0YXR1cy1jb2Rlcy5yYW1sXCIpXG4gICAgICAgIC53aGVuR0VUKFwiL2VuZHBvaW50XCIpLnRoZW5SZXNwb25kV2l0aCgyMDEsIFwibm90Rm91bmRcIilcbiAgICAgIGZhaWwoKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBleHBlY3QoZSkudG9FcXVhbChuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJjb3VsZCBub3QgZmluZCBleGFtcGxlIFtub3RGb3VuZF1cIikpO1xuICAgIH1cbiAgfSk7XG5cbiAgaXQoXCJ0aHJvd3MgZXhjZXB0aW9uIGlmIG5vIHJlc3AgZm91bmQgd2l0aCBzdGF0dXMgY29kZVwiLCAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIFJBTUxCYWNrZW5kQ29uZmlnLmluaXRXaXRoRmlsZShcIi4vYmFzZS90ZXN0ZGF0YS9zdGF0dXMtY29kZXMucmFtbFwiKS53aGVuR0VUKFwiL2VuZHBvaW50XCIpLnRoZW5SZXNwb25kV2l0aCg1NTUpO1xuICAgICAgZmFpbChcImRpZCBub3QgdGhyb3cgZXhjZXB0aW9uIGZvciB1bmRlZmluZWQgcmVzcG9uc2VcIilcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBleHBlY3QoZSkudG9FcXVhbChuZXcgSW52YWxpZFN0dWJiaW5nRXJyb3IoXCJ0aGVyZSBpcyBubyByZXNwb25zZSBkZWZpbmVkIHdpdGggc3RhdHVzIGNvZGUgNTU1IGluIHRoZSBSQU1MIGZpbGVcIikpO1xuICAgIH1cbiAgfSk7XG5cbn0pO1xuXG5kZXNjcmliZShcIkJvZHkgdmFsaWRhdGlvblwiLCAoKSA9PiB7XG5cbiAgaXQoXCJ2YWxpZGF0ZXMgcmVxdWVzdCBib2RpZXMgYXMgcGVyIGpzb24gc2NoZW1hXCIsICgpID0+IHtcbiAgICBjb25zdCBzdWJqZWN0ID0gY3JlYXRlU3ViamVjdChcIi4vYmFzZS90ZXN0ZGF0YS9lbmRwb2ludHMtd2l0aC1zY2hlbWFzLnJhbWxcIiksIGh0dHAgPSBuZXcgSHR0cChzdWJqZWN0LCBuZXcgUmVxdWVzdE9wdGlvbnMoKSk7XG4gICAgY29uc3Qgb25TdWNjZXNzID0gamFzbWluZS5jcmVhdGVTcHkoXCJvblN1Y2Nlc3NcIik7XG5cbiAgICB0cnkge1xuICAgICAgaHR0cC5wb3N0KGFic1VyaShcIi90aGluZ1wiKSwge3Byb3A6XCJhYlwifSkuc3Vic2NyaWJlKG9uU3VjY2Vzcyk7XG4gICAgICBmYWlsKFwiZGlkIG5vdCB0aHJvdyBleGNlcHRpb24gZm9yIGludmFsaWQgcmVxdWVzdCBib2R5XCIpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGV4cGVjdChvblN1Y2Nlc3MpLm5vdC50b0hhdmVCZWVuQ2FsbGVkKCk7XG4gICAgfVxuICB9KTtcblxuICBpdChcImNhbiByZWZlciB0byBzY2hlbWFzIGluIGZyYWdtZW50XCIsICgpID0+IHtcbiAgICBjb25zdCBzdWJqZWN0ID0gY3JlYXRlU3ViamVjdChcIi4vYmFzZS90ZXN0ZGF0YS9lbmRwb2ludHMtd2l0aC1zY2hlbWFzLnJhbWxcIiksIGh0dHAgPSBuZXcgSHR0cChzdWJqZWN0LCBuZXcgUmVxdWVzdE9wdGlvbnMoKSk7XG4gICAgY29uc3Qgb25TdWNjZXNzID0gamFzbWluZS5jcmVhdGVTcHkoXCJvblN1Y2Nlc3NcIik7XG5cbiAgICB0cnkge1xuICAgICAgaHR0cC5wb3N0KGFic1VyaShcIi9wcm9wdHlwZVwiKSwge3Byb3A6XCJhYlwifSkuc3Vic2NyaWJlKG9uU3VjY2Vzcyk7XG4gICAgICBmYWlsKFwiZGlkIG5vdCB0aHJvdyBleGNlcHRpb24gZm9yIGludmFsaWQgcmVxdWVzdCBib2R5XCIpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGV4cGVjdChvblN1Y2Nlc3MpLm5vdC50b0hhdmVCZWVuQ2FsbGVkKCk7XG4gICAgfVxuICB9KTtcblxufSk7XG4iXX0=
