"""
Capability-tolerant wrapper around Anthropic `messages.parse`.

Adaptive thinking improves quality on the big models but 400s on models that
don't support it (found live 2026-07-02: ADVISOR_MODEL=claude-haiku-4-5 made
every lecture request fail with "adaptive thinking is not supported on this
model"). Rather than maintain a model→capability table that will drift, prefer
thinking and retry ONCE without it when the API says the model can't do it.
Any other error propagates untouched.
"""

import logging

logger = logging.getLogger("growpodempire.anthropic")


def parse_preferring_thinking(messages_api, **kwargs):
    """`messages_api.parse(...)` with adaptive thinking when the model supports
    it, transparently retrying without `thinking` when it doesn't."""
    try:
        return messages_api.parse(thinking={"type": "adaptive"}, **kwargs)
    except Exception as exc:
        msg = str(exc).lower()
        if "thinking" in msg and "not supported" in msg:
            logger.info(
                "model %s does not support adaptive thinking — retrying without",
                kwargs.get("model"),
            )
            return messages_api.parse(**kwargs)
        raise
