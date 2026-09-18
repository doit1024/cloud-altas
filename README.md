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
python3 -m http.server 4173 --directory dist
```

然后打开 `http://127.0.0.1:4173/`。

项目入口为 `dist/index.html`，体积云渲染器位于 `dist/cloud-renderer.js`。
