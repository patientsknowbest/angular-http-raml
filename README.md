# angular-http-raml

This library provides a [RAML](http://raml.org) RAML-based `MockBackend` generator for testing Angular 4 applications.

Simply put, you can define your REST API using RAML, and use this definition to create
an angular Http object which speaks the same language as the API you defined.

## Installation

TODO

## Usage

### Prerequisities:

To understand the below walk-through, you need to have a basic understanding of the followings:

 * Angular 2+
 * RAML
 * Jasmine
 * Test doubles (mocks and stubs)

### Quickstart


This library generates stub HTTP backends

Let's assume your application interacts with the API defined by the following RAML file:

_person-api.raml_:

```
#%RAML 1.0
title: Endpoints for testing response selection based on status codes
version: v0
baseUri: http://api.example.com
mediaType: application/json
/person/{personId}/emails:
  get:
    responses:
      200:
        body:
          example:
            - email: "testuser@example.com"
              active: true
            - email: "test.user@example.com"
              active: false
      404:
        body:
          example:
            message: "not found"
  post:
    responses:
      201:
```


Let's also assume that you want to test the following Angular service:

_my-service.ts_:

```

export class MyService {
  
  constructor(private @Inject() http: Http) {}
  
  public fetchPersonEmails(personId: number): Observable<string[]> {
    return http.get("http://api.example.com/person/" + personId + "/emails")
        .map(response => response.json());
  }
  
}

```
 
_my-service.spec.ts_ :

```
describe("MyService", () => {
  
  it("queries the backend", () => {
    const mockBackend = RAMLBackendConfig.initWithFile("./person-api.raml")
      .stubAll()
      .createBackend();
    const http = new Http(mockBackend, new RequestOptions());
    const subject = new MyService(http);
    
    subject.fetchPersonEmails(123).subscribe(emails => {
      expect(emails).toEqual([
        {email: "testuser@example.com", active: true},
        {email: "test.user@example.com", active: false},
      ]);
    });
    
    mockBackend.verifyNoPendingRequests();
  });
  
});
```

Here is what happens when you run this test:

 * the ` RAMLBackendConfig.initWithFile("./person-api.raml")` call looks up the REST endpoints with their parameters. These are the possible calls to be used on the mock
 * the `stubAll()` call tells the `RAMLBackendConfig` instance to stub all requests defined in the RAML file. The responses will be the entities defined in the `example`
   node of the RAML definition (if present). 
 * then we instantiate a `Http` object which will use our generated `MockBackend`.
 * when your `MyService` method calls the `http.get(...)` method then the generated stub will know that the `GET http://api.example.com/person/123/emails` call matches
   the stubbed `GET /person/{personId}/emails` endpoint, so it will pick up the `example` array and return it as the response body. Unless you specify it otherwise it
   will look for a 2xx response in the listed responses.
 * the `MyService` instance receives the response (just like if it would be a real HTTP backend service), and publishes the result to the subscriber attached in the test.
   This subscriber will perform the assertion (if the response of `MyService` is correct). 

This was the quick-start of using the library. To sum up, if you develop a RAML file which includes example responses, then you generate a HTTP stub backend from it in a
few lines.

### Customizing stubbing




### Generating Mocks instead of Stubs

TODO
