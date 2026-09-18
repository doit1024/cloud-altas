# 云境 · 3D 云图鉴

一个不依赖第三方运行时资源的 Web 3D 云图鉴。使用 WebGL 2、预生成的 3D Perlin–Worley 噪声、包络侵蚀与体积光线步进，程序化还原常见云型。体积光照包含 Beer–Lambert 吸收、向光采样、双叶各向异性相位函数与多重散射近似，算法方向参考 Nubis Envelope Model 与 `three-volumetric-clouds` 实验项目。

- 积雨云（Cumulonimbus）
- 层积云（Stratocumulus）
- 卷云（Cirrus）
- 卷积云（Cirrocumulus）
- 高积云（Altocumulus）
- 高层云（Altostratus）
- 雨层云（Nimbostratus）
- 积云（Cumulus）

## 交互

- 点击云型切换体积结构与科普信息
- 拖拽画面旋转视角
- 滚轮缩放
- 调节云量与日光强度

## 本地运行

在项目目录运行任意静态文件服务器，例如：

```bash
npm run preview
```

或：

```bash
python3 -m http.server 4173 --directory dist
```

然后打开 `http://127.0.0.1:4173/cloud-altas/`。

用 Wrangler 模拟线上路由：

```bash
npm install
npm run dev
```

然后打开 `http://127.0.0.1:8787/cloud-altas/`。

项目入口为 `dist/cloud-altas/index.html`，体积云渲染器位于 `dist/cloud-altas/cloud-renderer.js`。

## 部署

Cloudflare Workers 静态资源（Worker 名 `cloud-altas`），路由 `www.doooit.me/cloud-altas*`，线上地址：

[https://www.doooit.me/cloud-altas](https://www.doooit.me/cloud-altas)

```bash
npm install
npm run deploy
```

首次部署需要本机已登录 Wrangler（`npx wrangler login`）或设置 `CLOUDFLARE_API_TOKEN`。在 Cloudflare Dashboard 把本仓库接到该 Worker 的 Workers Builds 后，推送到 `main` 会自动部署（无需额外 build command，deploy command 用默认的 `npx wrangler deploy` 即可）。
