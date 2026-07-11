export default async function handler(req, res) {
  const { default: app } = await import("../dist/index.js");
  req.url = "/api" + req.url;
  return app(req, res);
}
