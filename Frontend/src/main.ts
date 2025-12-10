import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { provideHttpClient } from '@angular/common/http';

const configWithHttp = {
  ...appConfig,
  providers: [
    ...(appConfig.providers || []),
    provideHttpClient() 
  ]
};

bootstrapApplication(App, configWithHttp)
  .catch((err) => console.error(err));