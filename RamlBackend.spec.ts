import {RamlBackend, URIPattern} from "./RamlBackend";
import {Http, RequestOptions} from "@angular/http";

describe("RamlBackend", () => {

  function createSubject(path: string = "./test-endpoints.raml"): RamlBackend {
    return new RamlBackend().loadRAMLFromPath(path);
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

    http.get("http://dummy-endpoint/auth/token")
      .subscribe(resp => {
        expect(resp.json()).toEqual({name: "John Smith"});
      });

    subject.verifyNoPendingRequests();
  });

  it("takes method into account when looking for response", () => {
    const subject = createSubject(), http = new Http(subject, new RequestOptions());

    http.post("http://dummy-endpoint/auth/token", {}).subscribe(resp => {
      expect(resp.status).toEqual(201);
      expect(resp.json()).toEqual({message: "created"});
    });

    subject.verifyNoPendingRequests();
  });

  it("uses the 0th example if there are more than one", () => {
    const subject = createSubject(), http = new Http(subject, new RequestOptions());

    http.get("http://dummy-endpoint/create/whatever").subscribe(resp => {
      expect(resp.status).toEqual(200);
      expect(resp.json()).toEqual({name: "Alice"});
    });

    subject.verifyNoPendingRequests();
  });

  it("matches path parameters", () => {
    const subject = createSubject(), http = new Http(subject, new RequestOptions());

    http.get("http://dummy-endpoint/person/123/456").subscribe(resp => {
      expect(resp.status).toEqual(200);
    });

    subject.verifyNoPendingRequests();
  });

  it("checks invalid query parameters", () => {

  });

  it("checks headers" , () => {

  });

  it("checks the type of path params", () => {

  });

  it("no example, no examples", () => {

  });

})


describe("URIPattern", () => {

  function absUri(path: string): string {
    return "http://dummy-endpoint" + path;
  }

  function createSubject(path: string): URIPattern {
    return new URIPattern(absUri(path));
  }

  it("returns empty result on matching parameterless URI", () => {
    expect(createSubject("/person").matches(absUri("/person"))).toEqual({});
  });

  fit("returns param map for match", () => {
    const actual = createSubject("/person/{personId}/{otherParam}").matches(absUri("/person/123/foo"));
    expect(actual).toEqual({personId: "123", otherParam: "foo"});
  });

});
