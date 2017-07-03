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
    const mockBackend = RAMLBackendConfig.initWithFile("./person-api.raml").createBackend();
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
