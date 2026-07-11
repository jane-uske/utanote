// UtaNote App 图标生成：和纸底 + 朱印「歌」。
// 用法: swift scripts/ios/gen_icon.swift <输出.png>
import AppKit

let out = CommandLine.arguments.count > 1
    ? CommandLine.arguments[1]
    : "AppIcon.png"

let side = 1024
guard let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: side, pixelsHigh: side,
    bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
    colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)
else { fatalError("bitmap 创建失败") }

NSGraphicsContext.saveGraphicsState()
let ctx = NSGraphicsContext(bitmapImageRep: rep)!
NSGraphicsContext.current = ctx
let cg = ctx.cgContext

// 和纸底
cg.setFillColor(CGColor(red: 0xF6 / 255, green: 0xF4 / 255, blue: 0xEF / 255, alpha: 1))
cg.fill(CGRect(x: 0, y: 0, width: side, height: side))

// 轻微纸纹（确定性噪点）
var state: UInt64 = 20260711
func rnd() -> Double {
    state = state &* 6364136223846793005 &+ 1442695040888963407
    return Double((state >> 33) % 10000) / 10000
}
for _ in 0..<2600 {
    let x = rnd() * Double(side)
    let y = rnd() * Double(side)
    let w = 1.2 + rnd() * 1.6
    let dark = rnd() > 0.5
    cg.setFillColor(CGColor(gray: dark ? 0.2 : 1.0, alpha: 0.035))
    cg.fill(CGRect(x: x, y: y, width: w, height: w))
}

// 朱印（整体微旋转）
let center = CGPoint(x: 512, y: 520)
cg.saveGState()
cg.translateBy(x: center.x, y: center.y)
cg.rotate(by: -6 * .pi / 180)
cg.translateBy(x: -center.x, y: -center.y)

let radius: CGFloat = 350
let circleRect = CGRect(
    x: center.x - radius, y: center.y - radius,
    width: radius * 2, height: radius * 2)
cg.setShadow(offset: CGSize(width: 0, height: -14), blur: 40,
             color: CGColor(red: 0.75, green: 0.29, blue: 0.24, alpha: 0.35))
cg.setFillColor(CGColor(red: 0xBF / 255, green: 0x4B / 255, blue: 0x3E / 255, alpha: 1))
cg.fillEllipse(in: circleRect)
cg.setShadow(offset: .zero, blur: 0, color: nil)

// 内圈白环
cg.setStrokeColor(CGColor(gray: 1.0, alpha: 0.35))
cg.setLineWidth(10)
cg.strokeEllipse(in: circleRect.insetBy(dx: 26, dy: 26))

// 「歌」
let font = NSFont(name: "HiraMinProN-W6", size: 430)
    ?? NSFont.systemFont(ofSize: 430, weight: .bold)
let text = NSAttributedString(
    string: "歌",
    attributes: [.font: font, .foregroundColor: NSColor.white])
let textSize = text.size()
text.draw(at: NSPoint(
    x: center.x - textSize.width / 2,
    y: center.y - textSize.height / 2))
cg.restoreGState()

NSGraphicsContext.restoreGraphicsState()

guard let png = rep.representation(using: .png, properties: [:]) else {
    fatalError("PNG 编码失败")
}
try! png.write(to: URL(fileURLWithPath: out))
print("icon written: \(out)")
