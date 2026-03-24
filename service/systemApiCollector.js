const cleanJoinedPath = (basePath, routePath) => {
  const joined = `${basePath || ""}${routePath || ""}`.replace(/\/+/g, "/");
  return joined.startsWith("/") ? joined : `/${joined}`;
};

const extractMountPath = (layer) => {
  if (layer.path) return layer.path;
  if (!layer.regexp || !layer.regexp.source) return "";

  let source = layer.regexp.source;
  source = source
    .replace(/\\\/\?\(\?=\\\/\|\$\)/g, "")
    .replace(/\(\?=\\\/\|\$\)/g, "")
    .replace(/\\\//g, "/")
    .replace(/^\^/, "")
    .replace(/\$$/, "")
    .replace(/\(\?:\(\[\^\/]\+\?\)\)/g, ":param")
    .replace(/\(\[\^\/]\+\?\)/g, ":param");

  if (!source) return "";
  return source.startsWith("/") ? source : `/${source}`;
};

const collectRoutes = (stack, basePath = "") => {
  const routes = [];

  for (const layer of stack || []) {
    if (layer.route && layer.route.path) {
      const routePaths = Array.isArray(layer.route.path)
        ? layer.route.path
        : [layer.route.path];
      const methods = Object.keys(layer.route.methods || {})
        .filter((method) => layer.route.methods[method])
        .map((method) => method.toUpperCase());

      for (const routePath of routePaths) {
        const fullPath = cleanJoinedPath(basePath, String(routePath));
        for (const method of methods) {
          routes.push({ method, path: fullPath });
        }
      }
      continue;
    }

    if (layer.name === "router" && layer.handle && layer.handle.stack) {
      const mountPath = extractMountPath(layer);
      const nestedBasePath = cleanJoinedPath(basePath, mountPath);
      routes.push(...collectRoutes(layer.handle.stack, nestedBasePath));
    }
  }

  return routes;
};

const getAllApiRoutes = (app) => {
  const appStack = app?._router?.stack || [];
  const routes = collectRoutes(appStack).filter((item) => item.path.startsWith("/api"));

  return Array.from(
    new Map(routes.map((item) => [`${item.method}:${item.path}`, item])).values(),
  ).sort((a, b) => {
    if (a.path === b.path) return a.method.localeCompare(b.method);
    return a.path.localeCompare(b.path);
  });
};

module.exports = {
  getAllApiRoutes,
};
