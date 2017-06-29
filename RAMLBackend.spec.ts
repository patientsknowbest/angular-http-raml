import {RAMLBackend, URIPattern} from "./RAMLBackend";
import {Http, RequestOptions} from "@angular/http";

function absUri(path: string): string {
  return "http://dummy-endpoint" + path;
}


describe("RamlBackend", () => {

  function createSubject(path: string = "./test-endpoints.raml"): RAMLBackend {
    return new RAMLBackend().loadRAMLFromPath(path);
  }

  it("loads absolute endpoints", () => {
    const subject = createSubject("./only-endpoints.raml");

    expect(subject.endpoints).toEqual([
      "http://dummy-endpoint/auth",
      "http://dummy-endpoint/auth/token",
      'http://dummy-endpoint/create/whatever'
    ]);
  });

  it("returns 200 with example for found endpoints", () => {
    const subject = createSubject();

    const http = new Http(subject, new RequestOptions());

    http.get(absUri("/auth/token"))
      .subscribe(resp => {
        expect(resp.json()).toEqual({name: "John Smith"});
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

  fit("checks invalid query parameters", () => {
    const subject = createSubject(), http = new Http(subject, new RequestOptions());

    http.get(absUri("/queryparams?foo=bar&hello=world&invalid=asd"))
      .subscribe(resp => {
        expect(resp.status).toEqual(401);
        expect(resp.json().message).toEqual("undeclared query parameter [invalid] found in request");
      });

    subject.verifyNoPendingRequests();
  });

  it("checks headers" , () => {

  });

  it("checks the type of path params", () => {

  });

  it("no example, no examples", () => {

  });

})
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
