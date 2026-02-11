from __future__ import annotations

from typing import List, Literal
from pydantic import BaseModel


class ParagraphBlock(BaseModel):
    type: Literal["paragraph"]
    text: str


class BulletsBlock(BaseModel):
    type: Literal["bullets"]
    items: List[str]


Block = ParagraphBlock | BulletsBlock