/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension filter-download.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/* global Nanobar, contentPage */
document.addEventListener("DOMContentLoaded", () => {
  const nanobar = new Nanobar({
    classname: "purify-progress-bar",
  });

  nanobar.go(10);

  const Checkbox = function (id, property, options) {
    options = options || {};
    const { negate } = options;
    const { hidden } = options;

    const element = document.querySelector(id);
    if (!hidden) {
      element.addEventListener("change", function () {
        contentPage.sendMessage({
          type: "changeUserSetting",
          key: property,
          value: negate ? !this.checked : this.checked,
        });
      });
    }

    const render = function () {
      if (hidden) {
        element.closest("li").style.display = "none";
        return;
      }
      let checked = userSettings.values[property];
      if (negate) {
        checked = !checked;
      }

      CheckboxUtils.updateCheckbox([element], checked);
    };

    const getPropertyName = () => property;

    const updateCheckboxValue = (value) => {
      let checked = value;
      if (negate) {
        checked = !checked;
      }
      CheckboxUtils.updateCheckbox([element], checked);
    };

    return {
      render,
      getPropertyName,
      updateCheckboxValue,
    };
  };

  const checkboxes = [];

  checkboxes.push(new Checkbox("#block_porn", userSettings.names.BLOCK_PORN));
  checkboxes.push(new Checkbox("#block_sexy", userSettings.names.BLOCK_SEXY));
  checkboxes.push(
    new Checkbox("#block_bloody", userSettings.names.BLOCK_BLOODY)
  );
  checkboxes.push(
    new Checkbox("#block_bloodshed", userSettings.names.BLOCK_BLOODSHED)
  );
  checkboxes.push(
    new Checkbox("#block_blacklist", userSettings.names.BLOCK_BLACKLIST)
  );
  checkboxes.push(new Checkbox("#block_ads", userSettings.names.BLOCK_ADS));

  function onLoaded() {
    nanobar.go(100);
    setTimeout(() => {
      if (window) {
        contentPage.sendMessage({ type: "openThankYouPage" });
      }
    }, 2000);
  }

  function checkRequestFilterReady() {
    contentPage.sendMessage({ type: "checkRequestFilterReady" }, (response) => {
      if (response.ready) {
        onLoaded();
      } else {
        setTimeout(checkRequestFilterReady, 20000);
      }
    });
  }

  checkRequestFilterReady();
});
