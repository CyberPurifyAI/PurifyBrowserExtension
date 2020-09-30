

/* global I18nHelper, i18n */

i18n.translateElement = function (element, messageId, args) {
  const message = i18n.getMessage(messageId, args);
  I18nHelper.translateElement(element, message);
};

document.addEventListener("DOMContentLoaded", () => {
  [].slice.call(document.querySelectorAll("[i18n]")).forEach((el) => {
    const message = i18n.getMessage(el.getAttribute("i18n"));
    I18nHelper.translateElement(el, message);
  });
  [].slice.call(document.querySelectorAll("[i18n-plhr]")).forEach((el) => {
    el.setAttribute(
      "placeholder",
      i18n.getMessage(el.getAttribute("i18n-plhr"))
    );
  });
  [].slice.call(document.querySelectorAll("[i18n-href]")).forEach((el) => {
    el.setAttribute("href", i18n.getMessage(el.getAttribute("i18n-href")));
  });
  [].slice.call(document.querySelectorAll("[i18n-title]")).forEach((el) => {
    el.setAttribute("title", i18n.getMessage(el.getAttribute("i18n-title")));
  });
});
