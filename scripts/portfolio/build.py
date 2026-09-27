#!/usr/bin/env python3
"""Build the Wafer Lens application portfolio from verified project evidence."""

import json
import sys
from pathlib import Path
from urllib.parse import urlparse

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
FONT_CANDIDATES = [
    ROOT / "scripts/portfolio/NotoSansKR.ttf",
    Path("/System/Library/Fonts/AppleSDGothicNeo.ttc"),
]
INK = colors.HexColor("#10232B")
BODY = colors.HexColor("#000000")
MINT = colors.HexColor("#42E0BD")
MUTED = colors.HexColor("#334D52")
PAPER = colors.HexColor("#F4F7F5")


def validate(data, source_path):
    required = ("title", "problem", "solution", "demo_url", "metrics_file", "runtime", "reproduce", "ai_use")
    missing = [key for key in required if not data.get(key)]
    if missing:
        raise ValueError("Missing required fields: " + ", ".join(missing))
    parsed = urlparse(data["demo_url"])
    if parsed.scheme != "https" or not parsed.netloc or ".example" in parsed.netloc:
        raise ValueError("demo_url must be the verified HTTPS deployment URL")
    metrics_path = (source_path.parent / data["metrics_file"]).resolve()
    if not metrics_path.is_file():
        raise FileNotFoundError(f"metrics artifact not found: {metrics_path}")
    evidence = json.loads(metrics_path.read_text(encoding="utf-8"))
    evaluation = evidence.get("evaluation", {})
    if not all(key in evaluation for key in ("total", "accuracy", "macroF1", "abstained", "abstentionRate", "accepted", "selectiveAccuracy", "perClass")):
        raise ValueError("metrics artifact lacks a complete holdout evaluation")
    if not data["reproduce"] or not evidence.get("limitations"):
        raise ValueError("reproduce must contain commands and metrics artifact must list limitations")
    statement = data["ai_use"].strip()
    if not 50 <= len(statement) <= 2000:
        raise ValueError(f"ai_use must be 50–2,000 characters (currently {len(statement)})")
    data["_evidence"] = evidence


def register_font():
    for font_path in FONT_CANDIDATES:
        if font_path.exists():
            pdfmetrics.registerFont(TTFont("Korean", str(font_path), subfontIndex=0))
            return "Korean"
    raise FileNotFoundError("Korean font not found; add NotoSansKR.ttf under scripts/portfolio/")


def wrapped(c, text, x, y, max_width, size=11, leading=17, color=BODY, font="Korean"):
    c.setFillColor(color)
    c.setFont(font, size)
    line = ""
    for word in str(text).split(" "):
        candidate = f"{line} {word}".strip()
        if line and pdfmetrics.stringWidth(candidate, font, size) > max_width:
            c.drawString(x, y, line)
            y -= leading
            line = word
        else:
            line = candidate
    if line:
        c.drawString(x, y, line)
        y -= leading
    return y


def page_header(c, number, title):
    width, height = A4
    c.setFillColor(INK)
    c.rect(0, height - 92, width, 92, fill=1, stroke=0)
    c.setFillColor(MINT)
    c.setFont("Korean", 9)
    c.drawString(42, height - 35, "WAFER LENS  /  AI HACKATHON 2026")
    c.setFillColor(colors.white)
    c.setFont("Korean", 23)
    c.drawString(42, height - 68, title)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(42, 24, "PUBLIC-DATA PROTOTYPE  ·  NO INTERNAL FAB DATA")
    c.drawRightString(width - 42, 24, f"{number} / 3")


def section(c, label, text, x, y, width, body_size=11):
    c.setFillColor(colors.HexColor("#008F79"))
    c.setFont("Korean", 9)
    c.drawString(x, y, label.upper())
    return wrapped(c, text, x, y - 21, width, size=body_size, leading=17)


def build(data, source_path, out_dir):
    font = register_font()
    out_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = out_dir / "wafer-lens-portfolio.pdf"
    width, height = A4
    c = canvas.Canvas(str(pdf_path), pagesize=A4)
    c.setTitle("Wafer Lens | AI Hackathon 2026")
    c.setAuthor("Wafer Lens project team")
    c.setFillColor(PAPER)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    page_header(c, 1, data["title"])
    y = height - 132
    y = section(c, "현장 문제", data["problem"], 42, y, width - 84, 12)
    y -= 16
    y = section(c, "제안하는 도구", data["solution"], 42, y, width - 84, 12)
    y -= 12
    c.setFillColor(INK)
    c.roundRect(42, y - 72, width - 84, 72, 10, fill=1, stroke=0)
    c.setFillColor(MINT)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(58, y - 25, "LIVE PROTOTYPE")
    c.setFillColor(colors.white)
    wrapped(c, data["demo_url"], 58, y - 48, width - 116, 10, 14, colors.white, "Helvetica")
    c.linkURL(data["demo_url"], (58, y - 54, width - 58, y - 40), relative=0, thickness=0)
    screenshot = data.get("screenshot")
    if screenshot:
        img = (source_path.parent / screenshot).resolve()
        if not img.is_file():
            raise FileNotFoundError(f"screenshot not found: {img}")
        c.drawImage(str(img), 42, 116, width - 84, 170, preserveAspectRatio=True, anchor="c", mask="auto")
    else:
        img = ROOT / "scripts/portfolio/wafer-optics.png"
        c.drawImage(str(img), 42, 116, 170, 170, preserveAspectRatio=True, anchor="c", mask="auto")
        c.setFillColor(MUTED)
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(127, 106, "CONCEPT ART · NOT A SCREENSHOT")
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(238, 257, "WORKFLOW")
        c.setFont(font, 9)
        c.drawString(238, 231, "01  샘플 또는 CSV map 불러오기")
        c.drawString(238, 205, "02  셀을 편집하며 가까운 패턴 비교")
        c.drawString(238, 179, "03  불확실성·기권을 확인하고 검토")
        c.setFillColor(MUTED)
        c.setFont(font, 9)
        c.drawString(238, 146, "패턴은 원인 진단이나 자동 판정이 아닙니다.")
    c.showPage()

    c.setFillColor(PAPER)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    evidence = data["_evidence"]
    page_header(c, 2, "검증 결과 · V2")
    y = height - 132
    ev = evidence["evaluation"]
    y = section(c, "데이터와 방법", f"{evidence['source']['name']} · {evidence['method']}", 42, y, width - 84, 9)
    y -= 10
    split = evidence["split"]
    train_n = sum(split["sampledRows"]["train"].values())
    final_n = sum(split["sampledRows"]["final"].values())
    final_lots = split["sampledLots"]["final"]
    y = section(c, "평가 방법", f"{ev['type']} Train {train_n}개 / {split['sampledLots']['train']} lots, final test {final_n}개 / {final_lots} lots. 해시 기반 lot 분리: 학습 3·4, 검증 1, 최종 평가 2.", 42, y, width - 84, 9)
    y -= 14
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(42, y, "MEASURED RESULTS")
    y -= 26
    metrics = [
        ("정확도 · 기권 포함", f"{ev['accuracy']:.1%}", f"{ev['correct']} / {ev['total']} final test wafers"),
        ("Macro F1", f"{ev['macroF1']:.3f}", "9개 class F1의 비가중 평균"),
        ("기권 비율", f"{ev['abstentionRate']:.1%}", f"{ev['abstained']} / {ev['total']} wafers"),
        ("응답 정확도", f"{ev['selectiveAccuracy']:.1%}", f"{ev['correct']} / {ev['accepted']} non-abstained wafers"),
    ]
    for name, value, context in metrics:
        c.setFillColor(colors.white)
        c.roundRect(42, y - 57, width - 84, 52, 7, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(font, 12)
        c.drawString(56, y - 25, name)
        c.setFillColor(colors.HexColor("#008F79"))
        c.setFont("Helvetica-Bold", 16)
        c.drawRightString(width - 56, y - 27, value)
        wrapped(c, context, 56, y - 44, width - 120, 8, 11, MUTED, "Helvetica" if context.isascii() else font)
        y -= 68
    weakest = sorted(ev["perClass"].items(), key=lambda item: item[1]["recall"])[:3]
    weak_summary = "낮은 recall class: " + " · ".join(f"{label} {values['recall']:.1%}" for label, values in weakest)
    wrapped(c, weak_summary, 42, y - 1, width - 84, 9, 13, colors.HexColor("#6F3E28"))
    c.setFillColor(MUTED)
    c.setFont(font, 8)
    c.drawString(42, 90, "수치는 입력된 평가 결과를 그대로 표시합니다. 운영 성능이나 수율 개선을 의미하지 않습니다.")
    c.showPage()

    c.setFillColor(PAPER)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    page_header(c, 3, "재현성과 한계")
    y = height - 132
    y = section(c, "재현", f"{data['runtime']} 환경에서 아래 명령을 실행합니다.", 42, y, width - 84)
    y -= 5
    for command in data["reproduce"]:
        c.setFillColor(INK)
        c.roundRect(42, y - 27, width - 84, 24, 4, fill=1, stroke=0)
        wrapped(c, command, 53, y - 20, width - 106, 8, 11, colors.white, "Helvetica")
        y -= 38
    y -= 7
    source = evidence["source"]
    y = section(c, "데이터 출처", f"{source['name']} · {source['uploader']} · {source['url']} · {source['listingLicense']}. {source['caveat']}", 42, y, width - 84, 8)
    y -= 4
    comparison = evidence.get("validationComparison", {})
    if "baseline80" in comparison and "candidate160" in comparison:
        base = comparison["baseline80"]
        candidate = comparison["candidate160"]
        history = evidence.get("evaluationHistory", {})
        overlap = history.get("v2EvaluationWaferIdOverlapWithV1Training", "일부")
        note = f"모델 선택: 검증 분할 {base['total']} wafers에서 학습 표본 {base['training']} / {candidate['training']}개를 비교 (macro-F1 {base['macroF1']:.3f} / {candidate['macroF1']:.3f}). 최종 {ev['total']} wafers ({final_lots} lots)는 v2 학습·검증 lots와 분리했지만, 최종 평가 ID {overlap}개가 v1 학습에 포함되어 전체 개발 이력 기준의 완전 독립 시험은 아닙니다."
        y = section(c, "모델 선택", note, 42, y, width - 84, 8)
        y -= 4
    y = section(c, "한계", " · ".join(evidence["limitations"]), 42, y, width - 84, 8)
    y -= 8
    section(c, "다음 검증", "데이터 권리와 라벨 품질 확인, 다른 데이터 분할에서의 재현, 도메인 전문가 검토, 실제 제조 환경의 별도 검증이 필요합니다.", 42, y, width - 84, 9)
    c.save()
    statement_path = out_dir / "ai-use-application.txt"
    statement_path.write_text(data["ai_use"].strip() + "\n", encoding="utf-8")
    return pdf_path, statement_path


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 scripts/portfolio/build.py output/portfolio-input.json")
    source = Path(sys.argv[1]).resolve()
    data = json.loads(source.read_text(encoding="utf-8"))
    validate(data, source)
    pdf_path, statement_path = build(data, source, ROOT / "output")
    print(f"Created {pdf_path}")
    print(f"Created {statement_path}")


if __name__ == "__main__":
    main()
