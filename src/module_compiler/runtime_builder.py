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
    print("🚨 USING UPDATED blocks_to_strings")
    output = []

    for block in blocks:
        if block.type == "paragraph":
            output.append({
                "type": "paragraph",
                "text": block.text
            })
        elif block.type == "bullets":
            output.append({
                "type": "bullets",
                "items": block.items
            })

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
            combined_text = blocks_to_strings(item.body)

            items.append(
                Engage1Item(
                    label=item.label,
                    text=combined_text,
                    image=item.image,
                )
            )

        intro_text = ""
        if raw.engage1_intro:
            intro_text = blocks_to_strings(raw.engage1_intro)

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
        slides = []

        for q in raw.quiz_questions or []:
            options = [
                QuizOption(id=o.id, text=o.text)
                for o in (q.options or [])
            ]

            question = QuizQuestion(
                prompt=q.prompt,
                options=options,
                correct_option_id=q.correct_option_id,
                explanation=q.explanation,
            )

            slides.append(
                QuizSlide(
                    type="quiz",
                    quiz_scope=raw.quiz_scope or "inline",
                    quiz_type=raw.quiz_type or "mcq",
                    questions=[question],   # ← ONE QUESTION ONLY
                )
            )

        return slides

    raise ValueError(f"Unknown slide type: {raw.slide_type}")


# --------------------------------------------------
# Module Conversion
# --------------------------------------------------

def build_module(module_id: str, raw_slides: List[RawSlide]) -> Module:
    slides = []

    for s in raw_slides:
        converted = convert_slide(s)

        if isinstance(converted, list):
            slides.extend(converted)
        else:
            slides.append(converted)

    return Module(
        module_id=module_id,
        slides=slides,
    )
