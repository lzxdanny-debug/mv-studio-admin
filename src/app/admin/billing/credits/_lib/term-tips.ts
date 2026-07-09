/** 积分管理页关键名词说明 */

export const CREDIT_TERM_TIPS = {
  totalBalance:
    '全站所有用户当前积分余额之和，来自 user_credits 表快照，不随下方时间筛选变化。',
  usersWithBalance: '当前积分余额大于 0 的用户数量。',
  userAccounts: '已创建积分账户的用户总数（含余额为 0 的账户）。',
  totalIn:
    '所选时间范围内，所有积分流水里金额为正的合计，包括充值、赠送、退款退回、手动增加等。',
  totalOut:
    '所选时间范围内，所有积分流水里金额为负的合计（取绝对值），包括生成消耗、手动扣减等。',
  bySource:
    '按积分来源类型汇总所选时间范围内的流水。点击卡片可进入该类型的明细页。',
  userBalanceRank:
    '按用户当前积分余额从高到低排列，可搜索邮箱、昵称或用户 ID。',
  currentBalance: '该用户账户里尚未使用的积分数量。',
  lastUpdated: '该用户积分余额最近一次发生变动的时间。',
  transactionCount: '所选时间范围内，该类型积分流水的总笔数。',
  netAmount:
    '所选时间范围内，该类型流水的净变动（入账减出账）。手动调整可能同时包含增加与扣减。',
  increaseAmount: '所选时间范围内，该类型里金额为正的积分合计。',
  decreaseAmount: '所选时间范围内，该类型里金额为负的积分合计（取绝对值）。',
  creditChange: '本条流水导致的积分增减，正数为入账，负数为出账。',
} as const;

export const CREDIT_TYPE_TIPS: Record<string, string> = {
  purchase: '用户通过 Stripe 充值到账的积分，对应流水 type = purchase。',
  signup: '新用户注册时一次性发放的积分，reference_id 为 signup。',
  daily_check_in:
    '用户每日签到领取的积分，每个自然日最多一条，reference_id 为 daily-checkin:日期。',
  referral:
    '邀请新用户注册后发放给邀请人的奖励积分，reference_id 为 referral:被邀请人ID。',
  admin_adjust:
    '管理员在后台手动增加或扣减的积分，reference_id 以 admin_adjust: 开头，净额 = 增加 − 扣减。',
};
