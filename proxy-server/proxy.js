const Koa = require("koa");
const cors = require("@koa/cors");
const proxy = require("koa-proxies");
const app = new Koa();

const port = process.env.PORT || 8889;

app.use(cors());

app.use(
  proxy("/", {
    //target: "http://localhost:8888",
    target: "http://weed1.judahsoftware.com:8888/",
    changeOrigin: true,
    logs: true,
  })
);

app.listen(port);
console.log(`listening on port ${port}`);