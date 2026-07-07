// Small floating "back to dashboard" link injected into every mounted app,
// so each tool stays otherwise untouched but is still reachable as part of
// the unified platform. Path is relative to apps/<name>/index.html.
(function () {
  const link = document.createElement("a");
  link.href = "../../index.html";
  link.textContent = "← 30080 Utility";
  link.className = "platform-dash-link";
  document.body.appendChild(link);
})();
