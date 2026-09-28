import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from '@/i18n/locales';

const ZHT_TEXT: Record<string, string> = {
  'Report any problems to 抽貝比': '有任何問題，請回報給抽貝比',
  'If you run into system problems, bugs, or any other questions, please message 抽貝比 directly. Include a description of the problem and a screenshot so it can be handled quickly. Thank you for your cooperation!':
    '公會成員若遇到任何系統問題、功能錯誤或其他疑問，請直接私訊抽貝比。回報時請附上問題描述與截圖，以便快速處理。感謝大家的配合！',
  'Guild raid night every Friday at 21:00': '每週五 21:00 公會團戰夜',
  'All guild members are welcome to join our weekly raid night every Friday starting at 21:00 server time. Please ensure your gear is up to date and bring consumables. Loot will be distributed via the in-guild auction system. See you there!':
    '歡迎所有公會成員參加每週五伺服器時間 21:00 開始的團戰夜。請確認裝備已更新並攜帶消耗品，戰利品將透過公會競拍系統分配。到時見！',
  'Weekly Raid Night - Friday 8PM': '每週團戰夜 - 週五晚上 8 點',
  'This Friday we will be tackling the Ancient Dragon. All members level 50+ are encouraged to join.':
    '本週五我們將挑戰遠古巨龍，歡迎所有 50 級以上的成員參加。',
  'Guild Vault Update': '公會倉庫更新',
  'The guild vault has been updated. Auction proceeds for this month have been distributed.':
    '公會倉庫已更新，本月的競拍收益已經分配完畢。',
  'Guild Hall Renovation': '公會大廳整修',
  'We are planning to renovate the guild hall next month.': '我們計劃在下個月整修公會大廳。',

  'Weekly Guild Check-in': '每週公會點名',
  'Open — awaiting your check-in': '進行中 — 等待你簽到',
  'Open now': '進行中',
  'Auction ending soon': '競拍即將結束',
  'Active auction': '進行中的競拍',
  'Recurring weekly event': '每週例行活動',
  'Guild Strategy Meeting': '公會戰略會議',
  'Spring Giveaway Draw': '春季贈獎抽獎',
  'Monthly Mega Draw': '每月大抽獎',
  'Weekly Mini Draw': '每週小抽獎',
  'Grand Guild Lottery': '公會大樂透',
  'Legendary Item Raffle': '傳說物品抽獎',
  'Flash Draw': '限時快速抽獎',

  'Spider Queen': '蜘蛛女王',
  'Flame Dragon': '炎龍',
  'Skeleton King': '骷髏王',
  'Abyssal Witch': '深淵魔女',
  'Stone Colossus': '巨石像',
  'Frost Giant': '冰霜巨人',
  'Late arrival': '遲到',

  'Dragon Scale': '龍鱗',
  'Fire Crystal': '火焰水晶',
  'Web Fragment': '蛛網碎片',
  'Venom Fang': '毒牙',
  'Spider Silk': '蜘蛛絲',
  'Ancient Rune': '遠古符文',
  'Frost Core': '冰霜核心',
  'Shadow Essence': '暗影精華',
  'Dragon Slayer Sword': '屠龍劍',
  'Mystic Shield of Protection': '神秘守護之盾',
  'Ancient Healing Scroll': '遠古治療卷軸',
  'Rare Mithril Ore': '稀有秘銀礦',
  'Shadow Cloak of the Assassin': '刺客暗影斗篷',
  'Ancient Sword': '古劍',
  'Lucky Charm': '幸運護符',
  'Iron Shield': '鐵盾',
  'Health Potion': '生命藥水',
  'Elixir of Strength': '力量藥劑',
  'Tome of Arcane Secrets': '奧術秘典',
  'Iron Ore Bundle': '鐵礦包',

  'A legendary blade forged from dragon scales. Increases critical hit rate by 25%.':
    '以龍鱗鍛造的傳說之刃，爆擊率提升 25%。',
  'An enchanted shield that provides magical protection and reflects 15% damage.':
    '附魔的盾牌，提供魔法防護並反彈 15% 傷害。',
  'A powerful healing spell that restores 80% of maximum health instantly.':
    '強大的治療法術，立即恢復 80% 最大生命值。',
  'High-quality crafting material used to forge superior weapons and armor.':
    '高品質的製作材料，可用來鍛造上等武器與防具。',
  'A mysterious cloak that conceals the wearer in darkness. Details hidden until auction ends.':
    '能讓穿戴者隱身於黑暗的神秘斗篷，詳細資訊將在競拍結束後公開。',
  'A blade passed down through generations, still sharp as ever.': '代代相傳的利刃，至今依然鋒利。',
  'A small trinket said to bring good fortune in battle.': '據說能在戰鬥中帶來好運的小飾品。',
  'Standard issue protective gear for guild members.': '公會成員的標準防護裝備。',
  'Restores 50% maximum health when consumed.': '使用後恢復 50% 最大生命值。',
  'A durable scale from a defeated dragon. Used for crafting high-tier armor.':
    '取自被擊敗巨龍的堅硬鱗片，可用於製作高階防具。',
  'Grants a powerful temporary boost to physical abilities.': '短時間內大幅提升體能。',
  'An ancient spellbook containing forgotten knowledge of arcane arts.': '記載著失傳奧術知識的古老法術書。',
  'A bulk bundle of iron ore for crafting basic equipment.': '大量鐵礦，用於製作基礎裝備。',

  'Account deposit': '帳戶存款',
  'Withdrawal request': '提款申請',
  'Withdrawal to bank account': '提款至銀行帳戶',
  'Guild reward payout': '公會獎勵發放',
  'Auction sale proceeds': '競拍售出收益',
  'Lottery winnings': '抽獎獎金',

  'Weekly contribution': '每週貢獻',
  'Potion supplies for raid': '團戰用藥水補給',
  'Initial guild fund': '公會初始資金',
  'Enchanting materials': '附魔材料',
  'Distributed by admin': '由管理員分配',

  'placed a bid on Dragon Slayer Sword': '對屠龍劍出價',
  'checked in to weekly guild check-in': '完成每週公會點名簽到',
  'purchased 2 lottery tickets': '購買了 2 張彩券',
  'joined the guild': '加入了公會',
  'created auction for Mystic Shield': '建立了神秘守護之盾的競拍',
  'checked in to raid preparation': '完成團戰準備點名簽到',

  'just now': '剛剛',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ZHT_PATTERNS: Array<[RegExp, (...groups: string[]) => string]> = [
  [/^Transfer to (.+)$/, name => `轉帳給 ${name}`],
  [/^(.+) ×(\d+)$/, (item, qty) => `${translateZht(item)} ×${qty}`],
  [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})$/, (month, day) => `${MONTHS.indexOf(month) + 1}月${day}日`],
  [/^Draws in (.+)$/, time => `${time} 後開獎`],
  [/^(\S+) remaining$/, time => `剩餘 ${time}`],
  [/^Tomorrow (\d{2}:\d{2})$/, time => `明天 ${time}`],
  [/^You have (\d+) tickets$/, count => `你有 ${count} 張彩券`],
  [/^([\d,.]+) prize pool$/, amount => `獎金池 ${amount}`],
  [/^(\d+) min ago$/, n => `${n} 分鐘前`],
  [/^(\d+)h ago$/, n => `${n} 小時前`],
  [/^(\d+)d ago$/, n => `${n} 天前`],
  [/^(\d+)w ago$/, n => `${n} 週前`],
];

function translateZht(text: string): string {
  if (text in ZHT_TEXT) return ZHT_TEXT[text];
  for (const [pattern, format] of ZHT_PATTERNS) {
    const match = text.match(pattern);
    if (match) return format(...match.slice(1));
  }
  return text;
}

export function currentMockLocale(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const value = document.cookie
    .split('; ')
    .find(part => part.startsWith(`${LOCALE_COOKIE}=`))
    ?.split('=')[1];
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function localizeMock<T>(value: T, locale: Locale = currentMockLocale()): T {
  if (locale === 'en') return value;
  return translateDeep(value) as T;
}

function translateDeep(value: unknown): unknown {
  if (typeof value === 'string') return translateZht(value);
  if (Array.isArray(value)) return value.map(translateDeep);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, translateDeep(entry)]));
  }
  return value;
}
