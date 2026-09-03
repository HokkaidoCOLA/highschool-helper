# -*- coding: utf-8 -*-
# SPDX-License-Identifier: GPL-3.0-or-later
"""
高中助学 · 教师演示 PPT（苹果风重制版）—— python-pptx 单一写入端。

为什么换生成器：此前 pptxgenjs → 正则手术 → python-pptx 三层写入，Windows PowerPoint
（尤其希沃一体机）对上游 XML 怪癖零容忍。现在全部部件由 python-pptx 自己的序列化器产出，
项目里最保守、最接近 PowerPoint 原生写法的 OOXML。

设计：白底大留白 / 黑底首尾 / Apple 灰瓦片 / 大标题细字重；动效 = 每页淡入切换
（p:transition 是 ECMA 主命名空间的安全写法，不碰高危的 timing XML）。
第 8 页三维演示升级为 2×2 大图主角页；第 9 页右下角嵌入互动 HTML（OLE Package）。

用法：.cache/venv/bin/python scripts/make-ppt-guide.py [--no-ole]
"""
import io
import os
import struct
import sys

from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn

HOME = os.path.expanduser("~")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESK = os.path.join(HOME, "Documents", "演示")
DESKTOP = os.path.join(ROOT, ".preview", "desktop")
VIZ = os.path.join(ROOT, ".preview", "viz")
ICON = os.path.join(ROOT, ".cache", "ole-icon.png")
HTML = os.path.join(DESK, "高中助学-互动演示.html")
OUT = os.path.join(DESK, "高中助学-功能与使用-教师演示.pptx")
NO_OLE = "--no-ole" in sys.argv

# ── 色板与字体（Apple 风）───────────────────────────────────────────────────
INK = RGBColor(0x1D, 0x1D, 0x1F)
SUB = RGBColor(0x6E, 0x6E, 0x73)
FAINT = RGBColor(0xA1, 0xA1, 0xAA)
BLUE = RGBColor(0x2F, 0x6D, 0xF6)
TILE = RGBColor(0xF5, 0xF5, 0xF7)
BG = RGBColor(0xFF, 0xFF, 0xFF)
BLACK = RGBColor(0x0A, 0x0A, 0x0C)
WHITE = RGBColor(0xF5, 0xF5, 0xF7)
MUTE = RGBColor(0x8E, 0x8E, 0x93)
OKC = RGBColor(0x1F, 0xA9, 0x7C)
WARNC = RGBColor(0xE0, 0x8B, 0x1A)
EA_FONT = "Microsoft YaHei"
LIGHT_FONT = "Microsoft YaHei Light"
AR_APP = 2480 / 1640
AR_CANVAS = 2440 / 1040
TOTAL = 14
_n = [0]


def png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    return struct.unpack(">II", head[16:24])


def fade(slide):
    """给整页加淡入切换（ECMA 主命名空间，位置：clrMapOvr 之后）。"""
    sld = slide._element
    tr = sld.makeelement(qn("p:transition"), {"spd": "med"})
    tr.append(sld.makeelement(qn("p:fade"), {}))
    sld.append(tr)


def new_slide(prs, bg=BG):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = bg
    fade(s)
    _n[0] += 1
    return s


def _apply_font(run, name, size, color, bold):
    f = run.font
    f.size = Pt(size)
    f.bold = bold
    f.color.rgb = color
    f.name = name
    rPr = run._r.get_or_add_rPr()
    for tag in ("a:latin", "a:ea"):
        e = rPr.find(qn(tag))
        if e is None:
            e = rPr.makeelement(qn(tag), {})
            rPr.append(e)
        e.set("typeface", name)


def text(slide, x, y, w, h, paras, size=14, color=INK, bold=False, font=EA_FONT,
         align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, spacing=None, line=1.12):
    """paras: str | [(runs)]；runs: (txt, {overrides})"""
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    if isinstance(paras, str):
        paras = [[(paras, {})]]
    for i, para in enumerate(paras):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = line
        if i:
            p.space_before = Pt(6)
        if isinstance(para, str):
            para = [(para, {})]
        for txt, ov in para:
            r = p.add_run()
            r.text = txt
            _apply_font(r, ov.get("font", font), ov.get("size", size), ov.get("color", color),
                        ov.get("bold", bold))
            sp = ov.get("spacing", spacing)
            if sp:
                r._r.get_or_add_rPr().set("spc", str(int(sp * 100)))
    return tb


def tile(slide, x, y, w, h, fill=TILE, radius=0.055):
    sh = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    try:
        sh.adjustments[0] = radius
    except Exception:
        pass
    sh.fill.solid()
    sh.fill.fore_color.rgb = fill
    sh.line.fill.background()
    sh.shadow.inherit = False
    return sh


def pic(slide, path, x, y, w, ar=None, cap=None, cap_color=FAINT):
    if ar is None:
        pw, ph = png_size(path)
        ar = pw / ph
    h = w / ar
    slide.shapes.add_picture(path, Inches(x), Inches(y), Inches(w))
    if cap:
        text(slide, x, y + h + 0.05, w, 0.3, cap, size=9.5, color=cap_color, align=PP_ALIGN.CENTER)
    return h


def kicker_title(slide, kick, title, dark=False, sub=None):
    kc = BLUE if not dark else RGBColor(0x7D, 0x95, 0xFF)
    tc = INK if not dark else WHITE
    text(slide, 0.9, 0.52, 11.5, 0.35, [[(kick, {"spacing": 2})]], size=12.5, color=kc, bold=True)
    text(slide, 0.9, 0.86, 11.5, 0.75, title, size=30, color=tc, bold=True, font=LIGHT_FONT)
    if sub:
        text(slide, 0.9, 1.62, 11.5, 0.4, sub, size=13.5, color=SUB if not dark else MUTE)


def footer(slide, dark=False):
    if dark:
        return
    text(slide, 9.2, 7.08, 3.5, 0.3, "高中助学 · 教师演示　%d / %d" % (_n[0], TOTAL),
         size=9, color=RGBColor(0xC7, 0xC7, 0xCC), align=PP_ALIGN.RIGHT)


def bullets(slide, x, y, w, items, size=13.5, gap=10, line=1.22):
    paras = []
    for lead, rest in items:
        runs = [("•  ", {"color": BLUE, "bold": True})]
        if lead:
            runs.append((lead, {"bold": True, "color": INK}))
        runs.append((rest, {"color": SUB}))
        paras.append(runs)
    tb = text(slide, x, y, w, 5, paras, size=size, line=line)
    for i, p in enumerate(tb.text_frame.paragraphs):
        if i:
            p.space_before = Pt(gap)
    return tb


def package_blob(data, filename):
    def s(t):
        return t.encode("gbk", errors="replace") + b"\x00"
    fake = "C:\\hst-demo\\" + filename
    out = bytearray()
    out += struct.pack("<H", 2) + b"Package\x00" + b"\x00" + b"\x00"
    out += s(fake) + struct.pack("<I", 2) + s(fake)
    out += struct.pack("<I", len(data)) + data + b"\x00\x00"
    return bytes(out)


# ═══════════════════════ 组稿 ═══════════════════════
prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

# ── 1 封面（黑）──
s = new_slide(prs, BLACK)
text(s, 1.0, 1.5, 11.33, 0.4, [[("为 老 师 介 绍 的 一 次 演 示", {"spacing": 3})]],
     size=13, color=MUTE, align=PP_ALIGN.CENTER)
text(s, 1.0, 2.15, 11.33, 1.5, "高中助学", size=72, color=WHITE, bold=True,
     font=LIGHT_FONT, align=PP_ALIGN.CENTER)
text(s, 1.0, 3.9, 11.33, 0.6, [[("错题，", {}), ("自己会复习", {"color": RGBColor(0x9D, 0xB8, 0xFF)}), ("。", {})]],
     size=26, color=WHITE, font=LIGHT_FONT, align=PP_ALIGN.CENTER)
text(s, 1.0, 4.85, 11.33, 0.4, "错题本 · 艾宾浩斯自动排期 · 二维/三维动态演示 · AI 讲题",
     size=14, color=MUTE, align=PP_ALIGN.CENTER)
text(s, 1.0, 6.55, 11.33, 0.4, "手机 / 电脑 / 浏览器　·　离线可用　·　数据全在本机　·　免费开源",
     size=11.5, color=RGBColor(0x60, 0x60, 0x68), align=PP_ALIGN.CENTER)

# ── 2 四个场面 ──
s = new_slide(prs)
kicker_title(s, "为 什 么", "老师都见过的四个场面")
rows = [
    ("讲过的题，隔天还错", "订正当场会，考试照旧——缺的不是讲解，是节奏",
     "遗忘曲线自动排期", "每道错题到点回来报到，错 20 分钟后重排队"),
    ("说复习了，没法检查", "复习没留痕，牢不牢全凭自觉",
     "复习全程留数据", "每日条数、连续天数、正确率、薄弱排行"),
    ("抽象概念，黑板画不出", "截面、晶胞、晨昏线，只能靠学生脑补",
     "二维三维动态演示", "分步时间轴 + 3D 亲手旋转，AI 还能按题现画"),
    ("错题本坚持不过一周", "手抄太慢，抄完也不再翻",
     "录入十秒", "拍一张照，或把整份试卷拖进来自动拆题"),
]
y = 1.95
for pain, pain_sub, good, good_sub in rows:
    tile(s, 0.9, y, 5.35, 1.08)
    text(s, 1.2, y + 0.16, 4.9, 0.4, pain, size=14.5, color=INK, bold=True)
    text(s, 1.2, y + 0.58, 4.9, 0.4, pain_sub, size=11, color=SUB)
    text(s, 6.32, y + 0.28, 0.66, 0.5, "→", size=20, color=BLUE, bold=True, align=PP_ALIGN.CENTER)
    tile(s, 7.05, y, 5.38, 1.08, RGBColor(0xEC, 0xF2, 0xFF))
    text(s, 7.35, y + 0.16, 4.9, 0.4, good, size=14.5, color=BLUE, bold=True)
    text(s, 7.35, y + 0.58, 4.9, 0.4, good_sub, size=11, color=SUB)
    y += 1.26
footer(s)

# ── 3 六大功能 ──
s = new_slide(prs)
kicker_title(s, "有 什 么", "六大功能，一个闭环")
feats = [
    ("📕", "错题本 · 题库", "错题与知识卡片统一管理：检索、薄弱筛选、导出"),
    ("🧠", "艾宾浩斯复习", "按遗忘曲线自动排期，翻卡四档评分，错答即时回炉"),
    ("🌀", "动态演示", "九种 2D/3D 场景，分步时间轴，3D 可拖拽旋转"),
    ("📥", "试卷导入", "拖入 docx/pptx 整卷：自动切题、识别选项、答案回填"),
    ("🤖", "AI 讲题", "拍照问题、对话讲解，还能按题目现场画演示图"),
    ("📈", "学情统计", "高考倒计时、每日曲线、掌握度、模考成绩趋势"),
]
for i, (glyph, name, desc) in enumerate(feats):
    x = 0.9 + (i % 3) * 4.0
    y = 1.95 + (i // 3) * 2.3
    tile(s, x, y, 3.78, 2.1)
    text(s, x + 0.28, y + 0.22, 3.2, 0.55, glyph, size=26)
    text(s, x + 0.28, y + 0.82, 3.2, 0.4, name, size=15.5, bold=True)
    text(s, x + 0.28, y + 1.24, 3.25, 0.8, desc, size=10.5, color=SUB, line=1.25)
text(s, 0.9, 6.55, 11.5, 0.4, "不接 AI 时，前四项照样完整可用——AI 是增强，不是前提。",
     size=12.5, color=BLUE, align=PP_ALIGN.CENTER)
footer(s)

# ── 4 三分钟上手 ──
s = new_slide(prs)
kicker_title(s, "怎 么 用 ①", "三分钟上手")
devs = [("📱", "手机", "Android 安装 APK；或浏览器「添加到主屏幕」", BLUE),
        ("💻", "电脑", "Windows 安装包 / 免安装便携版，双击即用", RGBColor(0x7C, 0x5C, 0xFA)),
        ("🌐", "浏览器", "打开网址即用，断网也能继续复习", OKC)]
for i, (g, name, desc, c) in enumerate(devs):
    x = 0.9 + i * 4.0
    tile(s, x, 1.95, 3.78, 1.75)
    text(s, x + 0.28, 2.15, 3.2, 0.5, g, size=24)
    text(s, x + 0.28, 2.72, 3.2, 0.4, name, size=15, bold=True, color=c)
    text(s, x + 0.28, 3.14, 3.25, 0.55, desc, size=10.5, color=SUB, line=1.25)
steps = [
    ("1", "设置页选年级与考区", "高考倒计时、复习目标按学段自动配好"),
    ("2", "录几道错题开跑", "手录 / 拍照 / 导入试卷任选，当天生成第一份复习队列"),
    ("3", "（可选）接入 AI", "设置里填地址 / Key / 模型名，任意 OpenAI 兼容服务"),
]
y = 4.15
for num, head, sub in steps:
    c = tile(s, 0.9, y, 0.42, 0.42, BLUE, radius=0.5)
    text(s, 0.9, y + 0.02, 0.42, 0.38, num, size=15, color=WHITE, bold=True, align=PP_ALIGN.CENTER)
    text(s, 1.55, y - 0.02, 10.8, 0.4, [[(head + "　", {"bold": True, "color": INK}), (sub, {"color": SUB, "size": 12})]], size=14)
    y += 0.62
tile(s, 0.9, 6.25, 11.53, 0.62, RGBColor(0xFF, 0xF4, 0xE3))
text(s, 1.2, 6.25, 11.0, 0.62, [[("给老师的定心丸：", {"bold": True, "color": WARNC}),
     ("数据只存在学生自己的设备里；无账号体系、不上传、无广告。", {"color": INK})]], size=12.5, anchor=MSO_ANCHOR.MIDDLE)
footer(s)

# ── 5 录题 ──
s = new_slide(prs)
kicker_title(s, "使 用 · 录 入", "把错题记进来，只要十秒")
bullets(s, 0.9, 2.15, 5.3, [
    ("拍照录题：", "拍练习册上的错题，AI 识别题干自动入库、进入排期"),
    ("整卷导入：", "docx / pptx 拖进来——自动按题号切分、识别 ABCD、答案回填"),
    ("手动录入：", "学科 + 题干 + 答案 + 解析，四十秒一道"),
    ("内置起步包：", "六科高频知识卡片一键导入，第一天就有的复习"),
    ("入库即排期：", "每道题自动进遗忘曲线，到日子出现在「今日」"),
], size=13)
pic(s, os.path.join(DESKTOP, "a-library.png"), 6.55, 2.05, 5.9, cap="题库页：检索 · 薄弱筛选 · 一键导出")
footer(s)

# ── 6 每日闭环 ──
s = new_slide(prs)
kicker_title(s, "使 用 · 复 习", "每天十分钟，闭环自己转")
flow = [("打开「今日」", "队列与倒计时，一眼知道要干什么"), ("翻卡作答", "先看题干自己答，再对照"),
        ("四档自评", "重来 / 困难 / 良好 / 简单"), ("自动安排下次", "答错 20 分钟回炉，答对间隔拉长")]
for i, (a, b) in enumerate(flow):
    x = 0.9 + i * 3.05
    text(s, x, 1.95, 0.5, 0.5, "①②③④"[i], size=20, color=BLUE, bold=True)
    text(s, x + 0.42, 2.0, 2.55, 0.4, a, size=14, bold=True)
    text(s, x + 0.42, 2.42, 2.5, 0.7, b, size=10.5, color=SUB, line=1.25)
    if i < 3:
        text(s, x + 2.62, 1.98, 0.5, 0.4, "→", size=16, color=FAINT)
pic(s, os.path.join(DESKTOP, "a-today.png"), 0.9, 3.45, 4.85, cap="今日页：队列 · 分科待复习 · 快速记一笔")
pic(s, os.path.join(DESKTOP, "a-review.png"), 7.05, 3.45, 4.85, cap="复习页：左演示画布 + 右翻卡")
footer(s)

# ── 7 二维 ──
s = new_slide(prs)
kicker_title(s, "演 示 · 二 维", "函数切线、电路、过程曲线")
cw = 3.6
AR_V = 1372 / 1040
for i, (f, cap) in enumerate([
    ("v-plot2d.png", "数学 · 导数的几何意义：切线自动求斜率"),
    ("v-circuit.png", "物理 · 滑动变阻器变化，电路分步重画"),
    ("v-chart2d.png", "化学 · 升温瞬间 v−t 突跃，看平衡移动"),
]):
    pic(s, os.path.join(VIZ, f), 0.9 + i * (cw + 0.65), 1.95, cw, ar=AR_V, cap=cap)
bullets(s, 0.9, 5.35, 5.6, [
    ("分步时间轴：", "每张图按讲解节奏一步步「长」出来，★ 标关键步骤"),
    ("课堂自学两用：", "投屏讲一遍，学生平板上回放十遍"),
], size=12.5)
bullets(s, 6.9, 5.35, 5.5, [
    ("可交互：", "拖动平移、滚轮缩放、双击复位"),
    ("来源三种：", "内置样例 / AI 按题目现场生成 / JSON 导入"),
], size=12.5)
footer(s)

# ── 8 三维（主角页，2×2 大图）──
s = new_slide(prs)
kicker_title(s, "演 示 · 三 维", "把抽象对象，拿在手里转")
d3 = [("s-d-geom3d.png", "数学 · 正方体截面自动求解"), ("s-d-lattice.png", "化学 · NaCl 晶胞与配位数"),
      ("s-d-mol.png", "化学 · 乙烯分子空间构型"), ("s-d-globe.png", "地理 · 夏至光照与晨昏线")]
for i, (f, cap) in enumerate(d3):
    x = 1.12 + (i % 2) * 5.9
    y = 1.82 + (i // 2) * 2.72
    pic(s, os.path.join(VIZ, f), x, y, 5.2, ar=AR_CANVAS, cap=cap)
footer(s)

# ── 9 六科全景 + 互动嵌入 ──
s = new_slide(prs)
kicker_title(s, "六 科 齐 活", "每科一份，都在这儿")
grid = [("s-d-math3d.png", "数学 · 异面直线所成角（3D）"), ("s-physics.png", "物理 · 磁场圆周"), ("s-chinese.png", "语文 · 天净沙"),
        ("s-chemistry.png", "化学 · 滴定突跃"), ("s-english.png", "英语 · 长难句"), ("s-geography.png", "地理 · 三圈环流")]
for i, (f, lab) in enumerate(grid):
    x = 0.9 + (i % 3) * 3.38
    y = 1.95 + (i // 3) * 1.85
    pic(s, os.path.join(VIZ, f), x, y, 3.2, ar=AR_CANVAS, cap=lab)
ole_shape = None
if not NO_OLE and os.path.exists(HTML) and os.path.exists(ICON):
    with open(HTML, "rb") as f:
        blob = package_blob(f.read(), "高中助学-互动演示.html")
    ole_shape = s.shapes.add_ole_object(
        object_file=io.BytesIO(blob), prog_id="Package",
        left=Inches(11.05), top=Inches(2.35), width=Inches(1.38), height=Inches(0.86),
        icon_file=ICON)
    text(s, 10.85, 3.32, 1.78, 0.7, "双击图标\n提取 → 打开", size=10, color=SUB, align=PP_ALIGN.CENTER, line=1.25)
else:
    tile(s, 11.05, 2.35, 1.38, 0.86)
    text(s, 11.05, 2.35, 1.38, 0.86, "（未嵌入）", size=10, color=FAINT, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
text(s, 0.9, 6.0, 11.5, 0.8, [
    [("互动演示已装进这份 PPT：", {"bold": True, "color": INK})],
    [("右上角图标双击即开——切学科、空格走步骤、3D 亲手转；单文件离线，拷这一个 pptx 就够。", {"color": SUB, "size": 12})],
], size=13.5)
footer(s)

# ── 10 AI ──
s = new_slide(prs)
kicker_title(s, "使 用 · AI", "一位二十四小时在线的助教")
bullets(s, 0.9, 2.15, 5.3, [
    ("一句话发题：", "拍照或粘贴，按「先结论后步骤」讲解，深度随年级调整"),
    ("说「抽查我」：", "从今日队列抽题当场提问，评分自动记回排期"),
    ("让它画图：", "「画个传送带受力分析」——生成可分步播放的演示卡"),
    ("丢整份卷子：", "「把这份月考卷导进题库」——自动切题入库"),
    ("边界清楚：", "AI 只是「嘴」，题库/排期/统计都在本机执行"),
], size=13)
pic(s, os.path.join(DESKTOP, "a-chat.png"), 6.55, 2.05, 5.9, cap="聊天页：拍照 · 附件 · 建议气泡（桌面版）")
footer(s)

# ── 11 学情 ──
s = new_slide(prs)
kicker_title(s, "使 用 · 数 据", "学了什么样，数据说话")
bullets(s, 0.9, 2.15, 5.3, [
    ("每日曲线：", "复习条数、学习分钟、连续天数——真复习的证据"),
    ("薄弱排行：", "错得多、掌握度低的知识点排前面，下一步补哪目了然"),
    ("模考趋势：", "每次月考录一次，各科涨跌一条曲线看清"),
    ("备份迁移：", "一键导出 JSON；手机记的题导入电脑接着用"),
], size=13)
pic(s, os.path.join(DESKTOP, "a-stats.png"), 6.55, 2.05, 5.9, cap="统计页：时间窗曲线 · 掌握度 · 模考趋势")
footer(s)

# ── 12 场景 & Q&A ──
s = new_slide(prs)
kicker_title(s, "落 到 实 处", "用在哪，以及老师可能想问的")
tile(s, 0.9, 1.95, 5.75, 4.5)
text(s, 1.25, 2.2, 5.0, 0.4, "典型用法", size=15.5, bold=True, color=BLUE)
bullets(s, 1.25, 2.75, 5.1, [
    ("每日课后 10 分钟：", "打开「今日」清队列，错题不过夜"),
    ("考前两周总攻：", "按薄弱排行集中翻卡，演示卡回炉概念"),
    ("周末整理：", "一周试卷拍照归档，下周排期自动跟上"),
    ("家长监督：", "看连续天数与正确率曲线即可，不必盯过程"),
], size=12.5, gap=9)
tile(s, 6.95, 1.95, 5.75, 4.5)
text(s, 7.3, 2.2, 5.0, 0.4, "常见问题", size=15.5, bold=True, color=OKC)
bullets(s, 7.3, 2.75, 5.1, [
    ("数据安全吗：", "全部存本机，无账号无上传；AI 请求只发给自选端点"),
    ("收费吗：", "免费开源（GPL-3.0），无广告无内购"),
    ("断网能用吗：", "复习、题库、演示、统计全离线"),
    ("用什么模型：", "任意 OpenAI 兼容服务（DeepSeek、通义、Kimi 等）"),
], size=12.5, gap=9)
footer(s)

# ── 13 尾页（黑）──
s = new_slide(prs, BLACK)
text(s, 1.0, 2.7, 11.33, 1.0, "把每一道错题，都变成得分点。", size=38, color=WHITE,
     bold=True, font=LIGHT_FONT, align=PP_ALIGN.CENTER)
text(s, 1.0, 4.0, 11.33, 0.5, "欢迎试用 · 求指点", size=15, color=MUTE, align=PP_ALIGN.CENTER)
text(s, 1.0, 6.5, 11.33, 0.4, "第 9 页右下角的图标，就是这份 PPT 自带的互动演示",
     size=11.5, color=RGBColor(0x60, 0x60, 0x68), align=PP_ALIGN.CENTER)

# ── 14 彩蛋 ──
s = new_slide(prs)
text(s, 0.9, 1.7, 11.53, 0.4, [[("—— 彩 蛋 · 出 品 名 单 ——", {"spacing": 2})]],
     size=12, color=FAINT, align=PP_ALIGN.CENTER)
text(s, 0.9, 2.55, 11.53, 0.6, "所有内容由 deepseek-harness 搭配 qwen3.8flash-next——",
     size=17, bold=True, font=LIGHT_FONT, align=PP_ALIGN.CENTER)
text(s, 0.9, 3.2, 11.53, 0.6, "与一个即将改变世界的大模型，共同完成创作。",
     size=17, bold=True, font=LIGHT_FONT, align=PP_ALIGN.CENTER)
text(s, 0.9, 4.15, 11.53, 0.45, "这份 PPT 的文案与版式、十份演示的图（切线 / 电路 / 滴定 / 截面 / 晶胞 / 晨昏线），",
     size=12, color=SUB, align=PP_ALIGN.CENTER)
text(s, 0.9, 4.6, 11.53, 0.45, "与这个软件本身一样，皆为「人当船长、AI 当水手」的产物。",
     size=12, color=SUB, align=PP_ALIGN.CENTER)
text(s, 0.9, 5.5, 11.53, 0.5, "错题是你的，得分点是我们的。", size=14, bold=True, color=BLUE, align=PP_ALIGN.CENTER)
text(s, 0.9, 6.7, 11.53, 0.36, "GPL-3.0-or-later · 开源，每一行代码都经得起审视",
     size=10.5, color=FAINT, align=PP_ALIGN.CENTER)
footer(s)

prs.save(OUT)
print("PPT 已生成 →", OUT, "（%d 页 · python-pptx 单一写入 · 淡入切换）" % len(prs.slides._sldIdLst))
if NO_OLE:
    print("⚠ 本次未嵌入互动附件（--no-ole）")
