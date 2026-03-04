from __future__ import annotations

from typing import List

from .models.raw_models import RawSlide
from .models.schema import (
    Module,
    PanelSlide,
    Engage1Slide,
    Engage1Item,
    Engage2Slide,
    QuizSlide,
    QuizQuestion,
    QuizOption,
    Engage2Layer,
)


# --------------------------------------------------
# Block Conversion
# --------------------------------------------------

def blocks_to_strings(blocks):
    """
    Convert ParagraphBlock / BulletsBlock into plain text strings.
    Bullets are joined into a single newline-separated string.
    """
    output = []

    for block in blocks:
        if block.type == "paragraph":
            output.append(block.text)
        elif block.type == "bullets":
            bullet_text = "\n".join(f"- {item}" for item in block.items)
            output.append(bullet_text)

    return output


# --------------------------------------------------
# Slide Conversion
# --------------------------------------------------

def convert_slide(raw: RawSlide):
    if raw.slide_type == "panel":
        return PanelSlide(
            type="panel",
            header=raw.header,
            body=blocks_to_strings(raw.body or []),
            image=raw.image,
        )

    if raw.slide_type == "engage1":
        items = []

        for item in raw.engage1_items or []:
            text_blocks = blocks_to_strings(item.body)
            combined_text = "\n".join(text_blocks)

            items.append(
                Engage1Item(
                    label=item.label,
                    text=combined_text,
                    image=item.image,
                )
            )

        intro_text = ""
        if raw.engage1_intro:
            intro_blocks = blocks_to_strings(raw.engage1_intro)
            intro_text = "\n".join(intro_blocks)

        return Engage1Slide(
            type="engage_1",
            header=raw.header,
            intro=intro_text,
            intro_image=raw.engage1_intro_image,
            items=items,
        )

    if raw.slide_type == "engage2":

        intro_text = ""
        intro_image = raw.engage2_intro_image

        if raw.engage2_intro:
            intro_blocks = blocks_to_strings(raw.engage2_intro)
            intro_text = "\n".join(intro_blocks)

        layers = []

        for block in raw.engage2_layers or []:
            layers.append(
                Engage2Layer(
                    text=block.text,
                    image=block.image,
                )
            )

        return Engage2Slide(
            type="engage_2",
            header=raw.header,
            intro=intro_text,
            intro_image=intro_image,
            layers=layers,
            button_label=raw.engage2_button_label or "Continue",
        )

    if raw.slide_type == "quiz":
        questions = []

        for q in raw.quiz_questions or []:
            options = [
                QuizOption(id=o.id, text=o.text)
                for o in (q.options or [])
            ]

            questions.append(
                QuizQuestion(
                    prompt=q.prompt,
                    options=options,
                    correct_option_id=q.correct_option_id,
                    explanation=q.explanation,
                )
            )

        return QuizSlide(
            type="quiz",
            quiz_scope=raw.quiz_scope or "inline",
            quiz_type=raw.quiz_type or "mcq",
            questions=questions,
        )

    raise ValueError(f"Unknown slide type: {raw.slide_type}")


# --------------------------------------------------
# Module Conversion
# --------------------------------------------------

def build_module(module_id: str, raw_slides: List[RawSlide]) -> Module:
    slides = [convert_slide(s) for s in raw_slides]

    return Module(
        module_id=module_id,
        slides=slides,
    )
