import { Configuration, FrontendApi } from '@ory/client';
import { env } from '@/lib/env';

export const kratosConfig = new Configuration({
  basePath: typeof window === 'undefined' ? env.kratos.publicUrl : window.location.origin,
});

export const kratos = new FrontendApi(kratosConfig);
