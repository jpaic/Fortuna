export default async function handler(req, res) {
  const { default: app } = await import("../dist/index.js");
  return app(req, res);
}
