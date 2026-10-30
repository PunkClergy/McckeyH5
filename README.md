# WiseLink Auto Ride H5（由 MCCKey 精简迁移）

场景：纯 H5（uni-app Vue3，浏览器运行）。已按确认范围裁剪：**无地图、无蓝牙、无登录体系、无车辆/钥匙管理等旧桌面端遗留接口**。**全站无需登录**：分享链接带参数进入后直接查询车辆，完成云端控车、查看照片与还车拍照；不设登录页、登录按钮与 token 逻辑。支持中 / 英 / 西三语切换（默认英文）。

## 一、目录结构

```
McckeyH5/
├── App.vue                      # 全局：仅版本号，无登录态读取
├── main.js / index.html         # Vue3 入口与 H5 壳（模板保留）
├── manifest.json                # H5 配置（hash 路由、标题）；原生权限清单已清空
├── pages.json                   # 2 个页面路由，自定义导航栏
├── api/
│   ├── index.js
│   └── home.js                  # 3 个封装接口（查码/查车/控车）
├── utils/
│   ├── request/http.js          # uni.request 统一封装（直连线上域名 + 拦截器）
│   ├── urlParams.js             # 合并 options / location.search / hash query，兼容根路径 ?code= 链接
│   ├── langOptions.js            # 语种下拉清单 LANG_OPTIONS，新增语种在此追加
│   ├── langtips.js              # 文案字典（按语种 key 分组，可扩展）
│   └── langtitle.js             # 页面标题双语
└── pages/
    ├── index/index.vue           # 控车台：解析链接参数(code/mobile)查车 + 开锁/关锁/寻车 + 查看照片 + 还车入口
    └── returnPhotos/index.vue    # 5 张还车照片采集/上传 + 提交还车
```

## 二、接口台账（共 5 个业务接口，统一直连 `https://k1sw.wiselink.net.cn`）

| # | 函数 / 位置 | 方法 / Content-Type | 完整请求地址 | 主要入参 | 用途 | 调用页面 |
|---|---|---|---|---|---|---|
| 1 | `u_getControlCodeByMobile` | GET（query） | `https://k1sw.wiselink.net.cn/renterApi/getControlCodeByMobile` | `mobile` | 按手机号取控制码列表，取首条 `controlcode`（链接 `mobile` 参数场景） | index |
| 2 | `u_getCarPoisitonByCode` | POST / form | `https://k1sw.wiselink.net.cn/renterApi/getCarPoisitonByCode` | `code`（控制码） | 取车辆信息：`sn`、`plateNumber`、`startDate/endDate`、`latitude/longitude`、历史照片字段 | index |
| 3 | `u_operation` | POST / form | `https://k1sw.wiselink.net.cn/renterApi/operation` | `sn`、`operationType`（3=开锁 / 1=关锁 / 5=鸣笛寻车）、`code`、`_timestamp` | 云端远程控车 | index |
| 4 | 直写 `uni.uploadFile` | POST / multipart/form-data | `https://k1sw.wiselink.net.cn/renterApi/saveImg` | `formData.code`；文件字段 `img1Arr`~`img5Arr`（车头/车尾/左/右/钥匙位） | 5 张还车照片逐张上传 | returnPhotos |
| 5 | 直写 `uni.request` | POST / form | `https://k1sw.wiselink.net.cn/renterApi/returnCar` | `code` | 照片上传完成后提交还车 | returnPhotos |

**请求公共头**（`utils/request/http.js` 拦截器自动注入；还车页两个直写请求手动注入）：

| Header | 取值来源 |
|---|---|
| `funAreaId` | 固定 `1760`（沿用 MCCKey） |
| `lang` | `zhCn→zh_CN`、`enUs→en_US`、`esEs→es_ES`；来自缓存 `language`，缺省 `en_US`（默认英文） |
| `timestamp` | 还车页直写请求携带 `Date.parse(new Date())`；封装层控车接口由 `_timestamp` 业务字段承载；全站不使用 token |
| `content-type` | form 接口 `application/x-www-form-urlencoded`，其余 JSON；图片上传由 `uni.uploadFile` 自动设为 multipart |

**静态资源域名（非接口）**：车辆历史照片 `https://k3a.wiselink.net.cn/img/`（首页「查看照片」拼接 `uploadImgUrl` 等字段展示）。

## 三、页面与流程

### 分享链接格式（主入口，无需登录）

- **实际分发格式（控制码直连）**：`https://www.xxx.com?code=jshdjksahdj332`（参数直接挂在根路径 `?` 之后）
- 手机号查询：`https://www.xxx.com?mobile=13800000000`
- 参数别名兼容：控制码 `code` / `controlcode`；手机号 `mobile` / `phone`
- 解析实现：`utils/urlParams.js` 统一合并 `onLoad.options`、`location.search`、`location.hash` 内 query，兼容三种实际访问形态：
  - `https://host/?code=xxx`（history 模式根路径 query）
  - `https://host/?code=xxx#/pages/index/index`（当前 hash 模式，参数在 hash 之前）
  - `https://host/#/pages/index/index?code=xxx`（hash 之内的 query）

### 车辆来源优先级与页面流转

```
index（控车页，直接展示，全站无登录）
  ├─ onLoad 解析链接参数 code / mobile
  ├─ resolveVehicle() 车辆来源优先级：
  │    1) 链接 code    → getCarPoisitonByCode 直接取车
  │    2) 链接 mobile  → getControlCodeByMobile → getCarPoisitonByCode
  │    3) 无参数        → 空态（信息区占位、操作按钮提示暂无车辆）
  ├─ 开锁 / 关锁 / 鸣笛寻车 → u_operation（凭证为 code 控制码，鉴权以后端为准）
  ├─ 查看照片 → previewImage（k3a 域名拼接）
  └─ 归还车辆 → navigateTo returnPhotos?code=控制码
returnPhotos（code 来自链接或控车页）
  ├─ 5 张照片采集（相册/相机）
  ├─ Promise.all 并行上传 saveImg（仅带 timestamp 头）
  └─ 全部成功 → returnCar → reLaunch index?code=控制码
```

## 四、相对 MCCKey 的裁剪清单（明确未迁移）

| 类别 | 未迁移内容 | 原因 |
|---|---|---|
| 地图 | `hybrid/html/sendKey.html`、Google Maps JS / Geocode、腾讯步行规划 API、`components/MapCom` | 需求明确不要地图 |
| 蓝牙 | `ble-manager.js`、`BleKeyFun-utils-single.js`、`byte-util.js`、`device-control-cmds.js`、蓝牙切换 UI | uni BLE 仅 App 端可用，浏览器 H5 不支持，按确认直接移除 |
| 登录体系 | 账号密码登录 `zcyLogin`（`u_login`）、登录页 Logo `deskapi/logo`（`u_logo`）、微信手机号登录 `u_wxLogin`（依赖 `uni.login` 凭证）；登录缓存 `userKey`、退出登录逻辑一并移除 | 需求明确全站无登录，分享链接控制码即凭证；H5 浏览器也无小程序登录凭证 |
| 遗留接口 | 注册 `userReg`、车辆增删改 `carapi/*`、租钥匙 `rentKeyApi/*`、促销 `promotionalApi/*`、桌面 `deskapi/bannerlist20、navlist20、booklist、mylist、homeArea`、日志 `loggerapi/uploadLog`、设备 `k7Api/getBluetoothKey` | 旧桌面端/管理端遗留，H5 用车闭环不需要 |
| 废弃页面 | `desx`（蓝牙须知）、`meet`（应急开关锁，蓝牙通道）、`userCenter`、`register`（MCCKey 中本身未注册路由） | 依赖蓝牙或不在确认范围 |
| 其他 | `url-search-params-polyfill` 依赖、多套可切换后端域名存储（`k1swUrl/fin3Url`） | H5 固定直连 `k1sw.wiselink.net.cn`，不再需要运行时切换 |

## 五、运行方式

1. 用 HBuilderX 打开本目录 → 运行 → 运行到浏览器（Chrome）；或 CLI：`npm install` 后 `npm run dev:h5`（依赖项目自身 `package.json` 配置，当前未生成，以 HBuilderX 为准）。
2. 路由为 hash 模式，首页 `pages/index/index`（控车页默认直接展示）；带 `?code=` / `?mobile=` 参数直达车辆；`pages/returnPhotos/index` 为还车拍照页。全站无登录页与登录入口。
3. 语言策略：**默认英文（`enUs`）**；当前内置 `English / 中文 / Español`（`enUs / zhCn / esEs`）。控车页右上角为语种下拉选择器（`picker`，数据源 `utils/langOptions.js` 的 `LANG_OPTIONS`），选择结果写入缓存 `language` 并全站即时生效；清空缓存或首次访问均为英文。**新增语种步骤**：① `langOptions.js` 追加 `{ value, label }`；② `langtips.js` 各文案键补该语种文案；③ `http.js` 的 `BACKEND_LANG_MAP` 补后端语言码。

## 六、注意事项（上线前确认）

1. **跨域（CORS）**：当前按确认采用直连 `https://k1sw.wiselink.net.cn`。浏览器 H5 直接请求该域名，要求后端对 H5 部署域名放行 CORS（`Access-Control-Allow-Origin` 等）；若本地或线上出现跨域报错，备选方案是 HBuilderX/vite 配置开发代理（baseURL 改相对前缀 `/api`，由 devServer 或 Nginx 同源反代转发）。
2. **车辆字段假设**：车牌 `plateNumber`、周期 `startDate/endDate`、照片 `uploadImgUrl…Five` 沿用 MCCKey；品牌字段兼容 `brand / model / carBrand / vehicleModel`；位置字段兼容 `address / locationText`，缺省退化为经纬度；备注字段兼容 `remark / remarks / note / memo / description / comments / remarkText`，缺省显示 `-`；「位置获取时间」由前端在车辆信息拉取成功时生成（`yyyy-MM-dd HH:mm`）。联调以后端实际报文为准微调。
3. **照片上传字段名**：`img1Arr`~`img5Arr` 与 MCCKey 保持一致，未做改动；若后端已调整，需同步修改 `returnPhotos/index.vue` 的 `field`。
4. **控车/还车接口的后端鉴权**：全站不携带 token，请求仅带 `funAreaId`、`lang`、`timestamp`；若后端对 `operation`、`saveImg`、`returnCar` 仍强制鉴权，需确认是否以 `code`（控制码）作为分享场景凭证，或由后端放行该场景，前端再按需补字段。
5. **分享参数名以后端实际约定为准**：当前兼容 `code/controlcode`、`mobile/phone`；若下发链接使用其他参数名（如 `key`、`tel`），在 `utils/urlParams.js` 增补别名即可。
6. `manifest.json` 中原生 Android/iOS 权限与 SDK 配置已清空（H5 由浏览器授权相机/相册）；若后续再出 App 包需重新补配蓝牙、相机权限。
7. **路由模式与资源路径（部署关键）**：
   - `manifest.json` 采用 hash 模式（地址栏带 `#/`），`h5.router.base: "./"` 相对路径，资源按 `index.html` 所在目录加载（产物内引用为 `./assets/xxx.js`，不带前导 `/`），可部署在任意子路径（如 `/img/web/`），无需服务器额外配置。
   - 禁止把 `base` 写成 `http://` 绝对地址：HTTPS 页面加载 HTTP 资源会被浏览器以 Mixed Content 拦截（线上 `http://k1sw.wiselink.net.cn/assets/login` 被 block 即此原因）；`base` 也勿留空 `/`，否则部署到子目录时资源会去域名根目录找而 404。
   - 若改用 history 模式（地址栏无 `#`），除 `h5.router.mode` 外 `h5.router.base` 需配为部署子路径（如 `/img/web/`），并由 Nginx 等配置 `try_files ... /子路径/index.html` 回退，否则刷新子路由 404；本项目默认 hash + `./` 相对路径以规避服务器配置。
8. **重新发行与旧包清理**：发行前清空本地 `unpackage/dist/build/web`（含旧压缩包 `web.rar`）；服务器部署目录（如 `/img/web/`）先清空再上传新产物，避免旧版 `login` 分包等残留 chunk 被引用，导致 `Unable to preload CSS/JS`、`/assets/login` 404。`utils/urlParams.js` 已兜底解析根路径 `?code=`，`www.xxx.com?code=xxx` 可直接取参。
