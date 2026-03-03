import { Configuration, FrontendApi } from "@ory/client";
import { env } from "@/lib/env";

console.log("Kratos Public URL:", env.kratos.publicUrl);

export const kratosConfig = new Configuration({
  basePath: env.kratos.publicUrl,
});

export const kratos = new FrontendApi(kratosConfig);
