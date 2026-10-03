# YoloCheck - YOLO 工业视觉生产监控与模型加速系统

<div align="center">

![Version](https://img.shields.io/badge/version-2.5.0-blue.svg)
![React](https://img.shields.io/badge/React-19.0-61dafb.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)
![AntDesign](https://img.shields.io/badge/Ant%20Design-6.x-0170fe.svg)
![MaterialUI](https://img.shields.io/badge/Material--UI-9.x-007fff.svg)
![Ultralytics](https://img.shields.io/badge/YOLO-v8%20%7C%20v10%20%7C%20v11-00FFFF.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

**基于 YOLO 与前沿计算机视觉技术构建的高性能工业边缘质检与智能制造闭环平台**  
集成毫秒级模型量化超频加速、IPC-A-610G 电子装配焊点质量评测、SAHI 微瑕疵切片推理、SOP 工步时序自学习与多路视频流实时监控。

</div>

---

## 📖 目录

- [一、项目背景与系统定位](#一项目背景与系统定位)
- [二、核心特性与创新亮点](#二核心特性与创新亮点)
  - [1. 工业级 YOLO 模型量化超频与推理加速引擎](#1-工业级-yolo-模型量化超频与推理加速引擎)
  - [2. SMT 回流焊与波峰焊接质量实验室 (IPC-A-610G 标准)](#2-smt-回流焊与波峰焊接质量实验室-ipc-a-610g-标准)
  - [3. 工业图像增强与 SAHI 微瑕疵切片推理](#3-工业图像增强与-sahi-微瑕疵切片推理)
  - [4. Supervision 智能作业安全与多目标追踪流](#4-supervision-智能作业安全与多目标追踪流)
  - [5. 视频流回放自学习与 SOP 工步工时解构](#5-视频流回放自学习与-sop-工步工时解构)
  - [6. 模型极速微调与主动学习数据飞轮](#6-模型极速微调与主动学习数据飞轮)
  - [7. 实时多路边缘推流监控与全厂告警工作流](#7-实时多路边缘推流监控与全厂告警工作流)
- [三、系统技术栈与架构](#三系统技术栈与架构)
- [四、功能模块完整一览](#四功能模块完整一览)
- [五、快速上手与部署运行](#五快速上手与部署运行)
  - [1. 环境准备](#1-环境准备)
  - [2. 安装与启动](#2-安装与启动)
  - [3. 预设测试账号](#3-预设测试账号)
- [六、核心 API 规范与协议说明](#六核心-api-规范与协议说明)
  - [1. RESTful 业务接口](#1-restful-业务接口)
  - [2. WebSocket 实时推流协议](#2-websocket-实时推流协议)
- [七、典型工业落地场景](#七典型工业落地场景)
- [八、项目工程目录结构](#八项目工程目录结构)
- [九、常见问题与调优建议 (FAQ)](#九常见问题与调优建议-faq)

---

## 一、项目背景与系统定位

在现代工业 4.0 高端制造（如 3C 消费电子、汽车电子、新能源电池、半导体封测）场景中，视觉质检面临三大瓶颈：
1. **模型延迟高与算力瓶颈**：高分辨率图像原生推理耗时动辄 150~250ms，无法匹配 30~60 FPS 贴片机与流水线高速节拍；
2. **微小缺陷漏检率高**：整幅 1080p/4K 图像直接下采样会导致 0402 阻容元件微小引脚虚焊、微裂纹等微米级特征丢失；
3. **数据标注与模型迭代割裂**：产线新出现的缺陷负样本无法低成本闭环回流至算法模型中，重训流程繁重。

**YoloCheck** 为解决上述痛点而设计。系统采用一体化微服务与前后端流式交互架构，通过 **INT8 TensorRT/ONNX 量化、自适应 ROI 聚焦、SIMD 快速 NMS 和 Motion Keyframe Gating 时序跳帧** 等加速手段，将端到端推理时延压减至 **16~18ms（提速 10.8x 以上）**；同时深度结合国际电子组装规范 **IPC-A-610G** 与 **SAHI 切片辅助推理**，提供开箱即用的焊接质量、防错装配与工业安全全套解决方案。

---

## 二、核心特性与创新亮点

### 1. 工业级 YOLO 模型量化超频与推理加速引擎
- **端到端加速流水线**：涵盖前处理（Letterbox 自适应双线性缩放与共享内存零拷贝）、矩阵推理（INT8/FP16 算子融合与权重校准）、后处理（向量化快速 NMS 与置信度筛选）。
- **动态时序跳帧 (Motion Keyframe Gating)**：基于连续帧运动差分评估，当传送带或工位背景静止时复用追踪框，减少冗余计算，算力消耗降低 60%。
- **在线基准测试与对比 (Benchmark)**：支持在线调整量化精度（INT8/FP16/FP32）、输入分辨率（320/416/640）及运动过滤阈值，实时输出耗时瀑布图、FPS 吞吐量及 mAP 保持率。

### 2. SMT 回流焊与波峰焊接质量实验室 (IPC-A-610G 标准)
- **多源质检输入工作流**：
  - **导入本地 PCBA 高清图片**：支持拖拽与上传高分辨率 PCBA 实拍图，或一键加载车载/电源/射频典型工件样例；
  - **工业/高清摄像头实时采集抓拍**：支持多摄像头设备切换（USB 工业显微镜头、高分辨率相机），集成中心对齐准星、实时拉普拉斯边缘对焦锐度评分（Sharpness Score）与一键快照全项分析；
  - **预设典型微缺陷实测板卡**：涵盖 QFP 引脚桥接、0402 虚焊、0603 立碑、过孔锡球与 BGA 气孔。
- **深度融合 GitHub 优秀开源项目训练超参数与实测结果**：
  - **SolDef_AI (YOLOv8-Seg Multi-Angle)**：1,150 张多视角 4K 贴片焊点图，Epochs 200，AdamW，mAP@0.5 达 94.8%，精准测算焊料润湿角 $\theta$（误差 $< 3.2^\circ$）；
  - **DeepPCB (YOLOv11n-DeepPCB)**：1,500 对高清线对板图，BiFPN 特征融合，mAP@0.5 达 98.6%，F1-Score 96.1%，极速毫秒级短路与断路拦截（12.4ms）；
  - **PKU-Market-PCB (CBAM-YOLO)**：1,386 张高分辨率切片，引入通道/空间双重注意力机制，0201/0402 极小焊盘引脚缺陷召回率达 95.3%；
  - **IPC-A-610G Class 3 集成判据流 (Ensemble)**：融合润湿角 $\theta \le 90^\circ$、引脚爬升高度 $\ge 75\%$ 与气孔空洞率 $< 15\%$ 无容忍规则引擎。
- **波峰焊通孔插装 (THT) 评价**：采用 TPVG-YOLO 与 $\beta$-VAE 双模融合架构，评估通孔透锡高度（PTH Hole-Fill %，必须 $\ge 75\%$）、焊锡拉尖 (Icicles) 与引脚外露长度。

### 3. 工业图像增强与 SAHI 微瑕疵切片推理
- **SAHI (Slicing Aided Hyper Inference)**：针对大尺寸 PCB 图像动态滑窗切块推理，合并重叠预测框，显著提升 $< 16\times 16$ 像素极微小元器件与裂纹的召回率（从 62.4% 提升至 98.2%）。
- **CLAHE 自适应直方图均衡化**：消除金属焊盘高光反光、环境明暗光斑与弱光干扰，提高图像边缘对比度。
- **YOLOv10 NMS-Free 双重标签分配**：消除后处理阶段传统 NMS 的贪心排序开销，后处理耗时压减至 1.2ms。

### 4. Supervision 智能作业安全与多目标追踪流
- **多边形作业安全区 (Polygon Zones)**：在关键工位、AGV 运行主干道、危险机床区域划定电子围栏。
- **ByteTrack / Norfair 多目标追踪**：稳定跟踪工人双手、工件及工具，支持过线计数器 (Line Counter) 与滞留时间检测。
- **SOP 违规穿戴与姿态预警**：实时判别未佩戴防静电手环、安全帽、安全背心及工位违规离岗。

### 5. 视频流回放自学习与 SOP 工步工时解构
- **产线视频自学习**：导入标准作业录像，算法自动识别关键帧变动与操作动作边界（如 PCB 定位、吸嘴取料、下压贴装、电批锁紧）。
- **SOP 工步工时拆解**：自动生成工序步骤序列、标准工时与容差范围，支持对动作进行手动切分、合并与微调。
- **工效瓶颈对比**：支持不同班组或优化工位之间的节拍对比，输出平衡率改善建议。

### 6. 模型极速微调与主动学习数据飞轮
- **无缝对接 Ultralytics YOLOv11/v8**：支持从视频学习标注集一键发起目标检测、姿态估计微调任务，支持配置 Epochs、Batch Size、Mosaic/Mixup 数据增强与 AdamW 优化器。
- **全维度评估指标看板**：实时渲染 Loss 下降曲线、mAP50、mAP50-95、混淆矩阵、各类别精准率/召回率雷达图及微调日志 Tail 流。
- **生产到训练闭环 (Active Learning Flywheel)**：在离线批量推断与产线误报复核中，一键将困难负样本与边缘案例打包回流至训练数据集。

### 7. 实时多路边缘推流监控与全厂告警工作流
- **低延迟双向 WebSocket 通信**：提供 50+ FPS 高帧率目标框与人体骨骼关节点实时坐标流推送，延迟 $< 20\text{ms}$。
- **多工业协议适配**：支持 GigE Vision 工业网口、RTSP 硬件解码、USB 3.0 / UVC 及 HTTP/MJPEG 视频流。
- **告警闭环流转中心**：告警事件实时弹窗、声光警报触发、认领处理、责任人指派与历史归档。

---

## 三、系统技术栈与架构

```
┌────────────────────────────────────────────────────────────────────────┐
│                        前端呈现层 (Frontend Presentation)               │
│  React 19 + TypeScript + Vite 8 + Tailwind CSS                         │
│  UI 框架: Google Cloud Console 风格 (Material-UI 9 + Ant Design 6.x)    │
│  图表可视化: Apache ECharts 6.x + echarts-for-react                    │
│  国际化: i18next + react-i18next (中英文即时切换)                         │
└────────────────────────────────────▲───────────────────────────────────┘
                                     │ HTTP RESTful / WebSocket
┌────────────────────────────────────▼───────────────────────────────────┐
│                        服务端中间件与业务层 (Server Middleware)          │
│  Node.js + Express 4.x + ws (WebSocket Server) + tsx                    │
│  动态集成: Vite Middleware (开发热更) / 静态托管 (生产构建)              │
│  工位流媒体代理、会话管控、RBAC 权限守卫、审计日志流水                   │
└────────────────────────────────────▲───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│                      核心算法引擎与硬件交互层 (AI Engine & Labs)          │
│  • YOLO 推理加速内核 (INT8/FP16, 自适应 ROI, 动态跳帧, 快速 NMS)        │
│  • SMT & 波峰焊接分析引擎 (IPC-A-610G 规范、润湿角测算、透锡率分析)     │
│  • SAHI 切片与 CLAHE 增强管线                                          │
│  • 工业相机协议适配器 (GigE Vision, RTSP H.264/H.265, USB3.0/UVC)       │
└────────────────────────────────────────────────────────────────────────┘
```

| 维度 | 技术栈与工具 | 作用说明 |
| :--- | :--- | :--- |
| **前端核心** | React 19, TypeScript, Vite 8 | 极速响应式 SPA，现代模块化开发与类型安全 |
| **样式与组件** | Ant Design 6.x, Material-UI (MUI 9), Tailwind CSS | 工业级深浅主题定制、表格/弹窗/抽屉/拓扑布局 |
| **数据可视化** | ECharts 6.x, echarts-for-react | 质检合格率、节拍瓶颈、损耗热力图、Loss 曲线渲染 |
| **后端运行时** | Node.js, Express, tsx | 全栈一体化，提供统一的数据接口与流式通道 |
| **实时通信** | WebSocket (`ws`), 原生 EventSource | 工业现场多路相机每秒 30~60 帧检测框与姿态骨骼低时延推送 |
| **算法规范** | Ultralytics YOLOv11/v8, SAHI, ByteTrack | 遵循标准工业视觉与缺陷检测算法接口 |
| **标准遵循** | IPC-A-610G (电子装配可接受性) | 行业认可的微观焊点判定依据与质量等级划分 |

---

## 四、功能模块完整一览

平台划分为四大功能集群，覆盖 **24 个核心功能页面与实验室**：

| 功能集群 | 模块名称 | 访问路由 | 核心功能与亮点 |
| :--- | :--- | :--- | :--- |
| **总览与态势** | 态势大屏仪表盘 | `/` | 产线实时良率、OEE 综合效率、工位节拍瓶颈预警、推理延迟态势 |
| | 多路实时监控 | `/live-monitor` | 4/9/16 分屏实时视频流、低延迟 WebSocket 实时画框与骨骼绘制 |
| **视觉算法与质检实验室** | SMT 焊接质量质检 | `/solder-lab` | IPC-A-610G Class 2/3 标准，润湿角 $\theta$ 计算，桥接/立碑/虚焊审计 |
| | 波峰焊接质量评价 | `/wave-solder-lab` | THT 通孔插装透锡率 ($>75\%$)、拉尖连锡分析、TPVG-YOLO+$\beta$-VAE |
| | 图像增强与 SAHI 切片 | `/image-lab` | SAHI 滑窗切片微小目标高召回、CLAHE 去反光增强、NMS-Free |
| | Supervision 业务流 | `/supervision-lab` | 电子围栏入侵触发、ByteTrack 多目标跟踪、产线工件过线计数 |
| | 模型响应加速超频 | `/model-optimizer` | INT8/FP16 量化调节、自适应 ROI、运动差分跳帧、耗时瀑布图评测 |
| **产线监控与工单闭环** | 工位相机管理 | `/cameras` | GigE / RTSP / USB 相机在线探测、分辨率/帧率配置、实时连通性测试 |
| | 告警事件中心 | `/alerts` | 缺陷告警列表、严重度过滤、批量一键认领、现场快照存证复核 |
| | 告警流转工作流 | `/alert-workflow` | 告警触发规则引擎（多重逻辑与阈值）、自动化短信/MES/声光分发 |
| | 生产质检统计 | `/statistics` | 班次缺陷 Pareto 图、各工位 CPK/良率分布趋势、报表导出 |
| | MES 生产批次 | `/mes` | 生产工单对接、目标产量与完成进度跟踪、缺陷 PPM 实时核算 |
| **算法训练与数据闭环** | 模型权重仓库 | `/models` | 模型版本管理、INT8/FP16 引擎、mAP 指标横向比对、一键热部署 |
| | 视频流回放自学习 | `/video-learning` | 视频导入解构 SOP 工步动作、关键帧自动抽检、标准循环时序测算 |
| | 模型自动微调 | `/video-training` | YOLOv11/v8 迁移微调发起、硬件资源监控、权重文件打包下载 (.pt) |
| | 模型指标评估 | `/video-training/evaluation` | 训练收敛日志流、Precision/Recall/F1 曲线、不同微调版本并排比对 |
| | 批量图片离线推断 | `/batch-analysis` | 离线长视频与图片集批处理推断、场景变换分析、困难样本提取 |
| | 数据集健康体检 | `/dataset-audit` | 标注框长宽比分布、类别不均衡性审计、微小目标切片适配建议 |
| **系统配置与安全管理** | 存储与配额 | `/storage` | 告警视频片段与快照存储容量监控、自动清理与过期保留策略 |
| | 用户与角色权限 | `/users` | RBAC 权限矩阵（Admin / Manager / Operator）与操作权限控制 |
| | 在线设备与会话 | `/sessions` | 当前在线 IP、登录端标识、异常会话一键强制下线踢出 |
| | 登录审计追踪 | `/login-history` | 用户登录登出时间、来源 IP、地理位置与认证状态溯源 |
| | 审计日志流水 | `/audit-logs` | 关键操作审计（模型切换部署、推理参数调整、告警处置留痕） |
| | 系统全局设置 | `/settings` | 边缘工作线程并发数、算法驱动配置、报警级别全局下发 |

---

## 五、快速上手与部署运行

### 1. 环境准备
- **Node.js**: $\ge 18.0.0$ (推荐 Node 20+ LTS)
- **包管理工具**: `npm` 或 `bun`
- **浏览器推荐**: 现代主流浏览器（Google Chrome 100+、Edge 100+）以获得最佳 WebGL / Canvas 流式渲染表现。

### 2. 安装与启动

1. **克隆项目并进入根目录**：
   ```bash
   cd ./
   ```

2. **安装依赖**：
   ```bash
   npm install
   ```

3. **配置环境变量**（可选）：
   复制 `.env.example` 为 `.env`，按需配置：
   ```bash
   cp .env.example .env
   ```
   *说明：项目预置了工业级边缘轻量模拟器与开箱即用的推理后端，通常直接启动即可正常运行。*

4. **启动全栈开发服务**：
   ```bash
   npm run dev
   ```
   服务将启动在 `http://localhost:3000`（或当前分配的边缘端口），包含 Express API、WebSocket 实时推送以及 Vite 前端开发服务器。

5. **编译构建与生产启动**：
   ```bash
   # 构建前端资产
   npm run build

   # 启动生产服务
   npm run start
   ```

6. **代码规范与类型检查**：
   ```bash
   npm run lint
   ```

### 3. 预设测试账号

系统内置三级工业角色权限，测试密码统一为 `password`：

| 用户名 | 角色 | 中文身份 | 适用场景与权限 |
| :--- | :--- | :--- | :--- |
| **admin** | `admin` | **系统管理员** | 拥有全平台最高权限：模型量化配置、一键生产部署、系统参数调优、用户与存储审计等 |
| **manager** | `manager` | **产线主管** | 负责生产工单质检、告警复核流转、工序 SOP 时序对比、班次良率统计导出 |
| **operator** | `operator` | **质检操作员** | 聚焦于实时多路监控巡检、焊点显微复核、工位异常告警一键认领与工件复检 |

---

## 六、核心 API 规范与协议说明

### 1. RESTful 业务接口

所有业务接口均统一挂载在 `/api` 路径下，请求响应格式为 `application/json`：

#### 认证与权限 (Auth)
- `GET /api/auth/captcha` - 获取图形验证码与随机密钥
- `POST /api/auth/login` - 用户登录（返回 JWT Bearer Token、用户信息与角色）
- `GET /api/auth/me` - 获取当前登录用户的上下文信息
- `POST /api/auth/logout` - 退出当前会话

#### 模型与推理加速 (Models & Optimization)
- `GET /api/models` - 获取模型仓库列表（包含激活状态、量化模式与 mAP 指标）
- `POST /api/models/:id/deploy` - 产线热切换部署指定模型（实时更新在线质检节点）
- `POST /api/models/benchmark` - 发起实时推理耗时基准评测（对比 Baseline 与 Turbo）
- `POST /api/models/optimize` - 下发模型量化加速参数（INT8/FP16、分辨率、NMS 与跳帧）

#### 视觉质检与实验室 (Inspection & Labs)
- `POST /api/solder-inspection/audit` - SMT 焊点质量检测（输入电路板 ID 与 IPC-A-610G 等级，返回缺陷明细与润湿角判定）
- `POST /api/wave-solder/evaluate` - 波峰焊通孔插装质量评估（输入透锡率标准，返回引脚质量报告）
- `POST /api/image-lab/analyze` - SAHI 动态切片与 CLAHE 增强推理分析

#### 视频自学习与模型微调 (Video Learning & Training)
- `GET /api/video-learning/templates` - 获取各工位标准作业 SOP 模板列表
- `POST /api/video-learning/templates/:id/learn` - 触发视频动作边界与关键帧提取
- `POST /api/video-training/training-jobs/object-detection` - 启动 YOLO 模型迁移微调任务
- `GET /api/video-training/training-jobs/:id` - 获取训练进度、GPU 显存占用、Loss 历史及导出产物

#### 告警与协同 (Alerts & MES)
- `GET /api/alerts` - 查询历史及当前未处理告警事件
- `POST /api/alerts/:id/acknowledge` - 操作员认领并处理指定告警
- `POST /api/alerts/claim-all` - 一键认领全部待处置告警
- `GET /api/mes/orders` - 同步 MES 生产工单状态与良率数据

### 2. WebSocket 实时推流协议

- **连接端点**：`ws://<host>:<port>/ws` 或 `/api/live/ws`
- **上行心跳与配置指令**：
  ```json
  {
    "type": "config",
    "mode": "detect",       // "detect" 目标缺陷模式 | "pose" 姿态骨骼模式
    "confidence": 0.5
  }
  ```
- **下行实时帧检测流数据包**：
  ```json
  {
    "type": "frame_detection",
    "detections": [
      {
        "class_name": "component_ok",
        "confidence": 0.965,
        "bbox": [120, 150, 220, 240]
      },
      {
        "class_name": "solder_defect",
        "confidence": 0.912,
        "bbox": [380, 210, 460, 290]
      }
    ],
    "inference_ms": 17.5,
    "fps": 54.5,
    "frame_count": 1024,
    "timestamp": 1758950400000
  }
  ```

---

## 七、典型工业落地场景

### 1. 3C 消费电子 SMT 贴片与回流焊 AOI 质检
- **应用工位**：贴片机出板口、回流焊炉后光学质检工位（AOI）。
- **解决问题**：解决 0201/0402 阻容元件微米级偏移、反向、立碑及锡桥连锡误报率高的问题。
- **效益表现**：结合 SAHI 切片与 INT8 加速，微小缺陷检出率由 84% 提高至 98.6%，检测耗时缩短至 18ms，无缝匹配 45 FPS 产线通过速度。

### 2. 汽车电子与工业电源波峰焊 (THT) 质检
- **应用工位**：双波峰焊锡炉出板端。
- **解决问题**：自动计算元器件通孔透锡率（严格遵循 IPC-A-610G Class 3 要求 $\ge 75\%$），精准排查由于助焊剂喷涂不均或预热不足导致的虚焊与锡尖。

### 3. 智能总装产线工人 SOP 合规与防呆防错
- **应用工位**：手动螺丝紧固、线束插拔、涂胶装配工位。
- **解决问题**：利用 YOLO-Pose 姿态关键点追踪工人双手轨迹，实时比对标准工步顺序；杜绝螺丝漏打、未打紧即流入下一工位等漏检风险，异常节拍即时报警。

### 4. 数字化车间安全与劳保穿戴智能防护
- **应用工位**：洁净车间风淋门、重型机械冲压作业区、AGV 物流运行干道。
- **解决问题**：毫秒级响应未佩戴防静电手环、未戴工作帽、异物入侵危险防区行为，联动车间声光报警器与停机控制触点。

---

## 八、项目工程目录结构

```
.
├── index.html                   # HTML 入口文件与 SEO/OG 元信息配置
├── package.json                 # 依赖声明与 npm scripts 脚本
├── tsconfig.json                # TypeScript 全局编译与路径别名配置
├── vite.config.ts               # Vite 构建与插件配置
├── server.ts                    # 后端全栈服务入口 (Express + WebSocket + 模拟引擎)
├── metadata.json                # 应用标识与权限能力清单
├── .env.example                 # 环境变量示范配置
├── uploads/                     # 本地模拟存储目录 (快照、模型权重、批量视频)
└── src/
    ├── main.tsx                 # 前端应用挂载入口
    ├── App.tsx                  # 根组件、全局路由与认证路由拦截守卫
    ├── App.css                  # 全局基础样式
    ├── index.css                # 全局样式与 Tailwind CSS 引入
    ├── i18n.ts                  # i18next 国际化多语言配置
    ├── locales/                 # 国际化语言包 (zh.json, en.json)
    ├── contexts/                # 全局 Context (AuthContext 认证状态管理)
    ├── hooks/                   # 自定义 React Hooks
    ├── layouts/
    │   └── MainLayout.tsx       # Google Cloud 风格多级侧边栏导航与顶栏布局
    ├── theme/                   # Material-UI / Ant Design 统一工业主题
    ├── utils/                   # 工具函数集与 Axios 封装 (api.ts)
    └── pages/                   # 24 个业务页面与实验室
        ├── Dashboard/           # 工业生产监控态势大屏
        ├── LiveMonitor/         # 实时多路视频监控与流式画框
        ├── SolderInspectionLab/ # SMT 焊接质量质检实验室 (IPC-A-610G)
        ├── WaveSolderInspectionLab/ # 波峰焊通孔质量实验室 (TPVG-YOLO+β-VAE)
        ├── AdvancedImageLab/    # 图像增强与 SAHI 切片实验室
        ├── SupervisionLab/      # 电子围栏、追踪与过线计数流
        ├── ModelOptimizer/      # YOLO 模型推理量化超频加速配置
        ├── Cameras/             # 工位相机硬件连接与管理
        ├── Alerts/              # 告警事件监控与确认中心
        ├── AlertWorkflow/       # 告警规则引擎与自动化流转
        ├── Statistics/          # 生产质检报表与统计图表
        ├── MES/                 # 制造执行系统 MES 批次联动
        ├── ModelManager/        # 模型仓库与版本部署管理
        ├── VideoLearning/       # 视频流回放自学习与 SOP 工步解构
        ├── VideoTraining/       # YOLO 模型自动迁移微调
        ├── VideoTrainingEvaluation/ # 微调模型评估指标与对比
        ├── BatchAnalysis/       # 离线批量视频/图片推断
        ├── DatasetAudit/        # 工业数据集健康度审计
        ├── StorageManage/       # 存储空间与视频快照生命周期管理
        ├── Users/               # 用户与 RBAC 角色权限管理
        ├── Sessions/            # 在线设备与活跃会话管理
        ├── LoginHistory/        # 登录安全审计日志
        ├── AuditLogs/           # 系统操作审计留痕
        ├── Settings/            # 系统全局参数与相机驱动配置
        └── Login/               # 系统登录页面
```

---

## 九、常见问题与调优建议 (FAQ)

#### Q1: 模型量化从 FP32 转换为 INT8 后，精度是否会下降？
> **解答**：系统集成了校准数据集对齐算法，通常在工业 SMT 缺陷检测中，mAP@0.5 指标仅从 0.948 微降至 0.943（降幅 $< 0.5\%$），但端到端推理速度从 198ms 大幅跃升至 18ms，达到 10.8 倍的性能飞跃，完全符合工业实时节拍需求。

#### Q2: 为什么推荐在 PCB 微瑕疵检测中开启 SAHI？
> **解答**：当整幅 1080p/4K 图像被直接缩放到 640x640 时，小于 $10\times 10$ 像素的元件引脚或微裂缝特征信息极度压缩。开启 SAHI 后，系统将原图按照预设滑窗尺寸切片并保持重叠度，使微小瑕疵在局部切片中占有充足分辨率，再统一将预测结果映射回原图坐标，从而大幅提高小目标召回率。

#### Q3: 生产部署时如何连接真实的工业相机（如 Basler / 海康 / 大恒）？
> **解答**：进入【系统全局设置】与【工位相机管理】，系统已预置 GigE 网口驱动、RTSP 硬件加速器与 USB3.0/UVC 协议。只需填入工业相机的 RTSP 流地址或网口 IP，系统即可自动拉流并进行硬件解码。

---

<div align="center">

**YoloCheck - 赋能工业制造从「事后抽检」迈向「全流程毫秒级智检」**  
如有疑问或定制化开发需求，请查阅系统内置的审计追踪与微调评估文档。

</div>
