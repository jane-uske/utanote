import { useRef, useState } from 'react'
import { useShareAppMessage } from '@tarojs/taro'
import { View, Text, Textarea, Input, ScrollView, Button, Image } from '@tarojs/components'
import { useUtaNote } from '../../logic/useUtaNote'
import { sx } from '../../logic/sx'
import { COPY } from '../../logic/copy'
import appLogo from '../../assets/app-logo.png'
import './index.css'

// Swipe tuning for the card screen (Douyin-style vertical flip):
// finger tracks 1:1 while dragging, then either commits to prev/next
// (fast flick or dragged far enough) or rubber-bands back to center.
const SWIPE_COMMIT_DISTANCE = 56 // px — always commits past this
const SWIPE_FLICK_DISTANCE = 22  // px — commits if also this fast
const SWIPE_FLICK_MS = 280
const SWIPE_MAX_DRAG = 110       // px — visual clamp while dragging

const primaryBtn = {
  textAlign: 'center', padding: 14, borderRadius: 14,
  background: 'linear-gradient(135deg, #6b70cf, #8489e0)', color: '#fff',
  fontSize: 15, fontWeight: 600, boxShadow: '0 8px 20px rgba(107,112,207,0.35)',
}
const errBanner = {
  fontSize: 12, lineHeight: 1.5, color: 'var(--error-text)',
  background: 'rgba(220,80,80,0.12)', border: '1px solid rgba(220,80,80,0.3)',
  borderRadius: 10, padding: '10px 12px',
}
const noticeBanner = {
  fontSize: 12, lineHeight: 1.5, color: 'var(--notice-text)',
  background: 'rgba(120,140,220,0.12)', border: '1px solid rgba(140,160,230,0.28)',
  borderRadius: 10, padding: '10px 12px',
}
const fieldLabel = { fontSize: 11.5, color: 'var(--ink-5)', marginBottom: 6 }
const fieldInput = {
  width: '100%', height: 42, background: 'var(--ink-04)', border: '1px solid var(--ink-1)',
  borderRadius: 10, padding: '0 12px', fontSize: 13, color: 'var(--text-body)',
}
const PLACEHOLDER = 'color: var(--ink-3)'

export default function Index() {
  const v = useUtaNote()

  // Enables WeChat forwarding (top-right menu + the summary's open-type=share
  // button). Runtime-only — the actual card must be verified on a real device.
  useShareAppMessage(() => ({
    title: v.shareTitle,
    path: '/pages/index/index',
  }))

  // Live-tracking swipe for the card screen — dragY follows the finger
  // during the gesture (dragAnim off), then either snaps instantly (a
  // committed swipe hands off to the card's own entrance animation) or
  // eases back to 0 (an aborted drag, dragAnim on).
  const [dragY, setDragY] = useState(0)
  const [dragAnim, setDragAnim] = useState(false)
  const touchRef = useRef({ y: 0, t: 0, active: false })

  const onCardTouchStart = (e) => {
    if (v.showModal) return
    const t = e.touches && e.touches[0]
    if (!t) return
    touchRef.current = { y: t.clientY, t: Date.now(), active: true }
    setDragAnim(false)
  }
  const onCardTouchMove = (e) => {
    if (!touchRef.current.active) return
    const t = e.touches && e.touches[0]
    if (!t) return
    const raw = t.clientY - touchRef.current.y
    setDragY(Math.max(-SWIPE_MAX_DRAG, Math.min(SWIPE_MAX_DRAG, raw)))
  }
  const onCardTouchEnd = () => {
    if (!touchRef.current.active) return
    touchRef.current.active = false
    const dy = dragY
    const dt = Date.now() - touchRef.current.t
    const commit = Math.abs(dy) > SWIPE_COMMIT_DISTANCE
      || (dt < SWIPE_FLICK_MS && Math.abs(dy) > SWIPE_FLICK_DISTANCE)
    if (commit) {
      setDragAnim(false)
      setDragY(0)
      if (dy < 0) v.nextCard()
      else v.prevCard()
    } else {
      setDragAnim(true)
      setDragY(0)
    }
  }

  return (
    <View
      className={v.themeClass}
      style={sx({
        height: '100vh', display: 'flex', flexDirection: 'column',
        background: 'var(--bg)', color: 'var(--text-root)', position: 'relative', overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      })}
    >
      <ScrollView scrollY style={sx({ flex: 1, minHeight: 0, background: 'var(--bg)' })}>
        <View style={sx({ minHeight: '100%', paddingTop: (v.isCard || v.isAbout) ? v.contentTopCard : v.isHome ? v.contentTopHome : v.contentTopDefault, paddingBottom: 8, background: 'var(--bg)' })}>

          {/* ============ HOME ============ */}
          {v.isHome && (
            <View className="screen" style={sx({ padding: '4px 22px 28px', display: 'flex', flexDirection: 'column', gap: 20, boxSizing: 'border-box' })}>
              <View>
                <Text style={sx({ fontFamily: '"Noto Serif SC", "Songti SC", "STSong", Georgia, serif', fontSize: 34, color: 'var(--text-heading)', letterSpacing: 1, fontWeight: 600 })}>UtaNote</Text>
                <View style={sx({ fontSize: 12.5, color: 'var(--ink-45)', marginTop: 4 })}>把一首日语歌拆成可学会的每一句</View>
              </View>

              <View style={sx({ display: 'flex', flexWrap: 'wrap', gap: 8 })}>
                {COPY.homeFeatures.map((f) => (
                  <View key={f.title} style={sx({ width: 'calc(50% - 4px)', boxSizing: 'border-box', padding: '12px 12px 13px', borderRadius: 14, background: 'var(--ink-04)', border: '1px solid var(--ink-08)', display: 'flex', flexDirection: 'column', gap: 3 })}>
                    <View style={sx({ fontSize: 17 })}>{f.icon}</View>
                    <View style={sx({ fontSize: 12.5, fontWeight: 600, color: 'var(--text-strong)' })}>{f.title}</View>
                    <View style={sx({ fontSize: 10.5, color: 'var(--ink-5)', lineHeight: 1.4 })}>{f.desc}</View>
                  </View>
                ))}
              </View>

              <View>
                <View style={sx({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 })}>
                  <Text style={sx({ fontSize: 15, fontWeight: 600, color: 'var(--text-strong)' })}>导入歌词</Text>
                </View>
                <Input
                  value={v.songTitle}
                  onInput={(e) => v.setSongTitle(e.detail.value)}
                  placeholder={COPY.songTitlePlaceholder}
                  placeholderStyle={PLACEHOLDER}
                  style={sx({ width: '100%', height: 42, boxSizing: 'border-box', background: 'var(--ink-04)', border: '1px solid var(--ink-08)', borderRadius: 14, padding: '0 14px', fontSize: 13.5, color: 'var(--text-body)', marginBottom: 10 })}
                />
                <View style={sx({ position: 'relative' })}>
                  <Textarea
                    value={v.lyricsText}
                    onInput={(e) => v.setLyrics(e.detail.value)}
                    maxlength={5000}
                    placeholder="粘贴或输入日文歌词（支持假名/汉字）"
                    placeholderStyle={PLACEHOLDER}
                    style={sx({ width: '100%', height: 150, boxSizing: 'border-box', background: 'var(--ink-04)', border: '1px solid var(--ink-08)', borderRadius: 14, padding: 14, fontSize: 13.5, color: 'var(--text-body)' })}
                  />
                  <View style={sx({ position: 'absolute', right: 12, bottom: 10, fontSize: 11, color: 'var(--ink-3)' })}>{v.lyricsCount} / 5000</View>
                </View>
                <View style={sx({ marginTop: 8, fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.55 })}>
                  {COPY.lyricsNotice}
                </View>
              </View>

              {v.parseError ? <View onClick={v.dismissParseError} style={sx(errBanner)}>{v.parseError}（点击关闭）</View> : null}
              {v.parseNotice ? <View onClick={v.dismissParseNotice} style={sx(noticeBanner)}>{v.parseNotice}（点击关闭）</View> : null}

              <View onClick={v.parsing ? undefined : v.startBreakdown} className="tap" hoverClass="press" hoverStartTime={0} hoverStayTime={60} style={sx({ ...primaryBtn, opacity: v.parsing ? 0.6 : 1 })}>
                {v.parsing ? '解析中…' : COPY.startButton}
              </View>
            </View>
          )}

          {/* ============ TASKS ============ */}
          {v.isTasks && (
            <View className="screen" style={sx({ padding: '4px 22px 24px', display: 'flex', flexDirection: 'column', gap: 16 })}>
              <View style={sx({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
                <View>
                  <Text style={sx({ fontSize: 22, fontWeight: 700, color: 'var(--text-heading)' })}>今日任务</Text>
                  <View style={sx({ fontSize: 12, color: 'var(--ink-4)', marginTop: 3 })}>《{v.activeSongTitle}》</View>
                </View>
                <View style={sx({ width: 42, height: 42, borderRadius: '50%', border: '3px solid var(--ink-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 })}>
                  <View style={sx({ position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: '50%', border: '3px solid transparent', borderTopColor: 'var(--accent)', borderRightColor: 'var(--accent)', transform: 'rotate(45deg)' })} />
                  <View style={sx({ textAlign: 'center' })}>
                    <View style={sx({ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)' })}>{v.sentenceCount}</View>
                    <View style={sx({ fontSize: 8, color: 'var(--ink-4)' })}>句</View>
                  </View>
                </View>
              </View>

              <View style={sx({ display: 'flex', flexDirection: 'column', gap: 9 })}>
                {v.taskRows.map((row) => (
                  <View key={row.key} onClick={row.onClick} className="tap" hoverClass="press" hoverStartTime={0} hoverStayTime={60} style={sx({ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 13, background: 'var(--ink-04)', border: `1px solid ${row.borderColor}` })}>
                    <View style={sx({ width: 26, height: 26, borderRadius: '50%', background: 'var(--ink-06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--ink-5)', flexShrink: 0 })}>{row.label}</View>
                    <View style={sx({ flex: 1, fontSize: 13.5, color: 'var(--text-body)' })}>{row.text}</View>
                    <View style={sx({ fontSize: 10.5, padding: '3px 8px', borderRadius: 20, background: row.badgeBg, color: row.badgeColor, flexShrink: 0 })}>{row.status}</View>
                    <View style={sx({ color: 'var(--ink-25)', fontSize: 13 })}>›</View>
                  </View>
                ))}
              </View>

              <View onClick={v.startPractice} className="tap" hoverClass="press" hoverStartTime={0} hoverStayTime={60} style={sx(primaryBtn)}>开始今天的练习 ▶</View>
            </View>
          )}

          {/* ============ CARD ============ */}
          {v.isCard && (
            <View className="screen" style={sx({ padding: '2px 22px 20px', display: 'flex', flexDirection: 'column', gap: 18 })}>
              {/* Swipeable region — tracks the finger live (Douyin-style), then either
                  commits to prevCard/nextCard or eases back to center. Header rides
                  along with the drag; the docked bottom bar (outside the ScrollView)
                  stays put so it never floats in dead space below short cards. */}
              <View
                onTouchStart={onCardTouchStart}
                catchTouchMove={onCardTouchMove}
                onTouchEnd={onCardTouchEnd}
                onTouchCancel={onCardTouchEnd}
                style={sx({ display: 'flex', flexDirection: 'column', gap: 18, transform: `translateY(${dragY}px)`, transition: dragAnim ? 'transform 0.28s cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none' })}
              >
                {/* Keyed by card position: flipping/swiping 上一句/下一句 remounts this
                    block, replaying the direction-matched card-in slide. */}
                <View key={v.cardPositionLabel} className={v.cardAnimClass} style={sx({ display: 'flex', flexDirection: 'column', gap: 18 })}>
                <View>
                  <View style={sx({ fontSize: 12, color: 'var(--ink-45)', letterSpacing: 0.5, marginBottom: 14 })}>今日第 {v.currentSentence.num} 句</View>
                  <Text style={sx({ fontSize: 23, lineHeight: 1.75, color: 'var(--text-heading)', fontWeight: 600, letterSpacing: 0.3 })}>
                    <Text>{v.currentSplit.pre}</Text>
                    <Text onClick={() => v.openWordModal(v.currentSentence.detail)} style={sx({ color: 'var(--accent-light)', fontWeight: 700, background: 'rgba(165,168,236,0.16)', borderRadius: 6, padding: '1px 6px' })}>{v.currentSplit.word}</Text>
                    <Text>{v.currentSplit.post}</Text>
                  </Text>
                  <View style={sx({ fontSize: 14, color: 'var(--text-soft)', lineHeight: 1.5, marginTop: 10 })}>{v.currentSentence.translation}</View>
                </View>

                <View>
                  <View style={sx({ fontSize: 11.5, color: 'var(--ink-35)', marginBottom: 4 })}>整句语法结构</View>
                  <View style={sx({ fontSize: 12, color: 'var(--accent-light)', marginBottom: 10 })}>{v.currentSentence.structure}</View>
                  <View style={sx({ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 5 })}>
                    {v.tokenViews.map((tok) => {
                      const isParticle = tok.type === 'particle'
                      return (
                        <View key={tok.key} onClick={tok.onClick} className="tap" hoverClass="press" hoverStartTime={0} hoverStayTime={60} style={sx(isParticle ? {
                          textAlign: 'center', padding: '7px 5px 0', borderRadius: 6,
                          background: tok.active ? 'rgba(165,168,236,0.14)' : 'transparent',
                        } : {
                          textAlign: 'center', padding: '9px 12px', borderRadius: 10,
                          background: tok.active ? 'rgba(165,168,236,0.16)' : 'var(--ink-06)',
                          border: tok.active ? '1px solid rgba(165,168,236,0.5)' : '1px solid var(--ink-1)',
                        })}>
                          {tok.reading ? <View style={sx({ fontSize: isParticle ? 8 : 9, color: 'var(--ink-4)', lineHeight: 1.3 })}>{tok.reading}</View> : null}
                          <View style={sx({ fontSize: isParticle ? 12 : 13.5, color: tok.active ? 'var(--accent-light)' : isParticle ? 'var(--ink-5)' : 'var(--text-body)', fontWeight: isParticle ? 400 : 600 })}>{tok.text}</View>
                          <View style={sx({ fontSize: 9, color: 'var(--ink-4)', marginTop: 2, whiteSpace: 'nowrap' })}>{tok.role}</View>
                        </View>
                      )
                    })}
                  </View>
                </View>

                <View onClick={v.toggleRomaji} className="tap" hoverClass="press" hoverStartTime={0} hoverStayTime={60} style={sx({ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-5)', width: 'fit-content' })}>
                  <Text>{v.romajiToggleLabel}</Text>
                  <View style={sx({ width: 6, height: 6, borderRight: '1.5px solid var(--ink-45)', borderBottom: '1.5px solid var(--ink-45)', transform: v.romajiArrowRotate, transition: 'transform 0.25s ease' })} />
                </View>

                {v.romajiOpen && (
                  <View className="panel-in" style={sx({ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', background: 'var(--ink-03)', borderRadius: 12, border: '1px solid var(--ink-06)' })}>
                    <View style={sx({ fontSize: 13, color: 'var(--text-lavender)' })}>{v.currentSentence.furigana}</View>
                    <View style={sx({ fontSize: 12, color: 'var(--ink-4)', fontStyle: 'italic' })}>{v.currentSentence.romaji}</View>
                  </View>
                )}

                <View>
                  <View style={sx({ fontSize: 11.5, color: 'var(--ink-35)', marginBottom: 6 })}>发音提示</View>
                  <View style={sx({ display: 'flex', gap: 8 })}>
                    {(v.currentSentence.tips || []).map((tip, i) => (
                      <View key={i} style={sx({ flex: 1, textAlign: 'center', padding: '9px 4px', background: 'var(--ink-04)', borderRadius: 10, border: '1px solid var(--ink-07)' })}>
                        <View style={sx({ fontSize: 12.5, color: 'var(--text-body)' })}>{tip.main}</View>
                        <View style={sx({ fontSize: 10, color: 'var(--ink-4)', marginTop: 2 })}>{tip.label}</View>
                      </View>
                    ))}
                  </View>
                </View>

                {/* AI 学习助手 — fixed questions only (no free-text chat).
                    P0 ships the singing coach:「这句怎么唱？」goes through the
                    askLine cloud function (globally cached, cache hits are
                    quota-free); the other chips stay as an inert preview. */}
                <View style={sx({ borderRadius: 14, background: 'var(--ink-03)', border: '1px solid var(--ink-06)', padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 10 })}>
                  <View style={sx({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' })}>
                    <View style={sx({ fontSize: 12.5, fontWeight: 600, color: 'var(--text-body)' })}>{COPY.assistantTitle}</View>
                    <View style={sx({ fontSize: 10, color: 'var(--accent-light)', padding: '2px 8px', borderRadius: 10, background: 'rgba(165,168,236,0.15)' })}>{COPY.assistantBadge}</View>
                  </View>
                  <View style={sx({ display: 'flex', flexWrap: 'wrap', gap: 7 })}>
                    <View
                      onClick={v.askSingingCoach}
                      style={sx({
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: 'var(--accent-light)',
                        padding: '7px 12px',
                        borderRadius: 20,
                        background: 'rgba(165,168,236,0.15)',
                        border: '1px solid rgba(165,168,236,0.4)',
                        opacity: v.aiCoach.status === 'loading' ? 0.6 : 1,
                      })}
                    >♪ {v.aiSingingChipLabel}</View>
                    {COPY.assistantPreviewChips.map((q) => (
                      <View key={q} style={sx({ fontSize: 11.5, color: 'var(--ink-35)', padding: '7px 12px', borderRadius: 20, background: 'var(--ink-04)', border: '1px solid var(--ink-07)' })}>{q}</View>
                    ))}
                  </View>
                  {v.aiCoach.status === 'error' && (
                    <View style={sx({ fontSize: 11, color: 'var(--warning)' })}>{v.aiCoach.error}</View>
                  )}
                  {v.aiCoach.status === 'done' && v.aiCoach.answer && (
                    <View style={sx({ display: 'flex', flexDirection: 'column', gap: 9 })}>
                      {!!v.aiCoach.answer.kanaBeats && (
                        <View style={sx({ padding: '9px 10px', borderRadius: 10, background: 'var(--ink-04)', border: '1px solid var(--ink-07)', textAlign: 'center' })}>
                          <View style={sx({ fontSize: 10, color: 'var(--ink-35)', marginBottom: 3 })}>按音拍唱 · 一拍一音</View>
                          <View style={sx({ fontSize: 13, color: 'var(--text-body)', letterSpacing: 1, lineHeight: 1.7 })}>{v.aiCoach.answer.kanaBeats}</View>
                        </View>
                      )}
                      {(v.aiCoach.answer.tips || []).map((tip, i) => (
                        <View key={i} style={sx({ display: 'flex', flexDirection: 'column', gap: 2 })}>
                          <View style={sx({ fontSize: 11.5, fontWeight: 600, color: 'var(--accent-light)' })}>{tip.title}</View>
                          <View style={sx({ fontSize: 11.5, color: 'var(--ink-5)', lineHeight: 1.6 })}>{tip.detail}</View>
                        </View>
                      ))}
                      {!!v.aiCoach.answer.watchOut && (
                        <View style={sx({ fontSize: 11.5, color: 'var(--warning)', lineHeight: 1.6 })}>⚠ {v.aiCoach.answer.watchOut}</View>
                      )}
                      <View style={sx({ fontSize: 9.5, color: 'var(--ink-3)', textAlign: 'right' })}>{COPY.assistantFooter}</View>
                    </View>
                  )}
                </View>
                </View>
              </View>
            </View>
          )}

          {/* CARD screen intentionally has no bottom padding above — its action
              bar is docked outside the ScrollView (below), not part of this
              scrollable content, so it never floats in empty space. */}

          {/* ============ SUMMARY ============ */}
          {v.isSummary && (
            <View className="screen" style={sx({ padding: '4px 22px 24px', display: 'flex', flexDirection: 'column', gap: 16 })}>
              <Text style={sx({ fontSize: 22, fontWeight: 700, color: 'var(--text-heading)' })}>学习总结</Text>

              <View style={sx({ borderRadius: 16, padding: 18, background: 'linear-gradient(135deg, rgba(107,112,207,0.28), rgba(60,50,90,0.4))', border: '1px solid var(--ink-08)', position: 'relative', overflow: 'hidden' })}>
                <View style={sx({ position: 'absolute', right: 14, top: 14, width: 34, height: 34, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #f4f0e0, #d9d3b8)' })} />
                <View style={sx({ fontSize: 13, color: 'var(--ink-7)' })}>你已学习</View>
                <View style={sx({ fontSize: 20, fontWeight: 700, color: '#fff', marginTop: 4 })}>《{v.activeSongTitle}》{v.summaryStudied}/{v.summaryTotal} 句</View>
                <View style={sx({ fontSize: 12, color: 'var(--ink-55)', marginTop: 6 })}>继续保持，下一句会更动听 ✨</View>
              </View>

              <View style={sx({ display: 'flex', gap: 8 })}>
                {v.summaryStats.map((stat, i) => (
                  <View key={i} style={sx({ flex: 1, padding: '14px 8px', borderRadius: 12, background: 'var(--ink-04)', border: '1px solid var(--ink-07)', textAlign: 'center' })}>
                    <View style={sx({ fontSize: 18, fontWeight: 700, color: 'var(--text-strong)' })}>{stat.value}</View>
                    <View style={sx({ fontSize: 10.5, color: 'var(--ink-4)', marginTop: 3 })}>{stat.label}</View>
                  </View>
                ))}
              </View>

              <View>
                <View style={sx({ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-5)', marginBottom: 6 })}>
                  <Text>句子掌握进度</Text><Text>{v.summaryMastered} / {v.summaryTotal}</Text>
                </View>
                <View style={sx({ height: 6, borderRadius: 3, background: 'var(--ink-08)', overflow: 'hidden' })}>
                  <View style={sx({ height: '100%', width: v.masteryProgressPct + '%', background: 'linear-gradient(90deg, #6b70cf, #8489e0)', borderRadius: 3 })} />
                </View>
              </View>

              <View style={sx({ display: 'flex', flexDirection: 'column', gap: 10 })}>
                <Button openType="share" className="tap plain-btn" hoverClass="press" hoverStartTime={0} hoverStayTime={60} style={sx({ textAlign: 'center', padding: 13, borderRadius: 14, background: 'linear-gradient(135deg, #6b70cf, #8489e0)', color: '#fff', fontSize: 14, fontWeight: 600 })}>分享给好友 ⤴</Button>
                <View onClick={v.goHome} className="tap" hoverClass="press" hoverStartTime={0} hoverStayTime={60} style={sx({ textAlign: 'center', padding: 12, borderRadius: 14, background: 'var(--ink-06)', border: '1px solid var(--ink-1)', color: 'var(--text-body)', fontSize: 14, fontWeight: 600 })}>完成</View>
              </View>
            </View>
          )}

          {/* ============ LIBRARY ============ */}
          {v.isLibrary && (
            <View className="screen" style={sx({ padding: '4px 22px 24px', display: 'flex', flexDirection: 'column', gap: 16 })}>
              <Text style={sx({ fontSize: 22, fontWeight: 700, color: 'var(--text-heading)' })}>词库</Text>

              <Input
                value={v.librarySearch}
                onInput={(e) => v.setSearch(e.detail.value)}
                placeholder="搜索单词或释义"
                placeholderStyle={PLACEHOLDER}
                style={sx({ width: '100%', height: 42, background: 'var(--ink-04)', border: '1px solid var(--ink-08)', borderRadius: 12, padding: '0 14px', fontSize: 13.5, color: 'var(--text-body)' })}
              />

              <ScrollView scrollX style={sx({ whiteSpace: 'nowrap' })}>
                <View style={sx({ display: 'flex', gap: 8 })}>
                  {v.libraryFilterChips.map((chip) => (
                    <View key={chip.key} onClick={chip.onClick} style={sx({ whiteSpace: 'nowrap', padding: '7px 13px', borderRadius: 20, fontSize: 12.5, background: chip.bg, color: chip.color, border: chip.border })}>{chip.label}</View>
                  ))}
                </View>
              </ScrollView>

              <View style={sx({ display: 'flex', gap: 8, padding: '12px 14px', borderRadius: 12, background: 'var(--ink-04)', border: '1px solid var(--ink-07)' })}>
                <View style={sx({ flex: 1, textAlign: 'center' })}><View style={sx({ fontSize: 15, fontWeight: 700, color: 'var(--text-strong)' })}>{v.libraryStats.total}</View><View style={sx({ fontSize: 10, color: 'var(--ink-4)', marginTop: 2 })}>累计词汇</View></View>
                <View style={sx({ flex: 1, textAlign: 'center' })}><View style={sx({ fontSize: 15, fontWeight: 700, color: 'var(--success)' })}>{v.libraryStats.mastered}</View><View style={sx({ fontSize: 10, color: 'var(--ink-4)', marginTop: 2 })}>已掌握</View></View>
                <View style={sx({ flex: 1, textAlign: 'center' })}><View style={sx({ fontSize: 15, fontWeight: 700, color: 'var(--warning)' })}>{v.libraryStats.learning}</View><View style={sx({ fontSize: 10, color: 'var(--ink-4)', marginTop: 2 })}>学习中</View></View>
              </View>

              <View style={sx({ display: 'flex', flexDirection: 'column', gap: 9 })}>
                {v.filteredVocab.map((vv) => (
                  <View key={vv.key} onClick={vv.onClick} className="tap" hoverClass="press" hoverStartTime={0} hoverStayTime={60} style={sx({ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 13, background: 'var(--ink-04)', border: '1px solid var(--ink-06)' })}>
                    <View style={sx({ flex: 1 })}>
                      <View style={sx({ display: 'flex', alignItems: 'center', gap: 8 })}>
                        <View style={sx({ fontSize: 15, fontWeight: 600, color: 'var(--text-strong)' })}>{vv.word}</View>
                        <View style={sx({ fontSize: 11.5, color: 'var(--ink-4)' })}>{vv.kana}</View>
                      </View>
                      <View style={sx({ fontSize: 12, color: 'var(--ink-5)', marginTop: 3 })}>{vv.meaning} · {vv.pos}</View>
                    </View>
                    <View style={sx({ fontSize: 10.5, padding: '3px 9px', borderRadius: 20, background: 'var(--ink-06)', color: vv.statusColor, flexShrink: 0, whiteSpace: 'nowrap' })}>{vv.statusLabel}</View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ============ ME ============ */}
          {v.isMe && (
            <View className="screen" style={sx({ padding: '4px 22px 24px', display: 'flex', flexDirection: 'column', gap: 16 })}>
              <View style={sx({ display: 'flex', alignItems: 'center', gap: 14 })}>
                <View style={sx({ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #6b70cf, #8489e0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: 1, flexShrink: 0 })}>うた</View>
                <View>
                  <View style={sx({ fontSize: 17, fontWeight: 700, color: 'var(--text-heading)' })}>日语学习者</View>
                  <View style={sx({ fontSize: 12, color: 'var(--ink-45)', marginTop: 2 })}>{v.streakLabel}</View>
                </View>
              </View>

              <View>
                <View style={sx({ fontSize: 13, fontWeight: 600, color: 'var(--text-body)', marginBottom: 8 })}>我的歌曲</View>
                <View style={sx({ display: 'flex', flexDirection: 'column', gap: 9 })}>
                  {v.mySongs.map((song) => (
                    <View key={song.key} onClick={song.onClick} className="tap" hoverClass="press" hoverStartTime={0} hoverStayTime={60} style={sx({ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 13, background: 'var(--ink-04)', border: '1px solid var(--ink-06)' })}>
                      <View style={sx({ width: 40, height: 40, borderRadius: 10, background: song.avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.85)', flexShrink: 0 })}>{song.avatarChar}</View>
                      <View style={sx({ flex: 1, minWidth: 0 })}>
                        <View style={sx({ fontSize: 13.5, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>{song.title}</View>
                        <View style={sx({ fontSize: 11, color: 'var(--ink-4)', marginTop: 3 })}>{song.subtitle}</View>
                      </View>
                      {song.onDelete && (
                        <View onClick={(e) => { e.stopPropagation(); song.onDelete() }} style={sx({ width: 28, height: 28, borderRadius: '50%', background: 'rgba(220,80,80,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--error)', flexShrink: 0 })}>✕</View>
                      )}
                      <View style={sx({ color: 'var(--ink-25)', fontSize: 13 })}>›</View>
                    </View>
                  ))}
                </View>
              </View>

              <View>
                <View style={sx({ fontSize: 13, fontWeight: 600, color: 'var(--text-body)', marginBottom: 8 })}>设置</View>
                <View style={sx({ display: 'flex', flexDirection: 'column', borderRadius: 13, background: 'var(--ink-04)', border: '1px solid var(--ink-06)', overflow: 'hidden' })}>
                  <View style={sx({ padding: '13px 14px', borderBottom: '1px solid var(--ink-06)' })}>
                    <View style={sx({ display: 'flex', alignItems: 'center', fontSize: 13.5, color: 'var(--text-body)', marginBottom: 10 })}><View style={sx({ flex: 1 })}>深浅模式</View><View style={sx({ color: 'var(--ink-4)', fontSize: 12 })}>{v.themePrefLabel}</View></View>
                    <View style={sx({ display: 'flex', gap: 8 })}>
                      {v.themeOptions.map((opt) => {
                        const active = v.themePref === opt.key
                        return (
                          <View key={opt.key} onClick={() => v.setThemePrefAction(opt.key)} style={sx({ flex: 1, textAlign: 'center', padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: active ? 600 : 400, color: active ? 'var(--accent-light)' : 'var(--ink-5)', background: active ? 'rgba(165,168,236,0.15)' : 'var(--ink-04)', border: active ? '1px solid rgba(165,168,236,0.4)' : '1px solid var(--ink-07)' })}>{opt.label}</View>
                        )
                      })}
                    </View>
                  </View>
	                  <View style={sx({ padding: '13px 14px', borderBottom: '1px solid var(--ink-06)' })}>
	                    <View style={sx({ display: 'flex', alignItems: 'center', fontSize: 13.5, color: 'var(--text-body)', marginBottom: 10 })}><View style={sx({ flex: 1 })}>字体大小</View><View style={sx({ color: 'var(--ink-4)', fontSize: 12 })}>{v.fontScaleLabel}</View></View>
	                    <View style={sx({ display: 'flex', gap: 8 })}>
	                      {v.fontScaleOptions.map((opt) => {
	                        const active = v.fontScale === opt.key
	                        return (
	                          <View key={opt.key} onClick={() => v.setFontScaleAction(opt.key)} style={sx({ flex: 1, textAlign: 'center', padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: active ? 600 : 400, color: active ? 'var(--accent-light)' : 'var(--ink-5)', background: active ? 'rgba(165,168,236,0.15)' : 'var(--ink-04)', border: active ? '1px solid rgba(165,168,236,0.4)' : '1px solid var(--ink-07)' })}>{opt.label}</View>
	                        )
	                      })}
	                    </View>
	                  </View>
	                  <View style={sx({ padding: '13px 14px', borderBottom: '1px solid var(--ink-06)' })}>
	                    <View style={sx({ display: 'flex', alignItems: 'center', fontSize: 13.5, color: 'var(--text-body)', marginBottom: 10 })}><View style={sx({ flex: 1 })}>朗读音色</View><View style={sx({ color: 'var(--ink-4)', fontSize: 12 })}>{v.ttsVoiceLabel}</View></View>
	                    <View style={sx({ display: 'flex', gap: 7, flexWrap: 'wrap' })}>
	                      {v.ttsVoiceOptions.map((opt) => {
	                        const active = v.ttsVoice === opt.key
	                        return (
	                          <View key={opt.key} onClick={() => v.setTtsVoice(opt.key)} style={sx({ minWidth: 52, textAlign: 'center', padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: active ? 600 : 400, color: active ? 'var(--accent-light)' : 'var(--ink-5)', background: active ? 'rgba(165,168,236,0.15)' : 'var(--ink-04)', border: active ? '1px solid rgba(165,168,236,0.4)' : '1px solid var(--ink-07)' })}>{opt.label}</View>
	                        )
	                      })}
	                    </View>
	                  </View>
	                  <View onClick={v.openAbout} style={sx({ display: 'flex', alignItems: 'center', padding: '13px 14px', fontSize: 13.5, color: 'var(--text-body)' })}><View style={sx({ flex: 1 })}>关于</View><View style={sx({ color: 'var(--ink-25)' })}>›</View></View>
	                </View>
              </View>
            </View>
          )}

          {/* ============ ABOUT ============ */}
          {v.isAbout && (
            <View className="screen" style={sx({ padding: '4px 22px 24px', display: 'flex', flexDirection: 'column', gap: 18 })}>
              <View style={sx({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 0' })}>
                <Image src={appLogo} mode="aspectFill" style={sx({ width: 64, height: 64, borderRadius: 16 })} />
                <Text style={sx({ fontFamily: '"Noto Serif SC", "Songti SC", Georgia, serif', fontSize: 24, color: 'var(--text-heading)', fontWeight: 600, letterSpacing: 1, marginTop: 4 })}>UtaNote</Text>
                <View style={sx({ fontSize: 12, color: 'var(--ink-4)' })}>v0.1.0</View>
              </View>

              <View style={sx({ fontSize: 13.5, color: 'var(--text-soft)', lineHeight: 1.8, textAlign: 'center' })}>
                {COPY.aboutIntro}
              </View>

              <View style={sx({ borderRadius: 13, background: 'var(--ink-04)', border: '1px solid var(--ink-06)', padding: '14px 16px' })}>
                <View style={sx({ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 })}>
                  <View style={sx({ fontSize: 15 })}>🔒</View>
                  <View style={sx({ fontSize: 13, fontWeight: 600, color: 'var(--text-body)' })}>隐私优先</View>
                </View>
                <View style={sx({ fontSize: 12, color: 'var(--ink-55)', lineHeight: 1.7 })}>
                  {COPY.aboutPrivacy}
                </View>
              </View>

              <View style={sx({ borderRadius: 13, background: 'var(--ink-04)', border: '1px solid var(--ink-06)', overflow: 'hidden' })}>
                {COPY.aboutInfoRows.map((row, i) => (
                  <View key={row.label} style={sx({ padding: '12px 14px', borderBottom: i < COPY.aboutInfoRows.length - 1 ? '1px solid var(--ink-06)' : 'none', display: 'flex' })}><View style={sx({ fontSize: 12, color: 'var(--ink-4)', width: 70, flexShrink: 0 })}>{row.label}</View><View style={sx({ fontSize: 12.5, color: 'var(--text-body)' })}>{row.value}</View></View>
                ))}
              </View>

              <View>
                <View style={sx({ fontSize: 13, fontWeight: 600, color: 'var(--text-body)', marginBottom: 10 })}>未来计划 🚀</View>
                <View style={sx({ display: 'flex', flexDirection: 'column', gap: 8 })}>
                  {COPY.futurePlans.map((item) => (
                    <View key={item.text} style={sx({ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--ink-03)', border: '1px solid var(--ink-06)' })}>
                      <View style={sx({ fontSize: 16, flexShrink: 0 })}>{item.icon}</View>
                      <View style={sx({ fontSize: 12.5, color: 'var(--ink-65)' })}>{item.text}</View>
                    </View>
                  ))}
                </View>
              </View>

              <View style={sx({ textAlign: 'center', fontSize: 11, color: 'var(--ink-25)', marginTop: 8 })}>
                Made with ♡ for Japanese learners
              </View>
            </View>
          )}

        </View>
      </ScrollView>

      {/* ============ CARD NAV BAR (fixed, aligned to the capsule button — see
          useUtaNote's getNavMetrics for the vertical-centering math) ============ */}
      {v.isCard && (
        <View style={sx({
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30, boxSizing: 'border-box',
          paddingTop: v.navBarPaddingTop, height: v.navBarPaddingTop + v.navBarHeight,
          paddingLeft: 22, paddingRight: v.navBarRightReserve,
          display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-bar)',
        })}>
          <View onClick={v.backToTasks} className="tap" hoverClass="press" hoverStartTime={0} hoverStayTime={60} style={sx({ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: -8 })}>
            <View style={sx({ width: 11, height: 11, borderLeft: '3px solid var(--ink-6)', borderBottom: '3px solid var(--ink-6)', transform: 'rotate(45deg)', marginLeft: 4 })} />
          </View>
          <View style={sx({ flex: 1, height: 4, borderRadius: 2, background: 'var(--ink-08)', overflow: 'hidden' })}>
            <View style={sx({ height: '100%', borderRadius: 2, background: 'var(--accent)', width: `${v.cardProgressPct}%`, transition: 'width 0.3s ease' })} />
          </View>
          <View style={sx({ fontSize: 12, color: 'var(--ink-45)', whiteSpace: 'nowrap' })}>{v.cardPositionLabel}</View>
          <View style={sx({ color: 'var(--ink-35)', fontSize: 15 })}>⋮</View>
        </View>
      )}

      {/* ============ ABOUT NAV BAR (same capsule-aligned fixed header) ============ */}
      {v.isAbout && (
        <View style={sx({
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30, boxSizing: 'border-box',
          paddingTop: v.navBarPaddingTop, height: v.navBarPaddingTop + v.navBarHeight,
          paddingLeft: 22, paddingRight: v.navBarRightReserve,
          display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-bar)',
        })}>
          <View onClick={v.closeAbout} className="tap" hoverClass="press" hoverStartTime={0} hoverStayTime={60} style={sx({ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: -8 })}>
            <View style={sx({ width: 11, height: 11, borderLeft: '3px solid var(--ink-6)', borderBottom: '3px solid var(--ink-6)', transform: 'rotate(45deg)', marginLeft: 4 })} />
          </View>
          <Text style={sx({ fontSize: 16, fontWeight: 700, color: 'var(--text-heading)' })}>关于</Text>
        </View>
      )}

      {/* ============ CARD ACTION BAR (docked to viewport bottom, like the tab bar) ============ */}
      {v.isCard && (
        <View style={sx({ padding: '10px 22px 22px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--ink-06)', background: 'var(--bg-bar)' })}>
          <View style={sx({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22 })}>
            <View onClick={v.prevCard} className="tap" hoverClass="press" hoverStartTime={0} hoverStayTime={60} style={sx({ display: 'flex', alignItems: 'center', gap: 3, padding: '10px 4px', color: 'var(--ink-5)', fontSize: 13, opacity: v.prevOpacity })}>
              <Text>‹</Text><Text>上一句</Text>
            </View>
            <View onClick={v.togglePlay} className="tap" hoverClass="press" hoverStartTime={0} hoverStayTime={60} style={sx({ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, #6b70cf, #8489e0)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, color: '#fff', boxShadow: '0 8px 20px rgba(107,112,207,0.38)', flexShrink: 0 })}>
              <View style={sx({ fontSize: 18, lineHeight: 1 })}>{v.playGlyph}</View>
              <View style={sx({ fontSize: 9.5, lineHeight: 1.2 })}>{v.playLabel}</View>
            </View>
            <View onClick={v.nextCard} className="tap" hoverClass="press" hoverStartTime={0} hoverStayTime={60} style={sx({ display: 'flex', alignItems: 'center', gap: 3, padding: '10px 4px', color: 'var(--ink-5)', fontSize: 13 })}>
              <Text>{v.nextLabel}</Text><Text>›</Text>
            </View>
          </View>

          {/* Auxiliary (慢速) vs. status (已掌握 — a state pill that doubles
              as the mark-as-mastered action only while still unmastered). */}
          <View style={sx({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 })}>
            <View onClick={v.toggleSlow} className="tap" hoverClass="press" hoverStartTime={0} hoverStayTime={60} style={sx({ fontSize: 11.5, color: v.slowColor, background: 'var(--ink-04)', border: '1px solid var(--ink-07)', borderRadius: 16, padding: '6px 13px' })}>{v.slowChipLabel}</View>
            <View
              onClick={v.currentMastery !== 'mastered' ? v.markAsMastered : undefined}
              className={v.currentMastery !== 'mastered' ? 'tap' : ''}
              hoverClass={v.currentMastery !== 'mastered' ? 'press' : ''}
              hoverStartTime={0} hoverStayTime={60}
              style={sx({ fontSize: 11.5, color: v.currentMasteryColor, background: v.currentMastery === 'mastered' ? 'var(--success-soft)' : 'var(--ink-04)', padding: '6px 13px', borderRadius: 16, border: `1px solid ${v.currentMasteryBorder}` })}
            >
              {v.currentMastery === 'mastered' ? '✓ 已掌握' : `${v.currentMasteryLabel} · 标记已掌握`}
            </View>
          </View>
        </View>
      )}

      {/* ============ TAB BAR ============ */}
      {v.showTabBar && (
        <View style={sx({ display: 'flex', padding: '10px 8px 26px', borderTop: '1px solid var(--ink-06)', background: 'var(--bg-bar)' })}>
          {v.tabs.map((tab) => (
            <View key={tab.key} onClick={tab.onClick} style={sx({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: tab.color, transition: 'color 0.2s ease' })}>
              <View style={sx({ fontSize: 17, transform: tab.active ? 'scale(1.18) translateY(-1px)' : 'scale(1)', transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)' })}>{tab.icon}</View>
              <View style={sx({ fontSize: 10 })}>{tab.label}</View>
            </View>
          ))}
        </View>
      )}

      {/* ============ LOADING OVERLAY ============ */}
      {v.parsing && (
        <View style={sx({ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--overlay)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' })}>
          <View style={sx({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '0 32px' })}>
            <View style={sx({ width: 44, height: 44, border: '3px solid var(--ink-15)', borderTopColor: 'var(--accent-light)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' })} />
            <View style={sx({ fontSize: 15, color: 'var(--text-body)', fontWeight: 600 })}>{v.parseStage || COPY.parseOverlayDefault}</View>
            {v.parseElapsed > 0 && (
              <View style={sx({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 })}>
                <View style={sx({ fontSize: 12, color: 'var(--ink-5)' })}>已等待 {v.parseElapsed} 秒</View>
                <View style={sx({ width: 180, height: 3, borderRadius: 2, background: 'var(--ink-08)', overflow: 'hidden' })}>
                  <View style={sx({ height: '100%', borderRadius: 2, background: 'var(--accent)', width: `${Math.min(v.parseElapsed / 20 * 100, 95)}%`, transition: 'width 1s linear' })} />
                </View>
              </View>
            )}
            <View style={sx({ fontSize: 11, color: 'var(--ink-35)', textAlign: 'center', lineHeight: 1.6 })}>
              {v.parseElapsed < 5 ? COPY.parseOverlayHintEarly : v.parseElapsed < 15 ? COPY.parseOverlayHintMid : '歌词较长，请耐心等待，即将完成'}
            </View>
          </View>
        </View>
      )}

      {/* ============ WORD MODAL ============ */}
      {v.showModal && (
        <View onClick={v.closeWordModal} className={'modal-mask' + (v.modalClosing ? ' closing' : '')} style={sx({ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--overlay)', zIndex: 40, display: 'flex', alignItems: 'flex-end' })}>
          {/* `78%` needs the mask's percentage height to resolve correctly
              through scroll-view's own layout — unreliable on-device, and it
              was clipping the sheet's bottom content with no way to scroll
              to it. `vh` sidesteps the percentage chain entirely (still a
              cap, not a fixed height — short entries still shrink to fit). */}
          <ScrollView scrollY catchMove onClick={(e) => e.stopPropagation()} className={'modal-sheet' + (v.modalClosing ? ' closing' : '')} style={sx({ width: '100%', maxHeight: '78vh', background: 'var(--surface-sheet)', borderRadius: '22px 22px 0 0', border: '1px solid var(--ink-08)', borderBottom: 'none', boxShadow: '0 -16px 40px rgba(0,0,0,0.35)' })}>
            <View style={sx({ padding: '10px 20px 28px', display: 'flex', flexDirection: 'column' })}>
              <View style={sx({ width: 36, height: 4, borderRadius: 2, background: 'var(--ink-15)', margin: '2px auto 14px' })} />

              <View style={sx({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 })}>
                <View style={sx({ fontSize: 12, color: 'var(--ink-4)', letterSpacing: 0.5 })}>词语详情</View>
                <View onClick={v.closeWordModal} className="tap" hoverClass="press" hoverStartTime={0} hoverStayTime={60} style={sx({ width: 30, height: 30, marginRight: -6, borderRadius: '50%', background: 'var(--ink-06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--ink-6)', flexShrink: 0 })}>✕</View>
              </View>

              {/* Header: the word itself is the anchor; favorite sits right
                  next to it (same tier of action), everything else about
                  reading/status moves down a row so it reads secondary. */}
              <View style={sx({ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' })}>
                <View style={sx({ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' })}>
                  <Text style={sx({ fontSize: 25, fontWeight: 700, color: 'var(--text-heading)' })}>{v.currentDetail.word}</Text>
                  <Text style={sx({ fontSize: 14, color: 'var(--text-lavender)' })}>{v.currentDetail.kana}</Text>
                </View>
                <View onClick={v.toggleFavorite} style={sx({ fontSize: 19, color: v.favoriteColor, flexShrink: 0 })}>{v.favoriteGlyph}</View>
              </View>
              <View style={sx({ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, marginBottom: 22 })}>
                <View style={sx({ fontSize: 12, color: 'var(--ink-4)', fontStyle: 'italic' })}>{v.currentDetail.romaji}</View>
                {v.isWordTtsLoading ? (
                  <View style={sx({ width: 11, height: 11, border: '2px solid var(--ink-15)', borderTopColor: 'var(--accent-light)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' })} />
                ) : (
                  <View onClick={v.playWordTts} className="tap" hoverClass="press" hoverStartTime={0} hoverStayTime={60} style={sx({ fontSize: 13, color: v.wordPlayIconColor, padding: 10, margin: -4 })}>🔊</View>
                )}
                <View style={sx({ fontSize: 11, color: v.currentMasteryColor, padding: '2px 9px', borderRadius: 10, background: 'var(--ink-05)', marginLeft: 'auto' })}>{v.currentMasteryLabel}</View>
              </View>

              {/* Meaning group */}
              {v.currentDetail.pos ? (
                <View style={sx({ fontSize: 11, color: 'var(--accent-light)', padding: '2px 8px', borderRadius: 8, background: 'rgba(165,168,236,0.14)', width: 'fit-content', marginBottom: 8 })}>{v.currentDetail.pos}</View>
              ) : null}
              <View style={sx({ fontSize: 16, fontWeight: 600, color: 'var(--text-heading)', lineHeight: 1.5, marginBottom: 22 })}>{v.currentDetail.meaning}</View>

              {/* Grammar group */}
              <View style={sx({ fontSize: 11, color: 'var(--ink-4)', letterSpacing: 0.5, marginBottom: 6 })}>语法</View>
              <View style={sx({ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.65 })}>{v.currentDetail.grammar}</View>
              {v.currentDetail.formula ? <View style={sx({ marginTop: 10, padding: '10px 12px', background: 'var(--ink-04)', borderRadius: 10, textAlign: 'center', fontSize: 12.5, color: 'var(--accent-light)' })}>{v.currentDetail.formula}</View> : null}
              {(v.currentDetail.tags || []).length ? (
                <View style={sx({ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 })}>
                  {v.currentDetail.tags.map((tag) => (
                    <View key={tag} style={sx({ fontSize: 10.5, padding: '3px 9px', borderRadius: 20, color: 'var(--ink-5)', border: '1px solid var(--ink-08)' })}>{tag}</View>
                  ))}
                </View>
              ) : null}

              <View style={sx({ height: 1, background: 'var(--ink-06)', margin: '22px 0 18px' })} />

              {/* Example group */}
              <View style={sx({ fontSize: 11, color: 'var(--ink-4)', letterSpacing: 0.5, marginBottom: 8 })}>例句</View>
              <View style={sx({ display: 'flex', alignItems: 'center', gap: 8 })}>
                <View style={sx({ fontSize: 14, color: 'var(--text-body)' })}>{v.currentDetail.example ? v.currentDetail.example.jp : ''}</View>
                {v.isExampleTtsLoading ? (
                  <View style={sx({ width: 11, height: 11, border: '2px solid var(--ink-15)', borderTopColor: 'var(--accent-light)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' })} />
                ) : (
                  <View onClick={v.playExampleTts} className="tap" hoverClass="press" hoverStartTime={0} hoverStayTime={60} style={sx({ fontSize: 12, color: v.examplePlayIconColor, padding: 10, margin: -4 })}>🔊</View>
                )}
              </View>
              <View style={sx({ fontSize: 12, color: 'var(--ink-45)', marginTop: 5 })}>{v.currentDetail.example ? v.currentDetail.example.cn : ''}</View>
              {v.eggFlash ? (
                <View className="panel-in" style={sx({ fontSize: 11.5, color: 'var(--accent-light)', marginTop: 8 })}>{v.eggFlash}</View>
              ) : null}
              {v.exampleEgg ? (
                <View style={sx({ marginTop: 8 })}>
                  <View onClick={v.toggleEgg} className="tap egg-hint" hoverClass="press" hoverStartTime={0} hoverStayTime={60} style={sx({ fontSize: 11.5, color: 'var(--accent-light)', width: 'fit-content' })}>✦ {v.eggOpen ? '收起彩蛋' : '轻触，好像藏了点什么'}</View>
                  {v.eggOpen ? (
                    <View className="panel-in" style={sx({ marginTop: 8, padding: '10px 12px', borderRadius: 12, background: 'rgba(132,137,224,0.12)', border: '1px solid rgba(165,168,236,0.3)' })}>
                      {v.exampleEgg.jp ? <View style={sx({ fontSize: 13, color: 'var(--accent-light)', marginBottom: 5 })}>{v.exampleEgg.jp}</View> : null}
                      <View style={sx({ fontSize: 12.5, color: 'var(--text-body)', lineHeight: 1.6 })}>{v.exampleEgg.cn}</View>
                      {v.exampleEgg.note ? <View style={sx({ fontSize: 11, color: 'var(--ink-4)', marginTop: 8 })}>{v.exampleEgg.note}</View> : null}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  )
}
