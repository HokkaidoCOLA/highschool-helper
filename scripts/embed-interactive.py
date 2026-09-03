# -*- coding: utf-8 -*-
# SPDX-License-Identifier: GPL-3.0-or-later
"""
把「高中助学-互动演示.html」以 OLE Package 附件嵌入教师演示 PPT 第 9 页（六科演示）。

Windows PowerPoint（含希沃一体机）双击图标 → 「提取包」→ 打开，浏览器加载完全离线的互动演示。
python-pptx 的 add_ole_object 只嵌原始字节，而 Packager.dll 要求 OLE 1.0 Package 流格式
（label/type/路径/长度/数据 的 ANSI 结构），所以这里先手工封装再喂给它。

用法：node scripts/make-ppt-guide.mjs && .cache/venv/bin/python scripts/embed-interactive.py
"""
import io
import os
import struct
import sys

from pptx import Presentation
from pptx.util import Inches

HOME = os.path.expanduser("~")
DEMO_DIR = os.path.join(HOME, "Documents", "演示")
HTML = os.path.join(DEMO_DIR, "高中助学-互动演示.html")
ICON = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".cache", "ole-icon.png")
PPTX = os.path.join(DEMO_DIR, "高中助学-功能与使用-教师演示.pptx")
SLIDE_INDEX = 8  # 第 9 页「六科演示，一屏看全」


def package_blob(data: bytes, filename: str) -> bytes:
    """封装 OLE 1.0 Package 流。ANSI 字符串按 GBK（中文 Windows / 希沃一体机语言环境）。"""

    def s(text: str) -> bytes:
        return text.encode("gbk", errors="replace") + b"\x00"

    fake_path = "C:\\hst-demo\\" + filename  # 提取对话框里显示的文件名来源
    out = bytearray()
    out += struct.pack("<H", 0x0002)          # version
    out += b"Package\x00"                     # label
    out += b"\x00"                            # type（空：交给系统按扩展名关联）
    out += b"\x00"                            # friendly app name
    out += s(fake_path)                       # 原始路径
    out += struct.pack("<I", 0x00000002)      # options
    out += s(fake_path)                       # temp 路径
    out += struct.pack("<I", len(data))       # 数据长度
    out += data                               # 文件字节
    out += b"\x00\x00"                        # 结束
    return bytes(out)


def main() -> int:
    for p in (HTML, ICON, PPTX):
        if not os.path.exists(p):
            print("缺少文件：", p)
            return 1

    with open(HTML, "rb") as f:
        blob = package_blob(f.read(), os.path.basename(HTML))

    prs = Presentation(PPTX)
    slide = prs.slides[SLIDE_INDEX]
    # 幂等：重跑先删旧嵌入对象
    for shp in list(slide.shapes):
        if shp.shape_type == 7 or (getattr(shp, "name", "") or "").startswith("hst-interactive"):  # MSO_SHAPE_TYPE.OLE_CONTROL
            shp._element.getparent().remove(shp._element)
    slide.shapes.add_ole_object(
        object_file=io.BytesIO(blob),
        prog_id="Package",
        left=Inches(11.02),
        top=Inches(5.93),
        width=Inches(1.42),
        height=Inches(0.89),
        icon_file=ICON,
    )
    prs.save(PPTX)
    print("互动演示已嵌入 →", PPTX)
    print("  · 附件 %.0f KB · 位置：第 %d 页右下角" % (len(blob) / 1024, SLIDE_INDEX + 1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
