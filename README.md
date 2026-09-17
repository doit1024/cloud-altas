# 云境 · 3D 云图鉴

一个不依赖第三方资源的 Web 3D 云图鉴。使用 WebGL 2 片元着色器与体积光线步进，程序化还原五种常见云型：

- 积雨云（Cumulonimbus）
- 层积云（Stratocumulus）
- 卷云（Cirrus）
- 积云（Cumulus）
- 层云（Stratus）

## 交互

- 点击云型切换体积结构与科普信息
- 拖拽画面旋转视角
- 滚轮缩放
- 调节云量与日光强度
- 开启或关闭自动旋转

## 本地运行

在项目目录运行任意静态文件服务器，例如：

```bash
python3 -m http.server 4173 --directory dist
```

然后打开 `http://127.0.0.1:4173/`。

项目入口为 `dist/index.html`，所有样式、交互和着色器均封装在该文件中。
