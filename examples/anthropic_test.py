from anthropic import Anthropic
import os
import tokescope

tokescope.init(
    api_key="test",
    endpoint="http://localhost:8000/ingest",
    capture_content=False,
    providers=["anthropic"]
)


client = Anthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY")
)

if not os.getenv("ANTHROPIC_API_KEY"):
    print("Error: ANTHROPIC_API_KEY environment variable not set")
    exit(1)

resp = client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=100,
    messages=[
        {"role": "user", "content": "Explain the diff between CDF and PDF in stats."}
    ],
)

print(resp.content)
tokescope.flush()
