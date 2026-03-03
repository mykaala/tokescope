from __future__ import annotations
from typing import List


def get_patchers() -> List[object]:
    patchers = []

    try:
        from .openai import OpenAIChatCompletionsPatcher
        patchers.append(OpenAIChatCompletionsPatcher())
    except Exception:
        pass

    try:
        from .anthropic import AnthropicMessagesPatcher
        patchers.append(AnthropicMessagesPatcher())
    except Exception:
        pass

    try:
        from .ollama import OllamaPatcher
        patchers.append(OllamaPatcher())
    except Exception:
        pass

    return patchers
