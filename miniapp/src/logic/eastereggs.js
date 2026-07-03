// UtaNote 例句彩蛋 —— 纯数据 + 查询，无副作用。
//
// 两类内容：
//   WORD_EGGS  通用词彩蛋：任何歌命中该词都触发。写"听歌赏析"口吻即可，
//              不用碰冷门日语文化梗。
//   SONG_EGGS  歌绑定彩蛋：songId → { 词 → 彩蛋 }。名句私货 / 作者悄悄话，
//              绑定到具体某首歌。目前只有 demo 歌是固定 id（'demo'）。
//
// 命中优先级：先查这首歌的专属彩蛋，再回落到通用词表。都没有就返回 null
// （例句区不显示任何入口 —— 大部分词没彩蛋，所以"遇到"本身就稀有）。
//
// 每条彩蛋形如 { jp?, cn, note? }：
//   jp   可选，日语一行（想放就放，纯中文赏析可以省）
//   cn   主体，一两句就好 —— 像书页里夹的一张小卡片
//   note 可选，落款 / 来源标签
//
// ⚠️ 下面全是示例占位，换成你自己的私货。demo 歌各句的高亮词见 src/data.js。

const WORD_EGGS = {
  // '涙': { cn: '日语歌里「涙」很少唱字面的眼泪，多是说不出口的情绪 —— 留意它落在旋律的哪个位置。', note: '听感 · 示例' },
}

const SONG_EGGS = {
  demo: {
    '静かに': {
      cn: '《月灯りのメロディー》开篇就压得很轻，「静かに」是整首的定调：深夜、独白、克制。',
      note: '作者悄悄话 · 示例，换成你的',
    },
  },
}

// 累计点例句🔊 满 TAP_EGG_THRESHOLD 次触发的彩蛋①（内容 / 阈值 / 冷却都在这里调）
export const TAP_EGG_MESSAGE = '例句反复听，学得真起劲 🎵'
export const TAP_EGG_THRESHOLD = 5
export const TAP_EGG_COOLDOWN_MS = 30000

// 查当前词的彩蛋。songId 命中优先于通用词，都没有返回 null。
export function findEasterEgg(songId, word) {
  if (!word) return null
  const bySong = SONG_EGGS[songId]
  if (bySong && bySong[word]) return bySong[word]
  return WORD_EGGS[word] || null
}
