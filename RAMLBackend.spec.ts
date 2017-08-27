import {RAMLBackend, URIPattern} from "./RAMLBackend";
import {Http, Request, RequestOptions, Response, ResponseOptions} from "@angular/http";
import {InvalidStubbingError, RAMLBackendConfig} from "./RAMLBackendConfig";



function absUri(path: string): string {
  return "http://dummy-endpoint" + path;
}

function ok() {
  return new Response(new ResponseOptions({
    status: 200,
    body: ""
  }));
}

function createSubject(path: string = "./base/testdata/test-endpoints.raml"): RAMLBackend {
  return RAMLBackendConfig.initWithFile(path)
    .stubAll()
    .createBackend();
}

describe("RAMLBackend", () => {

  it("returns 200 with example for found endpoints", () => {
    const subject = createSubject(), http = new Http(subject, new RequestOptions());

    http.get(absUri("/auth/token"))
      .subscribe(resp => {
        expect(resp.json()).toEqual({name: "John Snow"});
      });

    subject.verifyNoPendingRequests();
  });

  it("takes method into account when looking for response", () => {
    const subject = createSubject(), http = new Http(subject, new RequestOptions());

    http.post(absUri("/auth/token"), {}).subscribe(resp => {
      expect(resp.status).toEqual(201);
      expect(resp.json()).toEqual({message: "created"});
    });

    subject.verifyNoPendingRequests();
  });

  it("matches path parameters", () => {
    const subject = createSubject(), http = new Http(subject, new RequestOptions());

    http.get(absUri("/person/123/456")).subscribe(resp => {
      expect(resp.status).toEqual(200);
    });

    subject.verifyNoPendingRequests();
  });

  it("checks invalid query parameters", () => {
    const subject = createSubject(), http = new Http(subject, new RequestOptions());

    http.get(absUri("/queryparams?foo=bar&hello=world&invalid=asd"))
      .subscribe(resp => {
        expect(resp.status).toEqual(401);
        expect(resp.json().message).toEqual("undeclared query parameter [invalid] found in request");
      });

    subject.verifyNoPendingRequests();
  });

  xit("checks headers" , () => {
    const subject = createSubject(), http = new Http(subject, new RequestOptions());

    http.get("").subscribe(resp => {

    });

    subject.verifyNoPendingRequests();
  });

  xit("checks the type of path params", () => {

  });

  xit("no example, no examples", () => {

  });

});

describe("URIPattern", () => {


  function createSubject(path: string): URIPattern {
    return new URIPattern(absUri(path));
  }

  it("returns empty result on matching parameterless URI", () => {
    expect(createSubject("/person").matches(absUri("/person"))).toEqual({});
  });

  it("returns param map for match", () => {
    const actual = createSubject("/person/{personId}/{otherParam}/dummy/{thirdParam}").matches(absUri("/person/123/foo/dummy/bar"));
    expect(actual).toEqual({personId: "123", otherParam: "foo", thirdParam: "bar"});
  });

});

describe("explicit stubs", () => {

  function initStubConfig() {
    return RAMLBackendConfig.initWithFile("./base/testdata/stub-base.raml").stubAll();
  }

  it("overrides 'example' responses", ()  => {
    const explicitAccessToken = "ACCT456";
    const subject = initStubConfig()
      .whenGET("/endpoint").thenRespond(new Response(new ResponseOptions({
        status: 200,
        body: JSON.stringify({access_token: "ACCT456"})
      })))
      .createBackend();

     const http = new Http(subject, new RequestOptions());
    http.get(absUri("/endpoint")).subscribe(resp => {
       expect(resp.json()).toEqual({access_token: explicitAccessToken});
   })

  });

  it("refuses invalid paths", () => {
    try {
      initStubConfig().whenGET("/nonexistent");
      fail("did not refuse nonexistent endpoint");
    } catch (e) {
      expect(e).toEqual(new InvalidStubbingError("found no declaration of request [GET /nonexistent] in RAML - refusing to stub"))
    }
  });

  it("refuses invalid methods", () => {
    try {
      initStubConfig().whenHEAD("/endpoint");
      fail("did not refuse undefined HEAD method")
    } catch (e) {
      expect(e).toEqual(new InvalidStubbingError("found no declaration of request [HEAD /endpoint] in RAML - refusing to stub"))
    }
  });

  it("refuses invalid query params", () => {
    try {
      const subject = initStubConfig()
        .whenGET("/endpoint?qp0=val&foo=bar").thenRespond(new Response(new ResponseOptions({
          status: 200,
          body: JSON.stringify({access_token: 456})
        })))
        .createBackend();
      fail("did not fail for invalid query parameter")
    } catch (e) {
      expect(e).toEqual(new InvalidStubbingError("undeclared query parameter [foo] found in request"));
    }
  });

  it("refuses invalid response bodies", () => {
    try {
      const subject = initStubConfig().whenGET("/endpoint")
        .thenRespond(new Response(new ResponseOptions({
          status: 200,
          body: JSON.stringify({invalidKey: 123})
        })));
      fail("did not throw exception for invalid response body");
    } catch (e) {
      expect(e).toEqual(new InvalidStubbingError("invalid stub response body"));
    }
  });

  it("also validates non-object response bodies", () => {
    try {
      initStubConfig().whenPOST("/endpoint").thenRespond(new Response(new ResponseOptions({
        status: 201,
        body: "gg wp"
      })));
      fail("did not throw exception for invalid response body");
    } catch (e) {
      expect(e).toEqual(new InvalidStubbingError("invalid stub response body"));
    }
  });

  it("fails if there is pending behavior (unset response)", () => {
    try {
      const subject = initStubConfig();
      subject.whenGET("/endpoint");
      subject.whenPOST("/endpoint");
      fail("did not throw exception for unfinished behavior");
    } catch (e) {
      expect(e).toEqual(new InvalidStubbingError("unfinished behavior definition: cannot configure POST http://dummy-endpoint/endpoint " +
        "before setting the response for GET http://dummy-endpoint/endpoint"));
    }
  });

  it("can chain multiple stubbing", () => {
    initStubConfig().whenGET("/endpoint").thenRespond(new Response(new ResponseOptions({
      status: 200, body: "{\"access_token\":\"xxx\"}"
      })
    )).whenPOST("/endpoint").thenRespond(new Response(new ResponseOptions({status: 201, body: "Created"})));
  });

  it("can stub POST requests", () => {
    const subject = initStubConfig().whenPOST("/endpoint").thenRespond(ok()).createBackend();
    const http = new Http(subject, new RequestOptions());

    http.post("/endpoint", {}).subscribe(resp => {
      expect(resp.ok).toBe(true);
    });

    subject.verifyNoPendingRequests();
  });

  it("can stub PUT requests", () => {
    const subject = initStubConfig().whenPUT("/endpoint").thenRespond(ok()).createBackend();
    const http = new Http(subject, new RequestOptions());

    http.put("/endpoint", {}).subscribe(resp => {
      expect(resp.ok).toBe(true);
    });

    subject.verifyNoPendingRequests();
  });

  it("can stub DELETE requests", () => {
    const subject = initStubConfig().whenDELETE("/endpoint").thenRespond(ok()).createBackend();
    const http = new Http(subject, new RequestOptions());

    http.delete("/endpoint").subscribe(resp => {
      expect(resp.ok).toBe(true);
    });

    subject.verifyNoPendingRequests();
  });

  it("can stub PATCH requests", () => {
    const subject = initStubConfig().whenPATCH("/endpoint").thenRespond(ok()).createBackend();
    const http = new Http(subject, new RequestOptions());

    http.patch("/endpoint", {}).subscribe(resp => {
      expect(resp.ok).toBe(true);
    });

    subject.verifyNoPendingRequests();
  });

  it("can stub OPTIONS requests", () => {
    const subject = initStubConfig().whenOPTIONS("/endpoint").thenRespond(ok()).createBackend();
    const http = new Http(subject, new RequestOptions());

    http.options("/endpoint", {}).subscribe(resp => {
      expect(resp.ok).toBe(true);
    });

    subject.verifyNoPendingRequests();
  });

  it("can stub entire requests", () => {
    const request = new Request({
      method: "post",
      url: absUri("/endpoint"),
      body: {foo: "bar"}
    });
    const response = new Response(new ResponseOptions({
      status: 201,
      body: "created"
    }));
    const subject = initStubConfig().whenRequestIs(request).thenRespond(response).createBackend();
    const http = new Http(subject, new RequestOptions());

    http.post(absUri("/endpoint"), {foo :"bar"}).subscribe(resp => {
      expect(resp).toEqual(response);
    });

    subject.verifyNoPendingRequests();
  });

});

describe("response selection", () => {

  it("returns the lowest 2xx response by default", () => {
    const subject = RAMLBackendConfig.initWithFile("./base/testdata/status-codes.raml")
      .stubAll()
      .createBackend();
    const http = new Http(subject, new RequestOptions());

    http.get(absUri("/endpoint")).subscribe(resp => {
      expect(resp.status).toBe(200);
    });
  });

  it("can stub response by only status code", () => {
    const subject = RAMLBackendConfig.initWithFile("./base/testdata/status-codes.raml")
      .whenGET("/endpoint").thenRespondWith(500)
      .createBackend();
    const http = new Http(subject, new RequestOptions());

    http.get("/endpoint").subscribe(resp => {
      expect(resp.status).toBe(500);
      expect(resp.json()).toEqual({message:"internal server error"});
    });

    subject.verifyNoPendingRequests();
  });

  it("can stub by only status code and example id", () => {
    const subject = RAMLBackendConfig.initWithFile("./base/testdata/status-codes.raml")
      .whenGET("/endpoint").thenRespondWith(201, "withEntityId")
      .createBackend();
    const http = new Http(subject, new RequestOptions());

    http.get("/endpoint").subscribe(resp => {
      expect(resp.json()).toEqual({message: "created", entityId: 42});
    });

    subject.verifyNoPendingRequests();
  });

  it("throws exception if no examples are defined", () => {
    try {
      const subject = RAMLBackendConfig.initWithFile("./base/testdata/status-codes.raml")
        .whenGET("/endpoint").thenRespondWith(200, "notFound")
      fail("did not throw exception");
    } catch (e) {
      expect(e).toEqual(new InvalidStubbingError("could not find example [notFound]"));
    }
  });

  it("throws exception if no examples are defined", () => {
    try {
      const subject = RAMLBackendConfig.initWithFile("./base/testdata/status-codes.raml")
        .whenGET("/endpoint").thenRespondWith(201, "notFound")
      fail();
    } catch (e) {
      expect(e).toEqual(new InvalidStubbingError("could not find example [notFound]"));
    }
  });

  it("throws exception if no resp found with status code", () => {
    try {
      RAMLBackendConfig.initWithFile("./base/testdata/status-codes.raml").whenGET("/endpoint").thenRespondWith(555);
      fail("did not throw exception for undefined response")
    } catch (e) {
      expect(e).toEqual(new InvalidStubbingError("there is no response defined with status code 555 in the RAML file"));
    }
  });

});

describe("Body validation", () => {

  it("validates request bodies as per json schema", () => {
    const subject = createSubject("./base/testdata/endpoints-with-schemas.raml"), http = new Http(subject, new RequestOptions());
    const onSuccess = jasmine.createSpy("onSuccess");

    try {
      http.post(absUri("/thing"), {prop:"ab"}).subscribe(onSuccess);
      fail("did not throw exception for invalid request body");
    } catch (e) {
      expect(onSuccess).not.toHaveBeenCalled();
    }
  });

  it("can refer to schemas in fragment", () => {
    const subject = createSubject("./base/testdata/endpoints-with-schemas.raml"), http = new Http(subject, new RequestOptions());
    const onSuccess = jasmine.createSpy("onSuccess");

    try {
      http.post(absUri("/proptype"), {prop:"ab"}).subscribe(onSuccess);
      fail("did not throw exception for invalid request body");
    } catch (e) {
      expect(onSuccess).not.toHaveBeenCalled();
    }
  });

});
