import { Configuration, FrontendApi } from "@ory/client";

export const kratosConfig = new Configuration({
  basePath: "http://localhost:8081",
});

export const kratos = new FrontendApi(kratosConfig);
