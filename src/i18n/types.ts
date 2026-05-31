import "i18next";

import type common from "./locales/en-US/common.json";
import type editor from "./locales/en-US/editor.json";
import type settings from "./locales/en-US/settings.json";
import type startup from "./locales/en-US/startup.json";
import type loading from "./locales/en-US/loading.json";
import type errors from "./locales/en-US/errors.json";
import type project from "./locales/en-US/project.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: typeof common;
      editor: typeof editor;
      settings: typeof settings;
      startup: typeof startup;
      loading: typeof loading;
      errors: typeof errors;
      project: typeof project;
    };
  }
}
