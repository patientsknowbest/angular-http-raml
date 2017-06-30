import {RAMLBackend, URIPattern} from "./RAMLBackend";
import {Http, Request, RequestOptions, Response, ResponseOptions} from "@angular/http";
import {RAMLBackendConfig} from "./RAMLBackendConfig";

function absUri(path: string): string {
  return "http://dummy-endpoint" + path;
}


describe("RAMLBackend", () => {

  function createSubject(path: string = "./test-endpoints.raml"): RAMLBackend {
    return RAMLBackendConfig.initWithFile(path)
      .stubAll()
      .createBackend();
  }

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

  it("uses the 0th example if there are more than one", () => {
    const subject = createSubject(), http = new Http(subject, new RequestOptions());

    http.get(absUri("/create/whatever")).subscribe(resp => {
      expect(resp.status).toEqual(200);
      expect(resp.json()).toEqual({name: "Alice"});
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
    return RAMLBackendConfig.initWithFile("./stub-base.raml");
  }

  it("overrides 'example' responses", ()  => {
    const subject = initStubConfig()
      .whenGET("/endpoint").thenRespond(new Response(new ResponseOptions({
        status: 200,
        body: JSON.stringify({access_token: 456})
      })))
      .createBackend();
     const http = new Http(subject, new RequestOptions());

     http.get("/endpoint").subscribe(resp => {
       expect(resp.json()).toEqual({access_token: 456});
   })

  });

  it("refuses invalid paths", () => {
    try {
      initStubConfig().whenGET("/nonexistent");
      fail("did not refuse nonexistent endpoint");
    } catch (e) {
      expect(e.message).toEqual("found no declaration of request [GET /nonexistent] in RAML - refusing to stub")
    }
  });

  it("refuses invalid methods", () => {
    try {
      initStubConfig().whenHEAD("/endpoint");
      fail("did not refuse undefined HEAD method")
    } catch (e) {
      expect(e.message).toEqual("found no declaration of request [HEAD /endpoint] in RAML - refusing to stub")
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
      expect(e.message).toEqual("undeclared query parameter [foo] found in request")
    }
  });

  it("fails if there is pending behavior (unset response)", () => {
    try {
      const subject = initStubConfig();
      subject.whenGET("/endpoint");
      subject.whenPOST("/endpoint");
      fail("did not throw exception for unfinished behavior");
    } catch (e) {
      expect(e.message).toBe("unfinished behavior definition: cannot configure POST http://dummy-endpoint/endpoint " +
        "before setting the response for GET http://dummy-endpoint/endpoint");
    }
  });

  it("can chain multiple stubbing", () => {
    initStubConfig().whenGET("/endpoint").thenRespond(new Response(new ResponseOptions({
      status: 200, body: ""
      })
    )).whenPOST("/endpoint").thenRespond(new Response(new ResponseOptions({status: 201, body: "Created"})));
  });

  it("can stub POST requests", () => {
    const subject = initStubConfig().whenPOST("/endpoint");
  });

});