import SwiftUI

/// 简单的流式布局：托管 RubyText 的 token 换行与反馈页的词块。
struct FlowLayout: Layout {
    var alignment: HorizontalAlignment = .leading
    var spacing: CGFloat = 4
    var rowSpacing: CGFloat = 6

    private struct Row {
        var indices: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func computeRows(maxWidth: CGFloat, subviews: Subviews) -> [Row] {
        var rows: [Row] = []
        var current = Row()
        for (i, view) in subviews.enumerated() {
            let size = view.sizeThatFits(.unspecified)
            let extra = current.indices.isEmpty ? 0 : spacing
            if !current.indices.isEmpty, current.width + extra + size.width > maxWidth {
                rows.append(current)
                current = Row()
            }
            current.width += (current.indices.isEmpty ? 0 : spacing) + size.width
            current.height = max(current.height, size.height)
            current.indices.append(i)
        }
        if !current.indices.isEmpty { rows.append(current) }
        return rows
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        let rows = computeRows(maxWidth: maxWidth, subviews: subviews)
        let height = rows.map(\.height).reduce(0, +) + rowSpacing * CGFloat(max(0, rows.count - 1))
        let width = proposal.width ?? rows.map(\.width).max() ?? 0
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let rows = computeRows(maxWidth: bounds.width, subviews: subviews)
        var y = bounds.minY
        for row in rows {
            var x: CGFloat
            switch alignment {
            case .center: x = bounds.minX + (bounds.width - row.width) / 2
            case .trailing: x = bounds.minX + bounds.width - row.width
            default: x = bounds.minX
            }
            for i in row.indices {
                let size = subviews[i].sizeThatFits(.unspecified)
                subviews[i].place(
                    at: CGPoint(x: x, y: y + row.height - size.height),
                    anchor: .topLeading,
                    proposal: .unspecified)
                x += size.width + spacing
            }
            y += row.height + rowSpacing
        }
    }
}
