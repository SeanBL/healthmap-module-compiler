from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from docx import Document
from docx.oxml.ns import qn
from docx.document import Document as _Document
from docx.table import Table
from docx.text.paragraph import Paragraph

from ..models.blocks import ParagraphBlock, BulletsBlock, Block
from ..models.raw_models import (
    RawSlide,
    RawEngage1Item,
    RawQuizQuestion,
    RawQuizOption,
)

# --------------------------------------------------
# Utilities
# --------------------------------------------------
def iter_block_items(parent):
    """
    Yield paragraphs and tables in document order.
    """
    if isinstance(parent, _Document):
        parent_elm = parent.element.body
    else:
        parent_elm = parent._tc

    for child in parent_elm.iterchildren():
        if child.tag.endswith('}p'):
            yield Paragraph(child, parent)
        elif child.tag.endswith('}tbl'):
            yield Table(child, parent)


def normalize(text: str) -> str:
    if not text:
        return ""
    return " ".join(text.replace("\u00A0", " ").split()).strip()


def is_list_paragraph(p) -> bool:
    pPr = p._p.pPr
    if pPr is None:
        return False
    return pPr.find(qn("w:numPr")) is not None


def canonical_col_label(raw: str) -> str:
    t = normalize(raw).lower()
    if "/" in t:
        t = t.split("/", 1)[0].strip()

    if t.startswith("notes and instructions"):
        return "notes"
    if t.startswith("english text"):
        return "english"
    if t.startswith("image"):
        return "image"
    if t.startswith("button labels"):
        return "button_labels"

    return t


def is_slide_header(text: str) -> bool:
    t = text.lower()
    return (
        t.startswith("header:")
        or t.startswith("slide header")
        or t.startswith("slide (header)")
    )

def is_quiz_marker(text: str) -> bool:
    t = normalize(text).lower()
    return (
        t.startswith("quiz_")
        and (
            t.endswith("_inline")
            or t.endswith("_application")
            or t.endswith("_final")
        )
    )

def extract_quiz_scope(marker: str) -> str:
    t = normalize(marker).lower()

    if t.endswith("_final"):
        return "final"

    if t.endswith("_application"):
        return "application"

    return "inline"

# --------------------------------------------------
# Structural Extraction
# --------------------------------------------------

def extract_raw_slides(docx_path: Path) -> List[RawSlide]:
    doc = Document(str(docx_path))

    slides: List[RawSlide] = []
    slide_index = 0

    current_slide: Optional[RawSlide] = None
    col_labels: List[str] = []

    engage1_items: List[RawEngage1Item] = []
    pending_button_labels: List[str] = []

    quiz_questions: List[RawQuizQuestion] = []
    quiz_inline_mode = False
    quiz_inline_questions: List[RawQuizQuestion] = []

    for block in iter_block_items(doc):

        # -----------------------------
        # Paragraph blocks (markers)
        # -----------------------------
        if isinstance(block, Paragraph):
            text = normalize(block.text)

            print("PARAGRAPH:", repr(text))

            if is_quiz_marker(text):
                print("QUIZ MARKER DETECTED:", text)

                # Properly finalize previous slide first
                if current_slide is not None:

                    if current_slide.slide_type == "quiz":
                        current_slide.quiz_questions = quiz_questions
                        current_slide.quiz_type = "mcq"
                        quiz_questions = []

                    slides.append(current_slide)

                slide_index += 1

                scope = extract_quiz_scope(text)

                current_slide = RawSlide(
                    slide_id=f"slide_{slide_index:03d}",
                    header=text,
                    slide_type="quiz",
                )

                current_slide.quiz_scope = scope

                quiz_questions = []
                quiz_inline_mode = True
                continue
            continue

        # -----------------------------
        # Table blocks (real content)
        # -----------------------------
        if not isinstance(block, Table):
            continue

        tbl = block

        if len(tbl.rows) < 2:
            continue

        row_idx = 0

        while row_idx < len(tbl.rows):
            row = tbl.rows[row_idx]
            first_cell = normalize(row.cells[0].text)

            # -----------------------------
            # Start new slide
            # -----------------------------
            if is_slide_header(first_cell):

                # finalize previous slide
                if current_slide is not None:

                    if current_slide.slide_type == "engage1":

                        if not pending_button_labels:
                            raise ValueError(
                                f"Engage1 slide {current_slide.slide_id} has no buttons"
                            )

                        if not current_slide.body:
                            raise ValueError(
                                f"Engage1 slide {current_slide.slide_id} has no content paragraphs"
                            )

                        paragraphs = current_slide.body

                        # First paragraph becomes intro
                        intro = paragraphs[0]
                        content_paragraphs = paragraphs[1:]

                        if len(content_paragraphs) != len(pending_button_labels):
                            raise ValueError(
                                f"Engage1 slide {current_slide.slide_id} paragraph/button mismatch"
                            )

                        engage1_items = []

                        for label, paragraph in zip(pending_button_labels, content_paragraphs):
                            engage1_items.append(
                                RawEngage1Item(
                                    label=label,
                                    body=[paragraph],
                                    image=getattr(paragraph, "image", None),
                                )
                            )

                        current_slide.engage1_items = engage1_items
                        current_slide.engage1_intro = [intro]
                        current_slide.engage1_intro_image = getattr(intro, "image", None)
                        current_slide.body = None

                    if current_slide.slide_type == "engage2":

                        if not current_slide.body:
                            raise ValueError(
                                f"Engage2 slide {current_slide.slide_id} has no content paragraphs"
                            )

                        paragraphs = current_slide.body
                        intro_blocks = [paragraphs[0]]
                        layer_blocks = paragraphs[1:]

                        if not layer_blocks:
                            raise ValueError(
                                f"Engage2 slide {current_slide.slide_id} must have at least one reveal layer"
                            )

                        current_slide.engage2_intro = intro_blocks
                        current_slide.engage2_intro_image = getattr(intro_blocks[0], "image", None)
                        current_slide.engage2_layers = layer_blocks
                        current_slide.body = None

                    if current_slide.slide_type == "quiz":
                        current_slide.quiz_questions = quiz_questions
                        current_slide.quiz_type = "mcq"
                        quiz_questions = []

                    slides.append(current_slide)

                    # attach inline quiz slide
                    if quiz_inline_questions:
                        slide_index += 1
                        quiz_slide = RawSlide(
                            slide_id=f"slide_{slide_index:03d}",
                            header=f"{current_slide.header} (Quiz)",
                            slide_type="quiz",
                        )
                        quiz_slide.quiz_questions = quiz_inline_questions
                        quiz_slide.quiz_type = "mcq"
                        slides.append(quiz_slide)

                        quiz_inline_questions = []
                        quiz_inline_mode = False

                slide_index += 1
                engage1_items = []
                pending_button_labels = []

                current_slide = RawSlide(
                    slide_id=f"slide_{slide_index:03d}",
                    header=first_cell,
                    slide_type="panel",
                )

                label_row = tbl.rows[row_idx + 1]
                col_labels = [
                    canonical_col_label(c.text) for c in label_row.cells
                ]

                row_idx += 2
                continue

            if current_slide is None:
                row_idx += 1
                continue

            # -----------------------------
            # INLINE QUIZ PARSING
            # -----------------------------
            if quiz_inline_mode:

                if not first_cell:
                    row_idx += 1
                    continue

                if len(row.cells) < 2:
                    row_idx += 1
                    continue

                q_lines = [
                    l.strip()
                    for l in row.cells[0].text.splitlines()
                    if l.strip()
                ]

                prompt_lines = []
                options: List[RawQuizOption] = []

                for line in q_lines:
                    if len(line) > 2 and line[1] == "." and line[0].isalpha():
                        options.append(
                            RawQuizOption(
                                id=line[0].upper(),
                                text=line[2:].strip(),
                            )
                        )
                    else:
                        prompt_lines.append(line)

                prompt = " ".join(prompt_lines).strip()

                a_lines = [
                    l.strip()
                    for l in row.cells[1].text.splitlines()
                    if l.strip()
                ]

                correct_option_id = None
                explanation_lines = []

                for line in a_lines:
                    if line.lower().startswith("answer"):
                        parts = line.split(":")
                        if len(parts) == 2:
                            correct_option_id = parts[1].strip()
                    else:
                        explanation_lines.append(line)

                if correct_option_id:

                    # ----------------------------------------
                    # TRUE / FALSE AUTO-CONVERSION PATCH
                    # ----------------------------------------
                    if not options and correct_option_id.lower() in ("true", "false"):

                        options = [
                            RawQuizOption(id="A", text="True"),
                            RawQuizOption(id="B", text="False"),
                        ]

                        correct_option_id = (
                            "A" if correct_option_id.lower() == "true" else "B"
                        )

                    quiz_questions.append(
                        RawQuizQuestion(
                            prompt=prompt,
                            options=options,
                            correct_option_id=correct_option_id,
                            explanation=" ".join(explanation_lines).strip()
                            if explanation_lines
                            else None,
                        )
                    )

                row_idx += 1
                continue

            # -----------------------------
            # Normal row parsing
            # -----------------------------
            row_data = {}

            for idx, cell in enumerate(row.cells):
                if idx >= len(col_labels):
                    continue
                label = col_labels[idx]
                if not label:
                    continue
                texts = [
                    normalize(p.text)
                    for p in cell.paragraphs
                    if normalize(p.text)
                ]
                if texts:
                    row_data[label] = texts

            notes = row_data.get("notes", [])
            english = row_data.get("english", [])
            image = row_data.get("image", [])

            if notes:
                blob = " ".join(n.lower() for n in notes)

                if "slide type = quiz" in blob:
                    current_slide.slide_type = "quiz"
                elif "slide type = engage 1" in blob:
                    current_slide.slide_type = "engage1"
                elif "slide type = engage 2" in blob:
                    current_slide.slide_type = "engage2"

            # -----------------------------
            # ENGAGE1 PARSING (Correct Layout Handling)
            # -----------------------------
            if current_slide.slide_type == "engage1":

                # If this row contains button definitions
                if english and any(line.lower().startswith("[button]") for line in english):

                    for line in english:
                        if line.lower().startswith("[button]"):
                            label = line[8:].strip()
                            pending_button_labels.append(label)

                # Otherwise collect content paragraphs at slide level
                elif english:
                    blocks = current_slide.body or []

                    for line in english:
                        blocks.append(
                            ParagraphBlock(
                                type="paragraph",
                                text=line,
                                image=image[0] if image else None
                            )
                        )

                    current_slide.body = blocks

            # -----------------------------
            # ENGAGE2 PARSING
            # -----------------------------
            if current_slide.slide_type == "engage2" and english:

                blocks = current_slide.body or []

                for line in english:

                    cleaned = line.strip()

                    # 🔹 Filter control artifacts like "[Button] Next"
                    if cleaned.lower().startswith("[button]"):
                        button_label = cleaned[8:].strip()
                        current_slide.engage2_button_label = button_label
                        continue

                    blocks.append(
                        ParagraphBlock(
                            type="paragraph",
                            text=cleaned,
                            image=image[0] if image else None
                        )
                    )

                current_slide.body = blocks


            if current_slide.slide_type == "panel" and english:
                blocks = current_slide.body or []
                for line in english:
                    blocks.append(
                        ParagraphBlock(type="paragraph", text=line)
                    )
                current_slide.body = blocks

            if image:
                image_filename = image[0]

                if current_slide.slide_type == "panel":
                    current_slide.image = image_filename

            row_idx += 1

        # ✅ after finishing this table
        if quiz_inline_mode:
            quiz_inline_mode = False

    # finalize last slide
    if current_slide is not None:

        if current_slide.slide_type == "engage2":

            if not current_slide.body:
                raise ValueError(
                    f"Engage2 slide {current_slide.slide_id} has no content paragraphs"
                )

            paragraphs = current_slide.body
            intro_blocks = [paragraphs[0]]
            layer_blocks = paragraphs[1:]

            if not layer_blocks:
                raise ValueError(
                    f"Engage2 slide {current_slide.slide_id} must have at least one reveal layer"
                )

            current_slide.engage2_intro = intro_blocks
            current_slide.engage2_intro_image = getattr(intro_blocks[0], "image", None)
            current_slide.engage2_layers = layer_blocks
            current_slide.body = None

        if current_slide.slide_type == "quiz":
            current_slide.quiz_questions = quiz_questions
            current_slide.quiz_type = "mcq"

        slides.append(current_slide)

    return slides

    
