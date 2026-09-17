#!/usr/bin/env python3
"""Generate FloBama OS V1 product overview PDF."""

from __future__ import annotations

import os
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    Flowable,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "flobama-os-v1.pdf"
LOGO = ROOT / "public" / "flobama-logo.png"

INK = colors.HexColor("#1a1614")
MUTED = colors.HexColor("#5c534c")
LINE = colors.HexColor("#d9d0c8")
PAPER = colors.HexColor("#faf7f4")
ACCENT = colors.HexColor("#d36b4a")
ACCENT_DEEP = colors.HexColor("#a84a30")
CHARCOAL = colors.HexColor("#2a2623")
SOFT = colors.HexColor("#f0e8e1")
OK = colors.HexColor("#2f6b4f")
BLUE = colors.HexColor("#3d5a73")
WHITE = colors.white


class HRFlowable(Flowable):
    def __init__(self, width, color=LINE, thickness=1):
        super().__init__()
        self.width = width
        self.color = color
        self.thickness = thickness
        self.height = 8

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thickness)
        self.canv.line(0, 4, self.width, 4)


class BoxCard(Flowable):
    def __init__(self, title, body_lines, width, accent=ACCENT, height=None):
        super().__init__()
        self.title = title
        self.body_lines = body_lines
        self.box_width = width
        self.accent = accent
        # estimate height
        self.height = height or (28 + 12 * len(body_lines) + 16)

    def wrap(self, availWidth, availHeight):
        return self.box_width, self.height

    def draw(self):
        c = self.canv
        c.setFillColor(WHITE)
        c.setStrokeColor(LINE)
        c.roundRect(0, 0, self.box_width, self.height, 5, fill=1, stroke=1)
        c.setStrokeColor(self.accent)
        c.setLineWidth(2.5)
        c.line(1, self.height - 1, self.box_width - 1, self.height - 1)
        c.setFillColor(ACCENT_DEEP if self.accent == ACCENT else self.accent)
        c.setFont("Times-Bold", 10)
        c.drawString(10, self.height - 16, self.title)
        c.setFillColor(INK)
        c.setFont("Helvetica", 8)
        y = self.height - 30
        for line in self.body_lines:
            c.drawString(10, y, line[:95])
            y -= 11


class ArchitectureDiagram(Flowable):
    def __init__(self, width=7.3 * inch, height=3.55 * inch):
        super().__init__()
        self.width = width
        self.height = height

    def wrap(self, availWidth, availHeight):
        return self.width, self.height

    def _box(self, c, x, y, w, h, title, sub, fill=WHITE, stroke=LINE, title_color=INK):
        c.setFillColor(fill)
        c.setStrokeColor(stroke)
        c.setLineWidth(1)
        c.roundRect(x, y, w, h, 4, fill=1, stroke=1)
        c.setFillColor(title_color)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(x + w / 2, y + h - 14, title)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 6.5)
        c.drawCentredString(x + w / 2, y + h - 26, sub)

    def draw(self):
        c = self.canv
        c.setFillColor(PAPER)
        c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        c.setStrokeColor(LINE)
        c.rect(0, 0, self.width, self.height, fill=0, stroke=1)

        # Clients
        self._box(c, 12, 250, 110, 42, "Staff browser", "cookie session")
        self._box(c, 12, 195, 110, 42, "Public / WP", "embed · API · tickets")
        self._box(c, 12, 140, 110, 42, "OBS booth PC", "overlay + WebSocket")
        self._box(c, 12, 85, 110, 42, "Vertical TVs", "/display/vertical")

        # App
        c.setFillColor(CHARCOAL)
        c.roundRect(150, 85, 250, 210, 8, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("Times-Bold", 11)
        c.drawCentredString(275, 275, "Next.js App Router")
        c.setFont("Helvetica", 6.5)
        c.setFillColor(colors.HexColor("#d8c8bc"))
        c.drawCentredString(275, 262, "flobama-os · Vercel / :43123")

        self._box(c, 165, 195, 100, 48, "Staff routes", "actions + RLS", fill=colors.HexColor("#3a322e"), stroke=ACCENT, title_color=colors.HexColor("#ffd4c4"))
        self._box(c, 280, 195, 100, 48, "Public API", "/api/public/v1/*", fill=colors.HexColor("#3a322e"), stroke=BLUE, title_color=colors.HexColor("#d6e4ef"))
        self._box(c, 165, 110, 215, 70, "Integrations (server-only)", "GHL · OpenAI · Storage · OBS (browser)", fill=colors.HexColor("#3a322e"), stroke=OK, title_color=colors.HexColor("#c8e0d4"))

        # Supabase
        c.setFillColor(WHITE)
        c.setStrokeColor(ACCENT)
        c.setLineWidth(2)
        c.roundRect(430, 85, 160, 210, 8, fill=1, stroke=1)
        c.setFillColor(ACCENT_DEEP)
        c.setFont("Times-Bold", 11)
        c.drawCentredString(510, 275, "Supabase")
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 6.5)
        c.drawCentredString(510, 262, "Postgres + Auth + Storage")
        for i, label in enumerate(["auth.users · profiles", "events · artists · RLS", "ticketing · screens", "event_listings views"]):
            y = 230 - i * 38
            fill = SOFT if i < 3 else colors.HexColor("#eef3f0")
            c.setFillColor(fill)
            c.setStrokeColor(LINE)
            c.setLineWidth(1)
            c.roundRect(445, y, 130, 28, 3, fill=1, stroke=1)
            c.setFillColor(INK)
            c.setFont("Helvetica", 7)
            c.drawCentredString(510, y + 10, label)

        # External
        c.setFillColor(CHARCOAL)
        c.setFont("Times-Bold", 9)
        c.drawString(12, 62, "External systems")
        for i, (t, s) in enumerate([
            ("GoHighLevel", "booking + social"),
            ("OpenAI", "band-fit analysis"),
            ("Google Sheet", "master calendar CSV"),
            ("OBS WebSocket v5", "LAN booth only"),
        ]):
            x = 12 + i * 145
            self._box(c, x, 12, 135, 40, t, s, stroke=BLUE)

        # Arrows
        c.setStrokeColor(MUTED)
        c.setLineWidth(1.2)
        for y in (271, 216, 161, 106):
            c.line(122, y, 148, 200)
        c.setStrokeColor(ACCENT)
        c.setLineWidth(2)
        c.line(400, 190, 428, 190)


class ERDiagram(Flowable):
    """Generic labeled box diagram."""

    def __init__(self, title, boxes, edges, width=7.3 * inch, height=2.9 * inch):
        super().__init__()
        self.title = title
        self.boxes = boxes  # list of (x,y,w,h,label,sub,fill,stroke)
        self.edges = edges  # list of (x1,y1,x2,y2,color)
        self.width = width
        self.height = height

    def wrap(self, availWidth, availHeight):
        return self.width, self.height

    def draw(self):
        c = self.canv
        c.setFillColor(PAPER)
        c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        c.setStrokeColor(LINE)
        c.rect(0, 0, self.width, self.height, fill=0, stroke=1)
        c.setFillColor(CHARCOAL)
        c.setFont("Times-Bold", 10)
        c.drawString(10, self.height - 16, self.title)

        for x1, y1, x2, y2, col in self.edges:
            c.setStrokeColor(col)
            c.setLineWidth(1.1)
            c.line(x1, y1, x2, y2)

        for x, y, w, h, label, sub, fill, stroke in self.boxes:
            c.setFillColor(fill)
            c.setStrokeColor(stroke)
            c.setLineWidth(1.4 if stroke == ACCENT else 1)
            c.roundRect(x, y, w, h, 4, fill=1, stroke=1)
            c.setFillColor(WHITE if fill == CHARCOAL else (ACCENT_DEEP if stroke == ACCENT else INK))
            c.setFont("Helvetica-Bold", 8)
            c.drawCentredString(x + w / 2, y + h / 2 + (4 if sub else 0), label)
            if sub:
                c.setFillColor(colors.HexColor("#d8c8bc") if fill == CHARCOAL else MUTED)
                c.setFont("Helvetica", 6)
                c.drawCentredString(x + w / 2, y + h / 2 - 8, sub)


class NumberedFooterCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_decorations(self, page_count):
        page = self._pageNumber
        self.setStrokeColor(LINE)
        self.setLineWidth(0.6)
        self.line(0.6 * inch, 0.45 * inch, letter[0] - 0.6 * inch, 0.45 * inch)
        self.setFont("Helvetica", 7)
        self.setFillColor(MUTED)
        self.drawString(0.6 * inch, 0.32 * inch, "FloBama OS V1 · Product overview")
        self.drawRightString(letter[0] - 0.6 * inch, 0.32 * inch, f"{page} / {page_count}")


def styles():
    base = getSampleStyleSheet()
    s = {
        "tag": ParagraphStyle(
            "tag",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7,
            textColor=ACCENT_DEEP,
            spaceAfter=6,
            leading=9,
        ),
        "h1": ParagraphStyle(
            "h1",
            parent=base["Heading1"],
            fontName="Times-Bold",
            fontSize=22,
            textColor=CHARCOAL,
            spaceAfter=6,
            leading=26,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base["Heading2"],
            fontName="Times-Bold",
            fontSize=13,
            textColor=CHARCOAL,
            spaceBefore=8,
            spaceAfter=4,
            leading=16,
        ),
        "h3": ParagraphStyle(
            "h3",
            parent=base["Heading3"],
            fontName="Times-Bold",
            fontSize=10,
            textColor=ACCENT_DEEP,
            spaceBefore=4,
            spaceAfter=3,
            leading=13,
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            textColor=INK,
            leading=12.5,
            spaceAfter=6,
        ),
        "lede": ParagraphStyle(
            "lede",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=MUTED,
            leading=13.5,
            spaceAfter=8,
        ),
        "small": ParagraphStyle(
            "small",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            textColor=MUTED,
            leading=11,
            spaceAfter=4,
        ),
        "cell": ParagraphStyle(
            "cell",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7.5,
            textColor=INK,
            leading=10,
        ),
        "cell_head": ParagraphStyle(
            "cell_head",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            textColor=CHARCOAL,
            leading=10,
        ),
        "mono": ParagraphStyle(
            "mono",
            parent=base["Normal"],
            fontName="Courier",
            fontSize=7,
            textColor=INK,
            leading=9.5,
        ),
        "caption": ParagraphStyle(
            "caption",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=7.5,
            textColor=MUTED,
            alignment=TA_CENTER,
            spaceBefore=2,
            spaceAfter=8,
        ),
        "hero_title": ParagraphStyle(
            "hero_title",
            parent=base["Normal"],
            fontName="Times-Bold",
            fontSize=28,
            textColor=WHITE,
            leading=32,
            spaceAfter=8,
        ),
        "hero_body": ParagraphStyle(
            "hero_body",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=colors.HexColor("#e8ddd4"),
            leading=13.5,
            spaceAfter=6,
        ),
        "hero_meta": ParagraphStyle(
            "hero_meta",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            textColor=colors.HexColor("#d8c8bc"),
            leading=11,
        ),
        "bullet": ParagraphStyle(
            "bullet",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            textColor=INK,
            leading=11,
            leftIndent=8,
        ),
    }
    return s


def make_table(headers, rows, col_widths):
    data = [[Paragraph(h, styles()["cell_head"]) for h in headers]]
    for row in rows:
        data.append([Paragraph(c, styles()["cell"]) for c in row])
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), SOFT),
                ("GRID", (0, 0), (-1, -1), 0.5, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return t


def hero_block(s):
    """Build cover hero as a table with dark background."""
    logo_cell = []
    inner = []
    if LOGO.exists():
        from reportlab.platypus import Image

        img = Image(str(LOGO), width=2.1 * inch, height=0.68 * inch, kind="proportional")
        logo_cell.append(img)
    else:
        logo_cell.append(Paragraph("<b>FloBama</b>", s["hero_title"]))

    logo_cell.append(Spacer(1, 8))
    logo_cell.append(
        Paragraph(
            '<font color="#ffd4c4"><b>PRODUCT OVERVIEW · VERSION 1</b></font>',
            s["hero_meta"],
        )
    )
    logo_cell.append(Spacer(1, 6))
    logo_cell.append(Paragraph("FloBama OS", s["hero_title"]))
    logo_cell.append(
        Paragraph(
            "The internal operations platform for FloBama Music Hall — events, artists, "
            "public listings, screens, ticketing, booking, and social — so staff can run "
            "the room without touching the public website stack.",
            s["hero_body"],
        )
    )
    logo_cell.append(Spacer(1, 8))
    meta = Table(
        [
            [
                Paragraph("<b>Venue</b><br/>FloBama Music Hall · America/Chicago", s["hero_meta"]),
                Paragraph("<b>Stack</b><br/>Next.js · Supabase · GHL · OpenAI", s["hero_meta"]),
                Paragraph("<b>Production</b><br/>flobama-os.vercel.app", s["hero_meta"]),
                Paragraph("<b>Audience</b><br/>Admin / Manager / Viewer", s["hero_meta"]),
            ]
        ],
        colWidths=[1.7 * inch, 1.7 * inch, 1.6 * inch, 1.5 * inch],
    )
    logo_cell.append(meta)
    logo_cell.append(Spacer(1, 10))
    stats = Table(
        [
            [
                Paragraph("<font size='12'><b>Events</b></font><br/>Calendar, publish, sheet sync", s["hero_meta"]),
                Paragraph("<font size='12'><b>Screens</b></font><br/>LED wall + vertical TVs", s["hero_meta"]),
                Paragraph("<font size='12'><b>Tickets</b></font><br/>GA, VIP, tables, door QR", s["hero_meta"]),
                Paragraph("<font size='12'><b>Booking</b></font><br/>GHL inbox + band-fit AI", s["hero_meta"]),
            ]
        ],
        colWidths=[1.7 * inch, 1.7 * inch, 1.6 * inch, 1.5 * inch],
    )
    stats.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#3a322e")),
                ("BOX", (0, 0), (0, 0), 0.5, colors.HexColor("#4a403c")),
                ("BOX", (1, 0), (1, 0), 0.5, colors.HexColor("#4a403c")),
                ("BOX", (2, 0), (2, 0), 0.5, colors.HexColor("#4a403c")),
                ("BOX", (3, 0), (3, 0), 0.5, colors.HexColor("#4a403c")),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    logo_cell.append(stats)

    wrapper = Table([[logo_cell]], colWidths=[7.1 * inch])
    wrapper.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), CHARCOAL),
                ("LEFTPADDING", (0, 0), (-1, -1), 16),
                ("RIGHTPADDING", (0, 0), (-1, -1), 16),
                ("TOPPADDING", (0, 0), (-1, -1), 18),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 16),
            ]
        )
    )
    return wrapper


def bullets(items, s):
    return ListFlowable(
        [ListItem(Paragraph(i, s["bullet"]), leftIndent=8, bulletColor=ACCENT) for i in items],
        bulletType="bullet",
        start="•",
        leftIndent=12,
        bulletFontSize=8,
        spaceBefore=0,
        spaceAfter=4,
    )


def build():
    s = styles()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=letter,
        leftMargin=0.6 * inch,
        rightMargin=0.6 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.65 * inch,
        title="FloBama OS V1 — Product Overview",
        author="FloBama Music Hall",
    )

    story = []

    # -------- Cover --------
    story.append(hero_block(s))
    story.append(Spacer(1, 14))
    story.append(Paragraph("What V1 is", s["h2"]))
    story.append(
        Paragraph(
            "FloBama OS is a single Next.js App Router application with a Supabase Postgres backend. "
            "Staff authenticate with email/password; roles are venue-scoped and enforced in both "
            "server actions and row-level security. Public consumers never read internal event rows — "
            "they hit projection views and a versioned JSON API.",
            s["body"],
        )
    )
    story.append(
        Paragraph(
            "The product deliberately does <i>not</i> edit flobamadowntown.com, Pick'em, or other "
            "production sites. WordPress embeds, OBS overlays, and kiosk displays consume FloBama OS "
            "as the source of truth for listings and screens.",
            s["body"],
        )
    )
    story.append(Paragraph("In this document", s["h3"]))
    story.append(
        bullets(
            [
                "Product modules &amp; staff roles",
                "Architecture &amp; data flow",
                "External APIs and how they are used",
                "Database layout diagrams",
                "Ticketing &amp; screens runtime flows",
                "Public surface endpoints",
            ],
            s,
        )
    )

    # -------- Features --------
    story.append(PageBreak())
    story.append(Paragraph("PRODUCT", s["tag"]))
    story.append(Paragraph("Features by module", s["h1"]))
    story.append(
        Paragraph(
            "Everything lives in one staff app. Modules share the venue record, timezone, and role matrix.",
            s["lede"],
        )
    )

    card_w = 3.45 * inch
    row1 = Table(
        [
            [
                BoxCard(
                    "Dashboard & Events",
                    [
                        "• Today overlap, 7-day count, drafts, attention queue",
                        "• Create / edit / duplicate / publish / archive",
                        "• Ticketed flag, ticket URL, cover labels",
                        "• Events → Update syncs master Google Sheet",
                        "  by legacy_source_id (idempotent)",
                    ],
                    card_w,
                    height=95,
                ),
                BoxCard(
                    "Artists",
                    [
                        "• Directory: search, create, edit, archive",
                        "• Linked upcoming and past events",
                        "• Genre, bio, website",
                        "• Karaoke import does not invent a Karaoke artist",
                    ],
                    card_w,
                    accent=BLUE,
                    height=95,
                ),
            ]
        ],
        colWidths=[card_w + 8, card_w],
    )
    row2 = Table(
        [
            [
                BoxCard(
                    "Public listings",
                    [
                        "• JSON API with CORS * on GET",
                        "• HTML embed + iframe resizer for WordPress",
                        "• OBS overlay at 1920×1080",
                        "• Internal notes stay staff-only",
                    ],
                    card_w,
                    accent=OK,
                    height=88,
                ),
                BoxCard(
                    "Screens",
                    [
                        "• LED wall: OBS WebSocket v5 Ads vs Band",
                        "• Vertical 1080×1920 playlist + this-week slide",
                        "• Timed takeovers",
                        "• Weekly flyer & social graphic exports",
                    ],
                    card_w,
                    height=88,
                ),
            ]
        ],
        colWidths=[card_w + 8, card_w],
    )
    row3 = Table(
        [
            [
                BoxCard(
                    "Ticketing",
                    [
                        "• GA / VIP, whole-table reservations, guest checkout",
                        "• 10-minute holds; conditional table inventory",
                        "• QR passes + door check-in",
                        "• Mock payments in V1 (Stripe reserved)",
                    ],
                    card_w,
                    accent=BLUE,
                    height=88,
                ),
                BoxCard(
                    "Booking & Social",
                    [
                        "• GHL Band Submission & Private Events inbox",
                        "• GHL remains source of truth (not copied to DB)",
                        "• OpenAI booking-fit advisory",
                        "• GHL Social Planner for weekly graphics",
                    ],
                    card_w,
                    accent=OK,
                    height=88,
                ),
            ]
        ],
        colWidths=[card_w + 8, card_w],
    )
    story.append(row1)
    story.append(Spacer(1, 8))
    story.append(row2)
    story.append(Spacer(1, 8))
    story.append(row3)
    story.append(Paragraph("Staff roles", s["h2"]))
    roles = Table(
        [
            [
                BoxCard("Admin", ["Full control — staff, venue rename,", "events, screens, ticketing, booking, social"], 2.25 * inch, ACCENT, 58),
                BoxCard("Manager", ["Day-to-day ops — events, artists,", "screens, ticketing (no staff admin)"], 2.25 * inch, BLUE, 58),
                BoxCard("Viewer", ["Read-only calendar, artists,", "staff directory, sales views"], 2.25 * inch, OK, 58),
            ]
        ],
        colWidths=[2.35 * inch, 2.35 * inch, 2.3 * inch],
    )
    story.append(roles)
    story.append(Spacer(1, 8))
    callout = Table(
        [
            [
                Paragraph(
                    "<b>No public signup.</b> First admin is bootstrapped in SQL; later logins via Settings → Staff. "
                    "Master admin <font face='Courier' size='7.5'>zak@view360.marketing</font> cannot be removed or demoted by other staff.",
                    s["small"],
                )
            ]
        ],
        colWidths=[7.1 * inch],
    )
    callout.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fff8f4")),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LINEBEFORE", (0, 0), (0, -1), 3, ACCENT),
            ]
        )
    )
    story.append(callout)

    # -------- Architecture --------
    story.append(PageBreak())
    story.append(Paragraph("ARCHITECTURE", s["tag"]))
    story.append(Paragraph("How the app works", s["h1"]))
    story.append(
        Paragraph(
            "Staff sessions, public projections, and external services stay separated by design.",
            s["lede"],
        )
    )
    story.append(ArchitectureDiagram())
    story.append(Paragraph("Figure 1 — Runtime topology: staff UI, public surfaces, Supabase, and third-party APIs", s["caption"]))
    story.append(Paragraph("Request paths", s["h2"]))
    story.append(
        make_table(
            ["Surface", "Auth", "Data path"],
            [
                [
                    "Staff pages / server actions",
                    "Cookie session + membership role",
                    "Authenticated client → tables under RLS; service role only for creating logins",
                ],
                [
                    "<font face='Courier' size='7'>/api/public/v1/*</font>",
                    "Anonymous (CORS * on GET)",
                    "Anon client → event_listings / screen views / ticketing public handlers",
                ],
                [
                    "Booking / Social",
                    "Staff session + GHL PIT",
                    "Server fetches GHL; records are not copied into Postgres",
                ],
                [
                    "OBS LED wall",
                    "Staff session on booth PC",
                    "OBS credentials in sessionStorage; scenes driven by /now + takeover state",
                ],
            ],
            [1.8 * inch, 1.8 * inch, 3.5 * inch],
        )
    )

    # -------- APIs --------
    story.append(PageBreak())
    story.append(Paragraph("INTEGRATIONS", s["tag"]))
    story.append(Paragraph("APIs used — and how", s["h1"]))
    story.append(
        Paragraph(
            "V1 leans on a small set of external services. Secrets are server-only unless noted.",
            s["lede"],
        )
    )
    story.append(
        make_table(
            ["API / service", "Used for", "How FloBama OS calls it"],
            [
                [
                    "<b>Supabase</b><br/>Auth · Postgres · Storage",
                    "Identity, operational data, screen-ad files",
                    "@supabase/ssr cookie sessions; anon key for public views; service role for staff creation; screen-ads storage bucket",
                ],
                [
                    "<b>GoHighLevel</b><br/>leadconnectorhq.com",
                    "Band submissions, private events, Social Planner",
                    "Private Integration Token + location id. Custom objects; associations → contacts; Social Planner posts for weekly graphics",
                ],
                [
                    "<b>OpenAI</b>",
                    "Advisory band booking-fit scores",
                    "Server chat completion (default gpt-4.1-mini) from GHL Band Inquiry fields only — no live scraping; never writes status to GHL",
                ],
                [
                    "<b>Google Sheets</b><br/>published CSV",
                    "Master calendar import",
                    "Events → Update fetches published FloBama sheet CSV, upserts by legacy_source_id, withdraws unpublished/archived rows",
                ],
                [
                    "<b>OBS WebSocket v5</b>",
                    "LED wall scene cutting",
                    "obs-websocket-js from the booth browser; credentials never stored in DB or git",
                ],
                [
                    "<b>Stripe</b> (reserved)",
                    "Future card checkout",
                    "V1 uses a labeled mock payment adapter; live Stripe key without wiring refuses charges",
                ],
            ],
            [1.7 * inch, 1.7 * inch, 3.7 * inch],
        )
    )
    story.append(Paragraph("Public HTTP API (owned by FloBama OS)", s["h2"]))
    story.append(
        make_table(
            ["Endpoint", "Purpose"],
            [
                ["GET /api/public/v1/events", "Upcoming public listings (from, to, limit)"],
                ["GET /api/public/v1/events/[id]", "Single public event detail"],
                ["GET /api/public/v1/now", "Today’s overlapping shows + booth now-playing"],
                ["GET /api/public/v1/screens/vertical", "Vertical TV playlist JSON (kiosks poll)"],
                ["GET /api/public/v1/screens/week", "This week’s events for the live slide"],
                ["GET /api/public/v1/screens/week/social", "Social graphic render helper"],
                ["POST /api/public/v1/ticketing/hold", "Hold GA qty / tables (~10 min)"],
                ["POST /api/public/v1/ticketing/checkout", "Guest checkout → order + QR tickets"],
                ["GET /api/public/v1/ticketing/events/[id]", "Public ticketed event catalog + map"],
                ["GET /api/public/v1/ticketing/tickets/[token]", "Resolve ticket pass by QR token"],
            ],
            [3.4 * inch, 3.7 * inch],
        )
    )
    story.append(
        Paragraph(
            "<b>GHL booking call pattern:</b> 1) List custom object records → "
            "2) <font face='Courier' size='7.5'>GET /associations/relations/{recordId}</font> → "
            "3) <font face='Courier' size='7.5'>GET /contacts/{id}</font> → "
            "4) OpenAI fit note from inquiry fields only.",
            s["body"],
        )
    )

    # -------- Database core --------
    story.append(PageBreak())
    story.append(Paragraph("DATA MODEL", s["tag"]))
    story.append(Paragraph("Database layout", s["h1"]))
    story.append(
        Paragraph(
            "Single venue seed. Timezone locked to America/Chicago. Anonymous roles cannot SELECT internal tables.",
            s["lede"],
        )
    )

    core_boxes = [
        (270, 195, 160, 48, "venues", "id · name · timezone=Chicago", CHARCOAL, CHARCOAL),
        (20, 120, 130, 44, "profiles", "id → auth.users", WHITE, ACCENT),
        (170, 120, 145, 44, "venue_memberships", "venue_id · user_id · role", WHITE, ACCENT),
        (340, 120, 120, 44, "artists", "venue_id · name · genre", WHITE, LINE),
        (485, 120, 130, 44, "events", "status · visibility · times", WHITE, LINE),
        (400, 50, 130, 40, "event_artists", "event · artist · order", WHITE, LINE),
        (20, 50, 130, 40, "event_listings", "public view (no notes)", colors.HexColor("#eef3f0"), OK),
        (170, 50, 145, 40, "event_listing_artists", "public artist names", colors.HexColor("#eef3f0"), OK),
        (20, 5, 130, 32, "booth_state", "live_event · lower_third", WHITE, BLUE),
    ]
    core_edges = [
        (350, 195, 250, 164, ACCENT),
        (350, 195, 400, 164, MUTED),
        (350, 195, 550, 164, MUTED),
        (400, 120, 465, 90, MUTED),
        (550, 120, 465, 90, MUTED),
        (550, 120, 85, 90, OK),
    ]
    story.append(ERDiagram("Core domain", core_boxes, core_edges, height=2.7 * inch))
    story.append(Paragraph("Figure 2 — Core schema: membership, events/artists, and public projection views", s["caption"]))

    sec = Table(
        [
            [
                [
                    Paragraph("Security highlights", s["h3"]),
                    bullets(
                        [
                            "RLS forced on operational tables",
                            "Anon: no SELECT on events",
                            "Public consumers use security-definer views",
                            "Ticketing PII is staff-only",
                        ],
                        s,
                    ),
                ],
                [
                    Paragraph("Key enums", s["h3"]),
                    bullets(
                        [
                            "staff_role: admin · manager · viewer",
                            "event_status: draft · published · cancelled",
                            "event_visibility: public · private",
                            "event_type: live_music · karaoke · dj · sports · private_event · other",
                        ],
                        s,
                    ),
                ],
            ]
        ],
        colWidths=[3.5 * inch, 3.5 * inch],
    )
    story.append(sec)

    # -------- Ticketing + screens schema --------
    story.append(PageBreak())
    story.append(Paragraph("DATA MODEL", s["tag"]))
    story.append(Paragraph("Ticketing &amp; screens schemas", s["h1"]))

    tick_boxes = [
        (10, 175, 90, 36, "events", "", CHARCOAL, CHARCOAL),
        (120, 175, 115, 36, "event_ticketing", "enabled · holds", WHITE, ACCENT),
        (255, 175, 105, 36, "ticket_types", "GA / VIP · qty", WHITE, LINE),
        (380, 175, 100, 36, "ticket_holds", "session · expiry", WHITE, LINE),
        (10, 110, 115, 40, "venue_layouts", "master room", WHITE, BLUE),
        (140, 110, 130, 40, "venue_layout_objects", "tables · bar · stage", WHITE, BLUE),
        (290, 110, 110, 40, "event_layouts", "per-show snapshot", WHITE, ACCENT),
        (420, 110, 140, 40, "event_layout_objects", "available/held/sold", WHITE, ACCENT),
        (40, 45, 120, 40, "ticketing_orders", "guest PII · totals", WHITE, OK),
        (180, 45, 110, 40, "order_items", "ticket · table", WHITE, LINE),
        (310, 45, 95, 40, "tickets", "qr_token", WHITE, LINE),
        (425, 45, 95, 40, "checkins", "door scans", WHITE, LINE),
        (150, 5, 110, 28, "payments", "mock · stripe", SOFT, LINE),
        (290, 5, 110, 28, "refunds", "optional", SOFT, LINE),
    ]
    tick_edges = [
        (100, 193, 120, 193, MUTED),
        (235, 193, 255, 193, MUTED),
        (360, 193, 380, 193, MUTED),
        (125, 110, 125, 175, BLUE),
        (255, 130, 290, 130, ACCENT),
        (400, 130, 420, 130, ACCENT),
        (180, 175, 100, 85, OK),
        (160, 65, 180, 65, MUTED),
        (290, 65, 310, 65, MUTED),
        (405, 65, 425, 65, MUTED),
    ]
    story.append(ERDiagram("Ticketing", tick_boxes, tick_edges, height=2.45 * inch))
    story.append(Paragraph("Figure 3 — Ticketing: master layout → event snapshot → holds → orders → QR tickets", s["caption"]))

    screen_boxes = [
        (15, 40, 125, 55, "screen_wall_state", "auto/manual · scenes", WHITE, BLUE),
        (155, 40, 115, 55, "screen_ads", "media · order · transition", WHITE, ACCENT),
        (285, 40, 125, 55, "screen_ad_listings", "public playlist view", colors.HexColor("#eef3f0"), OK),
        (425, 40, 120, 55, "screen_takeovers", "timed override", WHITE, ACCENT),
        (155, 5, 255, 24, "Storage: screen-ads bucket", "", CHARCOAL, CHARCOAL),
    ]
    story.append(ERDiagram("Screens", screen_boxes, [], height=1.35 * inch))
    story.append(Paragraph("Figure 4 — Screens tables: LED wall config, ad playlist, takeovers, and storage", s["caption"]))

    # -------- Flows --------
    story.append(PageBreak())
    story.append(Paragraph("RUNTIME", s["tag"]))
    story.append(Paragraph("How key flows run", s["h1"]))
    story.append(Paragraph("Public listing → website &amp; booth", s["h2"]))

    flow_boxes = [
        (15, 55, 85, 40, "Publish", "staff action", CHARCOAL, CHARCOAL),
        (120, 55, 105, 40, "event_listings", "projection view", colors.HexColor("#eef3f0"), OK),
        (250, 95, 100, 32, "JSON API", "", WHITE, LINE),
        (250, 55, 100, 32, "/embed/events", "", WHITE, LINE),
        (250, 15, 100, 32, "/overlay", "", WHITE, LINE),
        (380, 95, 100, 32, "WordPress", "", colors.HexColor("#f6e4dc"), ACCENT),
        (380, 55, 100, 32, "Partners / apps", "", colors.HexColor("#f6e4dc"), ACCENT),
        (380, 15, 100, 32, "OBS Browser", "", colors.HexColor("#f6e4dc"), ACCENT),
        (510, 45, 110, 50, "/api/.../now", "LED auto mode", WHITE, BLUE),
    ]
    flow_edges = [
        (100, 75, 120, 75, MUTED),
        (225, 75, 250, 75, MUTED),
        (350, 110, 380, 110, MUTED),
        (350, 70, 380, 70, MUTED),
        (350, 30, 380, 30, MUTED),
        (480, 70, 510, 70, BLUE),
    ]
    story.append(ERDiagram("Publish fan-out", flow_boxes, flow_edges, height=1.55 * inch))
    story.append(Paragraph("Figure 5 — Publishing fans out through views to embed, API, overlay, and LED automation", s["caption"]))

    story.append(Paragraph("Ticketing purchase path", s["h2"]))
    steps = Table(
        [
            [
                BoxCard("1 · Browse", ["/tickets/[eventId] loads", "catalog + table map"], 1.7 * inch, ACCENT, 55),
                BoxCard("2 · Hold", ["POST hold locks GA / tables", "for ~10 minutes"], 1.7 * inch, BLUE, 55),
                BoxCard("3 · Checkout", ["Guest details + mock pay", "→ order + QR tickets"], 1.7 * inch, OK, 55),
                BoxCard("4 · Door", ["/t/[token] QR pass;", "staff check-in scans"], 1.7 * inch, ACCENT, 55),
            ]
        ],
        colWidths=[1.8 * inch] * 4,
    )
    story.append(steps)
    story.append(Spacer(1, 6))
    story.append(Paragraph("Vertical screens loop", s["h2"]))
    steps2 = Table(
        [
            [
                BoxCard("1 · Upload", ["Manager uploads stills/", "video to screen-ads"], 1.7 * inch, BLUE, 55),
                BoxCard("2 · Playlist", ["Kiosk polls", "/screens/vertical"], 1.7 * inch, ACCENT, 55),
                BoxCard("3 · Render", ["/display/vertical", "contain-fits 1080×1920"], 1.7 * inch, OK, 55),
                BoxCard("4 · Takeover", ["Timed override reloads", "players within seconds"], 1.7 * inch, BLUE, 55),
            ]
        ],
        colWidths=[1.8 * inch] * 4,
    )
    story.append(steps2)
    story.append(Spacer(1, 8))
    note2 = Table(
        [
            [
                Paragraph(
                    "Table inventory uses conditional updates (<font face='Courier' size='7'>UPDATE … WHERE status = 'available'</font>) "
                    "so two buyers cannot claim the same table. Enabling Ticketing copies the FloBama main-room layout onto that show only.",
                    s["small"],
                )
            ]
        ],
        colWidths=[7.1 * inch],
    )
    note2.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fff8f4")),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LINEBEFORE", (0, 0), (0, -1), 3, ACCENT),
            ]
        )
    )
    story.append(note2)

    # -------- Summary --------
    story.append(PageBreak())
    story.append(Paragraph("SUMMARY", s["tag"]))
    story.append(Paragraph("V1 at a glance", s["h1"]))
    story.append(
        Paragraph(
            "One staff OS for FloBama Music Hall — calendar through door scan — with a clean public edge.",
            s["lede"],
        )
    )
    summary = Table(
        [
            [
                [
                    Paragraph("Shipped in V1", s["h3"]),
                    bullets(
                        [
                            "Role-based staff OS (admin / manager / viewer)",
                            "Events + artists with sheet sync",
                            "Public API, embed, OBS overlay",
                            "LED wall + vertical screens + flyer/social exports",
                            "Native ticketing with QR door check-in",
                            "GHL booking inbox + OpenAI fit notes",
                            "GHL Social Planner for weekly posts",
                        ],
                        s,
                    ),
                ],
                [
                    Paragraph("Explicitly out of scope", s["h3"]),
                    bullets(
                        [
                            "Editing flobamadowntown.com or Pick'em",
                            "SpotOn / sales reporting",
                            "Inventory, payroll, multi-venue UI",
                            "Recurring events, per-TV playlists",
                            "Public self-registration",
                            "Live Stripe charges (mock until wired)",
                        ],
                        s,
                    ),
                ],
            ]
        ],
        colWidths=[3.5 * inch, 3.5 * inch],
    )
    story.append(summary)
    story.append(Paragraph("Useful URLs", s["h2"]))
    story.append(
        make_table(
            ["Surface", "Path"],
            [
                ["Production app", "https://flobama-os.vercel.app"],
                ["Events embed", "/embed/events"],
                ["OBS overlay", "/overlay"],
                ["Vertical TV", "/display/vertical"],
                ["Weekly flyer", "/print/week"],
                ["Public tickets", "/tickets/[eventId]"],
                ["Ticket pass", "/t/[token]"],
            ],
            [2.2 * inch, 4.9 * inch],
        )
    )
    story.append(Spacer(1, 12))
    closing = Table(
        [
            [
                Paragraph(
                    "<font color='#ffffff'><b>FloBama OS V1</b></font><br/>"
                    "<font color='#e8ddd4' size='8'>Internal operations for FloBama Music Hall · "
                    "Document generated from the product codebase · Accent #d36b4a</font>",
                    s["hero_body"],
                )
            ]
        ],
        colWidths=[7.1 * inch],
    )
    closing.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), CHARCOAL),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )
    story.append(closing)

    doc.build(story, canvasmaker=NumberedFooterCanvas)
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    build()
