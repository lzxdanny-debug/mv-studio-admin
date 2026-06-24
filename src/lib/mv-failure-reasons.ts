/** MV 镜头标准 failureReason 码 → 管理后台展示文案 */
export const MV_FAILURE_REASON_LABELS: Record<string, string> = {
  __STUCK__: '卡住（无失败码）',
  __NONE__: '失败（未分类）',
  IMAGE_BLOCKED: '故事板图片被拦截',
  PROMPT_BLOCKED: '提示词被拦截',
  CONTENT_SAFETY_RISK: '内容审核风险',
  FACE_DETECTED: '人脸相似度过高',
  INSUFFICIENT_CREDITS: '用户积分不足',
  UPSTREAM_CREDITS_EXHAUSTED: '上游账户余额不足',
  SERVICE_UNAVAILABLE: '服务临时不可用',
  TIMEOUT: '生成超时',
  USER_CANCELLED: '用户取消',
  PROVIDER_NOT_CONFIGURED: '引擎未配置',
  UPSTREAM_AUTH_FAILED: '上游认证失败',
  UNKNOWN: '未知错误',
};

export function labelMvFailureReason(code: string): string {
  return MV_FAILURE_REASON_LABELS[code] ?? code;
}
