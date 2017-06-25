import {MockBackend} from "@angular/http/testing";
import {loadApiSync, loadRAMLSync} from "raml-1-parser/dist/raml1/artifacts/raml10parser";

export class RamlBackend extends MockBackend {

  public doStuff() {
    const raml = loadRAMLSync("./github.raml", []);
    const api = loadApiSync("./github.raml");
    console.log(api.allResources()[0].absoluteUri());
  }

}
