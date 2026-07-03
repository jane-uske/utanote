import IOSDevice from './IOSDevice.jsx'
import { useUtaNote } from './useUtaNote.js'

// View layer only. All state / derived values / handlers come from
// useUtaNote(). Porting to Taro means re-expressing the markup below
// with View/Text/Input — the hook and data.js carry over unchanged.

const FONT_SERIF = "'Noto Serif SC', serif"
const FONT_SANS = "'Noto Sans SC', sans-serif"

const primaryBtn = {
  cursor: 'pointer', textAlign: 'center', padding: 14, borderRadius: 14,
  background: 'linear-gradient(135deg, #6b70cf, #8489e0)', color: '#fff',
  fontSize: 15, fontWeight: 600, boxShadow: '0 8px 20px rgba(107,112,207,0.35)',
}

const errBanner = {
  cursor: 'pointer', fontSize: 12, lineHeight: 1.5, color: '#ffb4b4',
  background: 'rgba(220,80,80,0.12)', border: '1px solid rgba(220,80,80,0.3)',
  borderRadius: 10, padding: '10px 12px',
}
const noticeBanner = {
  cursor: 'pointer', fontSize: 12, lineHeight: 1.5, color: '#cfe0ff',
  background: 'rgba(120,140,220,0.12)', border: '1px solid rgba(140,160,230,0.28)',
  borderRadius: 10, padding: '10px 12px',
}
const fieldLabel = { fontSize: 11.5, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }
const fieldInput = {
  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#eceaf3', outline: 'none',
  fontFamily: FONT_SANS,
}

export default function App() {
  const v = useUtaNote()

  return (
    <div
      style={{
        width: '100%', minHeight: '100vh',
        background:
          'radial-gradient(circle at 78% 8%, rgba(180,190,255,0.10), transparent 40%), linear-gradient(180deg, #0a0c16 0%, #0d1220 55%, #0a0d18 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '48px 24px', fontFamily: FONT_SANS, gap: 18,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: FONT_SERIF, fontSize: 26, color: '#f2f0f8', letterSpacing: '0.5px' }}>
          UtaNote <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.35)' }}>可交互原型</span>
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>把一首日语歌拆成可学会的每一句。通过 AI 解析歌词，为每句生成注音、翻译、语法讲解和词汇卡片，让你在喜欢的音乐中自然习得日语</div>
      </div>

      <IOSDevice dark width={402} height={874}>
        <div
          style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            background: '#0d1120', color: '#f2f2f6', position: 'relative', overflow: 'hidden',
          }}
        >
          <div className="dc-scroll" style={{ flex: 1, overflowY: 'auto', paddingTop: 56, display: 'flex', flexDirection: 'column' }}>

            {/* ============ HOME ============ */}
            {v.isHome && (
              <div style={{ padding: '4px 22px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <div style={{ fontFamily: FONT_SERIF, fontSize: 30, color: '#f5f4fa', letterSpacing: '0.5px' }}>UtaNote</div>
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>把一首日语歌拆成可学会的每一句。通过 AI 解析歌词，为每句生成注音、翻译、语法讲解和词汇卡片，让你在喜欢的音乐中自然习得日语</div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f5' }}>导入歌词</div>
                    <div onClick={v.fillSample} style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>示例歌词</div>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <textarea
                      placeholder="粘贴或输入日文歌词（支持假名/汉字）"
                      value={v.lyricsText}
                      onChange={(e) => v.setLyrics(e.target.value)}
                      style={{
                        width: '100%', height: 150, background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 14,
                        fontSize: 13.5, color: '#eceaf3', resize: 'none', fontFamily: FONT_SANS, outline: 'none',
                      }}
                    />
                    <div style={{ position: 'absolute', right: 12, bottom: 10, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{v.lyricsCount} / 5000</div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>或从以下方式导入</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['📄 文件导入', '📋 从剪贴板', '🔗 链接解析'].map((t) => (
                      <div key={t} style={{ flex: 1, textAlign: 'center', padding: '10px 6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{t}</div>
                    ))}
                  </div>
                </div>

                {v.parseError && (
                  <div onClick={v.dismissParseError} style={errBanner}>{v.parseError}（点击关闭）</div>
                )}
                {v.parseNotice && (
                  <div onClick={v.dismissParseNotice} style={noticeBanner}>{v.parseNotice}（点击关闭）</div>
                )}

                <div
                  onClick={v.parsing ? undefined : v.startBreakdown}
                  style={{ ...primaryBtn, opacity: v.parsing ? 0.6 : 1, cursor: v.parsing ? 'default' : 'pointer' }}
                >
                  {v.parsing ? '解析中…' : '开始拆解 ✨'}
                </div>
              </div>
            )}

            {/* ============ TASKS ============ */}
            {v.isTasks && (
              <div style={{ padding: '4px 22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#f5f4fa' }}>今日任务</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>《{v.songTitle}》</div>
                  </div>
                  <div style={{ width: 58, height: 58, borderRadius: '50%', border: '4px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '4px solid transparent', borderTopColor: '#8489e0', borderRightColor: '#8489e0', transform: 'rotate(45deg)' }} />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f5' }}>{v.sentenceCount}</div>
                      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>句</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {v.taskRows.map((row) => (
                    <div key={row.key} onClick={row.onClick} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 13, background: 'rgba(255,255,255,0.04)', border: `1px solid ${row.borderColor}` }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>{row.label}</div>
                      <div style={{ flex: 1, fontSize: 13.5, color: '#eceaf3' }}>{row.text}</div>
                      <div style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 20, background: row.badgeBg, color: row.badgeColor, flexShrink: 0 }}>{row.status}</div>
                      <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>›</div>
                    </div>
                  ))}
                </div>

                <div onClick={v.startPractice} style={primaryBtn}>开始今天的练习 ▶</div>
              </div>
            )}

            {/* ============ CARD ============ */}
            {v.isCard && (
              <div style={{ padding: '2px 22px 20px', display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div onClick={v.backToTasks} style={{ cursor: 'pointer', fontSize: 18, color: 'rgba(255,255,255,0.6)' }}>‹</div>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, background: '#8489e0', width: `${v.cardProgressPct}%` }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>{v.cardPositionLabel}</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 15 }}>⋮</div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>今日第 {v.currentSentence.num} 句</div>
                    <div onClick={v.togglePlay} style={{ cursor: 'pointer', fontSize: 13, color: v.playIconColor }}>🔊</div>
                  </div>
                  <div style={{ fontSize: 21, lineHeight: 1.6, color: '#f5f4fa', fontWeight: 600 }}>
                    <span>{v.currentSplit.pre}</span>
                    <span onClick={() => v.openWordModal(v.currentSentence.detail)} style={{ color: '#a5a8ec', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4 }}>{v.currentSplit.word}</span>
                    <span>{v.currentSplit.post}</span>
                  </div>
                  <div onClick={() => v.openWordModal(v.currentSentence.detail)} style={{ cursor: 'pointer', display: 'inline-block', marginTop: 6, fontSize: 11.5, color: '#a5a8ec', border: '1px solid rgba(165,168,236,0.35)', padding: '3px 10px', borderRadius: 20 }}>点击「{v.currentSentence.highlightWord}」查看详情 →</div>
                </div>

                <div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>整句语法结构</div>
                  <div style={{ fontSize: 12, color: '#a5a8ec', marginBottom: 8 }}>{v.currentSentence.structure}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {v.tokenViews.map((tok) => (
                      <div key={tok.key} style={{ textAlign: 'center', padding: '6px 10px', borderRadius: 8, background: tok.bg, border: tok.border }}>
                        {tok.reading && (
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', lineHeight: 1.3 }}>{tok.reading}</div>
                        )}
                        <div style={{ fontSize: 13, color: tok.color, fontWeight: tok.weight }}>{tok.text}</div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2, whiteSpace: 'nowrap' }}>{tok.role}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div onClick={v.toggleRomaji} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '6px 12px', width: 'fit-content' }}>
                  <span>{v.romajiToggleLabel}</span>
                  <span style={{ transform: v.romajiArrowRotate }}>⌄</span>
                </div>

                {v.romajiOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 13, color: '#cfcde8' }}>{v.currentSentence.furigana}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>{v.currentSentence.romaji}</div>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>中文释义</div>
                  <div style={{ fontSize: 14, color: '#dedcee', lineHeight: 1.5 }}>{v.currentSentence.translation}</div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {v.currentSentence.tips.map((tip, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center', padding: '9px 4px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ fontSize: 12.5, color: '#eceaf3' }}>{tip.main}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{tip.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ flex: 1 }} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                  <div onClick={v.prevCard} style={{ cursor: 'pointer', padding: '12px 20px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', fontSize: 13, opacity: v.prevOpacity }}>‹ 上一句</div>
                  <div onClick={v.togglePlay} style={{ cursor: 'pointer', width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #6b70cf, #8489e0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#fff', boxShadow: '0 6px 16px rgba(107,112,207,0.4)' }}>{v.playGlyph}</div>
                  <div onClick={v.nextCard} style={{ cursor: 'pointer', padding: '12px 20px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{v.nextLabel} ›</div>
                </div>
              </div>
            )}

            {/* ============ SUMMARY ============ */}
            {v.isSummary && (
              <div style={{ padding: '4px 22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#f5f4fa' }}>学习总结</div>

                <div style={{ borderRadius: 16, padding: 18, background: 'linear-gradient(135deg, rgba(107,112,207,0.28), rgba(60,50,90,0.4))', border: '1px solid rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', right: 14, top: 14, width: 34, height: 34, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #f4f0e0, #d9d3b8)' }} />
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>你已学会</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginTop: 4 }}>1 首歌的 12 句</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>继续保持，下一句会更动听 ✨</div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#eceaf3' }}>本周进度</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>5.12 - 5.18</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {v.weekDays.map((day, i) => (
                      <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 5 }}>{day.label}</div>
                        <div style={{ width: '100%', aspectRatio: '1', borderRadius: '50%', background: day.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>{day.mark}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {v.summaryStats.map((stat, i) => (
                    <div key={i} style={{ flex: 1, padding: '12px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f5' }}>{stat.value}</div>
                      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>{stat.label}</div>
                      <div style={{ fontSize: 9.5, color: '#8ed6a8', marginTop: 2 }}>{stat.delta}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                    <span>句子掌握进度</span><span>12 / 32</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '37%', background: 'linear-gradient(90deg, #6b70cf, #8489e0)', borderRadius: 3 }} />
                  </div>
                </div>

                <div onClick={v.goHome} style={{ cursor: 'pointer', textAlign: 'center', padding: 13, borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#eceaf3', fontSize: 14, fontWeight: 600 }}>分享成就卡片 ⤴</div>
              </div>
            )}

            {/* ============ LIBRARY (词库) ============ */}
            {v.isLibrary && (
              <div style={{ padding: '4px 22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#f5f4fa' }}>词库</div>

                <input
                  placeholder="搜索单词或释义"
                  value={v.librarySearch}
                  onChange={(e) => v.setSearch(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '11px 14px', fontSize: 13.5, color: '#eceaf3', outline: 'none', fontFamily: FONT_SANS }}
                />

                <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
                  {v.libraryFilterChips.map((chip) => (
                    <div key={chip.key} onClick={chip.onClick} style={{ cursor: 'pointer', whiteSpace: 'nowrap', padding: '7px 13px', borderRadius: 20, fontSize: 12.5, background: chip.bg, color: chip.color, border: chip.border }}>{chip.label}</div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ flex: 1, textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f5' }}>{v.libraryStats.total}</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>累计词汇</div></div>
                  <div style={{ flex: 1, textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 700, color: '#8ed6a8' }}>{v.libraryStats.mastered}</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>已掌握</div></div>
                  <div style={{ flex: 1, textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 700, color: '#e8c468' }}>{v.libraryStats.learning}</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>学习中</div></div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {v.filteredVocab.map((vv) => (
                    <div key={vv.word} onClick={vv.onClick} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f5' }}>{vv.word}</div>
                          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>{vv.kana}</div>
                        </div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>{vv.meaning} · {vv.pos}</div>
                      </div>
                      <div style={{ fontSize: 10.5, padding: '3px 9px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', color: vv.statusColor, flexShrink: 0, whiteSpace: 'nowrap' }}>{vv.statusLabel}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ============ ME (我的) ============ */}
            {v.isMe && (
              <div style={{ padding: '4px 22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #6b70cf, #8489e0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff', flexShrink: 0 }}>学</div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#f5f4fa' }}>日语学习者</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>连续学习 4 天 🔥</div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#eceaf3', marginBottom: 8 }}>我的歌曲</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {v.mySongs.map((song) => (
                      <div key={song.key} onClick={song.onClick} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'radial-gradient(circle at 35% 35%, #4a4f7a, #23263c)', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13.5, color: '#f0f0f5' }}>{song.title}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>{song.subtitle}</div>
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>›</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#eceaf3', marginBottom: 8 }}>设置</div>
                  <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div onClick={v.openSettings} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '13px 14px', fontSize: 13.5, color: '#eceaf3', borderBottom: '1px solid rgba(255,255,255,0.06)' }}><div style={{ flex: 1 }}>AI 解析设置</div><div style={{ color: v.hasApiKey ? '#8ed6a8' : 'rgba(255,255,255,0.4)', fontSize: 12 }}>{v.hasApiKey ? '已配置' : '未配置'}</div><div style={{ color: 'rgba(255,255,255,0.25)', marginLeft: 8 }}>›</div></div>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '13px 14px', fontSize: 13.5, color: '#eceaf3', borderBottom: '1px solid rgba(255,255,255,0.06)' }}><div style={{ flex: 1 }}>学习目标</div><div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>每日 4 句</div><div style={{ color: 'rgba(255,255,255,0.25)', marginLeft: 8 }}>›</div></div>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '13px 14px', fontSize: 13.5, color: '#eceaf3', borderBottom: '1px solid rgba(255,255,255,0.06)' }}><div style={{ flex: 1 }}>通知</div><div style={{ color: 'rgba(255,255,255,0.25)' }}>›</div></div>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '13px 14px', fontSize: 13.5, color: '#eceaf3' }}><div style={{ flex: 1 }}>关于</div><div style={{ color: 'rgba(255,255,255,0.25)' }}>›</div></div>
                  </div>
                </div>
              </div>
            )}

            {/* ============ SETTINGS (AI 解析) ============ */}
            {v.isSettings && (
              <div style={{ padding: '4px 22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div onClick={v.closeSettings} style={{ cursor: 'pointer', fontSize: 18, color: 'rgba(255,255,255,0.6)' }}>‹</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#f5f4fa' }}>AI 解析设置</div>
                </div>

                <div style={{ fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.5)' }}>
                  分词与假名在本地完成；语法讲解、翻译、生词释义由你配置的模型生成。填入任意 OpenAI 兼容接口即可（DeepSeek / 通义千问 / Moonshot / OpenAI 等）。
                </div>

                <div>
                  <div style={fieldLabel}>API 地址（到 /v1 为止）</div>
                  <input
                    value={v.settingsDraft.baseURL}
                    onChange={(e) => v.updateSettingsDraft({ baseURL: e.target.value })}
                    placeholder="https://api.deepseek.com/v1"
                    autoComplete="off" autoCapitalize="none" spellCheck={false}
                    style={fieldInput}
                  />
                </div>

                <div>
                  <div style={fieldLabel}>API Key</div>
                  <input
                    type="password"
                    value={v.settingsDraft.apiKey}
                    onChange={(e) => v.updateSettingsDraft({ apiKey: e.target.value })}
                    placeholder="sk-..."
                    autoComplete="off" autoCapitalize="none" spellCheck={false}
                    style={fieldInput}
                  />
                </div>

                <div>
                  <div style={fieldLabel}>模型名</div>
                  <input
                    value={v.settingsDraft.model}
                    onChange={(e) => v.updateSettingsDraft({ model: e.target.value })}
                    placeholder="deepseek-chat"
                    autoComplete="off" autoCapitalize="none" spellCheck={false}
                    style={fieldInput}
                  />
                </div>

                <div onClick={v.saveSettingsAction} style={primaryBtn}>保存</div>

                <div style={{ fontSize: 11, lineHeight: 1.6, color: 'rgba(255,255,255,0.35)' }}>
                  密钥仅保存在本机浏览器，不会上传到任何服务器。浏览器直连第三方接口可能受跨域（CORS）限制；若报错，可将地址改为支持 CORS 的中转。
                </div>
              </div>
            )}

          </div>

          {/* ============ TAB BAR ============ */}
          {v.showTabBar && (
            <div style={{ display: 'flex', padding: '10px 8px 26px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(13,17,32,0.9)' }}>
              {v.tabs.map((tab) => (
                <div key={tab.key} onClick={tab.onClick} style={{ flex: 1, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: tab.color }}>
                  <div style={{ fontSize: 17 }}>{tab.icon}</div>
                  <div style={{ fontSize: 10 }}>{tab.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* ============ WORD MODAL ============ */}
          {v.showModal && (
            <div onClick={v.closeWordModal} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 40, display: 'flex', alignItems: 'flex-end' }}>
              <div onClick={(e) => e.stopPropagation()} className="dc-scroll" style={{ width: '100%', maxHeight: '78%', background: '#161a2c', borderRadius: '22px 22px 0 0', border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none', padding: '18px 20px 26px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>词语详情</div>
                  <div onClick={v.closeWordModal} style={{ cursor: 'pointer', fontSize: 16, color: 'rgba(255,255,255,0.5)' }}>✕</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{v.currentDetail.word}</div>
                    <div onClick={v.togglePlay} style={{ cursor: 'pointer', fontSize: 14, color: v.playIconColor }}>🔊</div>
                  </div>
                  <div onClick={v.toggleFavorite} style={{ cursor: 'pointer', fontSize: 20, color: v.favoriteColor }}>{v.favoriteGlyph}</div>
                </div>
                <div>
                  <div style={{ fontSize: 14, color: '#cfcde8' }}>{v.currentDetail.kana}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginTop: 2 }}>{v.currentDetail.romaji}</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>词性/词类</div>
                  <div style={{ fontSize: 13.5, color: '#eceaf3' }}>{v.currentDetail.pos}</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>中文释义</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{v.currentDetail.meaning}</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 5 }}>语法解析</div>
                  <div style={{ fontSize: 12.5, color: '#dedcee', lineHeight: 1.6 }}>{v.currentDetail.grammar}</div>
                  <div style={{ marginTop: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, textAlign: 'center', fontSize: 12.5, color: '#a5a8ec' }}>{v.currentDetail.formula}</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>相关标签</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {v.currentDetail.tags.map((tag) => (
                      <div key={tag} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>{tag}</div>
                    ))}
                  </div>
                </div>

                <div style={{ paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>例句</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 13.5, color: '#eceaf3' }}>{v.currentDetail.example.jp}</div>
                    <div onClick={v.togglePlay} style={{ cursor: 'pointer', fontSize: 12, color: v.playIconColor }}>🔊</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{v.currentDetail.example.cn}</div>
                </div>
              </div>
            </div>
          )}

        </div>
      </IOSDevice>

      <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.3)', textAlign: 'center', maxWidth: 340 }}>点击卡片内容进行体验：导入 → 每日任务 → 逐句学习（点词查看详情）→ 学习总结</div>
    </div>
  )
}
