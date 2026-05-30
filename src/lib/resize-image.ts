/**
 * 客户端图片缩放 —— 在上传前把大图缩到 ≤ maxDim 像素 + JPEG 质量压缩。
 *
 * 背景：
 *   用户用手机/相机拍的人物照片常见 10-20 MB / 4032×3024。
 *   原图直接 POST /upload 会让网络等待 5-15s（弱网更糟），且后端 Gemini Vision
 *   分析（一次几十 MB 的 base64）也跟着慢一截。
 *
 *   实际上 nano-banana / Gemini Vision 对参考图的需求只到 1024-1280 px 长边，
 *   再大也会被模型内部 downscale 到这个量级，纯粹是带宽浪费。
 *
 * 策略：
 *   - 仅对图片 type 生效（image/jpeg, image/png, image/webp 等）
 *   - 已经够小的图（最长边 ≤ maxDim AND size ≤ skipBelowBytes）直接原样返回，
 *     不浪费 canvas 重编码的 CPU 时间
 *   - 透明 PNG 也会被压成 JPEG（背景 #fff）；MV 角色图基本不需要 alpha，OK
 *   - 失败时回退原 file，永远不阻塞上传
 *
 * 用法：
 *   const file = await resizeImageFile(e.target.files[0]);
 *   await uploadFile(file, '/upload');
 */
export interface ResizeOptions {
  /** 缩放后的最长边像素，默认 1280 */
  maxDim?: number;
  /** JPEG 质量 0~1，默认 0.85 */
  quality?: number;
  /** 文件已经小于此字节数时直接跳过 resize，默认 800 KB */
  skipBelowBytes?: number;
}

export async function resizeImageFile(
  file: File,
  opts: ResizeOptions = {},
): Promise<File> {
  const { maxDim = 1280, quality = 0.85, skipBelowBytes = 800 * 1024 } = opts;

  // 非图片直接放行（防误用）
  if (!file.type.startsWith('image/')) return file;

  // 文件已经够小 → 直接返回原文件，节省 CPU
  if (file.size <= skipBelowBytes) return file;

  try {
    const dataUrl = await readFileAsDataURL(file);
    const img = await loadImage(dataUrl);

    // 已经小于 maxDim → 退回原文件（哪怕 size 偏大，也不重编码，保留原画质）
    const maxSide = Math.max(img.naturalWidth, img.naturalHeight);
    if (maxSide <= maxDim) return file;

    const scale = maxDim / maxSide;
    const targetW = Math.round(img.naturalWidth * scale);
    const targetH = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // 透明 PNG 兜底背景：白色
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (!blob) return file;

    // 重编码后体积反而更大（极少见，多为已经高质量 JPEG）→ 用原文件
    if (blob.size >= file.size) return file;

    // 文件名换扩展名，避免 .png 被压成 jpg 但扩展名仍是 .png 导致 backend 误判
    const base = file.name.replace(/\.[^.]+$/, '');
    const newName = `${base}.jpg`;
    return new File([blob], newName, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } catch {
    // 任何异常退回原文件，永不阻塞上传
    return file;
  }
}

// ─── 内部工具 ────────────────────────────────────────────────────────────────

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (ev) => reject(ev);
    img.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });
}
