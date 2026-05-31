import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import {
  DEFAULT_LANGUAGE,
  DEFAULT_NAMESPACE,
  NAMESPACES,
  SUPPORTED_LANGUAGES,
} from "./config";

import enCommon from "./locales/en-US/common.json";
import enEditor from "./locales/en-US/editor.json";
import enSettings from "./locales/en-US/settings.json";
import enStartup from "./locales/en-US/startup.json";
import enLoading from "./locales/en-US/loading.json";
import enErrors from "./locales/en-US/errors.json";
import enProject from "./locales/en-US/project.json";

import zhCommon from "./locales/zh-CN/common.json";
import zhEditor from "./locales/zh-CN/editor.json";
import zhSettings from "./locales/zh-CN/settings.json";
import zhStartup from "./locales/zh-CN/startup.json";
import zhLoading from "./locales/zh-CN/loading.json";
import zhErrors from "./locales/zh-CN/errors.json";
import zhProject from "./locales/zh-CN/project.json";

const resources = {
  "en-US": {
    common: enCommon,
    editor: enEditor,
    settings: enSettings,
    startup: enStartup,
    loading: enLoading,
    errors: enErrors,
    project: enProject,
  },
  "zh-CN": {
    common: zhCommon,
    editor: zhEditor,
    settings: zhSettings,
    startup: zhStartup,
    loading: zhLoading,
    errors: zhErrors,
    project: zhProject,
  },
} as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    ns: NAMESPACES,
    defaultNS: DEFAULT_NAMESPACE,
    interpolation: {
      escapeValue: false,
    },
    // Persistence lives in useSettingsStore; here we only auto-detect.
    detection: {
      order: ["navigator"],
      caches: [],
    },
    returnNull: false,
  });

export default i18n;
