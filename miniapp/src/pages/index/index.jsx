import { View, Text, Textarea, Input, ScrollView } from '@tarojs/components'
import { useUtaNote } from '../../logic/useUtaNote'
import { sx } from '../../logic/sx'
import './index.css'

const primaryBtn = {
  textAlign: 'center', padding: 14, borderRadius: 14,
  background: 'linear-gradient(135deg, #6b70cf, #8489e0)', color: '#fff',
  fontSize: 15, fontWeight: 600, boxShadow: '0 8px 20px rgba(107,112,207,0.35)',
}
const errBanner = {
  fontSize: 12, lineHeight: 1.5, color: '#ffb4b4',
  background: 'rgba(220,80,80,0.12)', border: '1px solid rgba(220,80,80,0.3)',
  borderRadius: 10, padding: '10px 12px',
}
const noticeBanner = {
  fontSize: 12, lineHeight: 1.5, color: '#cfe0ff',
  background: 'rgba(120,140,220,0.12)', border: '1px solid rgba(140,160,230,0.28)',
  borderRadius: 10, padding: '10px 12px',
}
const fieldLabel = { fontSize: 11.5, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }
const fieldInput = {
  width: '100%', height: 42, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10, padding: '0 12px', fontSize: 13, color: '#eceaf3',
}
const PLACEHOLDER = 'color: rgba(255,255,255,0.3)'

export default function Index() {
  const v = useUtaNote()

  return (
    <View
      style={sx({
        height: '100vh', display: 'flex', flexDirection: 'column',
        background: '#0d1120', color: '#f2f2f6', position: 'relative', overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      })}
    >
      <ScrollView scrollY style={sx({ flex: 1, minHeight: 0 })}>
        <View style={sx({ paddingTop: 88, paddingBottom: 8 })}>

          {/* ============ HOME ============ */}
          {v.isHome && (
            <View style={sx({ padding: '4px 22px 28px', display: 'flex', flexDirection: 'column', gap: 20, boxSizing: 'border-box' })}>
              <View>
                <Text style={sx({ fontFamily: '"Noto Serif SC", "Songti SC", "STSong", Georgia, serif', fontSize: 30, color: '#f5f4fa', letterSpacing: 1, fontWeight: 600 })}>UtaNote</Text>
                <View style={sx({ fontSize: 12.5, color: 'rgba(255,255,255,0.45)', marginTop: 4 })}>把一首日语歌拆成可学会的每一句</View>
              </View>

              <View>
                <View style={sx({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 })}>
                  <Text style={sx({ fontSize: 15, fontWeight: 600, color: '#f0f0f5' })}>导入歌词</Text>
                  <Text onClick={v.fillSample} style={sx({ fontSize: 12.5, color: 'rgba(255,255,255,0.5)' })}>示例歌词</Text>
                </View>
                <Input
                  value={v.songTitle}
                  onInput={(e) => v.setSongTitle(e.detail.value)}
                  placeholder="输入歌曲名称（可选，默认取首行歌词）"
                  placeholderStyle={PLACEHOLDER}
                  style={sx({ width: '100%', height: 42, boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '0 14px', fontSize: 13.5, color: '#eceaf3', marginBottom: 10 })}
                />
                <View style={sx({ position: 'relative' })}>
                  <Textarea
                    value={v.lyricsText}
                    onInput={(e) => v.setLyrics(e.detail.value)}
                    maxlength={5000}
                    placeholder="粘贴或输入日文歌词（支持假名/汉字）"
                    placeholderStyle={PLACEHOLDER}
                    style={sx({ width: '100%', height: 150, boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 14, fontSize: 13.5, color: '#eceaf3' })}
                  />
                  <View style={sx({ position: 'absolute', right: 12, bottom: 10, fontSize: 11, color: 'rgba(255,255,255,0.3)' })}>{v.lyricsCount} / 5000</View>
                </View>
              </View>

              <View>
                <View style={sx({ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 8 })}>或从以下方式导入</View>
                <View style={sx({ display: 'flex', gap: 8 })}>
                  {['📄 文件导入', '📋 从剪贴板', '🔗 链接解析'].map((t) => (
                    <View key={t} style={sx({ flex: 1, textAlign: 'center', padding: '10px 6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, fontSize: 12, color: 'rgba(255,255,255,0.65)' })}>{t}</View>
                  ))}
                </View>
              </View>

              {v.parseError ? <View onClick={v.dismissParseError} style={sx(errBanner)}>{v.parseError}（点击关闭）</View> : null}
              {v.parseNotice ? <View onClick={v.dismissParseNotice} style={sx(noticeBanner)}>{v.parseNotice}（点击关闭）</View> : null}

              <View onClick={v.parsing ? undefined : v.startBreakdown} style={sx({ ...primaryBtn, opacity: v.parsing ? 0.6 : 1 })}>
                {v.parsing ? '解析中…' : '开始拆解 ✨'}
              </View>
            </View>
          )}

          {/* ============ TASKS ============ */}
          {v.isTasks && (
            <View style={sx({ padding: '4px 22px 24px', display: 'flex', flexDirection: 'column', gap: 16 })}>
              <View style={sx({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
                <View>
                  <Text style={sx({ fontSize: 22, fontWeight: 700, color: '#f5f4fa' })}>今日任务</Text>
                  <View style={sx({ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 3 })}>《{v.activeSongTitle}》</View>
                </View>
                <View style={sx({ width: 42, height: 42, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 })}>
                  <View style={sx({ position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: '50%', border: '3px solid transparent', borderTopColor: '#8489e0', borderRightColor: '#8489e0', transform: 'rotate(45deg)' })} />
                  <View style={sx({ textAlign: 'center' })}>
                    <View style={sx({ fontSize: 13, fontWeight: 700, color: '#f0f0f5' })}>{v.sentenceCount}</View>
                    <View style={sx({ fontSize: 8, color: 'rgba(255,255,255,0.4)' })}>句</View>
                  </View>
                </View>
              </View>

              <View style={sx({ display: 'flex', flexDirection: 'column', gap: 9 })}>
                {v.taskRows.map((row) => (
                  <View key={row.key} onClick={row.onClick} style={sx({ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 13, background: 'rgba(255,255,255,0.04)', border: `1px solid ${row.borderColor}` })}>
                    <View style={sx({ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'rgba(255,255,255,0.5)', flexShrink: 0 })}>{row.label}</View>
                    <View style={sx({ flex: 1, fontSize: 13.5, color: '#eceaf3' })}>{row.text}</View>
                    <View style={sx({ fontSize: 10.5, padding: '3px 8px', borderRadius: 20, background: row.badgeBg, color: row.badgeColor, flexShrink: 0 })}>{row.status}</View>
                    <View style={sx({ color: 'rgba(255,255,255,0.25)', fontSize: 13 })}>›</View>
                  </View>
                ))}
              </View>

              <View onClick={v.startPractice} style={sx(primaryBtn)}>开始今天的练习 ▶</View>
            </View>
          )}

          {/* ============ CARD ============ */}
          {v.isCard && (
            <View style={sx({ padding: '2px 22px 20px', display: 'flex', flexDirection: 'column', gap: 18 })}>
              <View style={sx({ display: 'flex', alignItems: 'center', gap: 12 })}>
                <View onClick={v.backToTasks} style={sx({ width: 36, height: 36, lineHeight: '30px', textAlign: 'center', fontSize: 24, color: 'rgba(255,255,255,0.6)', flexShrink: 0 })}>‹</View>
                <View style={sx({ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' })}>
                  <View style={sx({ height: '100%', borderRadius: 2, background: '#8489e0', width: `${v.cardProgressPct}%` })} />
                </View>
                <View style={sx({ fontSize: 12, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' })}>{v.cardPositionLabel}</View>
                <View style={sx({ color: 'rgba(255,255,255,0.35)', fontSize: 15 })}>⋮</View>
              </View>

              <View>
                <View style={sx({ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 })}>
                  <View style={sx({ fontSize: 13, color: 'rgba(255,255,255,0.45)' })}>今日第 {v.currentSentence.num} 句</View>
                  <View onClick={v.togglePlay} style={sx({ fontSize: 13, color: v.playIconColor })}>🔊</View>
                </View>
                <Text style={sx({ fontSize: 21, lineHeight: 1.6, color: '#f5f4fa', fontWeight: 600 })}>
                  <Text>{v.currentSplit.pre}</Text>
                  <Text onClick={() => v.openWordModal(v.currentSentence.detail)} style={sx({ color: '#a5a8ec', fontWeight: 700, textDecoration: 'underline' })}>{v.currentSplit.word}</Text>
                  <Text>{v.currentSplit.post}</Text>
                </Text>
                <View onClick={() => v.openWordModal(v.currentSentence.detail)} style={sx({ marginTop: 12, fontSize: 11.5, color: '#a5a8ec', border: '1px solid rgba(165,168,236,0.35)', padding: '6px 12px', borderRadius: 20, width: 'fit-content' })}>点击「{v.currentSentence.highlightWord}」查看详情 →</View>
              </View>

              <View>
                <View style={sx({ fontSize: 11.5, color: 'rgba(255,255,255,0.35)', marginBottom: 4 })}>整句语法结构</View>
                <View style={sx({ fontSize: 12, color: '#a5a8ec', marginBottom: 8 })}>{v.currentSentence.structure}</View>
                <View style={sx({ display: 'flex', flexWrap: 'wrap', gap: 6 })}>
                  {v.tokenViews.map((tok) => (
                    <View key={tok.key} style={sx({ textAlign: 'center', padding: '6px 10px', borderRadius: 8, background: tok.bg, border: tok.border })}>
                      {tok.reading ? <View style={sx({ fontSize: 9, color: 'rgba(255,255,255,0.4)', lineHeight: 1.3 })}>{tok.reading}</View> : null}
                      <View style={sx({ fontSize: 13, color: tok.color, fontWeight: tok.weight })}>{tok.text}</View>
                      <View style={sx({ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2, whiteSpace: 'nowrap' })}>{tok.role}</View>
                    </View>
                  ))}
                </View>
              </View>

              <View onClick={v.toggleRomaji} style={sx({ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '6px 12px', width: 'fit-content' })}>
                <Text>{v.romajiToggleLabel}</Text>
                <Text style={sx({ transform: v.romajiArrowRotate })}>⌄</Text>
              </View>

              {v.romajiOpen && (
                <View style={sx({ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' })}>
                  <View style={sx({ fontSize: 13, color: '#cfcde8' })}>{v.currentSentence.furigana}</View>
                  <View style={sx({ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' })}>{v.currentSentence.romaji}</View>
                </View>
              )}

              <View>
                <View style={sx({ fontSize: 11.5, color: 'rgba(255,255,255,0.35)', marginBottom: 6 })}>中文释义</View>
                <View style={sx({ fontSize: 14, color: '#dedcee', lineHeight: 1.5 })}>{v.currentSentence.translation}</View>
              </View>

              <View style={sx({ display: 'flex', gap: 8 })}>
                {(v.currentSentence.tips || []).map((tip, i) => (
                  <View key={i} style={sx({ flex: 1, textAlign: 'center', padding: '9px 4px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' })}>
                    <View style={sx({ fontSize: 12.5, color: '#eceaf3' })}>{tip.main}</View>
                    <View style={sx({ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 })}>{tip.label}</View>
                  </View>
                ))}
              </View>

              <View style={sx({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 8 })}>
                <View onClick={v.prevCard} style={sx({ padding: '12px 20px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', fontSize: 13, opacity: v.prevOpacity })}>‹ 上一句</View>
                <View onClick={v.togglePlay} style={sx({ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #6b70cf, #8489e0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#fff', boxShadow: '0 6px 16px rgba(107,112,207,0.4)' })}>{v.playGlyph}</View>
                <View onClick={v.nextCard} style={sx({ padding: '12px 20px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', fontSize: 13 })}>{v.nextLabel} ›</View>
              </View>

              <View style={sx({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 4 })}>
                <View style={sx({ fontSize: 12, color: v.currentMasteryColor, background: 'rgba(255,255,255,0.04)', padding: '5px 12px', borderRadius: 16, border: `1px solid ${v.currentMasteryColor}33` })}>{v.currentMasteryLabel}</View>
                {v.currentMastery !== 'mastered' && (
                  <View onClick={v.markAsMastered} style={sx({ fontSize: 12, color: '#8ed6a8', background: 'rgba(142,214,168,0.1)', padding: '5px 14px', borderRadius: 16, border: '1px solid rgba(142,214,168,0.3)' })}>标记已掌握 ✓</View>
                )}
              </View>
            </View>
          )}

          {/* ============ SUMMARY ============ */}
          {v.isSummary && (
            <View style={sx({ padding: '4px 22px 24px', display: 'flex', flexDirection: 'column', gap: 16 })}>
              <Text style={sx({ fontSize: 22, fontWeight: 700, color: '#f5f4fa' })}>学习总结</Text>

              <View style={sx({ borderRadius: 16, padding: 18, background: 'linear-gradient(135deg, rgba(107,112,207,0.28), rgba(60,50,90,0.4))', border: '1px solid rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' })}>
                <View style={sx({ position: 'absolute', right: 14, top: 14, width: 34, height: 34, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #f4f0e0, #d9d3b8)' })} />
                <View style={sx({ fontSize: 13, color: 'rgba(255,255,255,0.7)' })}>你已学会</View>
                <View style={sx({ fontSize: 20, fontWeight: 700, color: '#fff', marginTop: 4 })}>1 首歌的 12 句</View>
                <View style={sx({ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 6 })}>继续保持，下一句会更动听 ✨</View>
              </View>

              <View>
                <View style={sx({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 })}>
                  <Text style={sx({ fontSize: 13, fontWeight: 600, color: '#eceaf3' })}>本周进度</Text>
                  <Text style={sx({ fontSize: 11, color: 'rgba(255,255,255,0.35)' })}>5.12 - 5.18</Text>
                </View>
                <View style={sx({ display: 'flex', gap: 6 })}>
                  {v.weekDays.map((day, i) => (
                    <View key={i} style={sx({ flex: 1, textAlign: 'center' })}>
                      <View style={sx({ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 5 })}>{day.label}</View>
                      <View style={sx({ width: '100%', aspectRatio: '1 / 1', borderRadius: '50%', background: day.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' })}>{day.mark}</View>
                    </View>
                  ))}
                </View>
              </View>

              <View style={sx({ display: 'flex', gap: 8 })}>
                {v.summaryStats.map((stat, i) => (
                  <View key={i} style={sx({ flex: 1, padding: '12px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' })}>
                    <View style={sx({ fontSize: 16, fontWeight: 700, color: '#f0f0f5' })}>{stat.value}</View>
                    <View style={sx({ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginTop: 3 })}>{stat.label}</View>
                    <View style={sx({ fontSize: 9.5, color: '#8ed6a8', marginTop: 2 })}>{stat.delta}</View>
                  </View>
                ))}
              </View>

              <View>
                <View style={sx({ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 })}>
                  <Text>句子掌握进度</Text><Text>12 / 32</Text>
                </View>
                <View style={sx({ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' })}>
                  <View style={sx({ height: '100%', width: '37%', background: 'linear-gradient(90deg, #6b70cf, #8489e0)', borderRadius: 3 })} />
                </View>
              </View>

              <View onClick={v.goHome} style={sx({ textAlign: 'center', padding: 13, borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#eceaf3', fontSize: 14, fontWeight: 600 })}>分享成就卡片 ⤴</View>
            </View>
          )}

          {/* ============ LIBRARY ============ */}
          {v.isLibrary && (
            <View style={sx({ padding: '4px 22px 24px', display: 'flex', flexDirection: 'column', gap: 16 })}>
              <Text style={sx({ fontSize: 22, fontWeight: 700, color: '#f5f4fa' })}>词库</Text>

              <Input
                value={v.librarySearch}
                onInput={(e) => v.setSearch(e.detail.value)}
                placeholder="搜索单词或释义"
                placeholderStyle={PLACEHOLDER}
                style={sx({ width: '100%', height: 42, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '0 14px', fontSize: 13.5, color: '#eceaf3' })}
              />

              <ScrollView scrollX style={sx({ whiteSpace: 'nowrap' })}>
                <View style={sx({ display: 'flex', gap: 8 })}>
                  {v.libraryFilterChips.map((chip) => (
                    <View key={chip.key} onClick={chip.onClick} style={sx({ whiteSpace: 'nowrap', padding: '7px 13px', borderRadius: 20, fontSize: 12.5, background: chip.bg, color: chip.color, border: chip.border })}>{chip.label}</View>
                  ))}
                </View>
              </ScrollView>

              <View style={sx({ display: 'flex', gap: 8, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' })}>
                <View style={sx({ flex: 1, textAlign: 'center' })}><View style={sx({ fontSize: 15, fontWeight: 700, color: '#f0f0f5' })}>{v.libraryStats.total}</View><View style={sx({ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 })}>累计词汇</View></View>
                <View style={sx({ flex: 1, textAlign: 'center' })}><View style={sx({ fontSize: 15, fontWeight: 700, color: '#8ed6a8' })}>{v.libraryStats.mastered}</View><View style={sx({ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 })}>已掌握</View></View>
                <View style={sx({ flex: 1, textAlign: 'center' })}><View style={sx({ fontSize: 15, fontWeight: 700, color: '#e8c468' })}>{v.libraryStats.learning}</View><View style={sx({ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 })}>学习中</View></View>
              </View>

              <View style={sx({ display: 'flex', flexDirection: 'column', gap: 9 })}>
                {v.filteredVocab.map((vv) => (
                  <View key={vv.key} onClick={vv.onClick} style={sx({ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' })}>
                    <View style={sx({ flex: 1 })}>
                      <View style={sx({ display: 'flex', alignItems: 'center', gap: 8 })}>
                        <View style={sx({ fontSize: 15, fontWeight: 600, color: '#f0f0f5' })}>{vv.word}</View>
                        <View style={sx({ fontSize: 11.5, color: 'rgba(255,255,255,0.4)' })}>{vv.kana}</View>
                      </View>
                      <View style={sx({ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 3 })}>{vv.meaning} · {vv.pos}</View>
                    </View>
                    <View style={sx({ fontSize: 10.5, padding: '3px 9px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', color: vv.statusColor, flexShrink: 0, whiteSpace: 'nowrap' })}>{vv.statusLabel}</View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ============ ME ============ */}
          {v.isMe && (
            <View style={sx({ padding: '4px 22px 24px', display: 'flex', flexDirection: 'column', gap: 16 })}>
              <View style={sx({ display: 'flex', alignItems: 'center', gap: 14 })}>
                <View style={sx({ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #6b70cf, #8489e0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff', flexShrink: 0 })}>学</View>
                <View>
                  <View style={sx({ fontSize: 17, fontWeight: 700, color: '#f5f4fa' })}>日语学习者</View>
                  <View style={sx({ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 })}>连续学习 4 天 🔥</View>
                </View>
              </View>

              <View>
                <View style={sx({ fontSize: 13, fontWeight: 600, color: '#eceaf3', marginBottom: 8 })}>我的歌曲</View>
                <View style={sx({ display: 'flex', flexDirection: 'column', gap: 9 })}>
                  {v.mySongs.map((song) => (
                    <View key={song.key} onClick={song.onClick} style={sx({ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' })}>
                      <View style={sx({ width: 40, height: 40, borderRadius: 10, background: song.avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.85)', flexShrink: 0 })}>{song.avatarChar}</View>
                      <View style={sx({ flex: 1, minWidth: 0 })}>
                        <View style={sx({ fontSize: 13.5, color: '#f0f0f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>{song.title}</View>
                        <View style={sx({ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3 })}>{song.subtitle}</View>
                      </View>
                      {song.onDelete && (
                        <View onClick={(e) => { e.stopPropagation(); song.onDelete() }} style={sx({ width: 28, height: 28, borderRadius: '50%', background: 'rgba(220,80,80,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#e05050', flexShrink: 0 })}>✕</View>
                      )}
                      <View style={sx({ color: 'rgba(255,255,255,0.25)', fontSize: 13 })}>›</View>
                    </View>
                  ))}
                </View>
              </View>

              <View>
                <View style={sx({ fontSize: 13, fontWeight: 600, color: '#eceaf3', marginBottom: 8 })}>设置</View>
                <View style={sx({ display: 'flex', flexDirection: 'column', borderRadius: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' })}>
                  <View style={sx({ padding: '13px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' })}>
                    <View style={sx({ display: 'flex', alignItems: 'center', fontSize: 13.5, color: '#eceaf3', marginBottom: 10 })}><View style={sx({ flex: 1 })}>字体大小</View><View style={sx({ color: 'rgba(255,255,255,0.4)', fontSize: 12 })}>{v.fontScaleLabel}</View></View>
                    <View style={sx({ display: 'flex', gap: 8 })}>
                      {v.fontScaleOptions.map((opt) => {
                        const active = v.fontScale === opt.key
                        return (
                          <View key={opt.key} onClick={() => v.setFontScaleAction(opt.key)} style={sx({ flex: 1, textAlign: 'center', padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: active ? 600 : 400, color: active ? '#a5a8ec' : 'rgba(255,255,255,0.5)', background: active ? 'rgba(165,168,236,0.15)' : 'rgba(255,255,255,0.04)', border: active ? '1px solid rgba(165,168,236,0.4)' : '1px solid rgba(255,255,255,0.07)' })}>{opt.label}</View>
                        )
                      })}
                    </View>
                  </View>
                  <View onClick={v.openAbout} style={sx({ display: 'flex', alignItems: 'center', padding: '13px 14px', fontSize: 13.5, color: '#eceaf3' })}><View style={sx({ flex: 1 })}>关于</View><View style={sx({ color: 'rgba(255,255,255,0.25)' })}>›</View></View>
                </View>
              </View>
            </View>
          )}

          {/* ============ ABOUT ============ */}
          {v.isAbout && (
            <View style={sx({ padding: '4px 22px 24px', display: 'flex', flexDirection: 'column', gap: 18 })}>
              <View style={sx({ display: 'flex', alignItems: 'center', gap: 12 })}>
                <View onClick={v.closeAbout} style={sx({ width: 36, height: 36, lineHeight: '30px', textAlign: 'center', fontSize: 24, color: 'rgba(255,255,255,0.6)', flexShrink: 0 })}>‹</View>
                <Text style={sx({ fontSize: 20, fontWeight: 700, color: '#f5f4fa' })}>关于</Text>
              </View>

              <View style={sx({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 0' })}>
                <View style={sx({ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg, #6b70cf, #8489e0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: '#fff' })}>歌</View>
                <Text style={sx({ fontFamily: '"Noto Serif SC", "Songti SC", Georgia, serif', fontSize: 24, color: '#f5f4fa', fontWeight: 600, letterSpacing: 1, marginTop: 4 })}>UtaNote</Text>
                <View style={sx({ fontSize: 12, color: 'rgba(255,255,255,0.4)' })}>v0.1.0</View>
              </View>

              <View style={sx({ fontSize: 13.5, color: '#dedcee', lineHeight: 1.8, textAlign: 'center' })}>
                把一首日语歌拆成可学会的每一句。通过 AI 解析歌词，为每句生成注音、翻译、语法讲解和词汇卡片，让你在喜欢的音乐中自然习得日语。
              </View>

              <View style={sx({ borderRadius: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px' })}>
                <View style={sx({ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 })}>
                  <View style={sx({ fontSize: 15 })}>🔒</View>
                  <View style={sx({ fontSize: 13, fontWeight: 600, color: '#eceaf3' })}>隐私优先</View>
                </View>
                <View style={sx({ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 })}>
                  你的歌词、收藏、学习进度等所有数据均保存在本设备本地存储中，不上传云端、不同步服务器。AI 解析仅将歌词文本发送至 DeepSeek 进行语法分析，不会关联任何个人信息。卸载小程序即彻底删除所有数据。
                </View>
              </View>

              <View style={sx({ borderRadius: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' })}>
                <View style={sx({ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex' })}><View style={sx({ fontSize: 12, color: 'rgba(255,255,255,0.4)', width: 70, flexShrink: 0 })}>开发者</View><View style={sx({ fontSize: 12.5, color: '#eceaf3' })}>jane-uske</View></View>
                <View style={sx({ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex' })}><View style={sx({ fontSize: 12, color: 'rgba(255,255,255,0.4)', width: 70, flexShrink: 0 })}>开源地址</View><View style={sx({ fontSize: 12.5, color: '#a5a8ec' })}>github.com/jane-uske/utanote</View></View>
                <View style={sx({ padding: '12px 14px', display: 'flex' })}><View style={sx({ fontSize: 12, color: 'rgba(255,255,255,0.4)', width: 70, flexShrink: 0 })}>AI 引擎</View><View style={sx({ fontSize: 12.5, color: '#eceaf3' })}>DeepSeek</View></View>
              </View>

              <View>
                <View style={sx({ fontSize: 13, fontWeight: 600, color: '#eceaf3', marginBottom: 10 })}>未来计划 🚀</View>
                <View style={sx({ display: 'flex', flexDirection: 'column', gap: 8 })}>
                  {[
                    { icon: '🎤', text: 'AI 评分带唱 & 教唱模式' },
                    { icon: '🔊', text: 'TTS 语音朗读（单词 & 例句）' },
                    { icon: '🎯', text: '每日学习目标与打卡' },
                    { icon: '📊', text: '学习数据统计与进度追踪' },
                    { icon: '👥', text: '分享成就卡片给好友' },
                  ].map((item) => (
                    <View key={item.text} style={sx({ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' })}>
                      <View style={sx({ fontSize: 16, flexShrink: 0 })}>{item.icon}</View>
                      <View style={sx({ fontSize: 12.5, color: 'rgba(255,255,255,0.65)' })}>{item.text}</View>
                    </View>
                  ))}
                </View>
              </View>

              <View style={sx({ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 8 })}>
                Made with ♡ for Japanese learners
              </View>
            </View>
          )}

        </View>
      </ScrollView>

      {/* ============ TAB BAR ============ */}
      {v.showTabBar && (
        <View style={sx({ display: 'flex', padding: '10px 8px 26px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(13,17,32,0.95)' })}>
          {v.tabs.map((tab) => (
            <View key={tab.key} onClick={tab.onClick} style={sx({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: tab.color })}>
              <View style={sx({ fontSize: 17 })}>{tab.icon}</View>
              <View style={sx({ fontSize: 10 })}>{tab.label}</View>
            </View>
          ))}
        </View>
      )}

      {/* ============ LOADING OVERLAY ============ */}
      {v.parsing && (
        <View style={sx({ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' })}>
          <View style={sx({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '0 32px' })}>
            <View style={sx({ width: 44, height: 44, border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#a5a8ec', borderRadius: '50%', animation: 'spin 0.8s linear infinite' })} />
            <View style={sx({ fontSize: 15, color: '#eceaf3', fontWeight: 600 })}>{v.parseStage || 'AI 正在解析歌词…'}</View>
            {v.parseElapsed > 0 && (
              <View style={sx({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 })}>
                <View style={sx({ fontSize: 12, color: 'rgba(255,255,255,0.5)' })}>已等待 {v.parseElapsed} 秒</View>
                <View style={sx({ width: 180, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' })}>
                  <View style={sx({ height: '100%', borderRadius: 2, background: '#8489e0', width: `${Math.min(v.parseElapsed / 20 * 100, 95)}%`, transition: 'width 1s linear' })} />
                </View>
              </View>
            )}
            <View style={sx({ fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 1.6 })}>
              {v.parseElapsed < 5 ? '分批并发请求 AI 中，通常 10~15 秒完成' : v.parseElapsed < 15 ? '正在等待 AI 返回结构化解析结果…' : '歌词较长，请耐心等待，即将完成'}
            </View>
          </View>
        </View>
      )}

      {/* ============ WORD MODAL ============ */}
      {v.showModal && (
        <View onClick={v.closeWordModal} style={sx({ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)', zIndex: 40, display: 'flex', alignItems: 'flex-end' })}>
          <ScrollView scrollY catchMove onClick={(e) => e.stopPropagation()} style={sx({ width: '100%', maxHeight: '78%', background: '#161a2c', borderRadius: '22px 22px 0 0', border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none' })}>
            <View style={sx({ padding: '18px 20px 26px', display: 'flex', flexDirection: 'column', gap: 14 })}>
              <View style={sx({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
                <View style={sx({ fontSize: 13, color: 'rgba(255,255,255,0.4)' })}>词语详情</View>
                <View onClick={v.closeWordModal} style={sx({ fontSize: 16, color: 'rgba(255,255,255,0.5)' })}>✕</View>
              </View>

              <View style={sx({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
                <View style={sx({ display: 'flex', alignItems: 'center', gap: 8 })}>
                  <View style={sx({ fontSize: 22, fontWeight: 700, color: '#fff' })}>{v.currentDetail.word}</View>
                  <View onClick={v.togglePlay} style={sx({ fontSize: 14, color: v.playIconColor })}>🔊</View>
                </View>
                <View style={sx({ display: 'flex', alignItems: 'center', gap: 10 })}>
                  <View style={sx({ fontSize: 11, color: v.currentMasteryColor, padding: '3px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.05)' })}>{v.currentMasteryLabel}</View>
                  <View onClick={v.toggleFavorite} style={sx({ fontSize: 20, color: v.favoriteColor })}>{v.favoriteGlyph}</View>
                </View>
              </View>
              <View>
                <View style={sx({ fontSize: 14, color: '#cfcde8' })}>{v.currentDetail.kana}</View>
                <View style={sx({ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginTop: 2 })}>{v.currentDetail.romaji}</View>
              </View>

              <View>
                <View style={sx({ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 })}>词性/词类</View>
                <View style={sx({ fontSize: 13.5, color: '#eceaf3' })}>{v.currentDetail.pos}</View>
              </View>
              <View>
                <View style={sx({ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 })}>中文释义</View>
                <View style={sx({ fontSize: 15, fontWeight: 600, color: '#fff' })}>{v.currentDetail.meaning}</View>
              </View>
              <View>
                <View style={sx({ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 5 })}>语法解析</View>
                <View style={sx({ fontSize: 12.5, color: '#dedcee', lineHeight: 1.6 })}>{v.currentDetail.grammar}</View>
                {v.currentDetail.formula ? <View style={sx({ marginTop: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, textAlign: 'center', fontSize: 12.5, color: '#a5a8ec' })}>{v.currentDetail.formula}</View> : null}
              </View>
              <View>
                <View style={sx({ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 })}>相关标签</View>
                <View style={sx({ display: 'flex', gap: 6, flexWrap: 'wrap' })}>
                  {(v.currentDetail.tags || []).map((tag) => (
                    <View key={tag} style={sx({ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' })}>{tag}</View>
                  ))}
                </View>
              </View>
              <View style={sx({ paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' })}>
                <View style={sx({ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 })}>例句</View>
                <View style={sx({ display: 'flex', alignItems: 'center', gap: 8 })}>
                  <View style={sx({ fontSize: 13.5, color: '#eceaf3' })}>{v.currentDetail.example ? v.currentDetail.example.jp : ''}</View>
                  <View onClick={v.togglePlay} style={sx({ fontSize: 12, color: v.playIconColor })}>🔊</View>
                </View>
                <View style={sx({ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 })}>{v.currentDetail.example ? v.currentDetail.example.cn : ''}</View>
              </View>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  )
}
