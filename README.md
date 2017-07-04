<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [angular-http-raml](#angular-http-raml)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Prerequisities:](#prerequisities)
    - [Quickstart](#quickstart)
    - [Customizing stubbing](#customizing-stubbing)
      - [Changing the response by response code](#changing-the-response-by-response-code)
      - [Using an other example response body](#using-an-other-example-response-body)
      - [Passing an entire request](#passing-an-entire-request)
      - [Safety nets while mocking](#safety-nets-while-mocking)
    - [Generating Mocks instead of Stubs](#generating-mocks-instead-of-stubs)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

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
  
  constructor(private http: Http) {}
  
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

#### Changing the response by response code


RAML lets you describe responses with multiple response codes. By default, angular-http-raml will choose the response with the lowest 2xx status code, but you can simply
override this behavior. Example (using the above listed `person-api.raml`):

```
// ...
  const mockBackend = RAMLBackendConfig.initWithFile("./person-api.raml")
   .stubAll()
   .whenGET("/person/123/emails").thenRespondWith(404)
   .createBackend();
// ...
```

This configuration will override the default stubbing and tell the RAMLBackend to send the 404 response instead of the default 200. The response body will be `{"message":"not found"}`
as it is defined in the RAML file.

#### Using an other example response body
 
RAML lets you define multiple example response bodies for a response. angular-http-raml lets you easily switch between them. Let's consider the following RAML definition of an endpoint:

``` 
/person/{personId}/emails:
  get:
    responses:
      200:
        body:
          examples:
            hasEmails:
              - email: "testuser@example.com"
                active: true
              - email: "test.user@example.com"
                active: false
            emptyList: []
```

In this RAML definition there are 2 example responses (both with 200 response code). They are called `hasEmails` and `emptyList`. By default the `RAMLBackend` instance would return the 
first example response it finds (`hasEmails`), override it by passing `emptyList` as the 2nd parameter of `thenRespondWith()`:

```
const mockBackend = RAMLBackendConfig.initWithFile("./person-api.raml")
  .stubAll()
  .whenGET("/person/123/emails").thenRespondWith(404, "emptyList")
  .createBackend();
```

#### Passing an entire request

If the above two methods of overriding default responses - eg. because the response body you want to test with is different from the examples available in RAML - then you can explicitly
pecify the entire request to be sent back from the server by calling `thenRespond()` instead of `thenRespondWith()` :

```
const mockBackend = initStubConfig()
      .whenGET("/person/123/emails").thenRespond(new Response(new ResponseOptions({
        status: 200,
        body: JSON.stringify([{email:null, active: false}]);
      })))
      .createBackend();
``` 

#### Safety nets while mocking



### Generating Mocks instead of Stubs

TODO
