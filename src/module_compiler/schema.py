from __future__ import annotations

from typing import List, Optional, Literal
from pydantic import BaseModel, Field


# -------------------------
# Quiz models
# -------------------------

class QuizOption(BaseModel):
    id: str
    text: str


class QuizQuestion(BaseModel):
    id: str
    prompt: str
    options: List[QuizOption]
    correct_option_id: str
    explanation: Optional[str] = None


# -------------------------
# Slide models
# -------------------------

SlideType = Literal[
    "panel",
    "engage_list",
    "engage_button",
    "quiz_mcq"
]


class Slide(BaseModel):
    id: str
    type: SlideType
    locked: bool = True

    header: Optional[str] = None

    # Panel content
    body: Optional[List[str]] = None

    # Engage content
    items: Optional[List[str]] = None

    # Quiz content
    questions: Optional[List[QuizQuestion]] = None


# -------------------------
# Module root
# -------------------------

class Module(BaseModel):
    module_id: str
    version: str = Field(default="1.0")
    slides: List[Slide]
